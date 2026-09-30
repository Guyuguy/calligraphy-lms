import { Hono } from "hono";
import {
	assignments,
	courses,
	notifications,
	parentProfiles,
	payments,
	schedules,
	submissions,
	users,
} from "../db";
import { getStudentSummary } from "./progress";
import { requireAuth } from "./users";

export const dashboardRouter = new Hono();

// ============================================================
// 工具
// ============================================================

function todayWeekday(): number {
	// JS getDay: 0=Sun..6=Sat. 项目约定 1=Mon..7=Sun.
	const d = new Date().getDay();
	return d === 0 ? 7 : d;
}

function todayDateStr(): string {
	return new Date().toISOString().slice(0, 10);
}

function isDateInRange(dateStr: string, start: string, end: string): boolean {
	return dateStr >= start && dateStr <= end;
}

// ============================================================
// GET /student-todos — 学生今日待办
// ============================================================

dashboardRouter.get("/student-todos", (c) => {
	const parsed = requireAuth(c);
	if (!parsed) return c.json({ error: "unauthorized", message: "未登录" }, 401);
	if (parsed.role !== "student")
		return c.json({ error: "forbidden", message: "仅学生可调用" }, 403);

	const studentId = parsed.userId;
	const today = todayDateStr();
	const weekday = todayWeekday();
	const now = Date.now();

	// 1. 今日课程
	const todayClasses = Array.from(schedules.values())
		.filter(
			(s) =>
				s.studentIds.includes(studentId) &&
				s.weekday === weekday &&
				isDateInRange(today, s.startDate, s.endDate),
		)
		.sort((a, b) => a.startHour - b.startHour)
		.map((s) => {
			const course = courses.get(s.courseId);
			const teacher = users.get(s.teacherId);
			return {
				id: s.id,
				courseId: s.courseId,
				courseTitle: course?.title ?? "未知课程",
				teacherName: teacher?.name ?? "未知教师",
				startHour: s.startHour,
				endHour: s.endHour,
				mode: s.mode,
			};
		});

	// 2. 即将到期作业 (未来 7 天, 未提交)
	const summary = getStudentSummary(studentId);
	const enrolledCourseIds = new Set(
		(summary?.courses ?? []).map((c) => c.courseId),
	);

	const upcomingAssignments = Array.from(assignments.values())
		.filter((a) => enrolledCourseIds.has(a.courseId))
		.filter((a) => {
			const dueMs = new Date(a.dueAt).getTime();
			return dueMs >= now && dueMs <= now + 7 * 86400000;
		})
		.filter(
			(a) =>
				!Array.from(submissions.values()).some(
					(s) => s.assignmentId === a.id && s.studentId === studentId,
				),
		)
		.sort((a, b) => a.dueAt.localeCompare(b.dueAt))
		.slice(0, 5)
		.map((a) => ({
			id: a.id,
			courseId: a.courseId,
			courseTitle: courses.get(a.courseId)?.title ?? "",
			title: a.title,
			dueAt: a.dueAt,
		}));

	// 3. 推荐下一学习单元 (取报名课程中第一门未完成的下一个未学单元)
	const nextUnit = (() => {
		for (const c of summary?.courses ?? []) {
			const course = courses.get(c.courseId);
			if (!course) continue;
			if (c.status === "completed") continue;
			const allUnits = course.modules.flatMap((m) => m.units);
			const sorted = [...allUnits].sort((a, b) => a.order - b.order);
			const first = sorted[0];
			if (first) {
				return {
					courseId: c.courseId,
					courseTitle: c.courseTitle,
					unitId: first.id,
					unitTitle: first.title,
					percent: c.percent,
				};
			}
		}
		return null;
	})();

	return c.json({
		studentId,
		todayClasses,
		upcomingAssignments,
		nextUnit,
		enrolledCourseCount: summary?.courses.length ?? 0,
		streakDays: summary?.summary.streakDays ?? 0,
	});
});

// ============================================================
// GET /teacher-todos — 教师今日待办
// ============================================================

