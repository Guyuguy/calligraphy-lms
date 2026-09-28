import { Hono } from "hono";
import {
	assignments,
	courses,
	practiceDays,
	progress,
	schedules,
	studentProfiles,
	submissions,
	teacherProfiles,
	users,
} from "../db";
import type { Submission } from "../types";
import { requireAuth, requireRoles } from "./users";

export const teachingRouter = new Hono();

// ============================================================
// 工具函数
// ============================================================

function getTeacherCourses(teacherId: string) {
	return Array.from(courses.values()).filter((c) => c.teacherId === teacherId);
}

// ============================================================
// 教师所教班级列表
// ============================================================

teachingRouter.get(
	"/classes",
	requireRoles("teacher", "academic_head", "admin"),
	(c) => {
		const parsed = requireAuth(c);
		if (!parsed)
			return c.json({ error: "unauthorized", message: "未登录" }, 401);

		const teacherId = c.req.query("teacherId") ?? parsed.userId;
		const teacher = users.get(teacherId);
		if (!teacher)
			return c.json({ error: "not_found", message: "教师不存在" }, 404);

		const myCourses = getTeacherCourses(teacherId);
		const result = myCourses.map((course) => {
			// 该课程的所有排课
			const courseSchedules = Array.from(schedules.values()).filter(
				(s) => s.courseId === course.id,
			);
			// 该课程的学生总数（去重）
			const studentSet = new Set<string>();
			for (const s of courseSchedules) {
				for (const id of s.studentIds) studentSet.add(id);
			}

			// 平均进度
			let totalPercent = 0;
			let counted = 0;
			for (const sid of studentSet) {
				const allUnits = course.modules.flatMap((m) => m.units);
				const percents: number[] = [];
				for (const u of allUnits) {
					const p = progress.get(`${sid}:${u.id}`);
					if (p) percents.push(p.percent);
				}
				if (percents.length > 0) {
					totalPercent +=
						percents.reduce((sum, p) => sum + p, 0) / percents.length;
					counted++;
				}
			}
			const avgPercent = counted > 0 ? Math.round(totalPercent / counted) : 0;

			// 待批改数
			const courseAssignmentIds = Array.from(assignments.values())
				.filter((a) => a.courseId === course.id)
				.map((a) => a.id);
			const pendingCount = Array.from(submissions.values()).filter(
				(s) => courseAssignmentIds.includes(s.assignmentId) && s.score === null,
			).length;

			return {
				courseId: course.id,
				title: course.title,
				stage: course.stage,
				level: course.level,
				style: course.style,
				cover: course.cover,
				enrolledCount: studentSet.size,
				scheduleCount: courseSchedules.length,
				avgPercent,
				pendingReviews: pendingCount,
				status: course.status,
			};
		});

		return c.json({ teacherId, teacherName: teacher.name, classes: result });
	},
);

// ============================================================
// 待批改作业列表
// ============================================================

teachingRouter.get(
	"/submissions",
	requireRoles("teacher", "academic_head", "admin"),
	(c) => {
		const parsed = requireAuth(c);
		if (!parsed)
			return c.json({ error: "unauthorized", message: "未登录" }, 401);

		const status = c.req.query("status") ?? "pending"; // pending | reviewed | all
		const courseId = c.req.query("courseId");
		const teacherId = parsed.userId;

		// 教师所教课程的作业 ID
		const myCourseIds = new Set(getTeacherCourses(teacherId).map((c) => c.id));
		const myAssignmentIds = new Set(
			Array.from(assignments.values())
				.filter((a) =>
					courseId ? a.courseId === courseId : myCourseIds.has(a.courseId),
				)
				.map((a) => a.id),
		);

		let list = Array.from(submissions.values()).filter((s) =>
			myAssignmentIds.has(s.assignmentId),
		);
		if (status === "pending") list = list.filter((s) => s.score === null);
		else if (status === "reviewed") list = list.filter((s) => s.score !== null);

		// 按提交时间倒序
		list.sort((a, b) => b.submittedAt.localeCompare(a.submittedAt));

		const result = list.map((s) => {
			const asg = assignments.get(s.assignmentId);
			const course = asg ? courses.get(asg.courseId) : undefined;
			const student = users.get(s.studentId);
			return {
				id: s.id,
				assignmentId: s.assignmentId,
				assignmentTitle: asg?.title ?? "",
				courseId: asg?.courseId ?? "",
				courseTitle: course?.title ?? "",
				studentId: s.studentId,
				studentName: student?.name ?? "",
				studentAvatar: student?.avatar,
				content: s.content,
				imageUrl: s.imageUrl,
				submittedAt: s.submittedAt,
				version: s.version,
				score: s.score,
				teacherComment: s.teacherComment,
				reviewedAt: s.reviewedAt,
				totalScore: asg?.totalScore ?? 100,
				status: s.score === null ? "pending" : "reviewed",
			};
		});

		return c.json({
			teacherId,
			status,
			count: result.length,
			submissions: result,
		});
	},
);

