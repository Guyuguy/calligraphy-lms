import { Hono } from "hono";
import { courses, teacherProfiles, uid, users } from "../db";
import type { Course, Level, Stage, Style } from "../types";
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
