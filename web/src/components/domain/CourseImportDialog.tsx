import { Download, Upload } from "lucide-react";
import { useRef, useState } from "react";
import { ApiError, api, type Course } from "@/api/client";
import { Button } from "@/components/ui/button";
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogFooter,
	DialogHeader,
	DialogTitle,
} from "@/components/ui/dialog";

interface CourseImportDialogProps {
	open: boolean;
	onOpenChange: (open: boolean) => void;
	onImported: () => void;
}

interface ImportResult {
	created: number;
	courses: Course[];
	errors: string[];
}

function errMsg(e: unknown): string {
	if (e instanceof ApiError) return e.message;
	return e instanceof Error ? e.message : "操作失败";
}

const FORMAT_ACCEPT = ".json,.md,.txt,.xlsx,.docx";

export function CourseImportDialog({
	open,
	onOpenChange,
	onImported,
}: CourseImportDialogProps) {
	const [file, setFile] = useState<File | null>(null);
	const [importing, setImporting] = useState(false);
	const [error, setError] = useState<string | null>(null);
	const [result, setResult] = useState<ImportResult | null>(null);
	const inputRef = useRef<HTMLInputElement>(null);

	const reset = () => {
		setFile(null);
		setError(null);
		setResult(null);
		if (inputRef.current) inputRef.current.value = "";
	};

	const handleClose = (open: boolean) => {
		if (!open) reset();
		onOpenChange(open);
	};

	const handleImport = async () => {
		if (!file) return;
		setImporting(true);
		setError(null);
		setResult(null);
		try {
			const res = await api.postFile<ImportResult>("/courses/import", file);
			setResult(res);
			if (res.created > 0) {
				onImported();
			}
		} catch (e) {
			setError(errMsg(e));
		} finally {
			setImporting(false);
		}
	};

	return (
		<Dialog open={open} onOpenChange={handleClose}>
			<DialogContent className="sm:max-w-lg">
				<DialogHeader>
					<DialogTitle>导入课程</DialogTitle>
					<DialogDescription>
						支持 JSON / Markdown / TXT / Excel / Word 格式,可一次导入多门课程。
					</DialogDescription>
				</DialogHeader>

				<div className="space-y-4">
					<div className="space-y-1.5">
						<label htmlFor="ci-file" className="text-sm font-medium">
							选择文件
						</label>
						<input
							ref={inputRef}
							id="ci-file"
							type="file"
							accept={FORMAT_ACCEPT}
							onChange={(e) => {
								setFile(e.target.files?.[0] ?? null);
								setError(null);
								setResult(null);
							}}
							className="block w-full text-sm file:mr-3 file:rounded-md file:border file:border-border file:bg-card file:px-3 file:py-1.5 file:text-sm hover:file:bg-surface-2"
						/>
						{file && (
							<div className="text-xs text-text-muted">
								已选择: {file.name} ({(file.size / 1024).toFixed(1)} KB)
							</div>
						)}
					</div>

					<div className="rounded-md bg-surface-1 p-3 text-xs text-text-muted">
						<div className="mb-1 font-medium text-text">文件格式说明</div>
						<ul className="list-disc space-y-0.5 pl-4">
							<li>
								<span className="font-medium">JSON</span>:
								单个对象或数组,字段对应课程结构
							</li>
							<li>
								<span className="font-medium">MD/TXT</span>: # 课程标题 + ##
								章节 + ### 单元 + key:value 元数据
							</li>
							<li>
								<span className="font-medium">XLSX</span>:
								第一行表头,每行一个单元记录
							</li>
							<li>
								<span className="font-medium">DOCX</span>: 文本结构同
								MD(标题层级)
							</li>
						</ul>
						<div className="mt-2">
							不知道格式?
							<a
								href="https://placehold.co"
								className="ml-1 text-brand underline"
								onClick={(e) => {
									e.preventDefault();
									void downloadTemplate("json");
								}}
							>
								<Download className="mr-0.5 inline size-3" />
								下载模板
							</a>
							(支持 JSON / MD / TXT / XLSX)
						</div>
					</div>

					{error && (
						<div className="rounded-md border border-status-error/30 bg-status-error/10 px-3 py-2 text-sm text-status-error">
							{error}
						</div>
					)}

					{result && (
						<div className="rounded-md border border-border bg-surface-1 px-3 py-2 text-sm">
							<div className="font-medium text-status-success">
								成功创建 {result.created} 门课程
							</div>
							{result.errors.length > 0 && (
								<div className="mt-1 text-xs text-status-warning">
									警告 ({result.errors.length} 条):
									<ul className="list-disc pl-4">
										{result.errors.slice(0, 5).map((e, i) => (
											// biome-ignore lint/suspicious/noArrayIndexKey: 错误列表无稳定 id
											<li key={`err-${i}`}>{e}</li>
										))}
										{result.errors.length > 5 && (
											<li>...共 {result.errors.length} 条</li>
										)}
									</ul>
								</div>
							)}
							{result.created > 0 && (
								<div className="mt-1 text-xs text-text-muted">
									列表已刷新,可在课程管理页面查看新课程。
								</div>
							)}
						</div>
					)}
				</div>

				<DialogFooter>
					<Button
						variant="outline"
						onClick={() => handleClose(false)}
						disabled={importing}
					>
						{result?.created ? "关闭" : "取消"}
					</Button>
					<Button
						onClick={handleImport}
						disabled={!file || importing || !!result?.created}
					>
						<Upload className="size-4" />
						{importing ? "导入中..." : "开始导入"}
					</Button>
				</DialogFooter>
			</DialogContent>
		</Dialog>
	);
}

async function downloadTemplate(format: "json" | "md" | "txt" | "xlsx") {
	try {
		const { blob, filename } = await api.downloadBlob(
			`/courses/template?format=${format}`,
		);
		const url = URL.createObjectURL(blob);
		const a = document.createElement("a");
		a.href = url;
		a.download = filename;
		document.body.appendChild(a);
		a.click();
		document.body.removeChild(a);
		URL.revokeObjectURL(url);
	} catch (e) {
		console.error("下载模板失败:", e);
	}
}
