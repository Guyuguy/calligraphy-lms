import {
	Award,
	BookOpen,
	Calendar,
	Clock,
	GraduationCap,
	PenTool,
	Sparkles,
	Users,
} from "lucide-react";
import { useEffect, useState } from "react";
import {
	api,
	type Course,
	LEVEL_LABELS,
	type RecommendationItem,
	STAGE_LABELS,
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
import { Progress } from "@/components/ui/progress";

interface DashboardProps {
	user: User;
	navigate: (p: string) => void;
}

export function Dashboard({ user, navigate }: DashboardProps) {
	const [recommendations, setRecommendations] = useState<RecommendationItem[]>(
		[],
	);
	const [courses, setCourses] = useState<Course[]>([]);
	const [stats, setStats] = useState({
		totalCourses: 0,
		totalStudents: 0,
		totalTeachers: 0,
	});

	useEffect(() => {
		api
			.get<{ courses: Course[] }>("/courses")
			.then((r) => setCourses(r.courses))
			.catch(() => {});
		api
			.get<{ users: User[] }>("/users")
			.then((r) =>
				setStats({
					totalCourses: courses.length,
					totalStudents: r.users.filter((u) => u.role === "student").length,
					totalTeachers: r.users.filter((u) => u.role === "teacher").length,
				}),
			)
			.catch(() => {});
		if (user.role === "student") {
			api
				.get<{ recommendations: RecommendationItem[] }>(
					`/recommendations/${user.id}`,
				)
				.then((r) => setRecommendations(r.recommendations))
				.catch(() => {});
		}
	}, [user.id, user.role, courses.length]);

	return (
		<PageContainer
			title={`你好，${user.name}`}
			description={
				user.role === "student"
					? "继续你的硬笔书法学习之旅"
					: user.role === "teacher"
						? "今日教学概览"
						: user.role === "admin" || user.role === "academic_head"
							? "系统运行概览"
							: "查看孩子的学习情况"
			}
		>
			{/* 顶部统计卡片 */}
			<div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-4">
				<StatCard
					icon={BookOpen}
					label="课程总数"
					value={stats.totalCourses || courses.length}
					color="brand"
					onClick={() => navigate("/courses")}
				/>
				<StatCard
					icon={GraduationCap}
					label="学生人数"
					value={stats.totalStudents}
					color="info"
					onClick={() => navigate("/students")}
				/>
				<StatCard
					icon={Users}
					label="教师人数"
					value={stats.totalTeachers}
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
			</div>

			{/* 主体内容 — 按角色分流 */}
			<div className="mt-6 grid grid-cols-1 gap-6 lg:grid-cols-3">
				{/* 左侧：推荐课程 / 我的课程 / 待办 */}
				<div className="lg:col-span-2 space-y-6">
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

				{/* 右侧：学习画像 / 待办 */}
				<div className="space-y-6">
					<Card>
						<CardHeader>
							<CardTitle className="flex items-center gap-2">
								<Award className="size-4 text-brand" />
								{user.role === "student"
									? "我的学习画像"
									: user.role === "teacher"
										? "教学画像"
										: "系统概况"}
							</CardTitle>
						</CardHeader>
						<CardContent className="space-y-4">
							{user.role === "student" && (
								<>
									<SkillMini />
									<div className="space-y-2">
										<div className="flex items-center justify-between text-sm">
											<span className="text-text-muted">本月练习时长</span>
											<span className="font-medium">12.5 小时</span>
										</div>
										<div className="flex items-center justify-between text-sm">
											<span className="text-text-muted">连续打卡</span>
											<span className="font-medium">7 天</span>
										</div>
										<div className="flex items-center justify-between text-sm">
											<span className="text-text-muted">完成单元</span>
											<span className="font-medium">23 / 48</span>
										</div>
										<Progress value={48} color="brand" />
									</div>
								</>
							)}
							{user.role === "teacher" && (
								<div className="space-y-2">
									<div className="flex items-center justify-between text-sm">
										<span className="text-text-muted">本周课时</span>
										<span className="font-medium">14 节</span>
									</div>
									<div className="flex items-center justify-between text-sm">
										<span className="text-text-muted">学生总数</span>
										<span className="font-medium">42 人</span>
									</div>
									<div className="flex items-center justify-between text-sm">
										<span className="text-text-muted">待批改作业</span>
										<span className="font-medium text-status-warning">
											8 份
										</span>
									</div>
									<div className="flex items-center justify-between text-sm">
										<span className="text-text-muted">教师评分</span>
										<span className="font-medium">4.8 / 5.0</span>
									</div>
								</div>
							)}
							{(user.role === "admin" || user.role === "academic_head") && (
								<div className="space-y-2">
									<div className="flex items-center justify-between text-sm">
										<span className="text-text-muted">本月活跃学员</span>
										<span className="font-medium">156 人</span>
									</div>
									<div className="flex items-center justify-between text-sm">
										<span className="text-text-muted">本月新增</span>
										<span className="font-medium">+23 人</span>
									</div>
									<div className="flex items-center justify-between text-sm">
										<span className="text-text-muted">课程续报率</span>
										<span className="font-medium text-status-active">82%</span>
									</div>
									<div className="flex items-center justify-between text-sm">
										<span className="text-text-muted">教师人均课时</span>
										<span className="font-medium">16.5 / 周</span>
									</div>
								</div>
							)}
							{user.role === "parent" && (
								<div className="space-y-2">
									<div className="text-sm text-text-muted">关联子女</div>
									<div className="rounded-md border border-border bg-surface-1 p-3">
										<div className="font-medium">张小明</div>
										<div className="mt-1 text-xs text-text-muted">
											楷书 L3 · 连续打卡 5 天
										</div>
									</div>
								</div>
							)}
						</CardContent>
					</Card>

					<Card>
						<CardHeader>
							<CardTitle className="flex items-center gap-2">
								<Clock className="size-4 text-brand" />
								今日待办
							</CardTitle>
						</CardHeader>
						<CardContent className="space-y-2">
							<TodoItem
								text="19:00 楷书基础课"
								tag="直播课"
								tagVariant="info"
							/>
							<TodoItem text="批改 3 份作业" tag="教学" tagVariant="warning" />
							<TodoItem
								text="完成《永字八法》第 4 节"
								tag="学习"
								tagVariant="default"
							/>
						</CardContent>
					</Card>
				</div>
			</div>
		</PageContainer>
	);
}

function StatCard({
	icon: Icon,
	label,
	value,
	color,
	onClick,
}: {
	icon: React.ComponentType<{ className?: string }>;
	label: string;
	value: number;
	color: "brand" | "info" | "success" | "warning";
	onClick?: () => void;
}) {
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
			className="group flex items-center gap-4 rounded-xl border border-border bg-card p-5 text-left shadow-sm transition-all hover:shadow-md"
		>
			<div
				className={`flex size-12 items-center justify-center rounded-lg ${colorMap[color]}`}
			>
				<Icon className="size-6" />
			</div>
			<div>
				<div className="text-sm text-text-muted">{label}</div>
				<div className="font-serif text-2xl font-semibold text-text-primary">
					{value}
				</div>
			</div>
		</button>
	);
}

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

function SkillMini() {
	// 简化版技能展示，详细雷达图在进度页
	const skills = [
		{ name: "笔画", value: 65 },
		{ name: "结构", value: 58 },
		{ name: "章法", value: 42 },
		{ name: "速度", value: 70 },
		{ name: "稳定性", value: 55 },
	];
	return (
		<div className="space-y-2">
			{skills.map((s) => (
				<div key={s.name} className="space-y-1">
					<div className="flex items-center justify-between text-xs">
						<span className="text-text-muted">{s.name}</span>
						<span className="font-medium">{s.value}</span>
					</div>
					<Progress value={s.value} size="sm" />
				</div>
			))}
		</div>
	);
}

function TodoItem({
	text,
	tag,
	tagVariant,
}: {
	text: string;
	tag: string;
	tagVariant: "info" | "warning" | "default";
}) {
	return (
		<div className="flex items-center justify-between rounded-md border border-border bg-surface-1 px-3 py-2">
			<span className="text-sm">{text}</span>
			<Badge variant={tagVariant}>{tag}</Badge>
		</div>
	);
}
