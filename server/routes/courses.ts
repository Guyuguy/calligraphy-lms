import { Hono } from "hono";
import { courses, teacherProfiles, uid, users, videoRecords } from "../db";
import type { Course, Level, Stage, Style } from "../types";
import {
	buildCourseFromDraft,
	generateTemplate,
	parseCourseFile,
	type TemplateFormat,
} from "./coursesImport";
import { requireAuth, requireRoles } from "./users";

export const coursesRouter = new Hono();

// 列表（支持 stage/level/style/teacherId/status 筛选 + 搜索）
coursesRouter.get("/", (c) => {
	const parsed = requireAuth(c);
	if (!parsed) return c.json({ error: "unauthorized", message: "未登录" }, 401);

	const stage = c.req.query("stage") as Stage | undefined;
	const level = c.req.query("level") as Level | undefined;
	const style = c.req.query("style") as Style | undefined;
	const teacherId = c.req.query("teacherId");
	const status = c.req.query("status") as Course["status"] | undefined;
	const q = c.req.query("q");

	let list = Array.from(courses.values());
	if (stage) list = list.filter((c) => c.stage === stage);
	if (level) list = list.filter((c) => c.level === level);
	if (style) list = list.filter((c) => c.style === style);
	if (teacherId) list = list.filter((c) => c.teacherId === teacherId);
	if (status) list = list.filter((c) => c.status === status);
	if (q) {
		const lower = q.toLowerCase();
		list = list.filter(
			(c) =>
				c.title.toLowerCase().includes(lower) ||
				c.intro.toLowerCase().includes(lower),
		);
	}

	// 附带教师姓名
	const enriched = list.map((c) => {
		const teacher = users.get(c.teacherId);
		return { ...c, teacherName: teacher?.name ?? "未知教师" };
	});

	return c.json({ courses: enriched });
});

// ============================================================
// 课程导入 & 模板下载(必须在 /:id 之前注册,否则会被 :id 吃掉)
// ============================================================

// GET /api/courses/template?format=json|md|txt|xlsx — 下载模板
coursesRouter.get(
	"/template",
	requireRoles("admin", "academic_head", "teacher"),
	(c) => {
		const fmt = (c.req.query("format") ?? "json").toLowerCase();
		const validFormats: TemplateFormat[] = ["json", "md", "txt", "xlsx"];
		if (!validFormats.includes(fmt as TemplateFormat)) {
			return c.json(
				{
					error: "invalid_format",
					message: `不支持的格式: ${fmt},支持: ${validFormats.join(", ")}`,
				},
				400,
			);
		}
		const { body, mime, filename } = generateTemplate(fmt as TemplateFormat);
		return new Response(body, {
			headers: {
				"Content-Type": mime,
				"Content-Disposition": `attachment; filename="${filename}"`,
			},
		});
	},
);

// POST /api/courses/import — 上传文件批量导入课程
coursesRouter.post(
	"/import",
	requireRoles("admin", "academic_head", "teacher"),
	async (c) => {
		const parsed = requireAuth(c);
		if (!parsed)
			return c.json({ error: "unauthorized", message: "未登录" }, 401);

		const contentType = c.req.header("Content-Type") ?? "";
		if (!contentType.startsWith("multipart/form-data")) {
			return c.json(
				{ error: "invalid_content_type", message: "需要 multipart/form-data" },
				400,
			);
		}

		const form = await c.req.formData();
		const file = form.get("file");
		if (!(file instanceof File)) {
			return c.json({ error: "no_file", message: "未提供文件" }, 400);
		}

		const buf = new Uint8Array(await file.arrayBuffer());
		const result = await parseCourseFile(file.name, buf);
		if (result.courses.length === 0) {
			return c.json(
				{
					error: "parse_failed",
					message: "未能解析出任何课程",
					details: result.errors,
				},
				400,
			);
		}

		const created: Course[] = [];
		const errors: string[] = [...result.errors];
		for (const draft of result.courses) {
			try {
				const course = buildCourseFromDraft(draft, parsed.userId);
				courses.set(course.id, course);
				created.push(course);
			} catch (e) {
				errors.push(
					`课程"${draft.title}"创建失败: ${e instanceof Error ? e.message : String(e)}`,
				);
			}
		}
		return c.json({ created: created.length, courses: created, errors }, 201);
	},
);

// 详情
coursesRouter.get("/:id", (c) => {
	const parsed = requireAuth(c);
	if (!parsed) return c.json({ error: "unauthorized", message: "未登录" }, 401);
	const id = c.req.param("id");
	const course = courses.get(id);
	if (!course)
		return c.json({ error: "not_found", message: "课程不存在" }, 404);
	const teacher = users.get(course.teacherId);
	const teacherProfile = teacherProfiles.get(course.teacherId);
	return c.json({
		course,
		teacher: teacher
			? { id: teacher.id, name: teacher.name, email: teacher.email }
			: null,
		teacherProfile,
	});
});

