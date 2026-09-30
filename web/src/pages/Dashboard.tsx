import {
	AlertTriangle,
	Award,
	BookOpen,
	Calendar,
	CheckCircle,
	Clock,
	GraduationCap,
	PenTool,
	Sparkles,
	Users,
	Wallet,
} from "lucide-react";
import { useEffect, useState } from "react";
import {
	type AdminTodosResponse,
	api,
	type Course,
	LEVEL_LABELS,
	type ParentTodosResponse,
	type RecommendationItem,
	SCHEDULE_MODE_LABELS,
	STAGE_LABELS,
	type StudentTodosResponse,
	type TeacherTodosResponse,
	type User,
} from "@/api/client";
import { PageContainer } from "@/components/layout/PageContainer";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
	Card,
	CardContent,
	CardDescription,
	CardHeader,
	CardTitle,
} from "@/components/ui/card";

interface DashboardProps {
	user: User;
	navigate: (p: string) => void;
}

export function Dashboard({ user, navigate }: DashboardProps) {
	const [recommendations, setRecommendations] = useState<RecommendationItem[]>(
		[],
	);
	const [courses, setCourses] = useState<Course[]>([]);
	const [studentTodos, setStudentTodos] = useState<StudentTodosResponse | null>(
		null,
	);
	const [teacherTodos, setTeacherTodos] = useState<TeacherTodosResponse | null>(
		null,
	);
	const [parentTodos, setParentTodos] = useState<ParentTodosResponse | null>(
		null,
	);
	const [adminTodos, setAdminTodos] = useState<AdminTodosResponse | null>(null);
	const [totalStudents, setTotalStudents] = useState(0);
	const [totalTeachers, setTotalTeachers] = useState(0);

	useEffect(() => {
		api
			.get<{ courses: Course[] }>("/courses")
			.then((r) => setCourses(r.courses))
			.catch(() => {});
		if (user.role === "student") {
			api
				.get<StudentTodosResponse>("/dashboard/student-todos")
				.then(setStudentTodos)
				.catch(() => {});
			api
				.get<{ recommendations: RecommendationItem[] }>(
					`/recommendations/${user.id}`,
				)
				.then((r) => setRecommendations(r.recommendations))
				.catch(() => {});
		} else if (user.role === "teacher") {
			api
				.get<TeacherTodosResponse>("/dashboard/teacher-todos")
				.then(setTeacherTodos)
				.catch(() => {});
		} else if (user.role === "parent") {
			api
				.get<ParentTodosResponse>("/dashboard/parent-todos")
				.then(setParentTodos)
				.catch(() => {});
		} else if (user.role === "admin" || user.role === "academic_head") {
			api
				.get<AdminTodosResponse>("/dashboard/admin-todos")
				.then(setAdminTodos)
				.catch(() => {});
			api
				.get<{ users: User[] }>("/users")
				.then((r) => {
					setTotalStudents(r.users.filter((u) => u.role === "student").length);
					setTotalTeachers(r.users.filter((u) => u.role === "teacher").length);
				})
				.catch(() => {});
		}
	}, [user.id, user.role]);

	const myCoursesCount =
		user.role === "teacher"
			? courses.filter((c) => c.teacherId === user.id).length
			: 0;

	return (
		<PageContainer
			title={`你好，${user.name}`}
			description={descriptionFor(user.role)}
		>
			{/* 顶部统计卡片 — 按角色分流 */}
			<div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-4">
				{renderStatCards({
					user,
					courses,
					studentTodos,
					teacherTodos,
					parentTodos,
					adminTodos,
					totalStudents,
					totalTeachers,
					myCoursesCount,
					navigate,
				})}
			</div>

			{/* 主体内容 — 按角色分流 */}
			<div className="mt-6 grid grid-cols-1 gap-6 lg:grid-cols-3">
				{/* 左侧 */}
				<div className="space-y-6 lg:col-span-2">
					{user.role === "student" && (
						<Card>
							<CardHeader>
								<div className="flex items-center justify-between">
									<CardTitle className="flex items-center gap-2">
										<Sparkles className="size-4 text-brand" />
										为你推荐
									</CardTitle>
									<Button
										variant="link"
										size="sm"
										onClick={() => navigate("/recommend")}
									>
										查看全部
									</Button>
								</div>
								<CardDescription>
									基于你的学习画像与进度智能推荐
								</CardDescription>
							</CardHeader>
							<CardContent className="space-y-3">
								{recommendations.length === 0 ? (
									<div className="py-8 text-center text-sm text-text-muted">
										正在生成推荐...
									</div>
								) : (
									recommendations
										.slice(0, 3)
										.map((rec) => (
											<RecommendationRow
												key={rec.course.id}
												rec={rec}
												onClick={() => navigate(`/courses/${rec.course.id}`)}
											/>
										))
								)}
							</CardContent>
						</Card>
					)}

					{(user.role === "admin" || user.role === "academic_head") && (
						<Card>
							<CardHeader>
								<CardTitle className="flex items-center gap-2">
									<BookOpen className="size-4 text-brand" />
									热门课程
								</CardTitle>
								<CardDescription>按报名人数排序</CardDescription>
							</CardHeader>
							<CardContent className="space-y-3">
								{[...courses]
									.sort((a, b) => b.enrolledCount - a.enrolledCount)
									.slice(0, 5)
									.map((c, i) => (
										<div
											key={c.id}
											className="flex items-center gap-3 rounded-md border border-border bg-surface-1 p-3 transition-colors hover:bg-surface-2"
										>
											<div className="flex size-8 items-center justify-center rounded-full bg-brand/10 font-serif text-sm font-semibold text-brand">
												{i + 1}
											</div>
											<div className="flex-1">
												<div className="font-medium">{c.title}</div>
												<div className="mt-0.5 text-xs text-text-muted">
													{STAGE_LABELS[c.stage]} · {LEVEL_LABELS[c.level]} ·{" "}
													{c.teacherName ?? "未知教师"}
												</div>
											</div>
											<Badge variant="secondary">{c.enrolledCount} 人</Badge>
										</div>
									))}
							</CardContent>
						</Card>
					)}

					{user.role === "teacher" && (
						<Card>
							<CardHeader>
								<CardTitle className="flex items-center gap-2">
									<PenTool className="size-4 text-brand" />
									我的主讲课程
								</CardTitle>
								<CardDescription>查看班级进度与待批改作业</CardDescription>
							</CardHeader>
							<CardContent className="space-y-3">
								{courses
									.filter((c) => c.teacherId === user.id)
									.slice(0, 5)
									.map((c) => (
										<div
											key={c.id}
											className="flex items-center gap-3 rounded-md border border-border bg-surface-1 p-3"
										>
											<div className="flex-1">
												<div className="font-medium">{c.title}</div>
												<div className="mt-0.5 text-xs text-text-muted">
													{c.enrolledCount} 名学生 · {c.totalUnits} 节课
												</div>
											</div>
											<Button
												variant="outline"
												size="sm"
												onClick={() => navigate("/teaching")}
											>
												进入班级
											</Button>
										</div>
									))}
								{courses.filter((c) => c.teacherId === user.id).length ===
									0 && (
									<div className="py-8 text-center text-sm text-text-muted">
										暂未分配主讲课程
									</div>
								)}
							</CardContent>
						</Card>
					)}
				</div>

				{/* 右侧：今日待办 — 按角色分流 */}
				<div className="space-y-6">
					<Card>
						<CardHeader>
							<CardTitle className="flex items-center gap-2">
								<Clock className="size-4 text-brand" />
								今日待办
							</CardTitle>
							<CardDescription>{todoSubtitleFor(user.role)}</CardDescription>
						</CardHeader>
						<CardContent className="space-y-2">
							{renderTodos({
								user,
								studentTodos,
								teacherTodos,
								parentTodos,
								adminTodos,
								navigate,
							})}
						</CardContent>
					</Card>
				</div>
			</div>
		</PageContainer>
	);
}