dashboardRouter.get("/teacher-todos", (c) => {
	const parsed = requireAuth(c);
	if (!parsed) return c.json({ error: "unauthorized", message: "未登录" }, 401);
	if (parsed.role !== "teacher")
		return c.json({ error: "forbidden", message: "仅教师可调用" }, 403);

	const teacherId = parsed.userId;
	const today = todayDateStr();
	const weekday = todayWeekday();

	// 1. 今日课程
	const todayClasses = Array.from(schedules.values())
		.filter(
			(s) =>
				s.teacherId === teacherId &&
				s.weekday === weekday &&
				isDateInRange(today, s.startDate, s.endDate),
		)
		.sort((a, b) => a.startHour - b.startHour)
		.map((s) => {
			const course = courses.get(s.courseId);
			return {
				id: s.id,
				courseId: s.courseId,
				courseTitle: course?.title ?? "未知课程",
				startHour: s.startHour,
				endHour: s.endHour,
				mode: s.mode,
				studentCount: s.studentIds.length,
			};
		});

	// 2. 待批改作业 (取最新 5 条)
	const myCourseIds = new Set(
		Array.from(courses.values())
			.filter((c) => c.teacherId === teacherId)
			.map((c) => c.id),
	);
	const myAssignmentIds = new Set(
		Array.from(assignments.values())
			.filter((a) => myCourseIds.has(a.courseId))
			.map((a) => a.id),
	);
	const allPending = Array.from(submissions.values()).filter(
		(s) => myAssignmentIds.has(s.assignmentId) && s.score === null,
	);
	const pendingReviews = [...allPending]
		.sort((a, b) => b.submittedAt.localeCompare(a.submittedAt))
		.slice(0, 5)
		.map((s) => {
			const asg = assignments.get(s.assignmentId);
			const course = asg ? courses.get(asg.courseId) : undefined;
			const student = users.get(s.studentId);
			return {
				id: s.id,
				assignmentTitle: asg?.title ?? "",
				courseTitle: course?.title ?? "",
				studentName: student?.name ?? "",
				submittedAt: s.submittedAt,
			};
		});

	return c.json({
		teacherId,
		todayClasses,
		pendingReviews,
		pendingReviewsTotal: allPending.length,
	});
});

// ============================================================
// GET /parent-todos — 家长今日待办
// ============================================================

dashboardRouter.get("/parent-todos", (c) => {
	const parsed = requireAuth(c);
	if (!parsed) return c.json({ error: "unauthorized", message: "未登录" }, 401);
	if (parsed.role !== "parent")
		return c.json({ error: "forbidden", message: "仅家长可调用" }, 403);

	const parentId = parsed.userId;
	const pp = parentProfiles.get(parentId);
	if (!pp)
		return c.json({ error: "not_found", message: "家长档案不存在" }, 404);

	const today = todayDateStr();
	const weekday = todayWeekday();
	const now = Date.now();

	const children = pp.childIds.map((cid) => {
		const childUser = users.get(cid);
		const summary = getStudentSummary(cid);
		const enrolledCourseIds = new Set(
			(summary?.courses ?? []).map((c) => c.courseId),
		);

		// 今日课程
		const todayClasses = Array.from(schedules.values())
			.filter(
				(s) =>
					s.studentIds.includes(cid) &&
					s.weekday === weekday &&
					isDateInRange(today, s.startDate, s.endDate),
			)
			.sort((a, b) => a.startHour - b.startHour)
			.map((s) => ({
				id: s.id,
				courseTitle: courses.get(s.courseId)?.title ?? "",
				startHour: s.startHour,
				endHour: s.endHour,
			}));

		// 待交作业 (未来 7 天)
		const upcomingAssignments = Array.from(assignments.values())
			.filter((a) => enrolledCourseIds.has(a.courseId))
			.filter((a) => {
				const dueMs = new Date(a.dueAt).getTime();
				return dueMs >= now && dueMs <= now + 7 * 86400000;
			})
			.filter(
				(a) =>
					!Array.from(submissions.values()).some(
						(s) => s.assignmentId === a.id && s.studentId === cid,
					),
			)
			.slice(0, 3)
			.map((a) => ({
				id: a.id,
				title: a.title,
				courseTitle: courses.get(a.courseId)?.title ?? "",
				dueAt: a.dueAt,
			}));

		return {
			childId: cid,
			childName: childUser?.name ?? "",
			todayClasses,
			upcomingAssignments,
			summary: summary?.summary ?? null,
		};
	});

	// 待缴账单
	const pendingPayments = Array.from(payments.values())
		.filter((p) => p.parentId === parentId && p.status !== "paid")
		.sort((a, b) => a.dueAt.localeCompare(b.dueAt))
		.slice(0, 5)
		.map((p) => ({
			id: p.id,
			title: p.title,
			amount: p.amount,
			dueAt: p.dueAt,
			status: p.status,
		}));

	return c.json({
		parentId,
		children,
		pendingPayments,
	});
});

// ============================================================
// GET /admin-todos — 管理员/教务今日待办 (未读通知汇总)
// ============================================================

dashboardRouter.get("/admin-todos", (c) => {
	const parsed = requireAuth(c);
	if (!parsed) return c.json({ error: "unauthorized", message: "未登录" }, 401);
	if (parsed.role !== "admin" && parsed.role !== "academic_head")
		return c.json({ error: "forbidden", message: "仅管理员可调用" }, 403);

	const totalStudents = Array.from(users.values()).filter(
		(u) => u.role === "student",
	).length;
	const totalTeachers = Array.from(users.values()).filter(
		(u) => u.role === "teacher",
	).length;
	const totalCourses = courses.size;

	const unread = Array.from(notifications.values())
		.filter((n) => n.userId === parsed.userId && !n.read)
		.sort((a, b) => b.createdAt.localeCompare(a.createdAt))
		.slice(0, 5)
		.map((n) => ({
			id: n.id,
			type: n.type,
			title: n.title,
			body: n.body,
			createdAt: n.createdAt,
		}));

	return c.json({
		adminId: parsed.userId,
		systemOverview: {
			totalStudents,
			totalTeachers,
			totalCourses,
		},
		unreadNotifications: unread,
	});
});
