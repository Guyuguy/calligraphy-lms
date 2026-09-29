import { Hono } from "hono";
import {
	assignments,
	courses,
	practiceDays,
	progress,
	skillRadarSnapshots,
	studentProfiles,
	submissions,
	users,
} from "../db";
import type { ClassStudentProgress, Progress, ProgressStatus } from "../types";
import { requireAuth, requireRoles } from "./users";

export const progressRouter = new Hono();

// ============================================================
// 工具函数
// ============================================================

export function getCourseProgress(studentId: string, courseId: string) {
	const course = courses.get(courseId);
	if (!course) return null;
	const allUnits = course.modules.flatMap((m) => m.units);
	const records: Progress[] = [];
	for (const u of allUnits) {
		const p = progress.get(`${studentId}:${u.id}`);
		if (p) records.push(p);
	}
	const total = allUnits.length;
	const completed = records.filter(
		(r) => r.status === "completed" || r.status === "mastered",
	).length;
	const inProgress = records.filter((r) => r.status === "in_progress").length;
	const notStarted = total - completed - inProgress;
	const avgPercent =
		total > 0
			? Math.round(records.reduce((sum, r) => sum + r.percent, 0) / total)
			: 0;
	const lastActivityAt =
		records
			.map((r) => r.lastActivityAt)
			.sort()
			.reverse()[0] ?? "";
	return {
		courseId,
		courseTitle: course.title,
		stage: course.stage,
		level: course.level,
		style: course.style,
		cover: course.cover,
		teacherName: users.get(course.teacherId)?.name ?? "未知教师",
		unitsTotal: total,
		unitsCompleted: completed,
		unitsInProgress: inProgress,
		unitsNotStarted: notStarted,
		percent: avgPercent,
		lastActivityAt,
		status: deriveStatus(completed, inProgress, total),
	};
}

function deriveStatus(
	completed: number,
	inProgress: number,
	total: number,
): ProgressStatus {
	if (total === 0) return "not_started";
	if (completed === total) return "completed";
	if (completed === 0 && inProgress === 0) return "not_started";
	return "in_progress";
}

// ============================================================
// 学生总进度概览（共享 helper）
// ============================================================

export function getStudentSummary(studentId: string) {
	const profile = studentProfiles.get(studentId);
	if (!profile) return null;

	// 找出该学生有进度的所有课程
	const courseIds = new Set<string>();
	for (const key of progress.keys()) {
		if (key.startsWith(`${studentId}:`)) {
			const p = progress.get(key);
			if (p) courseIds.add(p.courseId);
		}
	}

	const courseProgress = Array.from(courseIds)
		.map((cid) => getCourseProgress(studentId, cid))
		.filter((x): x is NonNullable<typeof x> => x !== null);

	// 总体统计
	const totalUnits = courseProgress.reduce((sum, c) => sum + c.unitsTotal, 0);
	const totalCompleted = courseProgress.reduce(
		(sum, c) => sum + c.unitsCompleted,
		0,
	);
	const overallPercent =
		totalUnits > 0 ? Math.round((totalCompleted / totalUnits) * 100) : 0;

	// 本月练习时长
	const now = new Date();
	const monthPrefix = now.toISOString().slice(0, 7);
	let monthMinutes = 0;
	for (const key of practiceDays.keys()) {
		if (key.startsWith(`${studentId}:`) && key.includes(monthPrefix)) {
			const pd = practiceDays.get(key);
			if (pd) monthMinutes += pd.minutes;
		}
	}

	// 连续打卡天数
	let streak = 0;
	for (let d = 0; d < 365; d++) {
		const date = new Date(now.getTime() - d * 86400000)
			.toISOString()
			.slice(0, 10);
		if (practiceDays.has(`${studentId}:${date}`)) {
			streak++;
		} else if (d > 0) {
			break;
		}
	}

	return {
		studentId,
		profile,
		courses: courseProgress,
		summary: {
			totalCourses: courseProgress.length,
			totalUnits,
			totalCompleted,
			overallPercent,
			monthMinutes,
			streakDays: streak,
			totalPracticeMinutes: profile.totalPracticeMinutes,
		},
	};
}

