import {
	Award,
	BookOpen,
	Clock,
	Flame,
	Target,
	TrendingUp,
} from "lucide-react";
import { useEffect, useState } from "react";
import {
	api,
	type CourseProgressDetail,
	type HeatmapDay,
	LEVEL_LABELS,
	type ProgressOverview,
	type SkillRadarResponse,
	STAGE_LABELS,
	STYLE_LABELS,
	type User,
} from "@/api/client";
import { SkillRadarChart } from "@/components/domain/SkillRadar";
import { PageContainer } from "@/components/layout/PageContainer";
import { Badge } from "@/components/ui/badge";
import {
	Card,
	CardContent,
	CardDescription,
	CardHeader,
	CardTitle,
} from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";

interface ProgressViewProps {
	user: User;
}

export function ProgressView({ user }: ProgressViewProps) {
	const [overview, setOverview] = useState<ProgressOverview | null>(null);
	const [detail, setDetail] = useState<CourseProgressDetail | null>(null);
	const [heatmap, setHeatmap] = useState<HeatmapDay[]>([]);
	const [radar, setRadar] = useState<SkillRadarResponse | null>(null);
	const [loading, setLoading] = useState(true);
	const [error, setError] = useState<string | null>(null);
	const [selectedCourseId, setSelectedCourseId] = useState<string | null>(null);

	useEffect(() => {
		if (user.role !== "student") {
			setLoading(false);
			return;
		}
		let cancelled = false;
		(async () => {
			setLoading(true);
			setError(null);
			try {
				const [ov, hm, rd] = await Promise.all([
					api.get<ProgressOverview>(`/progress/${user.id}`),
					api.get<{ heat: HeatmapDay[] }>(
						`/progress/${user.id}/heatmap?days=90`,
					),
					api.get<SkillRadarResponse>(`/progress/${user.id}/skill-radar`),
				]);
				if (cancelled) return;
				setOverview(ov);
				setHeatmap(hm.heat);
				setRadar(rd);
				if (ov.courses.length > 0) setSelectedCourseId(ov.courses[0].courseId);
			} catch (e) {
				if (!cancelled) setError(e instanceof Error ? e.message : "加载失败");
			} finally {
				if (!cancelled) setLoading(false);
			}
		})();
		return () => {
			cancelled = true;
		};
	}, [user.id, user.role]);

	// 加载课程明细
	useEffect(() => {
		if (!selectedCourseId || user.role !== "student") return;
		let cancelled = false;
		(async () => {
			try {
				const d = await api.get<CourseProgressDetail>(
					`/progress/${user.id}/course/${selectedCourseId}`,
				);
				if (!cancelled) setDetail(d);
			} catch (e) {
				if (!cancelled)
					setError(e instanceof Error ? e.message : "加载课程明细失败");
			}
		})();
		return () => {
			cancelled = true;
		};
	}, [selectedCourseId, user.id, user.role]);

	if (user.role !== "student") {
		return (
			<PageContainer title="学习进度" description="此页面面向学生角色">
				<Card>
					<CardContent className="py-12 text-center text-text-muted">
						当前角色（{user.role}
						）暂不展示个人学习进度。请使用学生账号登录查看。
					</CardContent>
				</Card>
			</PageContainer>
		);
	}

	if (loading) {
		return (
			<PageContainer title="学习进度" description="你的学习数据与技能画像">
				<div className="flex h-64 items-center justify-center text-text-muted">
					加载中...
				</div>
			</PageContainer>
		);
	}

	if (error || !overview) {
		return (
			<PageContainer title="学习进度" description="你的学习数据与技能画像">
				<Card>
					<CardContent className="py-12 text-center text-status-error">
						{error ?? "加载失败"}
					</CardContent>
				</Card>
			</PageContainer>
		);
	}

	const monthHours = (overview.summary.monthMinutes / 60).toFixed(1);
	const heatMax = Math.max(60, ...heatmap.map((d) => d.minutes));

	return (
		<PageContainer title="学习进度" description="你的学习数据与技能画像">
			<div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
				<div className="space-y-6 lg:col-span-2">
					{/* 总览统计 */}
					<div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
						<StatBox
							icon={Clock}
							label="本月时长"
							value={`${monthHours}h`}
							color="brand"
						/>
						<StatBox
							icon={Flame}
							label="连续打卡"
							value={`${overview.summary.streakDays} 天`}
							color="warning"
						/>
						<StatBox
							icon={Award}
							label="完成单元"
							value={`${overview.summary.totalCompleted}/${overview.summary.totalUnits}`}
							color="success"
						/>
						<StatBox
							icon={TrendingUp}
							label="总体进度"
							value={`${overview.summary.overallPercent}%`}
							color="info"
						/>
					</div>

					{/* 课程进度列表 */}
					<Card>
						<CardHeader>
							<CardTitle className="flex items-center gap-2">
								<BookOpen className="size-4 text-brand" />
								课程进度
							</CardTitle>
							<CardDescription>当前在学课程的完成情况</CardDescription>
						</CardHeader>
						<CardContent className="space-y-4">
							{overview.courses.length === 0 ? (
								<div className="py-6 text-center text-text-muted">
									尚未开始任何课程
								</div>
							) : (
								overview.courses.map((c) => (
									<button
										key={c.courseId}
										type="button"
										onClick={() => setSelectedCourseId(c.courseId)}
										className={`w-full space-y-1.5 rounded-md border p-3 text-left transition-colors ${
											selectedCourseId === c.courseId
												? "border-brand bg-brand/5"
												: "border-border hover:border-brand/40 hover:bg-surface-1"
										}`}
									>
										<div className="flex items-center justify-between text-sm">
											<span className="font-medium">{c.courseTitle}</span>
											<div className="flex items-center gap-2">
												<Badge
													variant={
														c.status === "completed"
															? "success"
															: c.status === "in_progress"
																? "info"
																: "secondary"
													}
												>
													{c.status === "completed"
														? "已完成"
														: c.status === "in_progress"
															? "进行中"
															: "未开始"}
												</Badge>
												<span className="text-text-muted">{c.percent}%</span>
											</div>
										</div>
										<Progress
											value={c.percent}
											color={c.status === "completed" ? "success" : "brand"}
										/>
										<div className="flex items-center justify-between text-xs text-text-muted">
											<span>
												{STAGE_LABELS[c.stage]} · {LEVEL_LABELS[c.level]} ·{" "}
												{STYLE_LABELS[c.style]}
											</span>
											<span>
												{c.unitsCompleted}/{c.unitsTotal} 单元 · 教师{" "}
												{c.teacherName}
											</span>
										</div>
									</button>
								))
							)}
						</CardContent>
					</Card>

					{/* 课程明细 */}
					{detail && (
						<Card>
							<CardHeader>
								<CardTitle className="flex items-center gap-2">
									<Target className="size-4 text-brand" />
									{detail.course.courseTitle} · 单元明细
								</CardTitle>
								<CardDescription>
									{detail.course.unitsCompleted}/{detail.course.unitsTotal}{" "}
									单元完成 · 平均 {detail.course.percent}%
								</CardDescription>
							</CardHeader>
							<CardContent className="space-y-4">
								{detail.modules.map((m) => (
									<div key={m.id} className="space-y-2">
										<div className="text-sm font-medium text-text-secondary">
											{m.title}
										</div>
										<div className="space-y-1.5">
											{m.units.map((u) => (
												<div
													key={u.id}
													className="flex items-center gap-3 rounded-md border border-border bg-surface-1 px-3 py-2"
												>
													<div className="flex-1">
														<div className="text-sm font-medium">{u.title}</div>
														<div className="text-xs text-text-muted">
															{UNIT_TYPE_LABELS[u.type]} · {u.durationMinutes}{" "}
															分钟
															{u.quizScore !== null &&
																` · 测验 ${u.quizScore} 分`}
															{u.submissionCount > 0 &&
																` · 提交 ${u.submissionCount} 次`}
														</div>
													</div>
													<Badge
														variant={
															u.status === "completed" ||
															u.status === "mastered"
																? "success"
																: u.status === "in_progress"
																	? "info"
																	: "secondary"
														}
													>
														{STATUS_LABELS[u.status]}
													</Badge>
													<span className="w-10 text-right text-xs text-text-muted">
														{u.percent}%
													</span>
												</div>
											))}
										</div>
									</div>
								))}
							</CardContent>
						</Card>
					)}

					{/* 打卡热力图 */}
					<Card>
						<CardHeader>
							<CardTitle>打卡热力图</CardTitle>
							<CardDescription>过去 90 天的练习记录</CardDescription>
						</CardHeader>
						<CardContent>
							<div className="flex flex-wrap gap-1">
								{heatmap.map((d) => {
									const intensity =
										d.minutes === 0
											? 0
											: Math.min(4, Math.ceil((d.minutes / heatMax) * 4));
									const colors = [
										"bg-muted",
										"bg-brand/30",
										"bg-brand/50",
										"bg-brand/70",
										"bg-brand",
									];
									return (
										<div
											key={d.date}
											title={`${d.date} · ${d.minutes} 分钟`}
											className={`size-3 rounded-sm ${colors[intensity]}`}
										/>
									);
								})}
							</div>
							<div className="mt-3 flex items-center justify-end gap-1 text-xs text-text-muted">
								<span>少</span>
								<div className="size-3 rounded-sm bg-muted" />
								<div className="size-3 rounded-sm bg-brand/30" />
								<div className="size-3 rounded-sm bg-brand/50" />
								<div className="size-3 rounded-sm bg-brand/70" />
								<div className="size-3 rounded-sm bg-brand" />
								<span>多</span>
							</div>
						</CardContent>
					</Card>
				</div>

				{/* 右侧栏：技能雷达 */}
				<div className="space-y-6">
					<Card>
						<CardHeader>
							<CardTitle>技能雷达</CardTitle>
							<CardDescription>五维能力评估</CardDescription>
						</CardHeader>
						<CardContent className="flex justify-center">
							<SkillRadarChart
								radar={radar?.current ?? overview.profile.skillRadar}
								size={260}
							/>
						</CardContent>
					</Card>

					{radar && radar.snapshots.length > 0 && (
						<Card>
							<CardHeader>
								<CardTitle>历史趋势</CardTitle>
								<CardDescription>
									共 {radar.snapshots.length} 次评估快照
								</CardDescription>
							</CardHeader>
							<CardContent className="space-y-2 text-xs">
								{radar.snapshots.slice(-5).map((s) => (
									<div
										key={s.timestamp}
										className="flex items-center justify-between rounded-md border border-border bg-surface-1 px-3 py-2"
									>
										<span>{s.timestamp.slice(0, 10)}</span>
										<span className="text-text-muted">
											笔画 {s.radar.strokes} · 结构 {s.radar.structure} · 章法{" "}
											{s.radar.layout}
										</span>
									</div>
								))}
							</CardContent>
						</Card>
					)}
				</div>
			</div>
		</PageContainer>
	);
}

const STATUS_LABELS: Record<string, string> = {
	not_started: "未开始",
	in_progress: "进行中",
	completed: "已完成",
	mastered: "已精通",
};

const UNIT_TYPE_LABELS: Record<string, string> = {
	video: "视频",
	live: "直播",
	stroke_lesson: "笔画课",
	reference_char: "范字",
	tracing_exercise: "临摹",
	assignment: "作业",
	quiz: "测验",
};

function StatBox({
	icon: Icon,
	label,
	value,
	color,
}: {
	icon: React.ComponentType<{ className?: string }>;
	label: string;
	value: string;
	color: "brand" | "info" | "success" | "warning";
}) {
	const colorMap = {
		brand: "text-brand bg-brand/10",
		info: "text-status-running bg-status-running/10",
		success: "text-status-active bg-status-active/10",
		warning: "text-status-warning bg-status-warning/10",
	};
	return (
		<div className="rounded-lg border border-border bg-card p-3">
			<div
				className={`mb-1.5 flex size-8 items-center justify-center rounded-md ${colorMap[color]}`}
			>
				<Icon className="size-4" />
			</div>
			<div className="font-serif text-lg font-semibold">{value}</div>
			<div className="text-xs text-text-muted">{label}</div>
		</div>
	);
}
