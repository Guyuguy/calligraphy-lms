import { ArrowRight, Lock, Sparkles, Star, TrendingUp } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import {
	api,
	type Course,
	LEVEL_LABELS,
	type RecommendationItem,
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

interface CourseRecommendProps {
	user: User;
	navigate: (p: string) => void;
}

export function CourseRecommend({ user, navigate }: CourseRecommendProps) {
	const [recs, setRecs] = useState<RecommendationItem[]>([]);
	const [allCourses, setAllCourses] = useState<Course[]>([]);
	const [loading, setLoading] = useState(true);

	useEffect(() => {
		if (user.role !== "student") {
			setLoading(false);
			return;
		}
		Promise.all([
			api.get<{ recommendations: RecommendationItem[] }>(
				`/recommendations/${user.id}`,
			),
			api.get<{ courses: Course[] }>("/courses"),
		])
			.then(([r1, r2]) => {
				setRecs(r1.recommendations);
				setAllCourses(r2.courses);
			})
			.finally(() => setLoading(false));
	}, [user.id, user.role]);

	// 按书体分组课程，构造学习路径
	const pathsByStage = useMemo(() => {
		const groups: Record<string, Course[]> = {};
		for (const c of allCourses) {
			if (!groups[c.stage]) groups[c.stage] = [];
			groups[c.stage].push(c);
		}
		// 每组按 level 排序
		for (const k of Object.keys(groups)) {
			groups[k].sort((a, b) => a.level.localeCompare(b.level));
		}
		return groups;
	}, [allCourses]);

	// 推荐课程 id 集合（用于在路径图上高亮）
	const recommendedIds = useMemo(
		() => new Set(recs.map((r) => r.course.id)),
		[recs],
	);

	if (user.role !== "student") {
		return (
			<PageContainer title="课程推荐" description="仅学生账号可查看个性化推荐">
				<Card>
					<CardContent className="py-12 text-center text-sm text-text-muted">
						请使用学生账号登录查看推荐课程
					</CardContent>
				</Card>
			</PageContainer>
		);
	}

	return (
		<PageContainer
			title="课程推荐"
			description="基于你的学习画像、进度与偏好智能推荐"
		>
			{/* 推荐课程 Top 5 */}
			<Card className="mb-6">
				<CardHeader>
					<CardTitle className="flex items-center gap-2">
						<Sparkles className="size-4 text-brand" />
						为你推荐的课程
					</CardTitle>
					<CardDescription>Top 5 匹配度最高的课程，含推荐理由</CardDescription>
				</CardHeader>
				<CardContent className="space-y-3">
					{loading ? (
						<div className="py-12 text-center text-sm text-text-muted">
							正在生成推荐...
						</div>
					) : recs.length === 0 ? (
						<div className="py-12 text-center text-sm text-text-muted">
							暂无推荐
						</div>
					) : (
						recs.map((rec, idx) => (
							<RecommendationCard
								key={rec.course.id}
								rec={rec}
								rank={idx + 1}
								onClick={() => navigate(`/courses/${rec.course.id}`)}
							/>
						))
					)}
				</CardContent>
			</Card>

			{/* 学习路径图 */}
			<Card>
				<CardHeader>
					<CardTitle className="flex items-center gap-2">
						<TrendingUp className="size-4 text-brand" />
						学习路径图
					</CardTitle>
					<CardDescription>
						按书体划分的进阶路线，星标为推荐课程，锁标为有前置要求
					</CardDescription>
				</CardHeader>
				<CardContent className="space-y-6">
					{Object.entries(pathsByStage).map(([stage, courses]) => (
						<div key={stage}>
							<div className="mb-2 flex items-center gap-2">
								<Badge variant="default">
									{STAGE_LABELS[stage as keyof typeof STAGE_LABELS]}
								</Badge>
								<span className="text-sm text-text-muted">
									{courses.length} 门课程
								</span>
							</div>
							<div className="flex items-center gap-2 overflow-x-auto pb-2">
								{courses.map((c, i) => {
									const isRecommended = recommendedIds.has(c.id);
									const hasPrereq = c.prerequisites.length > 0;
									return (
										<div key={c.id} className="flex items-center gap-2">
											<button
												type="button"
												onClick={() => navigate(`/courses/${c.id}`)}
												className={`group relative flex min-w-44 max-w-52 flex-col items-start gap-1.5 rounded-lg border p-3 text-left transition-all ${
													isRecommended
														? "border-brand bg-brand/5 shadow-sm hover:bg-brand/10"
														: "border-border bg-surface-1 hover:bg-surface-2"
												}`}
											>
												<div className="flex w-full items-center justify-between">
													<Badge variant="secondary" className="text-[10px]">
														{LEVEL_LABELS[c.level]}
													</Badge>
													<div className="flex items-center gap-1">
														{hasPrereq && (
															<Lock className="size-3 text-text-muted" />
														)}
														{isRecommended && (
															<Star className="size-3 fill-brand text-brand" />
														)}
													</div>
												</div>
												<div className="line-clamp-2 text-sm font-medium leading-snug">
													{c.title}
												</div>
												<div className="text-xs text-text-muted">
													{STYLE_LABELS[c.style]} · {c.totalUnits} 节
												</div>
												{isRecommended && (
													<div className="mt-1 flex items-center gap-1 text-[10px] text-brand">
														<Sparkles className="size-2.5" />
														推荐课程
													</div>
												)}
											</button>
											{i < courses.length - 1 && (
												<ArrowRight className="size-4 shrink-0 text-text-muted" />
											)}
										</div>
									);
								})}
							</div>
						</div>
					))}
				</CardContent>
			</Card>

			{/* 推荐理由汇总 */}
			{!loading && recs.length > 0 && (
				<Card className="mt-6">
					<CardHeader>
						<CardTitle>推荐依据</CardTitle>
						<CardDescription>本系统采用多维加权评分算法</CardDescription>
					</CardHeader>
					<CardContent>
						<div className="grid grid-cols-1 gap-3 md:grid-cols-5">
							<FactorCard
								label="基础匹配"
								weight="30%"
								desc="书体阶段 + 难度梯度"
							/>
							<FactorCard label="能力阶梯" weight="25%" desc="前置课程完成度" />
							<FactorCard label="兴趣画像" weight="20%" desc="书体风格偏好" />
							<FactorCard label="教师契合" weight="15%" desc="教师评分与匹配" />
							<FactorCard label="同伴推荐" weight="10%" desc="同水平热门选择" />
						</div>
					</CardContent>
				</Card>
			)}
		</PageContainer>
	);
}

function RecommendationCard({
	rec,
	rank,
	onClick,
}: {
	rec: RecommendationItem;
	rank: number;
	onClick: () => void;
}) {
	const c: Course = rec.course;
	return (
		<button
			type="button"
			onClick={onClick}
			className="flex w-full items-start gap-4 rounded-lg border border-border bg-surface-1 p-4 text-left transition-all hover:border-brand hover:bg-surface-2"
		>
			<div className="flex size-10 shrink-0 items-center justify-center rounded-full bg-brand/10 font-serif text-base font-semibold text-brand">
				#{rank}
			</div>
			<img
				src={c.cover}
				alt=""
				className="size-20 shrink-0 rounded-md object-cover"
			/>
			<div className="flex-1">
				<div className="flex items-start justify-between gap-3">
					<div className="font-medium">{c.title}</div>
					<Badge variant="success">匹配 {(rec.score * 100).toFixed(0)}%</Badge>
				</div>
				<div className="mt-1 text-xs text-text-muted">
					{STAGE_LABELS[c.stage]} · {LEVEL_LABELS[c.level]} ·{" "}
					{STYLE_LABELS[c.style]} · {c.teacherName ?? "未知教师"}
				</div>
				<div className="mt-2 flex flex-wrap gap-1.5">
					{rec.reasons.map((r) => (
						<span
							key={r}
							className="inline-flex items-center gap-1 rounded-md bg-brand/10 px-2 py-0.5 text-xs text-brand"
						>
							<Sparkles className="size-3" />
							{r}
						</span>
					))}
				</div>
				{c.prerequisites.length > 0 && (
					<div className="mt-2 flex items-center gap-1 text-xs text-text-muted">
						<Lock className="size-3" />
						前置：{c.prerequisites.length} 门课程
					</div>
				)}
			</div>
		</button>
	);
}

function FactorCard({
	label,
	weight,
	desc,
}: {
	label: string;
	weight: string;
	desc: string;
}) {
	return (
		<div className="rounded-lg border border-border bg-surface-1 p-3">
			<div className="flex items-center justify-between">
				<span className="text-sm font-medium">{label}</span>
				<Badge variant="secondary">{weight}</Badge>
			</div>
			<div className="mt-1.5 text-xs text-text-muted">{desc}</div>
		</div>
	);
}
