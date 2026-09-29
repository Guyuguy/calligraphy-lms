import { Hono } from "hono";
import {
	annotations,
	assignments,
	audioRecords,
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
			size?: number;
			angle?: number;
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
		// content 允许为空字符串，但必须是字符串类型
		const content = typeof body.content === "string" ? body.content : "";

		// size 可选，默认 10（相对画布宽度的百分比），范围 2-50
		let size = 10;
		if (typeof body.size === "number" && body.size >= 2 && body.size <= 50) {
			size = body.size;
		}

		// angle 可选，箭头旋转角度（度），范围 -360 ~ 360
		let angle: number | undefined;
		if (
			typeof body.angle === "number" &&
			body.angle >= -360 &&
			body.angle <= 360
		) {
			angle = body.angle;
		}

		const annoId = uid("anno");
		const anno: Annotation = {
			id: annoId,
			artworkId: sub.id,
			x: body.x,
			y: body.y,
			type: body.type,
			content,
			authorId: parsed.userId,
			size,
			...(angle !== undefined ? { angle } : {}),
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
// PATCH /api/submissions/:id/annotations/:annoId — 更新标注（size/content）
// ============================================================

submissionsRouter.patch(
	"/:id/annotations/:annoId",
	requireRoles("teacher", "academic_head", "admin"),
	async (c) => {
		const parsed = requireAuth(c);
		if (!parsed)
			return c.json({ error: "unauthorized", message: "未登录" }, 401);

		const annoId = c.req.param("annoId");
		const anno = annotations.get(annoId);
		if (!anno)
			return c.json({ error: "not_found", message: "标注不存在" }, 404);

		// 只有作者本人或管理员可改
		if (anno.authorId !== parsed.userId && parsed.role !== "admin") {
			return c.json(
				{ error: "forbidden", message: "只能修改自己添加的标注" },
				403,
			);
		}

		let body: { size?: number; content?: string };
		try {
			body = await c.req.json();
		} catch {
			body = {};
		}

		const updated: Annotation = { ...anno };
		if (typeof body.size === "number" && body.size >= 2 && body.size <= 50) {
			updated.size = body.size;
		}
		if (typeof body.content === "string") {
			updated.content = body.content;
		}
		annotations.set(annoId, updated);

		return c.json({ ok: true, annotation: updated });
	},
);

// ============================================================
// POST /api/submissions/:id/audio — 教师上传音频评语
// ============================================================

submissionsRouter.post(
	"/:id/audio",
	requireRoles("teacher", "academic_head", "admin"),
	async (c) => {
		const parsed = requireAuth(c);
		if (!parsed)
			return c.json({ error: "unauthorized", message: "未登录" }, 401);

		const id = c.req.param("id");
		const sub = submissions.get(id);
		if (!sub) return c.json({ error: "not_found", message: "提交不存在" }, 404);

		const contentType = c.req.header("Content-Type") ?? "";
		if (!contentType.startsWith("audio/")) {
			return c.json(
				{
					error: "invalid_content_type",
					message: "Content-Type 必须为 audio/*",
				},
				400,
			);
		}

		const buf = await c.req.arrayBuffer();
		if (buf.byteLength === 0) {
			return c.json({ error: "empty_body", message: "音频数据为空" }, 400);
		}
		if (buf.byteLength > 10 * 1024 * 1024) {
			return c.json({ error: "too_large", message: "音频不能超过 10MB" }, 400);
		}

		const audioId = uid("audio");
		audioRecords.set(audioId, {
			mime: contentType,
			data: new Uint8Array(buf),
		});

		// 把音频 URL 写入提交记录
		const audioUrl = `/api/submissions/${id}/audio/${audioId}`;
		const updated: Submission = {
			...sub,
			teacherAudioUrl: audioUrl,
		};
		submissions.set(id, updated);

		return c.json({ ok: true, audioUrl, audioId }, 201);
	},
);

// ============================================================
// GET /api/submissions/:id/audio/:audioId — 下载音频评语
// ============================================================

submissionsRouter.get("/:id/audio/:audioId", (c) => {
	const parsed = requireAuth(c);
	if (!parsed) return c.json({ error: "unauthorized", message: "未登录" }, 401);

	const id = c.req.param("id");
	const sub = submissions.get(id);
	if (!sub) return c.json({ error: "not_found", message: "提交不存在" }, 404);

	// 学生只能听自己提交的音频，教师/教务/管理员可听
	if (parsed.role === "student" && sub.studentId !== parsed.userId) {
		return c.json({ error: "forbidden", message: "无权访问" }, 403);
	}
	if (parsed.role === "parent") {
		const child = studentProfiles.get(sub.studentId);
		if (!child?.parentIds.includes(parsed.userId)) {
			return c.json({ error: "forbidden", message: "无权访问" }, 403);
		}
	}

	const audioId = c.req.param("audioId");
	const record = audioRecords.get(audioId);
	if (!record)
		return c.json({ error: "not_found", message: "音频不存在" }, 404);

	return new Response(record.data.buffer as ArrayBuffer, {
		headers: {
			"Content-Type": record.mime,
			"Cache-Control": "private, max-age=3600",
		},
	});
});

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