// 创建
coursesRouter.post(
	"/",
	requireRoles("admin", "academic_head", "teacher"),
	async (c) => {
		const body = await c.req.json();
		const id = uid("course");
		const now = new Date().toISOString();
		const course: Course = {
			id,
			title: body.title,
			stage: body.stage ?? "kaishu",
			level: body.level ?? "L1",
			style: body.style ?? "modern",
			audience: body.audience ?? "",
			cover:
				body.cover ??
				`https://placehold.co/600x400/c96442/efeee9?text=${encodeURIComponent(body.title?.slice(0, 6) ?? "新课")}`,
			intro: body.intro ?? "",
			teacherId: body.teacherId,
			prerequisites: body.prerequisites ?? [],
			totalUnits: body.totalUnits ?? 0,
			enrolledCount: 0,
			rating: 0,
			price: body.price ?? 0,
			modules: body.modules ?? [],
			status: body.status ?? "draft",
			createdAt: now,
		};
		courses.set(id, course);
		return c.json({ course }, 201);
	},
);

// 更新
coursesRouter.put(
	"/:id",
	requireRoles("admin", "academic_head", "teacher"),
	async (c) => {
		const id = c.req.param("id");
		const course = courses.get(id);
		if (!course)
			return c.json({ error: "not_found", message: "课程不存在" }, 404);
		const body = await c.req.json();
		const updated: Course = {
			...course,
			...body,
			id,
			createdAt: course.createdAt,
		};
		courses.set(id, updated);
		return c.json({ course: updated });
	},
);

// 删除
coursesRouter.delete("/:id", requireRoles("admin", "academic_head"), (c) => {
	const id = c.req.param("id");
	if (!courses.has(id))
		return c.json({ error: "not_found", message: "课程不存在" }, 404);
	courses.delete(id);
	return c.json({ ok: true });
});

// 选课
coursesRouter.post("/:id/enroll", async (c) => {
	const parsed = requireAuth(c);
	if (!parsed) return c.json({ error: "unauthorized", message: "未登录" }, 401);
	const id = c.req.param("id");
	const course = courses.get(id);
	if (!course)
		return c.json({ error: "not_found", message: "课程不存在" }, 404);
	if (parsed.role !== "student")
		return c.json({ error: "forbidden", message: "仅学生可选课" }, 403);
	// MVP：仅增加 enrolledCount，不维护选课关系表
	course.enrolledCount += 1;
	courses.set(id, course);
	return c.json({ ok: true, enrolledCount: course.enrolledCount });
});

// ============================================================
// 视频上传 / 下载
// ============================================================

const VIDEO_MAX_BYTES = 1024 * 1024 * 1024; // 1GB

// 在课程中查找指定单元（返回 module 索引和 unit 引用）
function findUnit(
	course: Course,
	unitId: string,
): { module: Course["modules"][number]; unitIndex: number } | null {
	for (const mod of course.modules) {
		const idx = mod.units.findIndex((u) => u.id === unitId);
		if (idx >= 0) return { module: mod, unitIndex: idx };
	}
	return null;
}

// POST /api/courses/:courseId/units/:unitId/video — 上传/替换单元视频
coursesRouter.post(
	"/:courseId/units/:unitId/video",
	requireRoles("admin", "academic_head", "teacher"),
	async (c) => {
		const parsed = requireAuth(c);
		if (!parsed)
			return c.json({ error: "unauthorized", message: "未登录" }, 401);

		const courseId = c.req.param("courseId");
		const unitId = c.req.param("unitId");
		const course = courses.get(courseId);
		if (!course)
			return c.json({ error: "not_found", message: "课程不存在" }, 404);

		const found = findUnit(course, unitId);
		if (!found)
			return c.json({ error: "not_found", message: "单元不存在" }, 404);

		// 教师只能上传自己课程的视频
		if (parsed.role === "teacher" && course.teacherId !== parsed.userId) {
			return c.json(
				{ error: "forbidden", message: "只能上传自己课程的视频" },
				403,
			);
		}

		const contentType = c.req.header("Content-Type") ?? "";
		if (!contentType.startsWith("video/")) {
			return c.json(
				{
					error: "invalid_content_type",
					message: "Content-Type 必须为 video/*",
				},
				400,
			);
		}

		const buf = await c.req.arrayBuffer();
		if (buf.byteLength === 0) {
			return c.json({ error: "empty_body", message: "视频数据为空" }, 400);
		}
		if (buf.byteLength > VIDEO_MAX_BYTES) {
			return c.json(
				{
					error: "too_large",
					message: "视频不能超过 1024MB",
				},
				400,
			);
		}

		// 若单元已有视频，删除旧记录
		const oldUrl = found.module.units[found.unitIndex].videoUrl;
		if (oldUrl) {
			const oldId = oldUrl.split("/").pop();
			if (oldId) videoRecords.delete(oldId);
		}

		const videoId = uid("video");
		videoRecords.set(videoId, {
			mime: contentType,
			data: new Uint8Array(buf),
			courseId,
			unitId,
		});

		const videoUrl = `/api/courses/${courseId}/units/${unitId}/video/${videoId}`;
		const updatedUnit = {
			...found.module.units[found.unitIndex],
			videoUrl,
			videoMime: contentType,
			videoSize: buf.byteLength,
		};
		found.module.units[found.unitIndex] = updatedUnit;
		courses.set(courseId, course);

		return c.json(
			{
				ok: true,
				videoUrl,
				videoId,
				videoSize: buf.byteLength,
				unit: updatedUnit,
			},
			201,
		);
	},
);

