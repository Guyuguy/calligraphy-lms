// API 客户端 — fetch 封装

const BASE = "/api";

let authToken: string | null = null;

export function setAuthToken(token: string | null) {
	authToken = token;
	if (token) localStorage.setItem("lms-token", token);
	else localStorage.removeItem("lms-token");
}

export function getStoredToken(): string | null {
	if (authToken) return authToken;
	const t = localStorage.getItem("lms-token");
	if (t) authToken = t;
	return authToken;
}

export class ApiError extends Error {
	status: number;
	constructor(status: number, message: string) {
		super(message);
		this.status = status;
	}
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
	const incomingHeaders = (init?.headers as Record<string, string>) ?? {};
	const headers: Record<string, string> = {
		"Content-Type": "application/json",
		...incomingHeaders,
	};
	const token = getStoredToken();
	if (token) headers.Authorization = `Bearer ${token}`;

	const res = await fetch(`${BASE}${path}`, { ...init, headers });
	if (!res.ok) {
		let msg = `HTTP ${res.status}`;
		try {
			const body = await res.json();
			msg = body.message ?? msg;
		} catch {}
		throw new ApiError(res.status, msg);
	}
	return res.json() as Promise<T>;
}

export const api = {
	get: <T>(path: string) => request<T>(path),
	post: <T>(path: string, body?: unknown) =>
		request<T>(path, {
			method: "POST",
			body: body ? JSON.stringify(body) : undefined,
		}),
	put: <T>(path: string, body?: unknown) =>
		request<T>(path, {
			method: "PUT",
			body: body ? JSON.stringify(body) : undefined,
		}),
	del: <T>(path: string) => request<T>(path, { method: "DELETE" }),
	patch: <T>(path: string, body?: unknown) =>
		request<T>(path, {
			method: "PATCH",
			body: body ? JSON.stringify(body) : undefined,
		}),
	postAudio: <T>(path: string, blob: Blob) =>
		request<T>(path, {
			method: "POST",
			body: blob,
			headers: { "Content-Type": blob.type || "audio/webm" },
		}),
	getAudioBlob: async (path: string): Promise<string> => {
		const headers: Record<string, string> = {};
		const token = getStoredToken();
		if (token) headers.Authorization = `Bearer ${token}`;
		const res = await fetch(`${BASE}${path}`, { headers });
		if (!res.ok) {
			throw new ApiError(res.status, `HTTP ${res.status}`);
		}
		const blob = await res.blob();
		return URL.createObjectURL(blob);
	},
	postVideo: <T>(path: string, blob: Blob) =>
		request<T>(path, {
			method: "POST",
			body: blob,
			headers: { "Content-Type": blob.type || "video/mp4" },
		}),
	postImage: <T>(path: string, blob: Blob) =>
		request<T>(path, {
			method: "POST",
			body: blob,
			headers: { "Content-Type": blob.type || "image/jpeg" },
		}),
	getImageBlob: async (path: string): Promise<string> => {
		const headers: Record<string, string> = {};
		const token = getStoredToken();
		if (token) headers.Authorization = `Bearer ${token}`;
		const res = await fetch(`${BASE}${path}`, { headers });
		if (!res.ok) {
			throw new ApiError(res.status, `HTTP ${res.status}`);
		}
		const blob = await res.blob();
		return URL.createObjectURL(blob);
	},
	// 文件上传(multipart/form-data)— 浏览器自动设置 Content-Type 含 boundary
	postFile: async <T>(path: string, file: File): Promise<T> => {
		const fd = new FormData();
		fd.append("file", file);
		const headers: Record<string, string> = {};
		const token = getStoredToken();
		if (token) headers.Authorization = `Bearer ${token}`;
		const res = await fetch(`${BASE}${path}`, {
			method: "POST",
			body: fd,
			headers,
		});
		if (!res.ok) {
			let msg = `HTTP ${res.status}`;
			try {
				const body = await res.json();
				msg = body.message ?? msg;
			} catch {}
			throw new ApiError(res.status, msg);
		}
		return res.json() as Promise<T>;
	},
	// 下载二进制(模板文件等)— 返回 blob 和文件名
	downloadBlob: async (
		path: string,
	): Promise<{ blob: Blob; filename: string }> => {
		const headers: Record<string, string> = {};
		const token = getStoredToken();
		if (token) headers.Authorization = `Bearer ${token}`;
		const res = await fetch(`${BASE}${path}`, { headers });
		if (!res.ok) {
			throw new ApiError(res.status, `HTTP ${res.status}`);
		}
		const blob = await res.blob();
		const cd = res.headers.get("Content-Disposition") ?? "";
		const m = /filename="([^"]+)"/.exec(cd);
		const filename = m ? m[1] : "download";
		return { blob, filename };
	},
	// 视频流式播放：用 blob URL 让 <video> 能带 Range 请求
	// 注意：fetch 整个 blob 会丢失 Range 流式优势，但 MVP 内存存储可接受
	// 如需真正的流式播放，可直接用 src=/api/... 但要带 token，故用 blob URL
	getVideoBlob: async (path: string): Promise<string> => {
		const headers: Record<string, string> = {};
		const token = getStoredToken();
		if (token) headers.Authorization = `Bearer ${token}`;
		const res = await fetch(`${BASE}${path}`, { headers });
		if (!res.ok) {
			throw new ApiError(res.status, `HTTP ${res.status}`);
		}
		const blob = await res.blob();
		return URL.createObjectURL(blob);
	},
};

