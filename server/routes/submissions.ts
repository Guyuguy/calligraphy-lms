import { Hono } from "hono";
import {
	annotations,
	assignments,
	courses,
	studentProfiles,
	submissions,
	uid,
	users,
} from "../db";
import type { Annotation, Submission } from "../types";
import { requireAuth, requireRoles } from "./users";

export const submissionsRouter = new Hono();

// ============================================================
// 工具：组装提交详情（含标注、作业信息、学生信息）
// ============================================================

function buildSubmissionDetail(sub: Submission) {
	const asg = assignments.get(sub.assignmentId);
	const course = asg ? courses.get(asg.courseId) : undefined;
	const student = users.get(sub.studentId);
	const profile = studentProfiles.get(sub.studentId);
	const reviewer = sub.reviewedBy ? users.get(sub.reviewedBy) : undefined;

	// 该提交的所有标注
	const annoList = Array.from(annotations.values())
		.filter((a) => a.artworkId === sub.id)
		.sort((a, b) => a.x - b.x);

	return {
		...sub,
		assignmentTitle: asg?.title ?? "",
		assignmentDescription: asg?.description ?? "",
		courseId: asg?.courseId ?? "",
		courseTitle: course?.title ?? "",
		totalScore: asg?.totalScore ?? 100,
		studentName: student?.name ?? "",
		studentAvatar: student?.avatar,
		studentProfile: profile,
		reviewerName: reviewer?.name,
		annotations: annoList,
	};
}

// ============================================================
// GET /api/submissions/:id — 提交详情（含标注）
// ============================================================

submissionsRouter.get("/:id", (c) => {
	const parsed = requireAuth(c);
	if (!parsed) return c.json({ error: "unauthorized", message: "未登录" }, 401);

	const id = c.req.param("id");
	const sub = submissions.get(id);
	if (!sub) return c.json({ error: "not_found", message: "提交不存在" }, 404);

	// 学生只能看自己的提交，教师/教务/管理员可看所有
	if (parsed.role === "student" && sub.studentId !== parsed.userId) {
		return c.json({ error: "forbidden", message: "无权查看他人提交" }, 403);
	}
	if (parsed.role === "parent") {
		const child = studentProfiles.get(sub.studentId);
		if (!child?.parentIds.includes(parsed.userId)) {
			return c.json({ error: "forbidden", message: "无权查看" }, 403);
		}
	}

	return c.json({ submission: buildSubmissionDetail(sub) });
});

// ============================================================
// GET /api/submissions/:id/versions — 版本历史
// ============================================================

submissionsRouter.get("/:id/versions", (c) => {
	const parsed = requireAuth(c);
	if (!parsed) return c.json({ error: "unauthorized", message: "未登录" }, 401);

	const id = c.req.param("id");
	const sub = submissions.get(id);
	if (!sub) return c.json({ error: "not_found", message: "提交不存在" }, 404);

	if (parsed.role === "student" && sub.studentId !== parsed.userId) {
		return c.json({ error: "forbidden", message: "无权查看" }, 403);
	}

	// 同一作业的所有提交（按版本排序）
	const asg = assignments.get(sub.assignmentId);
	if (!asg) return c.json({ versions: [] });

	const versions = Array.from(submissions.values())
		.filter(
			(s) =>
				s.assignmentId === sub.assignmentId && s.studentId === sub.studentId,
		)
		.sort((a, b) => a.version - b.version)
		.map((s) => ({
			id: s.id,
			version: s.version,
			content: s.content,
			imageUrl: s.imageUrl,
			submittedAt: s.submittedAt,
			score: s.score,
			teacherComment: s.teacherComment,
			reviewedAt: s.reviewedAt,
		}));

	return c.json({ assignmentId: sub.assignmentId, versions });
});

// ============================================================
// POST /api/submissions/:id/annotations — 添加圈点标注
// ============================================================

