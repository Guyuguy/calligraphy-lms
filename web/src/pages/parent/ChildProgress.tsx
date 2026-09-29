import { ArrowLeft, Award, Clock, Flame, TrendingUp } from "lucide-react";
import { useEffect, useState } from "react";
import {
	api,
	LEVEL_LABELS,
	type ProgressOverview,
	STAGE_LABELS,
	STYLE_LABELS,
	type User,
} from "@/api/client";
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

interface ChildProgressProps {
	childId: string;
	user: User;
	navigate: (path: string) => void;
}

export function ChildProgress({ childId, user, navigate }: ChildProgressProps) {
	const [overview, setOverview] = useState<ProgressOverview | null>(null);
	const [loading, setLoading] = useState(true);
	const [error, setError] = useState<string | null>(null);

	useEffect(() => {
		setLoading(true);
		setError(null);
		api
			.get<ProgressOverview>(`/parent/children/${childId}/progress`)
			.then(setOverview)
			.catch((e) => setError(e instanceof Error ? e.message : "加载失败"))
			.finally(() => setLoading(false));
	}, [childId]);

	return (
		<PageContainer
			title={overview?.profile ? `${user.name} 查看孩子进度` : "孩子进度"}
			description={overview?.profile?.grade ?? ""}
			actions={
				<button
					type="button"
					onClick={() => navigate("/parent")}
					className="flex items-center gap-1 rounded-md border border-border px-3 py-1.5 text-sm hover:bg-surface-2"
				>
					<ArrowLeft className="size-4" />
					返回
				</button>
			}
		>
			{loading ? (
				<div className="py-12 text-center text-text-muted">加载中...</div>
			) : error ? (
				<Card>
					<CardContent className="py-12 text-center text-status-error">
						{error}
					</CardContent>
				</Card>
			) : !overview ? null : (
				<div className="space-y-6">
					<div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
						<StatBox
							icon={Clock}
							label="本月时长"
							value={`${(overview.summary.monthMinutes / 60).toFixed(1)}h`}
						/>
						<StatBox
							icon={Flame}
							label="连续打卡"
							value={`${overview.summary.streakDays} 天`}
						/>
						<StatBox
							icon={Award}
							label="完成单元"
							value={`${overview.summary.totalCompleted}/${overview.summary.totalUnits}`}
						/>
						<StatBox
							icon={TrendingUp}
							label="总体进度"
							value={`${overview.summary.overallPercent}%`}
						/>
					</div>

					<Card>
						<CardHeader>
							<CardTitle>课程进度</CardTitle>
							<CardDescription>
								共 {overview.courses.length} 门课程
							</CardDescription>
						</CardHeader>
						<CardContent className="space-y-3">
							{overview.courses.length === 0 ? (
								<div className="py-6 text-center text-text-muted">
									尚未开始任何课程
								</div>
							) : (
								overview.courses.map((c) => (
									<div
										key={c.courseId}
										className="space-y-1.5 rounded-md border border-border p-3"
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
									</div>
								))
							)}
						</CardContent>
					</Card>
				</div>
			)}
		</PageContainer>
	);
}

function StatBox({
	icon: Icon,
	label,
	value,
}: {
	icon: React.ComponentType<{ className?: string }>;
	label: string;
	value: string;
}) {
	return (
		<div className="rounded-lg border border-border bg-card p-3">
			<div className="mb-1.5 flex size-8 items-center justify-center rounded-md bg-brand/10 text-brand">
				<Icon className="size-4" />
			</div>
			<div className="font-serif text-lg font-semibold">{value}</div>
			<div className="text-xs text-text-muted">{label}</div>
		</div>
	);
}