// ============================================================
// 类型镜像（与 server/types.ts 保持同步）
// ============================================================

export type Role =
	| "admin"
	| "academic_head"
	| "teacher"
	| "ta"
	| "student"
	| "parent";
export type Stage = "kaishu" | "xingshu" | "lishu" | "kuaiXie";
export type Level = "L1" | "L2" | "L3" | "L4" | "L5" | "L6";
export type Style = "ou" | "yan" | "liu" | "zhao" | "shoujin" | "modern";

export interface User {
	id: string;
	role: Role;
	username: string;
	name: string;
	email: string;
	phone: string;
	avatar?: string;
	createdAt: string;
}

export interface SkillRadar {
	strokes: number;
	structure: number;
	layout: number;
	speed: number;
	stability: number;
}

export interface StudentProfile {
	userId: string;
	grade: string;
	school: string;
	parentIds: string[];
	currentStage: Stage;
	currentLevel: Level;
	handedness: "left" | "right";
	learningGoal: "interest" | "grade_exam" | "competition" | "daily_writing";
	preferredStyles: Style[];
	skillRadar: SkillRadar;
	totalPracticeMinutes: number;
	streakDays: number;
}

export interface TeacherProfile {
	userId: string;
	stages: Stage[];
	bio: string;
	qualifications: string;
	teachingYears: number;
	availability: Array<{ weekday: number; startHour: number; endHour: number }>;
	workloadHoursPerWeek: number;
	rating: number;
	studentCount: number;
}

export interface ParentProfile {
	userId: string;
	childIds: string[];
}

export interface Unit {
	id: string;
	moduleId: string;
	title: string;
	type:
		| "video"
		| "live"
		| "stroke_lesson"
		| "reference_char"
		| "tracing_exercise"
		| "assignment"
		| "quiz";
	description: string;
	order: number;
	durationMinutes: number;
	completionCriteria: {
		watchSeconds?: number;
		minSubmissions?: number;
		minQuizScore?: number;
	};
	videoUrl?: string;
	videoMime?: string;
	videoSize?: number;
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
	teacherName?: string;
	prerequisites: string[];
	totalUnits: number;
	enrolledCount: number;
	rating: number;
	price: number;
	modules: Module[];
	status: "draft" | "published" | "archived";
	createdAt: string;
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
	// 附带的展示字段（来自 GET /schedules 的 enriched 响应）
	courseTitle?: string;
	courseCover?: string;
	stage?: Stage;
	level?: Level;
	teacherName?: string;
	classroomName?: string;
	classroomLocation?: string;
	studentCount?: number;
}

export interface Classroom {
	id: string;
	name: string;
	capacity: number;
	location: string;
}

export interface ScheduleConflict {
	type: "teacher" | "student" | "classroom";
	message: string;
	conflictWith?: string;
}

export const SCHEDULE_MODE_LABELS: Record<ScheduleMode, string> = {
	fixed_class: "固定班课",
	one_on_one: "一对一",
	small_group: "小班课",
	recorded_qa: "录播+答疑",
};

// ============================================================
// 学习进度
// ============================================================

export type ProgressStatus =
	| "not_started"
	| "in_progress"
	| "completed"
	| "mastered";

export interface CourseProgress {
	courseId: string;
	courseTitle: string;
	stage: Stage;
	level: Level;
	style: Style;
	cover: string;
	teacherName: string;
	unitsTotal: number;
	unitsCompleted: number;
	unitsInProgress: number;
	unitsNotStarted: number;
	percent: number;
	lastActivityAt: string;
	status: ProgressStatus;
}

export interface ProgressOverview {
	studentId: string;
	profile: StudentProfile;
	courses: CourseProgress[];
	summary: {
		totalCourses: number;
		totalUnits: number;
		totalCompleted: number;
		overallPercent: number;
		monthMinutes: number;
		streakDays: number;
		totalPracticeMinutes: number;
	};
}

