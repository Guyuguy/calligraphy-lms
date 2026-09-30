import { PenTool, Trash2 } from "lucide-react";
import { useEffect, useState } from "react";
import {
	type Annotation,
	type AnnotationType,
	ApiError,
	type ArtworkDetail,
	api,
} from "@/api/client";
import { AnnotationCanvas } from "@/components/domain/AnnotationCanvas";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogFooter,
	DialogHeader,
	DialogTitle,
} from "@/components/ui/dialog";

interface ArtworkDetailDialogProps {
	artworkId: string | null;
	readonly: boolean;
	canDelete: boolean; // 是否可删除作品本身
	onClose: () => void;
	onChanged?: () => void; // 标注或作品变更后回调
}

function errMsg(e: unknown): string {
	if (e instanceof ApiError) return e.message;
	return e instanceof Error ? e.message : "操作失败";
}

export function ArtworkDetailDialog({
	artworkId,
	readonly,
	canDelete,
	onClose,
	onChanged,
}: ArtworkDetailDialogProps) {
	const [detail, setDetail] = useState<ArtworkDetail | null>(null);
	const [loading, setLoading] = useState(false);
	const [annotationType, setAnnotationType] =
		useState<AnnotationType>("circle");
	const [annotationContent, setAnnotationContent] = useState("");
	const [error, setError] = useState<string | null>(null);
	const [confirmingDelete, setConfirmingDelete] = useState(false);

	useEffect(() => {
		if (!artworkId) {
			setDetail(null);
			setError(null);
			setConfirmingDelete(false);
			return;
		}
		setLoading(true);
		setError(null);
		api
			.get<{ artwork: ArtworkDetail }>(`/portfolios/artworks/${artworkId}`)
			.then((r) => setDetail(r.artwork))
			.catch((e) => setError(errMsg(e)))
			.finally(() => setLoading(false));
	}, [artworkId]);

	const reload = () => {
		if (!artworkId) return;
		api
			.get<{ artwork: ArtworkDetail }>(`/portfolios/artworks/${artworkId}`)
			.then((r) => setDetail(r.artwork))
			.catch((e) => setError(errMsg(e)));
	};

	const addAnnotation = async (
		x: number,
		y: number,
		type: AnnotationType,
		options?: { size?: number; angle?: number },
	) => {
		if (!artworkId) return;
		try {
			await api.post<{ ok: true; annotation: Annotation }>(
				`/portfolios/artworks/${artworkId}/annotations`,
				{ x, y, type, content: annotationContent, ...(options ?? {}) },
			);
			setAnnotationContent("");
			reload();
			onChanged?.();
		} catch (e) {
			setError(errMsg(e));
		}
	};

	const deleteAnnotation = async (annoId: string) => {
		if (!artworkId) return;
		try {
			await api.del(`/portfolios/artworks/${artworkId}/annotations/${annoId}`);
			reload();
			onChanged?.();
		} catch (e) {
			setError(errMsg(e));
		}
	};

	const deleteArtwork = async () => {
		if (!artworkId) return;
		try {
			await api.del(`/portfolios/artworks/${artworkId}`);
			onClose();
			onChanged?.();
		} catch (e) {
			setError(errMsg(e));
		}
	};

	return (
		<Dialog open={!!artworkId} onOpenChange={(o) => !o && onClose()}>
			<DialogContent className="sm:max-w-4xl">
				<DialogHeader>
					<DialogTitle className="flex items-center gap-2">
						<PenTool className="size-4 text-brand" />
						{detail?.title ?? "作品详情"}
						{detail?.isFeatured && <Badge variant="info">精选</Badge>}
					</DialogTitle>
					<DialogDescription>
						{detail?.studentName}
						{detail?.linkedSubmission &&
							` · 关联作业: ${detail.linkedSubmission.assignmentTitle} (${detail.linkedSubmission.courseTitle})`}
					</DialogDescription>
				</DialogHeader>

				{loading && (
					<div className="flex h-40 items-center justify-center text-text-muted">
						加载中...
					</div>
				)}

				{error && (
					<div className="rounded-md border border-status-error/30 bg-status-error/10 px-3 py-2 text-sm text-status-error">
						{error}
					</div>
				)}

				{!loading && detail && (
					<div className="space-y-3">
						{detail.imageUrl ? (
							<>
								<div className="flex items-center justify-between">
									<span className="text-sm font-medium">
										{readonly ? "作品（只读）" : "作品（点击图片添加圈点标注）"}
									</span>
									{detail.annotations.length > 0 && (
										<Badge variant="info">
											{detail.annotations.length} 个标注
										</Badge>
									)}
								</div>
								<AnnotationCanvas
									imageUrl={detail.imageUrl}
									annotations={detail.annotations}
									annotationType={annotationType}
									onAddAnnotation={addAnnotation}
									onDeleteAnnotation={deleteAnnotation}
									readonly={readonly}
									annotationContent={annotationContent}
								/>

								{!readonly && (
									<div className="flex flex-wrap items-center gap-2 rounded-md border border-border bg-surface-1 p-2">
										<div className="flex items-center gap-1">
											{(["circle", "arrow", "text"] as AnnotationType[]).map(
												(t) => (
													<button
														key={t}
														type="button"
														onClick={() => setAnnotationType(t)}
														className={`rounded-md border px-2.5 py-1 text-xs transition-colors ${
															annotationType === t
																? "border-brand bg-brand text-white"
																: "border-border bg-card hover:bg-surface-2"
														}`}
													>
														{t === "circle"
															? "圆圈"
															: t === "arrow"
																? "箭头"
																: "编号"}
													</button>
												),
											)}
										</div>
										<input
											type="text"
											value={annotationContent}
											onChange={(e) => setAnnotationContent(e.target.value)}
											placeholder="标注说明（可选）"
											className="flex-1 rounded-md border border-border bg-card px-2 py-1 text-xs"
										/>
									</div>
								)}

								{detail.annotations.length > 0 && (
									<div className="rounded-md border border-border bg-surface-1 p-2">
										<div className="mb-1 text-xs font-medium text-text-muted">
											标注列表
										</div>
										<ul className="space-y-1 text-xs">
											{detail.annotations.map((a, i) => (
												<li key={a.id} className="flex items-start gap-2">
													<span className="mt-0.5 flex size-5 shrink-0 items-center justify-center rounded-full bg-status-error text-[10px] font-bold text-white">
														{i + 1}
													</span>
													<span className="flex-1">
														{a.type === "circle"
															? "圆圈"
															: a.type === "arrow"
																? "箭头"
																: "编号"}
														{a.content && ` · ${a.content}`}
													</span>
													{!readonly && (
														<button
															type="button"
															onClick={() => deleteAnnotation(a.id)}
															className="text-status-error hover:underline"
														>
															删除
														</button>
													)}
												</li>
											))}
										</ul>
									</div>
								)}
							</>
						) : (
							<div className="flex h-40 items-center justify-center rounded-md border border-border bg-surface-1 text-text-muted">
								该作品尚未上传图片
							</div>
						)}

						{detail.linkedSubmission && (
							<div className="rounded-md border border-border bg-surface-1 p-3 text-sm">
								<div className="font-medium">关联作业信息</div>
								<div className="mt-1 text-text-muted">
									{detail.linkedSubmission.assignmentTitle} ·{" "}
									{detail.linkedSubmission.courseTitle}
								</div>
								{detail.linkedSubmission.score !== null && (
									<div className="mt-1">
										分数:{" "}
										<span className="font-medium text-brand">
											{detail.linkedSubmission.score}
										</span>
									</div>
								)}
								{detail.linkedSubmission.teacherComment && (
									<div className="mt-1 text-text-muted">
										教师评语: {detail.linkedSubmission.teacherComment}
									</div>
								)}
							</div>
						)}

						{canDelete && !confirmingDelete && (
							<div className="flex justify-end">
								<Button
									variant="outline"
									size="sm"
									onClick={() => setConfirmingDelete(true)}
								>
									<Trash2 className="size-4" />
									删除作品
								</Button>
							</div>
						)}

						{confirmingDelete && (
							<div className="rounded-md border border-status-error/30 bg-status-error/10 p-3 text-sm">
								<div className="mb-2 font-medium text-status-error">
									确认删除该作品？此操作不可撤销,所有标注也会一并删除。
								</div>
								<div className="flex justify-end gap-2">
									<Button
										variant="outline"
										size="sm"
										onClick={() => setConfirmingDelete(false)}
									>
										取消
									</Button>
									<Button
										variant="destructive"
										size="sm"
										onClick={deleteArtwork}
									>
										确认删除
									</Button>
								</div>
							</div>
						)}
					</div>
				)}

				<DialogFooter>
					<Button variant="outline" onClick={onClose}>
						关闭
					</Button>
				</DialogFooter>
			</DialogContent>
		</Dialog>
	);
}