// ============================================================
// 角色文案
// ============================================================

function descriptionFor(role: User["role"]): string {
	switch (role) {
		case "student":
			return "继续你的硬笔书法学习之旅";
		case "teacher":
			return "今日教学概览";
		case "admin":
		case "academic_head":
			return "系统运行概览";
		case "parent":
			return "查看孩子的学习情况";
		default:
			return "工作台";
	}
}

function todoSubtitleFor(role: User["role"]): string {
	switch (role) {
		case "student":
			return "今日上课与作业安排";
		case "teacher":
			return "今日教学与批改任务";
		case "parent":
			return "孩子今日学习与缴费";
		case "admin":
		case "academic_head":
			return "系统通知与概况";
		default:
			return "";
	}
}

// ============================================================
// 顶部统计卡片
// ============================================================

interface StatCardProps {
	icon: React.ComponentType<{ className?: string }>;
	label: string;
	value: number | string;
	color: "brand" | "info" | "success" | "warning";
	onClick?: () => void;
}

function StatCard({ icon: Icon, label, value, color, onClick }: StatCardProps) {
	const colorMap = {
		brand: "bg-brand/10 text-brand",
		info: "bg-status-running/10 text-status-running",
		success: "bg-status-active/10 text-status-active",
		warning: "bg-status-warning/10 text-status-warning",
	};
	return (
		<button
			type="button"
			onClick={onClick}
			className="group flex items-center gap-3 rounded-xl border border-border bg-card p-4 text-left shadow-sm transition-all hover:shadow-md sm:gap-4 sm:p-5"
		>
			<div
				className={`flex size-10 items-center justify-center rounded-lg ${colorMap[color]} sm:size-12`}
			>
				<Icon className="size-5 sm:size-6" />
			</div>
			<div className="min-w-0">
				<div className="truncate text-xs text-text-muted sm:text-sm">
					{label}
				</div>
				<div className="font-serif text-xl font-semibold text-text-primary sm:text-2xl">
					{value}
				</div>
			</div>
		</button>
	);
}

