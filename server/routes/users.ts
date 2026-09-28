import { Hono } from "hono";
import {
	parentProfiles,
	studentProfiles,
	teacherProfiles,
	uid,
	users,
} from "../db";
import type {
	ParentProfile,
	Role,
	StudentProfile,
	TeacherProfile,
	User,
} from "../types";
import { parseToken } from "./auth";

export const usersRouter = new Hono();

// 鉴权中间件
// biome-ignore lint/suspicious/noExplicitAny: Hono Context typing is complex across versions
function requireAuth(c: any): { userId: string; role: string } | null {
	const authHeader = c.req.header("Authorization") ?? "";
	const token = authHeader.startsWith("Bearer ") ? authHeader.slice(7) : "";
	return parseToken(token);
}

function requireRoles(...roles: Role[]) {
	// biome-ignore lint/suspicious/noExplicitAny: Hono middleware typing
	return (c: any, next: any) => {
		const parsed = requireAuth(c);
		if (!parsed)
			return c.json({ error: "unauthorized", message: "未登录" }, 401);
		if (!roles.includes(parsed.role as Role)) {
			return c.json({ error: "forbidden", message: "权限不足" }, 403);
		}
		return next();
	};
}

// 列表（支持 role 筛选）
usersRouter.get("/", (c) => {
	const parsed = requireAuth(c);
	if (!parsed) return c.json({ error: "unauthorized", message: "未登录" }, 401);
	const role = c.req.query("role") as Role | undefined;
	let list = Array.from(users.values());
	if (role) list = list.filter((u) => u.role === role);
	// 不返回密码
	return c.json({ users: list.map(({ password, ...rest }) => rest) });
});

// 详情（含角色专属 profile）
usersRouter.get("/:id", (c) => {
	const parsed = requireAuth(c);
	if (!parsed) return c.json({ error: "unauthorized", message: "未登录" }, 401);
	const id = c.req.param("id");
	const user = users.get(id);
	if (!user) return c.json({ error: "not_found", message: "用户不存在" }, 404);
	const { password, ...safeUser } = user;
	const result: {
		user: Omit<User, "password">;
		profile?: StudentProfile | TeacherProfile | ParentProfile | null;
	} = { user: safeUser };
	if (user.role === "student") {
		result.profile = studentProfiles.get(id ?? "") ?? null;
	} else if (user.role === "teacher") {
		result.profile = teacherProfiles.get(id ?? "") ?? null;
	} else if (user.role === "parent") {
		result.profile = parentProfiles.get(id ?? "") ?? null;
	}
	return c.json(result);
});

// 创建（仅管理员）
usersRouter.post("/", requireRoles("admin", "academic_head"), async (c) => {
	const body = await c.req.json();
	const id = uid(`user_${body.role}`);
	const newUser: User = {
		id,
		role: body.role,
		username: body.username,
		password: body.password ?? "pass123",
		name: body.name,
		email: body.email ?? "",
		phone: body.phone ?? "",
		createdAt: new Date().toISOString(),
	};
	users.set(id, newUser);

	if (body.role === "student") {
		const sp: StudentProfile = {
			userId: id,
			grade: body.grade ?? "",
			school: body.school ?? "",
			parentIds: body.parentIds ?? [],
			currentStage: body.currentStage ?? "kaishu",
			currentLevel: body.currentLevel ?? "L1",
			handedness: body.handedness ?? "right",
			learningGoal: body.learningGoal ?? "interest",
			preferredStyles: body.preferredStyles ?? ["modern"],
			skillRadar: body.skillRadar ?? {
				strokes: 30,
				structure: 30,
				layout: 30,
				speed: 30,
				stability: 30,
			},
			totalPracticeMinutes: 0,
			streakDays: 0,
		};
		studentProfiles.set(id, sp);
	} else if (body.role === "teacher") {
		const tp: TeacherProfile = {
			userId: id,
			stages: body.stages ?? ["kaishu"],
			bio: body.bio ?? "",
			qualifications: body.qualifications ?? "",
			teachingYears: body.teachingYears ?? 0,
			availability: body.availability ?? [],
			workloadHoursPerWeek: 0,
			rating: 0,
			studentCount: 0,
		};
		teacherProfiles.set(id, tp);
	} else if (body.role === "parent") {
		const pp: ParentProfile = { userId: id, childIds: body.childIds ?? [] };
		parentProfiles.set(id, pp);
	}

	return c.json({ id, user: newUser }, 201);
});

// 更新
usersRouter.put("/:id", requireRoles("admin", "academic_head"), async (c) => {
	const id = c.req.param("id");
	const user = users.get(id);
	if (!user) return c.json({ error: "not_found", message: "用户不存在" }, 404);
	const body = await c.req.json();
	const updated: User = {
		...user,
		name: body.name ?? user.name,
		email: body.email ?? user.email,
		phone: body.phone ?? user.phone,
		password: body.password ?? user.password,
	};
	users.set(id, updated);

	if (user.role === "student" && body.profile) {
		const sp = studentProfiles.get(id);
		if (sp) studentProfiles.set(id, { ...sp, ...body.profile });
	} else if (user.role === "teacher" && body.profile) {
		const tp = teacherProfiles.get(id);
		if (tp) teacherProfiles.set(id, { ...tp, ...body.profile });
	} else if (user.role === "parent" && body.profile) {
		const pp = parentProfiles.get(id);
		if (pp) parentProfiles.set(id, { ...pp, ...body.profile });
	}

	return c.json({ user: updated });
});

// 删除
usersRouter.delete("/:id", requireRoles("admin"), (c) => {
	const id = c.req.param("id");
	if (!users.has(id))
		return c.json({ error: "not_found", message: "用户不存在" }, 404);
	users.delete(id);
	studentProfiles.delete(id);
	teacherProfiles.delete(id);
	parentProfiles.delete(id);
	return c.json({ ok: true });
});

export { requireAuth, requireRoles };