// ============================================================
// 单次提交详情
// ============================================================

teachingRouter.get(
	"/submissions/:id",
	requireRoles("teacher", "academic_head", "admin"),
	(c) => {
		const parsed = requireAuth(c);
		if (!parsed)
			return c.json({ error: "unauthorized", message: "未登录" }, 401);

		const id = c.req.param("id");
		const sub = submissions.get(id);
		if (!sub) return c.json({ error: "not_found", message: "提交不存在" }, 404);

		const asg = assignments.get(sub.assignmentId);
		const course = asg ? courses.get(asg.courseId) : undefined;
		const student = users.get(sub.studentId);
		const profile = studentProfiles.get(sub.studentId);

		return c.json({
			submission: {
				...sub,
				assignmentTitle: asg?.title ?? "",
				courseId: asg?.courseId ?? "",
				courseTitle: course?.title ?? "",
				totalScore: asg?.totalScore ?? 100,
				studentName: student?.name ?? "",
				studentProfile: profile,
			},
		});
	},
);

// ============================================================
// 批改提交
// ============================================================

teachingRouter.post(
	"/submissions/:id/review",
	requireRoles("teacher", "academic_head", "admin"),
	async (c) => {
		const parsed = requireAuth(c);
		if (!parsed)
			return c.json({ error: "unauthorized", message: "未登录" }, 401);

		const id = c.req.param("id");
		const sub = submissions.get(id);
		if (!sub) return c.json({ error: "not_found", message: "提交不存在" }, 404);

		let body: {
			score?: number;
			teacherComment?: string;
			teacherAudioUrl?: string;
		};
		try {
			body = await c.req.json();
		} catch {
			body = {};
		}

		if (typeof body.score !== "number" || body.score < 0 || body.score > 100) {
			return c.json(
				{ error: "invalid_score", message: "分数必须在 0-100 之间" },
				400,
			);
		}

		const updated: Submission = {
			...sub,
			score: body.score,
			teacherComment: body.teacherComment ?? sub.teacherComment,
			teacherAudioUrl: body.teacherAudioUrl ?? sub.teacherAudioUrl,
			reviewedAt: new Date().toISOString(),
			reviewedBy: parsed.userId,
		};
		submissions.set(id, updated);

		// 同步更新对应单元的进度（作业型单元）
		const asg = assignments.get(sub.assignmentId);
		if (asg) {
			const key = `${sub.studentId}:${asg.unitId}`;
			const p = progress.get(key);
			if (p) {
				progress.set(key, {
					...p,
					status: "completed",
					percent: 100,
					submissionCount: p.submissionCount + 1,
					lastActivityAt: updated.reviewedAt ?? new Date().toISOString(),
				});
			}
		}

		return c.json({ ok: true, submission: updated });
	},
);

// ============================================================
// 教师教学质量统计
// ============================================================

