import { MessageSquare } from "lucide-react";
import { useEffect, useState } from "react";
import { api, type FeaturedArtwork, type FeaturedResponse } from "@/api/client";
import { ArtworkDetailDialog } from "./ArtworkDetailDialog";

interface WorkWallProps {
	readonly: boolean; // 学生/家长只读
	canDeleteArtwork: boolean;
	refreshKey: number;
}

export function WorkWall({
	readonly,
	canDeleteArtwork,
	refreshKey,
}: WorkWallProps) {
	const [artworks, setArtworks] = useState<FeaturedArtwork[]>([]);
	const [loading, setLoading] = useState(true);
	const [error, setError] = useState<string | null>(null);
	const [selectedId, setSelectedId] = useState<string | null>(null);

	// biome-ignore lint/correctness/useExhaustiveDependencies: refreshKey 触发外部刷新
	useEffect(() => {
		setLoading(true);
		setError(null);
		api
			.get<FeaturedResponse>("/portfolios/artworks/featured")
			.then((r) => setArtworks(r.artworks))
			.catch((e) => setError(e instanceof Error ? e.message : "加载失败"))
			.finally(() => setLoading(false));
	}, [refreshKey]);

	if (loading) return <div className="text-text-muted">加载作品墙...</div>;
	if (error) return <div className="text-status-error text-sm">{error}</div>;

	if (artworks.length === 0)
		return (
			<div className="rounded-md border border-border bg-surface-1 p-8 text-center text-text-muted">
				暂无精选作品。教师可在作品详情中将作品标记为精选。
			</div>
		);

	return (
		<div>
			<div className="mb-3 text-sm text-text-muted">
				共 {artworks.length} 件精选作品
			</div>
			<div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
				{artworks.map((a) => (
					<button
						key={a.id}
						type="button"
						onClick={() => setSelectedId(a.id)}
						className="group overflow-hidden rounded-md border border-border bg-surface-1 text-left transition-all hover:border-brand/40 hover:shadow-md"
					>
						<div className="aspect-[3/4] overflow-hidden bg-surface-2">
							{a.imageUrl ? (
								<img
									src={a.imageUrl}
									alt={a.title}
									className="size-full object-cover transition-transform group-hover:scale-105"
								/>
							) : (
								<div className="flex size-full items-center justify-center text-xs text-text-muted">
									无图
								</div>
							)}
						</div>
						<div className="p-2">
							<div className="truncate text-sm font-medium">{a.title}</div>
							<div className="mt-0.5 truncate text-xs text-text-muted">
								{a.studentName}
							</div>
							<div className="mt-1 flex items-center justify-between text-xs">
								<span className="text-text-muted">
									{new Date(a.createdAt).toLocaleDateString("zh-CN")}
								</span>
								{a.annotationsCount && a.annotationsCount > 0 ? (
									<span className="flex items-center gap-0.5 text-text-muted">
										<MessageSquare className="size-3" />
										{a.annotationsCount}
									</span>
								) : null}
							</div>
						</div>
					</button>
				))}
			</div>

			<ArtworkDetailDialog
				artworkId={selectedId}
				readonly={readonly}
				canDelete={canDeleteArtwork}
				onClose={() => setSelectedId(null)}
				onChanged={() => setSelectedId(null)}
			/>
		</div>
	);
}