progressRouter.get("/:studentId", (c) => {
	const parsed = requireAuth(c);
	if (!parsed) return c.json({ error: "unauthorized", message: "未登录" }, 401);

	const studentId = c.req.param("studentId");
	if (!users.has(studentId))
		return c.json({ error: "not_found", message: "学生不存在" }, 404);

	const result = getStudentSummary(studentId);
	if (!result)
		return c.json({ error: "not_found", message: "学生档案不存在" }, 404);

	return c.json(result);
});

// ============================================================
// 单课程进度（含模块/单元明细）
// ============================================================

progressRouter.get("/:studentId/course/:courseId", (c) => {
	const parsed = requireAuth(c);
	if (!parsed) return c.json({ error: "unauthorized", message: "未登录" }, 401);

	const studentId = c.req.param("studentId");
	const courseId = c.req.param("courseId");
	const course = courses.get(courseId);
	if (!course)
		return c.json({ error: "not_found", message: "课程不存在" }, 404);

	const overview = getCourseProgress(studentId, courseId);
	if (!overview)
		return c.json({ error: "not_found", message: "进度不存在" }, 404);

	// 模块明细
	const modules = course.modules.map((m) => {
		const units = m.units.map((u) => {
			const p = progress.get(`${studentId}:${u.id}`);
			return {
				id: u.id,
				title: u.title,
				type: u.type,
				order: u.order,
				durationMinutes: u.durationMinutes,
				status: p?.status ?? "not_started",
				percent: p?.percent ?? 0,
				lastActivityAt: p?.lastActivityAt ?? "",
				videoWatchedSeconds: p?.videoWatchedSeconds ?? 0,
				practiceCount: p?.practiceCount ?? 0,
				submissionCount: p?.submissionCount ?? 0,
				quizScore: p?.quizScore ?? null,
			};
		});
		return {
			id: m.id,
			title: m.title,
			order: m.order,
			units,
		};
	});

	return c.json({ course: overview, modules });
});

// ============================================================
// 打卡热力图（过去 N 天，默认 90）
// ============================================================

progressRouter.get("/:studentId/heatmap", (c) => {
	const parsed = requireAuth(c);
	if (!parsed) return c.json({ error: "unauthorized", message: "未登录" }, 401);

	const studentId = c.req.param("studentId");
	const days = Number(c.req.query("days") ?? 90);
	const today = new Date();
	const heat: Array<{ date: string; minutes: number }> = [];
	for (let d = days - 1; d >= 0; d--) {
		const date = new Date(today.getTime() - d * 86400000)
			.toISOString()
			.slice(0, 10);
		const pd = practiceDays.get(`${studentId}:${date}`);
		heat.push({ date, minutes: pd?.minutes ?? 0 });
	}
	return c.json({ studentId, days, heat });
});

// ============================================================
// 技能雷达（当前 + 历史快照）
// ============================================================

progressRouter.get("/:studentId/skill-radar", (c) => {
	const parsed = requireAuth(c);
	if (!parsed) return c.json({ error: "unauthorized", message: "未登录" }, 401);

	const studentId = c.req.param("studentId");
	const profile = studentProfiles.get(studentId);
	if (!profile)
		return c.json({ error: "not_found", message: "学生档案不存在" }, 404);

	// 历史快照（按时间排序）
	const snapshots = Array.from(skillRadarSnapshots.values())
		.filter((s) => s.studentId === studentId)
		.sort((a, b) => a.timestamp.localeCompare(b.timestamp));

	return c.json({
		studentId,
		current: profile.skillRadar,
		snapshots,
	});
});

// ============================================================
// 学习时长趋势（按日聚合，过去 N 天）
// ============================================================