function renderStatCards(args: {
	user: User;
	courses: Course[];
	studentTodos: StudentTodosResponse | null;
	teacherTodos: TeacherTodosResponse | null;
	parentTodos: ParentTodosResponse | null;
	adminTodos: AdminTodosResponse | null;
	totalStudents: number;
	totalTeachers: number;
	myCoursesCount: number;
	navigate: (p: string) => void;
}) {
	const {
		user,
		courses,
		studentTodos,
		teacherTodos,
		parentTodos,
		adminTodos,
		totalStudents,
		totalTeachers,
		myCoursesCount,
		navigate,
	} = args;

	if (user.role === "student") {
		return (
			<>
				<StatCard
					icon={BookOpen}
					label="已报名课程"
					value={studentTodos?.enrolledCourseCount ?? 0}
					color="brand"
					onClick={() => navigate("/progress")}
				/>
				<StatCard
					icon={Calendar}
					label="今日课程"
					value={studentTodos?.todayClasses.length ?? 0}
					color="info"
					onClick={() => navigate("/schedule")}
				/>
				<StatCard
					icon={PenTool}
					label="待交作业"
					value={studentTodos?.upcomingAssignments.length ?? 0}
					color="warning"
					onClick={() => navigate("/progress")}
				/>
				<StatCard
					icon={Award}
					label="连续打卡"
					value={`${studentTodos?.streakDays ?? 0} 天`}
					color="success"
					onClick={() => navigate("/progress")}
				/>
			</>
		);
	}

	if (user.role === "teacher") {
		return (
			<>
				<StatCard
					icon={BookOpen}
					label="主讲课程"
					value={myCoursesCount}
					color="brand"
					onClick={() => navigate("/teaching")}
				/>
				<StatCard
					icon={Calendar}
					label="今日课时"
					value={teacherTodos?.todayClasses.length ?? 0}
					color="info"
					onClick={() => navigate("/schedule")}
				/>
				<StatCard
					icon={PenTool}
					label="待批改作业"
					value={teacherTodos?.pendingReviewsTotal ?? 0}
					color="warning"
					onClick={() => navigate("/teaching")}
				/>
				<StatCard
					icon={Users}
					label="学生总数"
					value={
						courses
							.filter((c) => c.teacherId === user.id)
							.reduce((sum, c) => sum + c.enrolledCount, 0) ?? 0
					}
					color="success"
					onClick={() => navigate("/teaching")}
				/>
			</>
		);
	}

	if (user.role === "parent") {
		const childrenCount = parentTodos?.children.length ?? 0;
		const pendingPayments = parentTodos?.pendingPayments.length ?? 0;
		const todayClasses =
			parentTodos?.children.reduce(
				(sum, c) => sum + c.todayClasses.length,
				0,
			) ?? 0;
		return (
			<>
				<StatCard
					icon={Users}
					label="关联子女"
					value={childrenCount}
					color="brand"
					onClick={() => navigate("/parent")}
				/>
				<StatCard
					icon={Calendar}
					label="子女今日课节"
					value={todayClasses}
					color="info"
					onClick={() => navigate("/schedule")}
				/>
				<StatCard
					icon={Wallet}
					label="待缴账单"
					value={pendingPayments}
					color="warning"
					onClick={() => navigate("/parent")}
				/>
				<StatCard
					icon={BookOpen}
					label="子女课程数"
					value={
						parentTodos?.children.reduce(
							(sum, c) => sum + (c.summary?.totalCourses ?? 0),
							0,
						) ?? 0
					}
					color="success"
					onClick={() => navigate("/parent")}
				/>
			</>
		);
	}

	// admin / academic_head / ta
	return (
		<>
			<StatCard
				icon={BookOpen}
				label="课程总数"
				value={adminTodos?.systemOverview.totalCourses ?? courses.length}
				color="brand"
				onClick={() => navigate("/courses")}
			/>
			<StatCard
				icon={GraduationCap}
				label="学生人数"
				value={totalStudents}
				color="info"
				onClick={() => navigate("/students")}
			/>
			<StatCard
				icon={Users}
				label="教师人数"
				value={totalTeachers}
				color="success"
				onClick={() => navigate("/teachers")}
			/>
			<StatCard
				icon={Calendar}
				label="本周课节"
				value={0}
				color="warning"
				onClick={() => navigate("/schedule")}
			/>
		</>
	);
}

