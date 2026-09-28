import { Hono } from "hono";
import { courses, progress, studentProfiles, teacherProfiles } from "../db";
import type { Course, Level, RecommendationItem, Stage } from "../types";
import { requireAuth } from "./users";

export const recommendationsRouter = new Hono();

// 多维加权推荐引擎
// 维度：基础匹配 30% + 能力阶梯 25% + 兴趣画像 20% + 教师契合度 15% + 同伴推荐 10%

function stageMatchScore(courseStage: Stage, studentStage: Stage): number {
	if (courseStage === studentStage) return 1.0;
	// 楷书是其他书体的基础
	if (courseStage === "kaishu" && studentStage !== "kaishu") return 0.6;
	return 0.3;
}

function levelMatchScore(courseLevel: Level, studentLevel: Level): number {
	const order: Record<Level, number> = {
		L1: 1,
		L2: 2,
		L3: 3,
		L4: 4,
		L5: 5,
		L6: 6,
	};
	const diff = order[courseLevel] - order[studentLevel];
	// 推荐略高于当前水平（+1）的课程
	if (diff === 1) return 1.0;
	if (diff === 0) return 0.8;
	if (diff === 2) return 0.6;
	if (diff === -1) return 0.5;
	if (diff > 2) return 0.2;
	return 0.1;
}

function styleMatchScore(
	courseStyle: Course["style"],
	preferredStyles: Course["style"][],
): number {
	if (preferredStyles.includes(courseStyle)) return 1.0;
	return 0.3;
}

function prerequisiteScore(course: Course, studentId: string): number {
	if (course.prerequisites.length === 0) return 1.0;
	let completed = 0;
	for (const preId of course.prerequisites) {
		const preCourse = courses.get(preId);
		if (!preCourse) continue;
		const allUnits = preCourse.modules.flatMap((m) => m.units);
		const completedUnits = allUnits.filter((u) => {
			const p = progress.get(`${studentId}:${u.id}`);
			return p?.status === "completed";
		}).length;
		if (allUnits.length > 0 && completedUnits / allUnits.length >= 0.7)
			completed += 1;
	}
	return completed / course.prerequisites.length;
}

function teacherMatchScore(course: Course, _studentId: string): number {
	// MVP：基于教师评分与学生偏好风格的匹配
	const teacher = teacherProfiles.get(course.teacherId);
	if (!teacher) return 0.5;
	// 评分越高越推荐
	return Math.min(1.0, teacher.rating / 5.0);
}

function peerScore(course: Course, _studentId: string): number {
	// MVP：基于已选人数归一化
	const maxEnrolled = Math.max(
		...Array.from(courses.values()).map((c) => c.enrolledCount),
		1,
	);
	return course.enrolledCount / maxEnrolled;
}

recommendationsRouter.get("/:studentId", (c) => {
	const parsed = requireAuth(c);
	if (!parsed) return c.json({ error: "unauthorized", message: "未登录" }, 401);

	const studentId = c.req.param("studentId");
	const profile = studentProfiles.get(studentId);
	if (!profile)
		return c.json({ error: "not_found", message: "学生档案不存在" }, 404);

	const allCourses = Array.from(courses.values()).filter(
		(c) => c.status === "published",
	);
	const items: RecommendationItem[] = [];

	for (const course of allCourses) {
		const sStage = stageMatchScore(course.stage, profile.currentStage);
		const sLevel = levelMatchScore(course.level, profile.currentLevel);
		const sStyle = styleMatchScore(course.style, profile.preferredStyles);
		const sPrereq = prerequisiteScore(course, studentId);
		const sTeacher = teacherMatchScore(course, studentId);
		const sPeer = peerScore(course, studentId);

		const total =
			sStage * 0.3 +
			sLevel * 0.25 +
			sStyle * 0.2 +
			sTeacher * 0.15 +
			sPeer * 0.05 +
			sPrereq * 0.05;

		const reasons: string[] = [];
		if (sStage >= 0.9)
			reasons.push(
				`与你当前学习的「${stageLabel(profile.currentStage)}」阶段匹配`,
			);
		if (sLevel >= 0.9)
			reasons.push(`难度刚好在你当前 ${profile.currentLevel} 之上一步`);
		if (sStyle >= 0.9)
			reasons.push(`符合你偏好的「${styleLabel(course.style)}」风格`);
		if (sPrereq >= 0.9 && course.prerequisites.length > 0)
			reasons.push("已满足前置课程要求");
		if (sTeacher >= 0.9) reasons.push("主讲教师评分优秀");
		if (sPeer >= 0.7) reasons.push("同学员热门选择");

		items.push({ course, score: Number(total.toFixed(3)), reasons });
	}

	items.sort((a, b) => b.score - a.score);
	return c.json({ recommendations: items.slice(0, 5) });
});

function stageLabel(s: Stage): string {
	return { kaishu: "楷书", xingshu: "行书", lishu: "隶书", kuaiXie: "快写" }[s];
}

function styleLabel(s: Course["style"]): string {
	return {
		ou: "欧体",
		yan: "颜体",
		liu: "柳体",
		zhao: "赵体",
		shoujin: "瘦金体",
		modern: "现代硬笔",
	}[s];
}
