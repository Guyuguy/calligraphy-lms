import { Hono } from "hono";
import {
	annotations,
	artworks,
	assignments,
	courses,
	imageRecords,
	studentProfiles,
	submissions,
	uid,
	users,
} from "../db";
import type { Annotation, Artwork, Submission } from "../types";
import { createNotification } from "./notifications";
import { requireAuth, requireRoles } from "./users";

export const portfolioRouter = new Hono();

// ============================================================
// 工具: 鉴权 — 学生只能看自己,家长只能看孩子,教师/教务/管理员/助教可看所有
// ============================================================

function assertCanViewStudent(
	parsed: { userId: string; role: string },
	studentId: string,
	// biome-ignore lint/suspicious/noExplicitAny: Hono Context
	c: any,
) {
	if (parsed.role === "student") {
		if (parsed.userId !== studentId)
			return c.json(
				{ error: "forbidden", message: "只能查看自己的作品集" },
				403,
			);
		return null;
	}
	if (parsed.role === "parent") {
		const sp = studentProfiles.get(studentId);
		if (!sp?.parentIds.includes(parsed.userId))
			return c.json({ error: "forbidden", message: "无权查看该学生" }, 403);
		return null;
	}
	// teacher / academic_head / admin / ta 放行
	return null;
}

// 工具: 鉴权 — 学生本人或教师/教务/管理员可编辑(上传/修改/删除)
function assertCanEditStudent(
	parsed: { userId: string; role: string },
	studentId: string,
	// biome-ignore lint/suspicious/noExplicitAny: Hono Context
	c: any,
) {
	if (parsed.role === "student") {
		if (parsed.userId !== studentId)
			return c.json({ error: "forbidden", message: "只能操作自己的作品" }, 403);
		return null;
	}
	if (parsed.role === "parent") {
		return c.json({ error: "forbidden", message: "家长无权修改作品" }, 403);
	}
	// teacher / academic_head / admin / ta 放行
	return null;
}

// ============================================================
// 工具: 组装作品详情(含标注、学生信息、关联提交/作业)
// ============================================================

function buildArtworkDetail(art: Artwork) {
	const student = users.get(art.studentId);
	const profile = studentProfiles.get(art.studentId);
	const annoList = Array.from(annotations.values())
		.filter((a) => a.artworkId === art.id)
		.sort((a, b) => a.x - b.x);

	let linkedSubmission: Submission | undefined;
	let linkedAssignmentTitle = "";
	let linkedCourseTitle = "";
	if (art.submissionId) {
		linkedSubmission = submissions.get(art.submissionId);
		if (linkedSubmission) {
			const asg = assignments.get(linkedSubmission.assignmentId);
			linkedAssignmentTitle = asg?.title ?? "";
			if (asg) {
				const course = courses.get(asg.courseId);
				linkedCourseTitle = course?.title ?? "";
			}
		}
	}

	return {
		...art,
		studentName: student?.name ?? "",
		studentAvatar: student?.avatar,
		studentProfile: profile,
		annotations: annoList,
		linkedSubmission: linkedSubmission
			? {
					id: linkedSubmission.id,
					assignmentTitle: linkedAssignmentTitle,
					courseTitle: linkedCourseTitle,
					score: linkedSubmission.score,
					teacherComment: linkedSubmission.teacherComment,
					submittedAt: linkedSubmission.submittedAt,
				}
			: null,
	};
}

// ============================================================
// 1. GET /api/portfolios/:studentId/timeline — 时间轴
// ============================================================

