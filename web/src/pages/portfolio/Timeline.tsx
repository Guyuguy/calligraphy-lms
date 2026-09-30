import { MessageSquare } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { api, type TimelineItem, type TimelineResponse } from "@/api/client";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { ArtworkDetailDialog } from "./ArtworkDetailDialog";

interface TimelineProps {
	studentId: string;
	readonly: boolean; // 学生/家长只读,教师/教务/管理员可编辑
	canDeleteArtwork: boolean;
	refreshKey: number; // 外部触发刷新
}

export function Timeline({
	studentId,
	readonly,
	canDeleteArtwork,
	refreshKey,
}: TimelineProps) {
	const [items, setItems] = useState<TimelineItem[]>([]);
	const [loading, setLoading] = useState(true);
	const [error, setError] = useState<string | null>(null);
	const [selectedId, setSelectedId] = useState<string | null>(null);

	// biome-ignore lint/correctness/useExhaustiveDependencies: refreshKey 触发外部刷新
	useEffect(() => {
		setLoading(true);
		setError(null);
		api
			.get<TimelineResponse>(`/portfolios/${studentId}/timeline`)
			.then((r) => setItems(r.items))
			.catch((e) => setError(e instanceof Error ? e.message : "加载失败"))
			.finally(() => setLoading(false));
	}, [studentId, refreshKey]);

	// 90 天热力图: 按日期聚合作品数
	const heatmap = useMemo(() => {
		const map = new Map<string, number>();
		for (const it of items) {
			const day = it.createdAt.slice(0, 10);
			map.set(day, (map.get(day) ?? 0) + 1);
		}
		const days: { date: string; count: number }[] = [];
		for (let i = 89; i >= 0; i--) {
			const d = new Date(Date.now() - i * 86400000).toISOString().slice(0, 10);
			days.push({ date: d, count: map.get(d) ?? 0 });
		}
		return days;
	}, [items]);

	if (loading) return <div className="text-text-muted">加载时间轴...</div>;
	if (error) return <div className="text-status-error text-sm">{error}</div>;

	if (items.length === 0)
		return (
			<div className="rounded-md border border-border bg-surface-1 p-8 text-center text-text-muted">
				暂无作品,点击右上角"上传作品"开始记录你的练字历程。
			</div>
		);

	return (
		<div className="space-y-4">
			{/* 90 天热力图 */}
			<Card>
				<CardContent className="p-3">
					<div className="mb-2 text-xs font-medium text-text-muted">
						最近 90 天作品密度
					</div>
					<div className="flex flex-wrap gap-0.5">
						{heatmap.map((d) => {
							const level =
								d.count === 0
									? "bg-surface-2"
									: d.count === 1
										? "bg-brand/30"
										: d.count === 2
											? "bg-brand/60"
											: "bg-brand";
							return (
								<div
									key={d.date}
									className={`size-2.5 rounded-sm ${level}`}
									title={`${d.date}: ${d.count} 个作品`}
								/>
							);
						})}
					</div>
				</CardContent>
			</Card>

			{/* 时间轴列表 */}
			<div className="space-y-2">
				{items.map((it) => (
					<button
						key={`${it.kind}-${it.id}`}
						type="button"
						onClick={() => setSelectedId(it.id)}
						className="flex w-full items-center gap-3 rounded-md border border-border bg-surface-1 p-3 text-left transition-colors hover:border-brand/40 hover:bg-surface-2"
					>
						{it.imageUrl ? (
							<img
								src={it.imageUrl}
								alt={it.title}
								className="size-16 shrink-0 rounded-md border border-border object-cover"
							/>
						) : (
							<div className="flex size-16 shrink-0 items-center justify-center rounded-md border border-border bg-surface-2 text-xs text-text-muted">
								无图
							</div>
						)}
						<div className="flex-1 min-w-0">
							<div className="flex items-center gap-2">
								<span className="truncate font-medium">{it.title}</span>
								{it.isFeatured && <Badge variant="info">精选</Badge>}
								<Badge variant="outline">
									{it.kind === "artwork" ? "独立作品" : "作业提交"}
								</Badge>
							</div>
							<div className="mt-0.5 text-xs text-text-muted">
								{new Date(it.createdAt).toLocaleString("zh-CN", {
									year: "numeric",
									month: "2-digit",
									day: "2-digit",
									hour: "2-digit",
									minute: "2-digit",
								})}
							</div>
							{it.linkedSubmission && (
								<div className="mt-0.5 text-xs text-text-muted">
									{it.linkedSubmission.courseTitle}
									{it.linkedSubmission.score !== null &&
										` · ${it.linkedSubmission.score} 分`}
								</div>
							)}
						</div>
						{it.annotationsCount > 0 && (
							<div className="flex items-center gap-1 text-xs text-text-muted">
								<MessageSquare className="size-3" />
								{it.annotationsCount}
							</div>
						)}
					</button>
				))}
			</div>

			<ArtworkDetailDialog
				artworkId={selectedId}
				readonly={readonly}
				canDelete={canDeleteArtwork}
				onClose={() => setSelectedId(null)}
				onChanged={() => {
					// 触发外部刷新
					setSelectedId(null);
				}}
			/>
		</div>
	);
}