teachingRouter.get(
	"/stats",
	requireRoles("teacher", "academic_head", "admin"),
	(c) => {
		const parsed = requireAuth(c);
		if (!parsed)
			return c.json({ error: "unauthorized", message: "未登录" }, 401);

		const teacherId = c.req.query("teacherId") ?? parsed.userId;
		const profile = teacherProfiles.get(teacherId);

		const myCourses = getTeacherCourses(teacherId);
		const myCourseIds = new Set(myCourses.map((c) => c.id));
		const myAssignmentIds = new Set(
			Array.from(assignments.values())
				.filter((a) => myCourseIds.has(a.courseId))
				.map((a) => a.id),
		);

		const mySubmissions = Array.from(submissions.values()).filter((s) =>
			myAssignmentIds.has(s.assignmentId),
		);

		const reviewed = mySubmissions.filter((s) => s.score !== null);
		const pending = mySubmissions.filter((s) => s.score === null);

		// 批改及时率：24 小时内批改的比例
		let timelyReviewed = 0;
		for (const s of reviewed) {
			if (s.reviewedAt) {
				const delta =
					new Date(s.reviewedAt).getTime() - new Date(s.submittedAt).getTime();
				if (delta <= 24 * 3600 * 1000) timelyReviewed++;
			}
		}
		const timelyRate =
			reviewed.length > 0
				? Math.round((timelyReviewed / reviewed.length) * 100)
				: 0;

		// 平均分
		const avgScore =
			reviewed.length > 0
				? Math.round(
						reviewed.reduce((sum, s) => sum + (s.score ?? 0), 0) /
							reviewed.length,
					)
				: 0;

		// 学生进步率：取所有学生最近一次 vs 第一次作业分数差值平均
		const studentScores = new Map<string, number[]>();
		for (const s of reviewed) {
			const arr = studentScores.get(s.studentId) ?? [];
			arr.push(s.score ?? 0);
			studentScores.set(s.studentId, arr);
		}
		let improvedCount = 0;
		for (const arr of studentScores.values()) {
			if (arr.length >= 2 && arr[arr.length - 1] > arr[0]) improvedCount++;
		}
		const improvementRate =
			studentScores.size > 0
				? Math.round((improvedCount / studentScores.size) * 100)
				: 0;

		return c.json({
			teacherId,
			teacherName: users.get(teacherId)?.name ?? "",
			rating: profile?.rating ?? 0,
			studentCount: profile?.studentCount ?? 0,
			classCount: myCourses.length,
			totalSubmissions: mySubmissions.length,
			pendingReviews: pending.length,
			reviewedCount: reviewed.length,
			timelyRate,
			avgScore,
			improvementRate,
		});
	},
);

// ============================================================
// 落后预警汇总
// ============================================================

teachingRouter.get(
	"/alerts",
	requireRoles("teacher", "academic_head", "admin"),
	(c) => {
		const parsed = requireAuth(c);
		if (!parsed)
			return c.json({ error: "unauthorized", message: "未登录" }, 401);

		const teacherId = parsed.userId;
		const myCourses = getTeacherCourses(teacherId);

		const alerts: Array<{
			studentId: string;
			studentName: string;
			courseId: string;
			courseTitle: string;
			type: "inactive" | "missing_submission" | "low_quiz";
			detail: string;
		}> = [];

		const now = Date.now();

		for (const course of myCourses) {
			const courseSchedules = Array.from(schedules.values()).filter(
				(s) => s.courseId === course.id,
			);
			const studentSet = new Set<string>();
			for (const s of courseSchedules) {
				for (const id of s.studentIds) studentSet.add(id);
			}

			for (const sid of studentSet) {
				const student = users.get(sid);
				if (!student) continue;

				// 连续 7 天未学习
				let inactiveDays = 0;
				for (let d = 0; d < 14; d++) {
					const date = new Date(now - d * 86400000).toISOString().slice(0, 10);
					if (!practiceDays.has(`${sid}:${date}`)) inactiveDays++;
					else break;
				}
				if (inactiveDays >= 7) {
					alerts.push({
						studentId: sid,
						studentName: student.name,
						courseId: course.id,
						courseTitle: course.title,
						type: "inactive",
						detail: `连续 ${inactiveDays} 天未学习`,
					});
				}

				// 作业逾期未交
				const courseAssignments = Array.from(assignments.values()).filter(
					(a) => a.courseId === course.id,
				);
				for (const asg of courseAssignments) {
					if (new Date(asg.dueAt).getTime() < now) {
						const submitted = Array.from(submissions.values()).some(
							(s) => s.assignmentId === asg.id && s.studentId === sid,
						);
						if (!submitted) {
							alerts.push({
								studentId: sid,
								studentName: student.name,
								courseId: course.id,
								courseTitle: course.title,
								type: "missing_submission",
								detail: `作业《${asg.title}》逾期未交`,
							});
						}
					}
				}

				// 测验不及格
				for (const key of progress.keys()) {
					if (!key.startsWith(`${sid}:`)) continue;
					const p = progress.get(key);
					if (
						p &&
						p.courseId === course.id &&
						p.quizScore !== null &&
						p.quizScore < 60
					) {
						alerts.push({
							studentId: sid,
							studentName: student.name,
							courseId: course.id,
							courseTitle: course.title,
							type: "low_quiz",
							detail: `测验得分 ${p.quizScore} 分（低于 60 分及格线）`,
						});
						break; // 每个学生每门课只报一次
					}
				}
			}
		}

		return c.json({ teacherId, count: alerts.length, alerts });
	},
);