portfolioRouter.get("/:studentId/timeline", (c) => {
	const parsed = requireAuth(c);
	if (!parsed) return c.json({ error: "unauthorized", message: "未登录" }, 401);

	const studentId = c.req.param("studentId");
	const forbidden = assertCanViewStudent(parsed, studentId, c);
	if (forbidden) return forbidden;

	// 学生不存在
	if (!users.has(studentId))
		return c.json({ error: "not_found", message: "学生不存在" }, 404);

	// 独立作品
	const artworkItems = Array.from(artworks.values())
		.filter((a) => a.studentId === studentId)
		.map((a) => {
			const annotationsCount = Array.from(annotations.values()).filter(
				(an) => an.artworkId === a.id,
			).length;
			return {
				id: a.id,
				kind: "artwork" as const,
				title: a.title,
				imageUrl: a.imageUrl,
				createdAt: a.createdAt,
				isFeatured: a.isFeatured,
				annotationsCount,
			};
		});

	// 作业提交(带 imageUrl)
	const submissionItems = Array.from(submissions.values())
		.filter((s) => s.studentId === studentId && s.imageUrl)
		.map((s) => {
			const asg = assignments.get(s.assignmentId);
			const course = asg ? courses.get(asg.courseId) : undefined;
			const annotationsCount = Array.from(annotations.values()).filter(
				(an) => an.artworkId === s.id,
			).length;
			return {
				id: s.id,
				kind: "submission" as const,
				title: asg?.title ?? "未命名作业",
				imageUrl: s.imageUrl ?? "",
				createdAt: s.submittedAt,
				isFeatured: false,
				annotationsCount,
				linkedSubmission: {
					id: s.id,
					assignmentTitle: asg?.title ?? "",
					courseTitle: course?.title ?? "",
					score: s.score,
				},
			};
		});

	const items = [...artworkItems, ...submissionItems].sort(
		(a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
	);

	return c.json({ studentId, items });
});

// ============================================================
// 2. GET /api/portfolios/:studentId/artworks — 学生作品列表
// ============================================================

portfolioRouter.get("/:studentId/artworks", (c) => {
	const parsed = requireAuth(c);
	if (!parsed) return c.json({ error: "unauthorized", message: "未登录" }, 401);

	const studentId = c.req.param("studentId");
	const forbidden = assertCanViewStudent(parsed, studentId, c);
	if (forbidden) return forbidden;

	const list = Array.from(artworks.values())
		.filter((a) => a.studentId === studentId)
		.map((a) => ({
			...a,
			annotationsCount: Array.from(annotations.values()).filter(
				(an) => an.artworkId === a.id,
			).length,
		}))
		.sort(
			(a, b) =>
				new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
		);

	return c.json({ studentId, total: list.length, artworks: list });
});

// ============================================================
// 3. GET /api/portfolios/artworks/featured — 作品墙(精选)
// 注意: 必须在 /:id 之前注册,否则会被 :id 吃掉
// ============================================================

portfolioRouter.get("/artworks/featured", (c) => {
	const parsed = requireAuth(c);
	if (!parsed) return c.json({ error: "unauthorized", message: "未登录" }, 401);

	const list = Array.from(artworks.values())
		.filter((a) => a.isFeatured)
		.map((a) => {
			const student = users.get(a.studentId);
			return {
				...a,
				studentName: student?.name ?? "",
				studentAvatar: student?.avatar,
				annotationsCount: Array.from(annotations.values()).filter(
					(an) => an.artworkId === a.id,
				).length,
			};
		})
		.sort(
			(a, b) =>
				new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
		);

	return c.json({ total: list.length, artworks: list });
});

// ============================================================
// 4. GET /api/portfolios/artworks/:id — 作品详情
// ============================================================

portfolioRouter.get("/artworks/:id", (c) => {
	const parsed = requireAuth(c);
	if (!parsed) return c.json({ error: "unauthorized", message: "未登录" }, 401);

	const id = c.req.param("id");
	const art = artworks.get(id);
	if (!art) return c.json({ error: "not_found", message: "作品不存在" }, 404);

	const forbidden = assertCanViewStudent(parsed, art.studentId, c);
	if (forbidden) return forbidden;

	return c.json({ artwork: buildArtworkDetail(art) });
});

// ============================================================
// 5. POST /api/portfolios/:studentId/artworks — 创建独立作品
// ============================================================

portfolioRouter.post("/:studentId/artworks", async (c) => {
	const parsed = requireAuth(c);
	if (!parsed) return c.json({ error: "unauthorized", message: "未登录" }, 401);

	const studentId = c.req.param("studentId");
	const forbidden = assertCanEditStudent(parsed, studentId, c);
	if (forbidden) return forbidden;

	if (!users.has(studentId))
		return c.json({ error: "not_found", message: "学生不存在" }, 404);

	let body: { title?: string; imageUrl?: string; submissionId?: string };
	try {
		body = await c.req.json();
	} catch {
		body = {};
	}

	if (!body.title?.trim())
		return c.json({ error: "invalid_title", message: "标题不能为空" }, 400);

	// 校验 submissionId(若提供)
	if (body.submissionId) {
		const sub = submissions.get(body.submissionId);
		if (!sub || sub.studentId !== studentId)
			return c.json(
				{
					error: "invalid_submission",
					message: "关联提交不存在或不属于该学生",
				},
				400,
			);
	}

	const id = uid("art");
	const now = new Date().toISOString();
	const art: Artwork = {
		id,
		studentId,
		title: body.title.trim(),
		imageUrl: body.imageUrl ?? "",
		createdAt: now,
		isFeatured: false,
		...(body.submissionId ? { submissionId: body.submissionId } : {}),
	};
	artworks.set(id, art);

	return c.json({ ok: true, artwork: art }, 201);
});

// ============================================================
// 6. POST /api/portfolios/artworks/:id/image — 上传作品图片
// ============================================================

const IMAGE_MAX_BYTES = 10 * 1024 * 1024; // 10MB

portfolioRouter.post("/artworks/:id/image", async (c) => {
	const parsed = requireAuth(c);
	if (!parsed) return c.json({ error: "unauthorized", message: "未登录" }, 401);

	const id = c.req.param("id");
	const art = artworks.get(id);
	if (!art) return c.json({ error: "not_found", message: "作品不存在" }, 404);

	const forbidden = assertCanEditStudent(parsed, art.studentId, c);
	if (forbidden) return forbidden;

	const contentType = c.req.header("Content-Type") ?? "";
	if (!contentType.startsWith("image/")) {
		return c.json(
			{ error: "invalid_content_type", message: "Content-Type 必须为 image/*" },
			400,
		);
	}

	const buf = await c.req.arrayBuffer();
	if (buf.byteLength === 0)
		return c.json({ error: "empty_body", message: "图片数据为空" }, 400);
	if (buf.byteLength > IMAGE_MAX_BYTES)
		return c.json({ error: "too_large", message: "图片不能超过 10MB" }, 400);

	// 若已有图片,删除旧记录
	if (art.imageUrl) {
		const oldId = art.imageUrl.split("/").pop();
		if (oldId) imageRecords.delete(oldId);
	}

	const imageId = uid("img");
	imageRecords.set(imageId, {
		mime: contentType,
		data: new Uint8Array(buf),
	});

	const imageUrl = `/api/portfolios/artworks/${id}/image/${imageId}`;
	const updated: Artwork = { ...art, imageUrl };
	artworks.set(id, updated);

	return c.json({ ok: true, imageUrl, imageId, artwork: updated }, 201);
});

// ============================================================
// 7. GET /api/portfolios/artworks/:id/image/:imageId — 下载作品图片
// ============================================================

portfolioRouter.get("/artworks/:id/image/:imageId", (c) => {
	const parsed = requireAuth(c);
	if (!parsed) return c.json({ error: "unauthorized", message: "未登录" }, 401);

	const id = c.req.param("id");
	const art = artworks.get(id);
	if (!art) return c.json({ error: "not_found", message: "作品不存在" }, 404);

	// 可见性: 复用作品本身的访问权限
	const forbidden = assertCanViewStudent(parsed, art.studentId, c);
	if (forbidden) return forbidden;

	const imageId = c.req.param("imageId");
	const record = imageRecords.get(imageId);
	if (!record)
		return c.json({ error: "not_found", message: "图片不存在" }, 404);

	return new Response(record.data.buffer as ArrayBuffer, {
		headers: {
			"Content-Type": record.mime,
			"Cache-Control": "private, max-age=3600",
		},
	});
});

// ============================================================
// 8. PATCH /api/portfolios/artworks/:id — 更新作品元数据
// ============================================================

portfolioRouter.patch("/artworks/:id", async (c) => {
	const parsed = requireAuth(c);
	if (!parsed) return c.json({ error: "unauthorized", message: "未登录" }, 401);

	const id = c.req.param("id");
	const art = artworks.get(id);
	if (!art) return c.json({ error: "not_found", message: "作品不存在" }, 404);

	const forbidden = assertCanEditStudent(parsed, art.studentId, c);
	if (forbidden) return forbidden;

	let body: { title?: string; isFeatured?: boolean };
	try {
		body = await c.req.json();
	} catch {
		body = {};
	}

	const updated: Artwork = { ...art };
	if (typeof body.title === "string" && body.title.trim())
		updated.title = body.title.trim();

	if (body.isFeatured === true) {
		// 把该学生其他作品的 isFeatured 设为 false(每人最多 1 个精选)
		for (const [otherId, other] of artworks.entries()) {
			if (
				otherId !== id &&
				other.studentId === art.studentId &&
				other.isFeatured
			) {
				artworks.set(otherId, { ...other, isFeatured: false });
			}
		}
		updated.isFeatured = true;
	} else if (body.isFeatured === false) {
		updated.isFeatured = false;
	}

	artworks.set(id, updated);
	return c.json({ ok: true, artwork: updated });
});

// ============================================================
// 9. DELETE /api/portfolios/artworks/:id — 删除作品
// ============================================================

portfolioRouter.delete("/artworks/:id", (c) => {
	const parsed = requireAuth(c);
	if (!parsed) return c.json({ error: "unauthorized", message: "未登录" }, 401);

	const id = c.req.param("id");
	const art = artworks.get(id);
	if (!art) return c.json({ error: "not_found", message: "作品不存在" }, 404);

	const forbidden = assertCanEditStudent(parsed, art.studentId, c);
	if (forbidden) return forbidden;

	// 删除关联图片
	if (art.imageUrl) {
		const imgId = art.imageUrl.split("/").pop();
		if (imgId) imageRecords.delete(imgId);
	}
	// 删除该作品的所有标注
	for (const [annoId, anno] of annotations.entries()) {
		if (anno.artworkId === id) annotations.delete(annoId);
	}
	artworks.delete(id);
	return c.json({ ok: true });
});

// ============================================================
// 10. POST /api/portfolios/artworks/:id/annotations — 添加标注
// ============================================================

portfolioRouter.post(
	"/artworks/:id/annotations",
	requireRoles("teacher", "academic_head", "admin"),
	async (c) => {
		const parsed = requireAuth(c);
		if (!parsed)
			return c.json({ error: "unauthorized", message: "未登录" }, 401);

		const id = c.req.param("id");
		const art = artworks.get(id);
		if (!art) return c.json({ error: "not_found", message: "作品不存在" }, 404);

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
		const content = typeof body.content === "string" ? body.content : "";

		let size = 10;
		if (typeof body.size === "number" && body.size >= 2 && body.size <= 50) {
			size = body.size;
		}

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
			artworkId: art.id,
			x: body.x,
			y: body.y,
			type: body.type,
			content,
			authorId: parsed.userId,
			size,
			...(angle !== undefined ? { angle } : {}),
		};
		annotations.set(annoId, anno);

		// 通知学生: 收到新标注
		const teacherName = users.get(parsed.userId)?.name ?? "教师";
		createNotification(
			art.studentId,
			"review_completed",
			"收到新批注",
			`${teacherName} 在你的作品《${art.title}》上添加了批注`,
			{ artworkId: art.id, annotationId: annoId },
		);

		return c.json({ ok: true, annotation: anno }, 201);
	},
);

// ============================================================
// 11. DELETE /api/portfolios/artworks/:id/annotations/:annoId — 删除标注
// ============================================================

portfolioRouter.delete(
	"/artworks/:id/annotations/:annoId",
	requireRoles("teacher", "academic_head", "admin"),
	(c) => {
		const parsed = requireAuth(c);
		if (!parsed)
			return c.json({ error: "unauthorized", message: "未登录" }, 401);

		const annoId = c.req.param("annoId");
		const anno = annotations.get(annoId);
		if (!anno)
			return c.json({ error: "not_found", message: "标注不存在" }, 404);

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
// 12. PATCH /api/portfolios/artworks/:id/annotations/:annoId — 更新标注
// ============================================================

portfolioRouter.patch(
	"/artworks/:id/annotations/:annoId",
	requireRoles("teacher", "academic_head", "admin"),
	async (c) => {
		const parsed = requireAuth(c);
		if (!parsed)
			return c.json({ error: "unauthorized", message: "未登录" }, 401);

		const annoId = c.req.param("annoId");
		const anno = annotations.get(annoId);
		if (!anno)
			return c.json({ error: "not_found", message: "标注不存在" }, 404);

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
