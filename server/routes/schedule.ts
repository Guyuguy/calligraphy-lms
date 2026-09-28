import { Hono } from "hono";
import {
	classrooms,
	courses,
	schedules,
	teacherProfiles,
	uid,
	users,
} from "../db";
import type { Schedule, ScheduleMode } from "../types";
import { requireAuth, requireRoles } from "./users";

export const scheduleRouter = new Hono();

// ============================================================
// 冲突检测
// ============================================================

interface Conflict {
	type: "teacher" | "student" | "classroom";
	message: string;
	conflictWith?: string; // 已存在的 schedule id
}

export function detectConflicts(
	candidate: Omit<Schedule, "id">,
	excludeId?: string,
): Conflict[] {
	const conflicts: Conflict[] = [];
	const all = Array.from(schedules.values()).filter((s) => s.id !== excludeId);

	for (const s of all) {
		// 时间重叠判定：同一天 + 时段相交
		if (s.weekday !== candidate.weekday) continue;
		const overlap =
			s.startHour < candidate.endHour && candidate.startHour < s.endHour;
		if (!overlap) continue;

		// 教师冲突
		if (s.teacherId === candidate.teacherId) {
			conflicts.push({
				type: "teacher",
				message: `教师此时段已有其他课程（${courses.get(s.courseId)?.title ?? "未知"}）`,
				conflictWith: s.id,
			});
		}

		// 教室冲突
		if (s.classroomId === candidate.classroomId) {
			conflicts.push({
				type: "classroom",
				message: `教室此时段已被占用（${courses.get(s.courseId)?.title ?? "未知"}）`,
				conflictWith: s.id,
			});
		}

		// 学生冲突（交集）
		const studentOverlap = candidate.studentIds.filter((sid) =>
			s.studentIds.includes(sid),
		);
		if (studentOverlap.length > 0) {
			const names = studentOverlap
				.map((sid) => users.get(sid)?.name ?? sid)
				.slice(0, 3)
				.join("、");
			conflicts.push({
				type: "student",
				message: `${studentOverlap.length} 名学生此时段已有课（${names}等）`,
				conflictWith: s.id,
			});
		}
	}

	return conflicts;
}

// ============================================================
// 路由
// ============================================================

// 列表（支持多种视角筛选）
scheduleRouter.get("/", (c) => {
	const parsed = requireAuth(c);
	if (!parsed) return c.json({ error: "unauthorized", message: "未登录" }, 401);

	const role = c.req.query("role") as string | undefined;
	const userId = c.req.query("userId");
	const classroomId = c.req.query("classroomId");
	const weekday = c.req.query("weekday");

	let list = Array.from(schedules.values());

	if (userId) {
		if (role === "teacher") {
			list = list.filter((s) => s.teacherId === userId);
		} else if (role === "student") {
			list = list.filter((s) => s.studentIds.includes(userId));
		}
	}
	if (classroomId) list = list.filter((s) => s.classroomId === classroomId);
	if (weekday) list = list.filter((s) => String(s.weekday) === weekday);

	// 附带课程名、教师名、教室名
	const enriched = list.map((s) => {
		const course = courses.get(s.courseId);
		const teacher = users.get(s.teacherId);
		const classroom = classrooms.get(s.classroomId);
		return {
			...s,
			courseTitle: course?.title ?? "未知课程",
			courseCover: course?.cover ?? "",
			stage: course?.stage,
			level: course?.level,
			teacherName: teacher?.name ?? "未知教师",
			classroomName: classroom?.name ?? "未知教室",
			classroomLocation: classroom?.location ?? "",
			studentCount: s.studentIds.length,
		};
	});

	return c.json({ schedules: enriched });
});

// 详情
scheduleRouter.get("/:id", (c) => {
	const parsed = requireAuth(c);
	if (!parsed) return c.json({ error: "unauthorized", message: "未登录" }, 401);
	const id = c.req.param("id");
	const s = schedules.get(id);
	if (!s) return c.json({ error: "not_found", message: "排课不存在" }, 404);
	return c.json({ schedule: s });
});

// 冲突预检（创建前调用）
scheduleRouter.post("/check", async (c) => {
	const parsed = requireAuth(c);
	if (!parsed) return c.json({ error: "unauthorized", message: "未登录" }, 401);
	const body = await c.req.json();
	const conflicts = detectConflicts(body);
	return c.json({ conflicts, ok: conflicts.length === 0 });
});

// 创建
scheduleRouter.post("/", requireRoles("admin", "academic_head"), async (c) => {
	const body = await c.req.json();

	// 校验必填
	if (
		!body.courseId ||
		!body.teacherId ||
		!body.classroomId ||
		!body.weekday ||
		!body.startHour ||
		!body.endHour
	) {
		return c.json({ error: "invalid_params", message: "缺少必填字段" }, 400);
	}
	if (body.startHour >= body.endHour) {
		return c.json(
			{ error: "invalid_time", message: "开始时间必须早于结束时间" },
			400,
		);
	}

	// 冲突检测
	const conflicts = detectConflicts(body);
	if (conflicts.length > 0 && !body.force) {
		return c.json(
			{ error: "conflict", message: "存在排课冲突", conflicts },
			409,
		);
	}

	const id = uid("schedule");
	const newSchedule: Schedule = {
		id,
		courseId: body.courseId,
		teacherId: body.teacherId,
		classroomId: body.classroomId,
		weekday: Number(body.weekday),
		startHour: Number(body.startHour),
		endHour: Number(body.endHour),
		mode: (body.mode ?? "fixed_class") as ScheduleMode,
		startDate: body.startDate ?? new Date().toISOString().slice(0, 10),
		endDate: body.endDate ?? "2026-12-31",
		studentIds: body.studentIds ?? [],
	};
	schedules.set(id, newSchedule);
	return c.json({ schedule: newSchedule }, 201);
});

