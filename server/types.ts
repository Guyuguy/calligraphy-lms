// 硬笔书法教学管理系统 — 共享类型定义

// ============================================================
// 用户与角色
// ============================================================

export type Role =
	| "admin"
	| "academic_head"
	| "teacher"
	| "ta"
	| "student"
	| "parent";

export type Stage = "kaishu" | "xingshu" | "lishu" | "kuaiXie"; // 楷/行/隶/快写
export type Level = "L1" | "L2" | "L3" | "L4" | "L5" | "L6";
export type Style = "ou" | "yan" | "liu" | "zhao" | "shoujin" | "modern"; // 欧/颜/柳/赵/瘦金/现代硬笔
export type Handedness = "left" | "right";

export interface User {
	id: string;
	role: Role;
	username: string;
	password: string; // MVP 明文，生产环境需 bcrypt
	name: string;
	email: string;
	phone: string;
	avatar?: string;
	createdAt: string;
}

export interface SkillRadar {
	strokes: number; // 笔画
	structure: number; // 结构
	layout: number; // 章法
	speed: number; // 速度
	stability: number; // 稳定性
}

export interface StudentProfile {
	userId: string;
	grade: string; // 年级
	school: string;
	parentIds: string[];
	currentStage: Stage;
	currentLevel: Level;
	handedness: Handedness;
	learningGoal: "interest" | "grade_exam" | "competition" | "daily_writing";
	preferredStyles: Style[];
	skillRadar: SkillRadar;
	totalPracticeMinutes: number;
	streakDays: number;
}

export interface AvailabilitySlot {
	weekday: number; // 0-6 (Sun-Sat)
	startHour: number; // 0-23
	endHour: number;
}

export interface TeacherProfile {
	userId: string;
	stages: Stage[];
	bio: string;
	qualifications: string;
	teachingYears: number;
	availability: AvailabilitySlot[];
	workloadHoursPerWeek: number;
	rating: number;
	studentCount: number;
}

export interface ParentProfile {
	userId: string;
	childIds: string[];
}

// ============================================================
// 课程
// ============================================================

export type UnitType =
	| "video"
	| "live"
	| "stroke_lesson"
	| "reference_char"
	| "tracing_exercise"
	| "assignment"
	| "quiz";

export interface CompletionCriteria {
	watchSeconds?: number;
	minSubmissions?: number;
	minQuizScore?: number;
}

export interface Unit {
	id: string;
	moduleId: string;
	title: string;
	type: UnitType;
	description: string;
	order: number;
	durationMinutes: number;
	completionCriteria: CompletionCriteria;
}

export interface Module {
	id: string;
	courseId: string;
	title: string;
	description: string;
	order: number;
	units: Unit[];
}

export interface Course {
	id: string;
	title: string;
	stage: Stage;
	level: Level;
	style: Style;
	audience: string;
	cover: string;
	intro: string;
	teacherId: string;
	prerequisites: string[]; // 课程 ID
	totalUnits: number;
	enrolledCount: number;
	rating: number;
	price: number;
	modules: Module[];
	status: "draft" | "published" | "archived";
	createdAt: string;
}

// ============================================================
// 排课
// ============================================================

export type ScheduleMode =
	| "fixed_class"
	| "one_on_one"
	| "small_group"
	| "recorded_qa";

export interface Schedule {
	id: string;
	courseId: string;
	teacherId: string;
	classroomId: string;
	weekday: number;
	startHour: number;
	endHour: number;
	mode: ScheduleMode;
	startDate: string;
	endDate: string;
	studentIds: string[];
}

export interface Classroom {
	id: string;
	name: string;
	capacity: number;
	location: string;
}

// ============================================================
// 学习进度
// ============================================================

export type ProgressStatus =
	| "not_started"
	| "in_progress"
	| "completed"
	| "mastered";

export interface Progress {
	studentId: string;
	unitId: string;
	courseId: string;
	status: ProgressStatus;
	percent: number;
	lastActivityAt: string;
	videoWatchedSeconds: number;
	practiceCount: number;
	submissionCount: number;
	quizScore: number | null;
}

export interface SkillRadarSnapshot {
	studentId: string;
	timestamp: string;
	radar: SkillRadar;
}

export interface PracticeDay {
	studentId: string;
	date: string; // YYYY-MM-DD
	minutes: number;
}

// ============================================================
// 作业与作品
// ============================================================

export interface Assignment {
	id: string;
	unitId: string;
	courseId: string;
	title: string;
	description: string;
	dueAt: string;
	totalScore: number;
}

export interface Submission {
	id: string;
	assignmentId: string;
	studentId: string;
	content: string;
	imageUrl?: string;
	submittedAt: string;
	version: number;
	score: number | null;
	teacherComment?: string;
	teacherAudioUrl?: string;
	reviewedAt?: string;
	reviewedBy?: string;
}

export interface Artwork {
	id: string;
	studentId: string;
	title: string;
	imageUrl: string;
	createdAt: string;
	isFeatured: boolean;
	submissionId?: string;
}

export interface Annotation {
	id: string;
	artworkId: string;
	x: number;
	y: number;
	type: "circle" | "arrow" | "text";
	content: string;
	authorId: string;
}

// ============================================================
// 评价
// ============================================================

export interface Evaluation {
	id: string;
	targetType: "teacher" | "student" | "course";
	targetId: string;
	authorId: string;
	rating: number;
	comment: string;
	createdAt: string;
}

// ============================================================
// 缴费
// ============================================================

export interface Payment {
	id: string;
	studentId: string;
	parentId: string;
	title: string;
	amount: number;
	dueAt: string;
	status: "pending" | "paid" | "overdue";
	createdAt: string;
	paidAt?: string;
}

// ============================================================
// 通知
// ============================================================

export type NotificationType =
	| "class_reminder"
	| "assignment_due"
	| "review_completed"
	| "reschedule"
	| "payment_due";

export interface Notification {
	id: string;
	userId: string;
	type: NotificationType;
	title: string;
	body: string;
	read: boolean;
	createdAt: string;
	meta?: Record<string, unknown>;
}

// ============================================================
// API 响应
// ============================================================

export interface ApiError {
	error: string;
	message: string;
}

export interface LoginResponse {
	token: string;
	user: User;
}

export interface RecommendationItem {
	course: Course;
	score: number;
	reasons: string[];
}

export interface ClassStudentProgress {
	student: User;
	profile: StudentProfile;
	coursePercent: number;
	unitsCompleted: number;
	unitsTotal: number;
	lastActivityAt: string;
	alerts: string[];
}