// DELETE /api/courses/:courseId/units/:unitId/video — 删除单元视频
coursesRouter.delete(
	"/:courseId/units/:unitId/video",
	requireRoles("admin", "academic_head", "teacher"),
	async (c) => {
		const parsed = requireAuth(c);
		if (!parsed)
			return c.json({ error: "unauthorized", message: "未登录" }, 401);

		const courseId = c.req.param("courseId");
		const unitId = c.req.param("unitId");
		const course = courses.get(courseId);
		if (!course)
			return c.json({ error: "not_found", message: "课程不存在" }, 404);

		const found = findUnit(course, unitId);
		if (!found)
			return c.json({ error: "not_found", message: "单元不存在" }, 404);

		if (parsed.role === "teacher" && course.teacherId !== parsed.userId) {
			return c.json(
				{ error: "forbidden", message: "只能删除自己课程的视频" },
				403,
			);
		}

		const oldUrl = found.module.units[found.unitIndex].videoUrl;
		if (oldUrl) {
			const oldId = oldUrl.split("/").pop();
			if (oldId) videoRecords.delete(oldId);
		}
		const updatedUnit = { ...found.module.units[found.unitIndex] };
		delete updatedUnit.videoUrl;
		delete updatedUnit.videoMime;
		delete updatedUnit.videoSize;
		found.module.units[found.unitIndex] = updatedUnit;
		courses.set(courseId, course);

		return c.json({ ok: true });
	},
);

// GET /api/courses/:courseId/units/:unitId/video/:videoId — 下载/播放视频（支持 Range）
coursesRouter.get("/:courseId/units/:unitId/video/:videoId", async (c) => {
	const parsed = requireAuth(c);
	if (!parsed) return c.json({ error: "unauthorized", message: "未登录" }, 401);

	const courseId = c.req.param("courseId");
	const unitId = c.req.param("unitId");
	const videoId = c.req.param("videoId");

	const record = videoRecords.get(videoId);
	if (!record || record.courseId !== courseId || record.unitId !== unitId) {
		return c.json({ error: "not_found", message: "视频不存在" }, 404);
	}

	const total = record.data.byteLength;
	const range = c.req.header("Range");

	if (range) {
		// 解析 bytes=start-end
		const m = /^bytes=(\d*)-(\d*)$/.exec(range);
		if (m) {
			const start = m[1] ? Number.parseInt(m[1], 10) : 0;
			let end = m[2] ? Number.parseInt(m[2], 10) : total - 1;
			if (start > end || start >= total) {
				return new Response(null, {
					status: 416,
					headers: { "Content-Range": `bytes */${total}` },
				});
			}
			if (end >= total) end = total - 1;
			const chunkSize = end - start + 1;
			const chunk = record.data.subarray(start, end + 1);
			return new Response(chunk.buffer.slice(start, end + 1) as ArrayBuffer, {
				status: 206,
				headers: {
					"Content-Type": record.mime,
					"Content-Length": String(chunkSize),
					"Content-Range": `bytes ${start}-${end}/${total}`,
					"Accept-Ranges": "bytes",
					"Cache-Control": "private, max-age=3600",
				},
			});
		}
	}

	return new Response(record.data.buffer as ArrayBuffer, {
		headers: {
			"Content-Type": record.mime,
			"Content-Length": String(total),
			"Accept-Ranges": "bytes",
			"Cache-Control": "private, max-age=3600",
		},
	});
});