submissionsRouter.post(
	"/:id/annotations",
	requireRoles("teacher", "academic_head", "admin"),
	async (c) => {
		const parsed = requireAuth(c);
		if (!parsed)
			return c.json({ error: "unauthorized", message: "未登录" }, 401);

		const id = c.req.param("id");
		const sub = submissions.get(id);
		if (!sub) return c.json({ error: "not_found", message: "提交不存在" }, 404);

		let body: {
			x?: number;
			y?: number;
			type?: "circle" | "arrow" | "text";
			content?: string;
		};
		try {
			body = await c.req.json();
		} catch {
			body = {};
		}

		if (
			typeof body.x !== "number" ||
			typeof body.y !== "number" ||
			body.x < 0 ||
			body.x > 100 ||
			body.y < 0 ||
			body.y > 100
		) {
			return c.json(
				{ error: "invalid_position", message: "坐标必须是 0-100 之间的百分比" },
				400,
			);
		}
		if (!body.type || !["circle", "arrow", "text"].includes(body.type)) {
			return c.json(
				{ error: "invalid_type", message: "标注类型必须是 circle/arrow/text" },
				400,
			);
		}
		if (!body.content || typeof body.content !== "string") {
			return c.json(
				{ error: "invalid_content", message: "标注内容不能为空" },
				400,
			);
		}

		const annoId = uid("anno");
		const anno: Annotation = {
			id: annoId,
			artworkId: sub.id,
			x: body.x,
			y: body.y,
			type: body.type,
			content: body.content,
			authorId: parsed.userId,
		};
		annotations.set(annoId, anno);

		return c.json({ ok: true, annotation: anno }, 201);
	},
);

// ============================================================
// DELETE /api/submissions/:id/annotations/:annoId — 删除标注
// ============================================================

submissionsRouter.delete(
	"/:id/annotations/:annoId",
	requireRoles("teacher", "academic_head", "admin"),
	(c) => {
		const parsed = requireAuth(c);
		if (!parsed)
			return c.json({ error: "unauthorized", message: "未登录" }, 401);

		const annoId = c.req.param("annoId");
		const anno = annotations.get(annoId);
		if (!anno)
			return c.json({ error: "not_found", message: "标注不存在" }, 404);

		// 只有作者本人或管理员可删
		if (anno.authorId !== parsed.userId && parsed.role !== "admin") {
			return c.json(
				{ error: "forbidden", message: "只能删除自己添加的标注" },
				403,
			);
		}

		annotations.delete(annoId);
		return c.json({ ok: true });
	},
);

// ============================================================
// POST /api/submissions/:id/version — 学生提交新版本
// ============================================================

submissionsRouter.post("/:id/version", async (c) => {
	const parsed = requireAuth(c);
	if (!parsed) return c.json({ error: "unauthorized", message: "未登录" }, 401);

	const id = c.req.param("id");
	const sub = submissions.get(id);
	if (!sub) return c.json({ error: "not_found", message: "提交不存在" }, 404);

	// 学生只能为自己的提交新增版本
	if (parsed.role !== "student" || sub.studentId !== parsed.userId) {
		return c.json(
			{ error: "forbidden", message: "只能为学生本人的提交新增版本" },
			403,
		);
	}

	let body: { content?: string; imageUrl?: string };
	try {
		body = await c.req.json();
	} catch {
		body = {};
	}

	if (!body.content && !body.imageUrl) {
		return c.json(
			{ error: "invalid_input", message: "内容或图片至少一项不能为空" },
			400,
		);
	}

	// 计算下一个版本号
	const existingVersions = Array.from(submissions.values())
		.filter(
			(s) =>
				s.assignmentId === sub.assignmentId && s.studentId === sub.studentId,
		)
		.map((s) => s.version);
	const nextVersion =
		existingVersions.length > 0 ? Math.max(...existingVersions) + 1 : 1;

	const newSubId = uid("sub");
	const newSub: Submission = {
		id: newSubId,
		assignmentId: sub.assignmentId,
		studentId: sub.studentId,
		content: body.content ?? "",
		imageUrl: body.imageUrl,
		submittedAt: new Date().toISOString(),
		version: nextVersion,
		score: null,
	};
	submissions.set(newSubId, newSub);

	return c.json({ ok: true, submission: newSub }, 201);
});