// 调课（修改时间/教室）
scheduleRouter.put(
	"/:id",
	requireRoles("admin", "academic_head"),
	async (c) => {
		const id = c.req.param("id");
		const existing = schedules.get(id);
		if (!existing)
			return c.json({ error: "not_found", message: "排课不存在" }, 404);

		const body = await c.req.json();
		const candidate: Omit<Schedule, "id"> = {
			courseId: body.courseId ?? existing.courseId,
			teacherId: body.teacherId ?? existing.teacherId,
			classroomId: body.classroomId ?? existing.classroomId,
			weekday: Number(body.weekday ?? existing.weekday),
			startHour: Number(body.startHour ?? existing.startHour),
			endHour: Number(body.endHour ?? existing.endHour),
			mode: body.mode ?? existing.mode,
			startDate: body.startDate ?? existing.startDate,
			endDate: body.endDate ?? existing.endDate,
			studentIds: body.studentIds ?? existing.studentIds,
		};

		const conflicts = detectConflicts(candidate, id);
		if (conflicts.length > 0 && !body.force) {
			return c.json(
				{ error: "conflict", message: "调课后存在冲突", conflicts },
				409,
			);
		}

		const updated: Schedule = { ...candidate, id };
		schedules.set(id, updated);
		return c.json({ schedule: updated });
	},
);

// 删除
scheduleRouter.delete("/:id", requireRoles("admin", "academic_head"), (c) => {
	const id = c.req.param("id");
	if (!schedules.has(id))
		return c.json({ error: "not_found", message: "排课不存在" }, 404);
	schedules.delete(id);
	return c.json({ ok: true });
});

// ============================================================
// 教室
// ============================================================

export const classroomRouter = new Hono();

classroomRouter.get("/", (c) => {
	const parsed = requireAuth(c);
	if (!parsed) return c.json({ error: "unauthorized", message: "未登录" }, 401);
	return c.json({ classrooms: Array.from(classrooms.values()) });
});

classroomRouter.post("/", requireRoles("admin", "academic_head"), async (c) => {
	const body = await c.req.json();
	const id = uid("classroom");
	const room = {
		id,
		name: body.name,
		capacity: Number(body.capacity ?? 30),
		location: body.location ?? "",
	};
	classrooms.set(id, room);
	return c.json({ classroom: room }, 201);
});

// 教室占用情况（按 weekday 返回该教室的所有排课）
classroomRouter.get("/:id/occupancy", (c) => {
	const parsed = requireAuth(c);
	if (!parsed) return c.json({ error: "unauthorized", message: "未登录" }, 401);
	const id = c.req.param("id");
	const list = Array.from(schedules.values())
		.filter((s) => s.classroomId === id)
		.map((s) => ({
			id: s.id,
			weekday: s.weekday,
			startHour: s.startHour,
			endHour: s.endHour,
			courseTitle: courses.get(s.courseId)?.title ?? "",
			teacherName: users.get(s.teacherId)?.name ?? "",
		}));
	return c.json({ occupancy: list });
});

// ============================================================
// 教师可授课时段（从 teacherProfile.availability 读取）
// ============================================================

scheduleRouter.get("/availability/:teacherId", (c) => {
	const parsed = requireAuth(c);
	if (!parsed) return c.json({ error: "unauthorized", message: "未登录" }, 401);
	const teacherId = c.req.param("teacherId");
	const profile = teacherProfiles.get(teacherId);
	if (!profile)
		return c.json({ error: "not_found", message: "教师档案不存在" }, 404);

	// 排除已被排课占用的时段
	const occupied = Array.from(schedules.values())
		.filter((s) => s.teacherId === teacherId)
		.map((s) => ({
			weekday: s.weekday,
			startHour: s.startHour,
			endHour: s.endHour,
		}));

	const available = profile.availability.filter((slot) => {
		return !occupied.some(
			(o) =>
				o.weekday === slot.weekday &&
				!(o.endHour <= slot.startHour || o.startHour >= slot.endHour),
		);
	});

	return c.json({ availability: available, occupied });
});

// ============================================================
// 学生课表冲突查询（学生选课时检查）
// ============================================================

scheduleRouter.get("/student/:studentId/conflicts", (c) => {
	const parsed = requireAuth(c);
	if (!parsed) return c.json({ error: "unauthorized", message: "未登录" }, 401);
	const studentId = c.req.param("studentId");
	const studentSchedules = Array.from(schedules.values()).filter((s) =>
		s.studentIds.includes(studentId),
	);
	return c.json({
		schedules: studentSchedules.map((s) => ({
			id: s.id,
			weekday: s.weekday,
			startHour: s.startHour,
			endHour: s.endHour,
			courseTitle: courses.get(s.courseId)?.title ?? "",
			teacherName: users.get(s.teacherId)?.name ?? "",
		})),
	});
});
