import { type KeyboardEvent, type MouseEvent, useRef, useState } from "react";
import type { Annotation } from "@/api/client";

interface AnnotationCanvasProps {
	imageUrl: string;
	annotations: Annotation[];
	onAddAnnotation: (x: number, y: number) => void;
	onDeleteAnnotation?: (id: string) => void;
	readonly?: boolean;
	annotationContent: string;
}

export function AnnotationCanvas({
	imageUrl,
	annotations,
	onAddAnnotation,
	onDeleteAnnotation,
	readonly = false,
	annotationContent,
}: AnnotationCanvasProps) {
	const containerRef = useRef<HTMLDivElement>(null);
	const [hoveredAnno, setHoveredAnno] = useState<string | null>(null);

	const handleClick = (e: MouseEvent<HTMLDivElement>) => {
		if (readonly || !annotationContent.trim()) return;
		const rect = containerRef.current?.getBoundingClientRect();
		if (!rect) return;
		const x = ((e.clientX - rect.left) / rect.width) * 100;
		const y = ((e.clientY - rect.top) / rect.height) * 100;
		if (x < 0 || x > 100 || y < 0 || y > 100) return;
		onAddAnnotation(Math.round(x * 10) / 10, Math.round(y * 10) / 10);
	};

	const handleKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
		if (readonly || !annotationContent.trim()) return;
		if (e.key !== "Enter" && e.key !== " ") return;
		const rect = containerRef.current?.getBoundingClientRect();
		if (!rect) return;
		onAddAnnotation(50, 50);
	};

	const interactiveProps = readonly
		? {}
		: {
				onClick: handleClick,
				onKeyDown: handleKeyDown,
				role: "button" as const,
				tabIndex: 0,
				"aria-label": "点击图片添加标注（先在下方输入标注内容）",
			};

	return (
		<div
			ref={containerRef}
			{...interactiveProps}
			className={`relative overflow-hidden rounded-md border border-border bg-surface-1 ${
				readonly ? "" : "cursor-crosshair"
			}`}
			style={{ minHeight: 300 }}
		>
			<img
				src={imageUrl}
				alt="学生作品"
				className="block max-h-[60vh] w-full object-contain"
				draggable={false}
			/>

			{/* 标注层 */}
			{annotations.map((a, idx) => (
				<div
					key={a.id}
					className="group absolute"
					style={{
						left: `${a.x}%`,
						top: `${a.y}%`,
						transform: "translate(-50%, -50%)",
					}}
					onMouseEnter={() => setHoveredAnno(a.id)}
					onMouseLeave={() => setHoveredAnno(null)}
					role="img"
					aria-label={`标注 ${idx + 1}：${a.content}`}
				>
					{/* 标注图形 */}
					{a.type === "circle" && (
						<div className="size-10 rounded-full border-2 border-status-error bg-status-error/20" />
					)}
					{a.type === "arrow" && (
						<div className="text-status-error text-2xl font-bold">→</div>
					)}
					{a.type === "text" && (
						<div className="flex size-6 items-center justify-center rounded-full bg-status-error text-xs font-bold text-white">
							{idx + 1}
						</div>
					)}

					{/* 序号标签（circle/arrow 也显示） */}
					{a.type !== "text" && (
						<div className="absolute -top-1 -left-1 flex size-5 items-center justify-center rounded-full bg-status-error text-[10px] font-bold text-white">
							{idx + 1}
						</div>
					)}

					{/* 悬浮提示 */}
					{hoveredAnno === a.id && (
						<div className="absolute left-1/2 top-full z-10 mt-1 -translate-x-1/2 whitespace-pre-wrap rounded-md border border-border bg-popover px-3 py-2 text-xs text-popover-foreground shadow-md max-w-48">
							<div className="font-medium">{a.content}</div>
							{!readonly && onDeleteAnnotation && (
								<button
									type="button"
									onClick={(e) => {
										e.stopPropagation();
										onDeleteAnnotation(a.id);
									}}
									className="mt-1 text-status-error hover:underline"
								>
									删除
								</button>
							)}
						</div>
					)}
				</div>
			))}

			{/* 提示 */}
			{!readonly && !annotationContent.trim() && (
				<div className="pointer-events-none absolute bottom-2 left-1/2 -translate-x-1/2 rounded-md bg-black/60 px-3 py-1 text-xs text-white">
					请在下方输入标注内容后点击图片添加标注
				</div>
			)}
		</div>
	);
}
