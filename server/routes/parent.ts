import { Hono } from "hono";
import {
	evaluations,
	parentProfiles,
	payments,
	studentProfiles,
	users,
} from "../db";
import type { Evaluation } from "../types";
import { getStudentSummary } from "./progress";
import { requireAuth, requireRoles } from "./users";

export const parentRouter = new Hono();

// ============================================================
// 工具函数
// ============================================================

/**
 * 校验亲子关系。返回 null 表示通过，否则返回 403 响应。
 */
function assertChildOf(
	parentId: string,
	childId: string,
	// biome-ignore lint/suspicious/noExplicitAny: Hono Context
	c: any,
) {
	const sp = studentProfiles.get(childId);
	if (!sp?.parentIds.includes(parentId)) {
		return c.json({ error: "forbidden", message: "无权查看该学生" }, 403);
	}
	return null;
}

// ============================================================
// GET /children — 家长的孩子列表
// ============================================================

parentRouter.get("/children", requireRoles("parent"), (c) => {
	const parsed = requireAuth(c);
	if (!parsed) return c.json({ error: "unauthorized", message: "未登录" }, 401);

	const parentId = parsed.userId;
	const pp = parentProfiles.get(parentId);
	if (!pp)
		return c.json({ error: "not_found", message: "家长档案不存在" }, 404);

	const children = pp.childIds.map((cid) => {
		const user = users.get(cid);
		const profile = studentProfiles.get(cid);
		const summary = getStudentSummary(cid);
		return {
			user: user ? { ...user, password: "" } : null,
			profile: profile ?? null,
			summary: summary?.summary ?? null,
		};
	});

	return c.json({ parentId, children });
});

// ============================================================
// GET /children/:childId/progress — 单个孩子的学习进度
// ============================================================

parentRouter.get("/children/:childId/progress", requireRoles("parent"), (c) => {
	const parsed = requireAuth(c);
	if (!parsed) return c.json({ error: "unauthorized", message: "未登录" }, 401);

	const childId = c.req.param("childId");
	const forbidden = assertChildOf(parsed.userId, childId, c);
	if (forbidden) return forbidden;

	const result = getStudentSummary(childId);
	if (!result)
		return c.json({ error: "not_found", message: "学生档案不存在" }, 404);

	return c.json(result);
});

// ============================================================
// GET /payments — 缴费列表
// ============================================================

parentRouter.get("/payments", requireRoles("parent"), (c) => {
	const parsed = requireAuth(c);
	if (!parsed) return c.json({ error: "unauthorized", message: "未登录" }, 401);

	const list = Array.from(payments.values())
		.filter((p) => p.parentId === parsed.userId)
		.sort((a, b) => b.dueAt.localeCompare(a.dueAt));

	return c.json({
		parentId: parsed.userId,
		count: list.length,
		payments: list,
	});
});

// ============================================================
// GET /payments/:id — 单笔缴费详情
// ============================================================

parentRouter.get("/payments/:id", requireRoles("parent"), (c) => {
	const parsed = requireAuth(c);
	if (!parsed) return c.json({ error: "unauthorized", message: "未登录" }, 401);

	const id = c.req.param("id");
	const p = payments.get(id);
	if (!p) return c.json({ error: "not_found", message: "缴费记录不存在" }, 404);
	if (p.parentId !== parsed.userId)
		return c.json({ error: "forbidden", message: "无权查看" }, 403);

	return c.json({ payment: p });
});

// ============================================================
// GET /evaluations — 我提交过的评价
// ============================================================

parentRouter.get("/evaluations", requireRoles("parent"), (c) => {
	const parsed = requireAuth(c);
	if (!parsed) return c.json({ error: "unauthorized", message: "未登录" }, 401);

	const list = Array.from(evaluations.values())
		.filter((e) => e.authorId === parsed.userId)
		.sort((a, b) => b.createdAt.localeCompare(a.createdAt));

	return c.json({
		parentId: parsed.userId,
		count: list.length,
		evaluations: list,
	});
});

// ============================================================
// POST /evaluations — 提交评价
// ============================================================

parentRouter.post("/evaluations", requireRoles("parent"), async (c) => {
	const parsed = requireAuth(c);
	if (!parsed) return c.json({ error: "unauthorized", message: "未登录" }, 401);

	let body: {
		targetType?: "teacher" | "student" | "course";
		targetId?: string;
		rating?: number;
		comment?: string;
	};
	try {
		body = await c.req.json();
	} catch {
		body = {};
	}

	if (
		body.targetType !== "teacher" &&
		body.targetType !== "student" &&
		body.targetType !== "course"
	) {
		return c.json(
			{
				error: "invalid_target",
				message: "targetType 必须为 teacher/student/course",
			},
			400,
		);
	}

	if (typeof body.rating !== "number" || body.rating < 1 || body.rating > 5) {
		return c.json(
			{ error: "invalid_rating", message: "rating 必须为 1-5 的整数" },
			400,
		);
	}

	if (!body.targetId) {
		return c.json({ error: "invalid_target", message: "缺少 targetId" }, 400);
	}

	const ev: Evaluation = {
		id: `eval_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
		targetType: body.targetType,
		targetId: body.targetId,
		authorId: parsed.userId,
		rating: Math.round(body.rating),
		comment: body.comment ?? "",
		createdAt: new Date().toISOString(),
	};
	evaluations.set(ev.id, ev);

	return c.json({ ok: true, evaluation: ev }, 201);
});
