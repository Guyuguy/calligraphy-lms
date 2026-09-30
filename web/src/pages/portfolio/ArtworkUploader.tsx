import { Upload } from "lucide-react";
import { useRef, useState } from "react";
import { ApiError, type Artwork, api } from "@/api/client";
import { Button } from "@/components/ui/button";
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogFooter,
	DialogHeader,
	DialogTitle,
} from "@/components/ui/dialog";

interface ArtworkUploaderProps {
	open: boolean;
	studentId: string;
	onOpenChange: (open: boolean) => void;
	onUploaded: () => void;
}

function errMsg(e: unknown): string {
	if (e instanceof ApiError) return e.message;
	return e instanceof Error ? e.message : "操作失败";
}

export function ArtworkUploader({
	open,
	studentId,
	onOpenChange,
	onUploaded,
}: ArtworkUploaderProps) {
	const [title, setTitle] = useState("");
	const [file, setFile] = useState<File | null>(null);
	const [uploading, setUploading] = useState(false);
	const [error, setError] = useState<string | null>(null);
	const inputRef = useRef<HTMLInputElement>(null);

	const reset = () => {
		setTitle("");
		setFile(null);
		setError(null);
		if (inputRef.current) inputRef.current.value = "";
	};

	const handleClose = (o: boolean) => {
		if (!o) reset();
		onOpenChange(o);
	};

	const handleUpload = async () => {
		if (!title.trim() || !file) return;
		setUploading(true);
		setError(null);
		try {
			// 1. 创建作品记录
			const createRes = await api.post<{ ok: true; artwork: Artwork }>(
				`/portfolios/${studentId}/artworks`,
				{ title: title.trim() },
			);
			// 2. 上传图片
			await api.postImage<{ ok: true; imageUrl: string }>(
				`/portfolios/artworks/${createRes.artwork.id}/image`,
				file,
			);
			reset();
			onOpenChange(false);
			onUploaded();
		} catch (e) {
			setError(errMsg(e));
		} finally {
			setUploading(false);
		}
	};

	return (
		<Dialog open={open} onOpenChange={handleClose}>
			<DialogContent className="sm:max-w-lg">
				<DialogHeader>
					<DialogTitle>上传作品</DialogTitle>
					<DialogDescription>
						上传一张独立作品(非作业提交),支持 JPG/PNG/WebP 等图片格式,最大
						10MB。
					</DialogDescription>
				</DialogHeader>

				<div className="space-y-4">
					<div className="space-y-1.5">
						<label htmlFor="au-title" className="text-sm font-medium">
							作品标题
						</label>
						<input
							id="au-title"
							type="text"
							value={title}
							onChange={(e) => setTitle(e.target.value)}
							placeholder="例如:永字八法练习"
							className="block w-full rounded-md border border-border bg-card px-3 py-1.5 text-sm"
						/>
					</div>

					<div className="space-y-1.5">
						<label htmlFor="au-file" className="text-sm font-medium">
							选择图片
						</label>
						<input
							ref={inputRef}
							id="au-file"
							type="file"
							accept="image/*"
							onChange={(e) => {
								setFile(e.target.files?.[0] ?? null);
								setError(null);
							}}
							className="block w-full text-sm file:mr-3 file:rounded-md file:border file:border-border file:bg-card file:px-3 file:py-1.5 file:text-sm hover:file:bg-surface-2"
						/>
						{file && (
							<div className="text-xs text-text-muted">
								已选择: {file.name} ({(file.size / 1024).toFixed(1)} KB)
							</div>
						)}
					</div>

					{error && (
						<div className="rounded-md border border-status-error/30 bg-status-error/10 px-3 py-2 text-sm text-status-error">
							{error}
						</div>
					)}
				</div>

				<DialogFooter>
					<Button
						variant="outline"
						onClick={() => handleClose(false)}
						disabled={uploading}
					>
						取消
					</Button>
					<Button
						onClick={handleUpload}
						disabled={!title.trim() || !file || uploading}
					>
						<Upload className="size-4" />
						{uploading ? "上传中..." : "上传"}
					</Button>
				</DialogFooter>
			</DialogContent>
		</Dialog>
	);
}