// ============================================================
// 今日待办渲染
// ============================================================

function TodoItem({
	text,
	tag,
	tagVariant,
	onClick,
}: {
	text: string;
	tag: string;
	tagVariant: "info" | "warning" | "default" | "success" | "danger";
	onClick?: () => void;
}) {
	return (
		<button
			type="button"
			onClick={onClick}
			disabled={!onClick}
			className="flex w-full items-center justify-between rounded-md border border-border bg-surface-1 px-3 py-2 text-left transition-colors hover:bg-surface-2 disabled:cursor-default disabled:hover:bg-surface-1"
		>
			<span className="text-sm">{text}</span>
			<Badge variant={tagVariant}>{tag}</Badge>
		</button>
	);
}

function EmptyTodo({ text }: { text: string }) {
	return (
		<div className="rounded-md border border-dashed border-border bg-surface-1 px-3 py-3 text-center text-sm text-text-muted">
			{text}
		</div>
	);
}

function renderTodos(args: {
	user: User;
	studentTodos: StudentTodosResponse | null;
	teacherTodos: TeacherTodosResponse | null;
	parentTodos: ParentTodosResponse | null;
	adminTodos: AdminTodosResponse | null;
	navigate: (p: string) => void;
}) {
	const {
		user,
		studentTodos,
		teacherTodos,
		parentTodos,
		adminTodos,
		navigate,
	} = args;

	if (user.role === "student") {
		if (!studentTodos) return <EmptyTodo text="加载中..." />;
		const items: React.ReactNode[] = [];
		for (const c of studentTodos.todayClasses) {
			items.push(
				<TodoItem
					key={`class-${c.id}`}
					text={`${String(c.startHour).padStart(2, "0")}:00 ${c.courseTitle} · ${c.teacherName ?? ""}`}
					tag={SCHEDULE_MODE_LABELS[c.mode]}
					tagVariant="info"
					onClick={() => navigate("/schedule")}
				/>,
			);
		}
		for (const a of studentTodos.upcomingAssignments) {
			const due = new Date(a.dueAt);
			const dueLabel = `${due.getMonth() + 1}/${due.getDate()} 前`;
			items.push(
				<TodoItem
					key={`asg-${a.id}`}
					text={`${a.courseTitle} · ${a.title}`}
					tag={dueLabel}
					tagVariant="warning"
					onClick={() => navigate("/progress")}
				/>,
			);
		}
		if (studentTodos.nextUnit) {
			items.push(
				<TodoItem
					key="next-unit"
					text={`继续学习 ${studentTodos.nextUnit.courseTitle} · ${studentTodos.nextUnit.unitTitle}`}
					tag="学习"
					tagVariant="success"
					onClick={() => navigate("/progress")}
				/>,
			);
		}
		return <>{items.length > 0 ? items : <EmptyTodo text="今日暂无待办" />}</>;
	}

	if (user.role === "teacher") {
		if (!teacherTodos) return <EmptyTodo text="加载中..." />;
		const items: React.ReactNode[] = [];
		for (const c of teacherTodos.todayClasses) {
			items.push(
				<TodoItem
					key={`class-${c.id}`}
					text={`${String(c.startHour).padStart(2, "0")}:00 ${c.courseTitle} · ${c.studentCount ?? 0} 人`}
					tag={SCHEDULE_MODE_LABELS[c.mode]}
					tagVariant="info"
					onClick={() => navigate("/schedule")}
				/>,
			);
		}
		for (const r of teacherTodos.pendingReviews) {
			items.push(
				<TodoItem
					key={`review-${r.id}`}
					text={`批改 ${r.studentName} · ${r.assignmentTitle}`}
					tag="待批改"
					tagVariant="warning"
					onClick={() => navigate("/teaching")}
				/>,
			);
		}
		return <>{items.length > 0 ? items : <EmptyTodo text="今日暂无待办" />}</>;
	}

	if (user.role === "parent") {
		if (!parentTodos) return <EmptyTodo text="加载中..." />;
		const items: React.ReactNode[] = [];
		for (const child of parentTodos.children) {
			for (const c of child.todayClasses) {
				items.push(
					<TodoItem
						key={`child-${child.childId}-class-${c.id}`}
						text={`${child.childName} ${String(c.startHour).padStart(2, "0")}:00 ${c.courseTitle}`}
						tag="上课"
						tagVariant="info"
						onClick={() => navigate("/schedule")}
					/>,
				);
			}
			for (const a of child.upcomingAssignments) {
				items.push(
					<TodoItem
						key={`child-${child.childId}-asg-${a.id}`}
						text={`${child.childName} 待交 ${a.title}`}
						tag="作业"
						tagVariant="warning"
						onClick={() => navigate("/parent")}
					/>,
				);
			}
		}
		for (const p of parentTodos.pendingPayments) {
			items.push(
				<TodoItem
					key={`pay-${p.id}`}
					text={`${p.title} · ¥${p.amount}`}
					tag={p.status === "overdue" ? "逾期" : "待缴"}
					tagVariant={p.status === "overdue" ? "danger" : "warning"}
					onClick={() => navigate("/parent")}
				/>,
			);
		}
		return <>{items.length > 0 ? items : <EmptyTodo text="今日暂无待办" />}</>;
	}

	// admin / academic_head
	if (!adminTodos) return <EmptyTodo text="加载中..." />;
	const items: React.ReactNode[] = [];
	if (adminTodos.unreadNotifications.length === 0) {
		return <EmptyTodo text="暂无未读通知，系统运行正常" />;
	}
	for (const n of adminTodos.unreadNotifications) {
		items.push(
			<TodoItem
				key={`notif-${n.id}`}
				text={n.title}
				tag="通知"
				tagVariant="info"
				onClick={() => navigate("/notifications")}
			/>,
		);
	}
	return <>{items}</>;
}

