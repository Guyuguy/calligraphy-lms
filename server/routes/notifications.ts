import { Hono } from "hono";
import { courses, notifications, schedules, uid, users } from "../db";
import type { Notification, NotificationType, Schedule } from "../types";
import { requireAuth } from "./users";

export const notificationsRouter = new Hono();

// ============================================================
// 共享 helper：创建通知（供其他路由复用）
// ============================================================

export function createNotification(
	userId: string,
	type: NotificationType,
	title: string,
	body: string,
	meta?: Record<string, unknown>,
): Notification {
	const n: Notification = {
		id: uid("notif"),
		userId,
		type,
		title,
		body,
		read: false,
		createdAt: new Date().toISOString(),
		meta,
	};
	notifications.set(n.id, n);
	return n;
}

// ============================================================
// 课前提醒生成（幂等）
// ============================================================

/**
 * 计算某排课下一次发生的时间（基于 weekday + startHour）。
 * 返回 60 分钟内即将开始的课程时间，否则返回 null。
 */
function nextOccurrenceWithinHour(s: Schedule): Date | null {
	const now = new Date();
	// 找到下一个匹配 weekday 的日期
	for (let offset = 0; offset <= 7; offset++) {
		const candidate = new Date(now);
		candidate.setDate(candidate.getDate() + offset);
		if (candidate.getDay() !== s.weekday) continue;
		candidate.setHours(s.startHour, 0, 0, 0);
		const diff = candidate.getTime() - now.getTime();
		// 0 < diff <= 60min 即将开始（含今天已开始但未过 1 小时）
		if (diff > 0 && diff <= 3600_000) return candidate;
		// 今天已开始但还在 1 小时内（diff 为负但绝对值小于 1 小时）
		if (diff <= 0 && diff >= -3600_000) return candidate;
	}
	return null;
}

/**
 * 扫描所有排课，为 60 分钟内即将开始的课程生成课前提醒。
 * 幂等：通过 notification.meta.window 标记去重。
 */
function generateClassReminders(): void {
	for (const s of schedules.values()) {
		const next = nextOccurrenceWithinHour(s);
		if (!next) continue;
		const windowKey = `${s.id}:${next.toISOString().slice(0, 16)}`;
		const courseTitle = courses.get(s.courseId)?.title ?? "未命名课程";
		const body = `${courseTitle} 将于 ${next.toLocaleString("zh-CN", { hour: "2-digit", minute: "2-digit", month: "2-digit", day: "2-digit" })} 开始，请提前准备。`;
		const recipients = new Set<string>([...s.studentIds, s.teacherId]);
		for (const rid of recipients) {
			if (!users.has(rid)) continue;
			const dup = Array.from(notifications.values()).some(
				(n) =>
					n.userId === rid &&
					n.type === "class_reminder" &&
					n.meta?.window === windowKey,
			);
			if (!dup) {
				createNotification(rid, "class_reminder", "课前提醒", body, {
					window: windowKey,
				});
			}
		}
	}
}

// ============================================================
// GET / — 列表（支持 read/limit/offset 筛选）
// ============================================================

notificationsRouter.get("/", (c) => {
	const parsed = requireAuth(c);
	if (!parsed) return c.json({ error: "unauthorized", message: "未登录" }, 401);

	// 每次拉取时尝试生成课前提醒（幂等）
	generateClassReminders();

	const readFilter = c.req.query("read"); // true | false | undefined
	const limit = Math.min(Number(c.req.query("limit") ?? 30), 100);
	const offset = Number(c.req.query("offset") ?? 0);

	let list = Array.from(notifications.values()).filter(
		(n) => n.userId === parsed.userId,
	);
	if (readFilter === "true") list = list.filter((n) => n.read);
	else if (readFilter === "false") list = list.filter((n) => !n.read);

	list.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
	const total = list.length;
	const paged = list.slice(offset, offset + limit);

	return c.json({
		userId: parsed.userId,
		total,
		limit,
		offset,
		notifications: paged,
	});
});

// ============================================================
// GET /unread-count — 未读数
// ============================================================

notificationsRouter.get("/unread-count", (c) => {
	const parsed = requireAuth(c);
	if (!parsed) return c.json({ error: "unauthorized", message: "未登录" }, 401);

	// 同时刷新课前提醒
	generateClassReminders();

	const count = Array.from(notifications.values()).filter(
		(n) => n.userId === parsed.userId && !n.read,
	).length;
	return c.json({ userId: parsed.userId, count });
});

// ============================================================
// POST /:id/read — 标记单条已读
// ============================================================

notificationsRouter.post("/:id/read", (c) => {
	const parsed = requireAuth(c);
	if (!parsed) return c.json({ error: "unauthorized", message: "未登录" }, 401);

	const id = c.req.param("id");
	const n = notifications.get(id);
	if (!n) return c.json({ error: "not_found", message: "通知不存在" }, 404);
	if (n.userId !== parsed.userId)
		return c.json({ error: "forbidden", message: "无权操作" }, 403);

	notifications.set(id, { ...n, read: true });
	return c.json({ ok: true });
});

// ============================================================
// POST /read-all — 全部标记已读
// ============================================================

notificationsRouter.post("/read-all", (c) => {
	const parsed = requireAuth(c);
	if (!parsed) return c.json({ error: "unauthorized", message: "未登录" }, 401);

	let updated = 0;
	for (const [id, n] of notifications.entries()) {
		if (n.userId === parsed.userId && !n.read) {
			notifications.set(id, { ...n, read: true });
			updated++;
		}
	}
	return c.json({ ok: true, updated });
});

// ============================================================
// DELETE /:id — 删除通知
// ============================================================

notificationsRouter.delete("/:id", (c) => {
	const parsed = requireAuth(c);
	if (!parsed) return c.json({ error: "unauthorized", message: "未登录" }, 401);

	const id = c.req.param("id");
	const n = notifications.get(id);
	if (!n) return c.json({ error: "not_found", message: "通知不存在" }, 404);
	if (n.userId !== parsed.userId)
		return c.json({ error: "forbidden", message: "无权操作" }, 403);

	notifications.delete(id);
	return c.json({ ok: true });
});