export interface UnitProgress {
	id: string;
	title: string;
	type: Unit["type"];
	order: number;
	durationMinutes: number;
	status: ProgressStatus;
	percent: number;
	lastActivityAt: string;
	videoWatchedSeconds: number;
	practiceCount: number;
	submissionCount: number;
	quizScore: number | null;
}

export interface ModuleProgress {
	id: string;
	title: string;
	order: number;
	units: UnitProgress[];
}

export interface CourseProgressDetail {
	course: CourseProgress;
	modules: ModuleProgress[];
}

export interface HeatmapDay {
	date: string;
	minutes: number;
}

export interface SkillRadarSnapshot {
	studentId: string;
	timestamp: string;
	radar: SkillRadar;
}

export interface SkillRadarResponse {
	studentId: string;
	current: SkillRadar;
	snapshots: SkillRadarSnapshot[];
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

export interface ClassProgressResponse {
	courseId: string;
	courseTitle: string;
	studentCount: number;
	averagePercent: number;
	students: ClassStudentProgress[];
}

// ============================================================
// 教学
// ============================================================

export interface TeachingClass {
	courseId: string;
	title: string;
	stage: Stage;
	level: Level;
	style: Style;
	cover: string;
	enrolledCount: number;
	scheduleCount: number;
	avgPercent: number;
	pendingReviews: number;
	status: "draft" | "published" | "archived";
}

export interface TeachingClassesResponse {
	teacherId: string;
	teacherName: string;
	classes: TeachingClass[];
}

export interface SubmissionListItem {
	id: string;
	assignmentId: string;
	assignmentTitle: string;
	courseId: string;
	courseTitle: string;
	studentId: string;
	studentName: string;
	studentAvatar?: string;
	content: string;
	imageUrl?: string;
	submittedAt: string;
	version: number;
	score: number | null;
	teacherComment?: string;
	reviewedAt?: string;
	totalScore: number;
	status: "pending" | "reviewed";
}

export interface SubmissionListResponse {
	teacherId: string;
	status: string;
	count: number;
	submissions: SubmissionListItem[];
}

export interface SubmissionDetail {
	submission: SubmissionListItem & {
		teacherAudioUrl?: string;
		reviewedBy?: string;
		studentProfile?: StudentProfile;
	};
}

export interface TeachingStats {
	teacherId: string;
	teacherName: string;
	rating: number;
	studentCount: number;
	classCount: number;
	totalSubmissions: number;
	pendingReviews: number;
	reviewedCount: number;
	timelyRate: number;
	avgScore: number;
	improvementRate: number;
}

export interface TeachingAlert {
	studentId: string;
	studentName: string;
	courseId: string;
	courseTitle: string;
	type: "inactive" | "missing_submission" | "low_quiz";
	detail: string;
}

export interface TeachingAlertsResponse {
	teacherId: string;
	count: number;
	alerts: TeachingAlert[];
}

// ============================================================
// 作业批改增强（Batch 4）
// ============================================================

export type AnnotationType = "circle" | "arrow" | "text";

export interface Annotation {
	id: string;
	artworkId: string;
	x: number; // 0-100 百分比
	y: number; // 0-100 百分比
	type: AnnotationType;
	content: string;
	authorId: string;
	size?: number; // 相对画布宽度的百分比，默认 10
	angle?: number; // 箭头旋转角度（度），0 = 向右
}

// ============================================================
// 作品集（M7）
// ============================================================

export interface Artwork {
	id: string;
	studentId: string;
	title: string;
	imageUrl: string;
	createdAt: string;
	isFeatured: boolean;
	submissionId?: string;
	annotationsCount?: number;
}

export interface ArtworkDetail extends Artwork {
	studentName: string;
	studentAvatar?: string;
	studentProfile?: StudentProfile;
	annotations: Annotation[];
	linkedSubmission: {
		id: string;
		assignmentTitle: string;
		courseTitle: string;
		score: number | null;
		teacherComment?: string;
		submittedAt: string;
	} | null;
}

export interface TimelineItem {
	id: string;
	kind: "artwork" | "submission";
	title: string;
	imageUrl: string;
	createdAt: string;
	isFeatured: boolean;
	annotationsCount: number;
	linkedSubmission?: {
		id: string;
		assignmentTitle: string;
		courseTitle: string;
		score: number | null;
	};
}

export interface TimelineResponse {
	studentId: string;
	items: TimelineItem[];
}

export interface FeaturedArtwork extends Artwork {
	studentName: string;
	studentAvatar?: string;
}

export interface FeaturedResponse {
	total: number;
	artworks: FeaturedArtwork[];
}

export interface ArtworkListResponse {
	studentId: string;
	total: number;
	artworks: Artwork[];
}

export interface SubmissionDetailFull {
	submission: SubmissionListItem & {
		teacherAudioUrl?: string;
		reviewedBy?: string;
		reviewerName?: string;
		studentProfile?: StudentProfile;
		annotations: Annotation[];
		assignmentDescription?: string;
	};
}

export interface SubmissionVersion {
	id: string;
	version: number;
	content: string;
	imageUrl?: string;
	submittedAt: string;
	score: number | null;
	teacherComment?: string;
	reviewedAt?: string;
}

export interface SubmissionVersionsResponse {
	assignmentId: string;
	versions: SubmissionVersion[];
}

// ============================================================
// 通知系统（Batch 7）
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

export interface NotificationListResponse {
	userId: string;
	total: number;
	limit: number;
	offset: number;
	notifications: Notification[];
}

export interface UnreadCountResponse {
	userId: string;
	count: number;
}

export const NOTIFICATION_TYPE_LABELS: Record<NotificationType, string> = {
	class_reminder: "课前提醒",
	assignment_due: "作业截止",
	review_completed: "批改完成",
	reschedule: "调课通知",
	payment_due: "缴费提醒",
};

// ============================================================
// 家长端（Batch 5）
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

export interface PaymentsResponse {
	parentId: string;
	count: number;
	payments: Payment[];
}

export interface Evaluation {
	id: string;
	targetType: "teacher" | "student" | "course";
	targetId: string;
	authorId: string;
	rating: number;
	comment: string;
	createdAt: string;
}

export interface EvaluationsResponse {
	parentId: string;
	count: number;
	evaluations: Evaluation[];
}

export interface ParentChild {
	user: User | null;
	profile: StudentProfile | null;
	summary: ProgressOverview["summary"] | null;
}

export interface ParentChildrenResponse {
	parentId: string;
	children: ParentChild[];
}

// ============================================================
// 工作台待办 (M7+)
// ============================================================

export interface DashboardTodayClass {
	id: string;
	courseId: string;
	courseTitle: string;
	teacherName?: string;
	startHour: number;
	endHour: number;
	mode: ScheduleMode;
	studentCount?: number;
}

export interface DashboardUpcomingAssignment {
	id: string;
	courseId: string;
	courseTitle: string;
	title: string;
	dueAt: string;
}

export interface DashboardNextUnit {
	courseId: string;
	courseTitle: string;
	unitId: string;
	unitTitle: string;
	percent: number;
}

export interface StudentTodosResponse {
	studentId: string;
	todayClasses: DashboardTodayClass[];
	upcomingAssignments: DashboardUpcomingAssignment[];
	nextUnit: DashboardNextUnit | null;
	enrolledCourseCount: number;
	streakDays: number;
}

export interface DashboardPendingReview {
	id: string;
	assignmentTitle: string;
	courseTitle: string;
	studentName: string;
	submittedAt: string;
}

export interface TeacherTodosResponse {
	teacherId: string;
	todayClasses: DashboardTodayClass[];
	pendingReviews: DashboardPendingReview[];
	pendingReviewsTotal: number;
}

export interface ParentChildTodos {
	childId: string;
	childName: string;
	todayClasses: DashboardTodayClass[];
	upcomingAssignments: DashboardUpcomingAssignment[];
	summary: ProgressOverview["summary"] | null;
}

export interface DashboardPendingPayment {
	id: string;
	title: string;
	amount: number;
	dueAt: string;
	status: "pending" | "paid" | "overdue";
}

export interface ParentTodosResponse {
	parentId: string;
	children: ParentChildTodos[];
	pendingPayments: DashboardPendingPayment[];
}

export interface DashboardUnreadNotification {
	id: string;
	type: NotificationType;
	title: string;
	body: string;
	createdAt: string;
}

export interface AdminTodosResponse {
	adminId: string;
	systemOverview: {
		totalStudents: number;
		totalTeachers: number;
		totalCourses: number;
	};
	unreadNotifications: DashboardUnreadNotification[];
}

// ============================================================
// 标签辅助
// ============================================================

export const STAGE_LABELS: Record<Stage, string> = {
	kaishu: "楷书",
	xingshu: "行书",
	lishu: "隶书",
	kuaiXie: "快写",
};

export const LEVEL_LABELS: Record<Level, string> = {
	L1: "L1 启蒙",
	L2: "L2 基础",
	L3: "L3 进阶",
	L4: "L4 提高",
	L5: "L5 高级",
	L6: "L6 创作",
};

export const STYLE_LABELS: Record<Style, string> = {
	ou: "欧体",
	yan: "颜体",
	liu: "柳体",
	zhao: "赵体",
	shoujin: "瘦金体",
	modern: "现代硬笔",
};

export const ROLE_LABELS: Record<Role, string> = {
	admin: "管理员",
	academic_head: "教务主管",
	teacher: "教师",
	ta: "助教",
	student: "学生",
	parent: "家长",
};