// ============================================================
// 推荐行
// ============================================================

function RecommendationRow({
	rec,
	onClick,
}: {
	rec: RecommendationItem;
	onClick: () => void;
}) {
	return (
		<button
			type="button"
			onClick={onClick}
			className="flex w-full items-start gap-3 rounded-md border border-border bg-surface-1 p-3 text-left transition-colors hover:bg-surface-2"
		>
			<img
				src={rec.course.cover}
				alt=""
				className="size-16 rounded-md object-cover"
			/>
			<div className="flex-1">
				<div className="flex items-center justify-between">
					<div className="font-medium">{rec.course.title}</div>
					<Badge variant="success">匹配 {(rec.score * 100).toFixed(0)}%</Badge>
				</div>
				<div className="mt-1 text-xs text-text-muted">
					{STAGE_LABELS[rec.course.stage]} · {LEVEL_LABELS[rec.course.level]} ·{" "}
					{rec.course.teacherName ?? ""}
				</div>
				{rec.reasons[0] && (
					<div className="mt-1.5 flex items-center gap-1 text-xs text-brand">
						<Sparkles className="size-3" />
						{rec.reasons[0]}
					</div>
				)}
			</div>
		</button>
	);
}

// 占位避免 unused 警告 (AlertTriangle/CheckCircle 暂留作未来扩展)
void AlertTriangle;
void CheckCircle;