progressRouter.get("/:studentId/time-trend", (c) => {
	const parsed = requireAuth(c);
	if (!parsed) return c.json({ error: "unauthorized", message: "未登录" }, 401);

	const studentId = c.req.param("studentId");
	const days = Number(c.req.query("days") ?? 30);
	const today = new Date();
	const trend: Array<{ date: string; minutes: number }> = [];
	for (let d = days - 1; d >= 0; d--) {
		const date = new Date(today.getTime() - d * 86400000)
			.toISOString()
			.slice(0, 10);
		const pd = practiceDays.get(`${studentId}:${date}`);
		trend.push({ date, minutes: pd?.minutes ?? 0 });
	}
	return c.json({ studentId, days, trend });
});

// ============================================================
// 班级学生进度（教师/教务/管理员）
// ============================================================

progressRouter.get(
	"/class/:courseId",
	requireRoles("teacher", "academic_head", "admin"),
	(c) => {
		const courseId = c.req.param("courseId");
		const course = courses.get(courseId);
		if (!course)
			return c.json({ error: "not_found", message: "课程不存在" }, 404);

		// 取所有有进度的学生
		const studentIds = new Set<string>();
		for (const key of progress.keys()) {
			if (key.endsWith(`:${courseId}`)) continue;
			const p = progress.get(key);
			if (p && p.courseId === courseId) studentIds.add(p.studentId);
		}

		const now = Date.now();
		const students: ClassStudentProgress[] = [];

		for (const sid of studentIds) {
			const u = users.get(sid);
			const profile = studentProfiles.get(sid);
			if (!u || !profile) continue;

			const cp = getCourseProgress(sid, courseId);
			if (!cp) continue;
			const alerts: string[] = [];

			// 落后预警：连续 7 天未学习
			let inactiveDays = 0;
			for (let d = 0; d < 14; d++) {
				const date = new Date(now - d * 86400000).toISOString().slice(0, 10);
				if (!practiceDays.has(`${sid}:${date}`)) inactiveDays++;
				else break;
			}
			if (inactiveDays >= 7) alerts.push(`连续 ${inactiveDays} 天未学习`);

			// 作业未交预警：找出该课程未提交的作业
			const courseAssignments = Array.from(assignments.values()).filter(
				(a) => a.courseId === courseId,
			);
			let missingSubmissions = 0;
			for (const asg of courseAssignments) {
				const submitted = Array.from(submissions.values()).some(
					(s) => s.assignmentId === asg.id && s.studentId === sid,
				);
				if (!submitted && new Date(asg.dueAt).getTime() < now)
					missingSubmissions++;
			}
			if (missingSubmissions >= 2)
				alerts.push(`${missingSubmissions} 次作业逾期未交`);

			// 测验低分预警
			let lowQuizCount = 0;
			for (const key of progress.keys()) {
				if (!key.startsWith(`${sid}:`)) continue;
				const p = progress.get(key);
				if (
					p &&
					p.courseId === courseId &&
					p.quizScore !== null &&
					p.quizScore < 60
				)
					lowQuizCount++;
			}
			if (lowQuizCount >= 1) alerts.push(`${lowQuizCount} 次测验不及格`);

			students.push({
				student: { ...u, password: "" },
				profile,
				coursePercent: cp.percent,
				unitsCompleted: cp.unitsCompleted,
				unitsTotal: cp.unitsTotal,
				lastActivityAt: cp.lastActivityAt,
				alerts,
			});
		}

		// 按进度升序，落后学生排在前面
		students.sort((a, b) => a.coursePercent - b.coursePercent);

		return c.json({
			courseId,
			courseTitle: course.title,
			studentCount: students.length,
			averagePercent:
				students.length > 0
					? Math.round(
							students.reduce((sum, s) => sum + s.coursePercent, 0) /
								students.length,
						)
					: 0,
			students,
		});
	},
);
