import {
	type KeyboardEvent,
	type MouseEvent,
	useLayoutEffect,
	useRef,
	useState,
} from "react";
import type { Annotation, AnnotationType } from "@/api/client";

const DEFAULT_SIZE = 10; // 相对画布宽度的百分比（编号用）
const MIN_SIZE = 2;
const MAX_SIZE = 50;
const MIN_DRAG_PX = 6; // 拖动小于此距离视为无效（圈/箭头）

interface AnnotationCanvasProps {
	imageUrl: string;
	annotations: Annotation[];
	annotationType: AnnotationType; // 当前选中的标注类型
	onAddAnnotation: (
		x: number,
		y: number,
		type: AnnotationType,
		options?: { size?: number; angle?: number },
	) => void;
	onDeleteAnnotation?: (id: string) => void;
	readonly?: boolean;
	annotationContent: string;
}

// 拖拽中的临时标注（未提交）
interface DraftAnno {
	x: number; // 起点百分比
	y: number;
	curX: number; // 当前点百分比
	curY: number;
	type: "circle" | "arrow";
}

export function AnnotationCanvas({
	imageUrl,
	annotations,
	annotationType,
	onAddAnnotation,
	onDeleteAnnotation,
	readonly = false,
	annotationContent,
}: AnnotationCanvasProps) {
	const containerRef = useRef<HTMLDivElement>(null);
	const [hoveredAnno, setHoveredAnno] = useState<string | null>(null);
	const [containerWidth, setContainerWidth] = useState(0);
	const [draft, setDraft] = useState<DraftAnno | null>(null);
	// 用于抑制 mouseUp 后的 click 事件（避免重复添加编号）
	const suppressClickRef = useRef(false);

	// 测量容器宽度，用于把百分比 size 转成 px
	useLayoutEffect(() => {
		const el = containerRef.current;
		if (!el) return;
		const update = () => setContainerWidth(el.clientWidth);
		update();
		const ro = new ResizeObserver(update);
		ro.observe(el);
		return () => ro.disconnect();
	}, []);

	// 把客户端坐标转换为相对容器的百分比
	const toPercent = (clientX: number, clientY: number) => {
		const rect = containerRef.current?.getBoundingClientRect();
		if (!rect) return null;
		const x = ((clientX - rect.left) / rect.width) * 100;
		const y = ((clientY - rect.top) / rect.height) * 100;
		if (x < 0 || x > 100 || y < 0 || y > 100) return null;
		return { x, y };
	};

	// 编号：点击添加
	const handleClick = (e: MouseEvent<HTMLDivElement>) => {
		if (readonly) return;
		if (suppressClickRef.current) {
			suppressClickRef.current = false;
			return;
		}
		if (annotationType !== "text") return; // 只有编号走点击路径
		const pos = toPercent(e.clientX, e.clientY);
		if (!pos) return;
		onAddAnnotation(
			Math.round(pos.x * 10) / 10,
			Math.round(pos.y * 10) / 10,
			"text",
		);
	};

	const handleKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
		if (readonly) return;
		if (e.key !== "Enter" && e.key !== " ") return;
		onAddAnnotation(50, 50, "text");
	};

	// 鼠标按下：圈/箭头开始拖拽
	const handleMouseDown = (e: MouseEvent<HTMLDivElement>) => {
		if (readonly) return;
		if (e.button !== 0) return;
		if (annotationType === "text") return; // 编号走 click
		const pos = toPercent(e.clientX, e.clientY);
		if (!pos) return;
		setDraft({
			x: pos.x,
			y: pos.y,
			curX: pos.x,
			curY: pos.y,
			type: annotationType as "circle" | "arrow",
		});
		e.preventDefault();
	};

	// 鼠标移动：更新 draft
	const handleMouseMove = (e: MouseEvent<HTMLDivElement>) => {
		if (readonly || !draft) return;
		const pos = toPercent(e.clientX, e.clientY);
		if (!pos) return;
		setDraft({ ...draft, curX: pos.x, curY: pos.y });
	};

	// 鼠标松开：根据拖动距离决定 size 和 angle
	const handleMouseUp = (e: MouseEvent<HTMLDivElement>) => {
		if (readonly || !draft) return;
		const rect = containerRef.current?.getBoundingClientRect();
		if (!rect) {
			setDraft(null);
			return;
		}
		const dxPx = e.clientX - rect.left - (draft.x * rect.width) / 100;
		const dyPx = e.clientY - rect.top - (draft.y * rect.height) / 100;
		const distPx = Math.sqrt(dxPx * dxPx + dyPx * dyPx);
		const startX = draft.x;
		const startY = draft.y;
		const type = draft.type;
		setDraft(null);
		// 抑制后续 click 事件
		suppressClickRef.current = true;
		if (distPx < MIN_DRAG_PX) {
			// 拖动太小，不添加
			return;
		}
		const sizePct = (distPx / rect.width) * 100;
		const size = Math.max(
			MIN_SIZE,
			Math.min(MAX_SIZE, Math.round(sizePct * 10) / 10),
		);
		const angle = (Math.atan2(dyPx, dxPx) * 180) / Math.PI;
		onAddAnnotation(
			Math.round(startX * 10) / 10,
			Math.round(startY * 10) / 10,
			type,
			{ size, angle },
		);
	};

	// 鼠标离开容器：取消 draft
	const handleMouseLeave = () => {
		if (draft) setDraft(null);
		setHoveredAnno(null);
	};

	const interactiveProps = readonly
		? {}
		: {
				onMouseDown: handleMouseDown,
				onMouseMove: handleMouseMove,
				onMouseUp: handleMouseUp,
				onMouseLeave: handleMouseLeave,
				onClick: handleClick,
				onKeyDown: handleKeyDown,
				role: "button" as const,
				tabIndex: 0,
				"aria-label": "长按拖拽添加圈/箭头标注，点击添加编号",
			};

	// 计算 draft 的渲染尺寸（px）
	const draftSizePx = draft
		? (() => {
				const rect = containerRef.current?.getBoundingClientRect();
				if (!rect) return 0;
				const dxPx = (draft.curX - draft.x) * rect.width;
				const dyPx = (draft.curY - draft.y) * rect.height;
				return Math.sqrt(dxPx * dxPx + dyPx * dyPx);
			})()
		: 0;

	const draftAngle = draft
		? (() => {
				const rect = containerRef.current?.getBoundingClientRect();
				if (!rect) return 0;
				const dxPx = (draft.curX - draft.x) * rect.width;
				const dyPx = (draft.curY - draft.y) * rect.height;
				return (Math.atan2(dyPx, dxPx) * 180) / Math.PI;
			})()
		: 0;

	return (
		<div
			ref={containerRef}
			{...interactiveProps}
			className={`relative overflow-hidden rounded-md border border-border bg-surface-1 ${
				readonly ? "" : "cursor-crosshair"
			}`}
			style={{ minHeight: 300, userSelect: "none" }}
		>
			<img
				src={imageUrl}
				alt="学生作品"
				className="block max-h-[60vh] w-full object-contain pointer-events-none"
				draggable={false}
			/>

			{/* 已有标注层（松开后锁定，不再可调整） */}
			{annotations.map((a, idx) => {
				const size = a.size ?? DEFAULT_SIZE;
				const sizePx = (size * containerWidth) / 100;
				return (
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
						aria-label={`标注 ${idx + 1}：${a.content || "无内容"}`}
					>
						{a.type === "circle" && (
							<div
								className="rounded-full border-2 border-status-error bg-status-error/20"
								style={{ width: sizePx, height: sizePx }}
							/>
						)}
						{a.type === "arrow" && (
							<div
								className="flex items-center justify-center text-status-error"
								style={{
									width: sizePx,
									height: sizePx,
									transform: `rotate(${a.angle ?? 0}deg)`,
								}}
							>
								<svg
									viewBox="0 0 24 24"
									fill="none"
									stroke="currentColor"
									strokeWidth="3"
									strokeLinecap="round"
									strokeLinejoin="round"
									className="size-full"
									role="img"
									aria-label="箭头标注"
								>
									<title>箭头标注</title>
									<path d="M5 12h14M13 6l6 6-6 6" />
								</svg>
							</div>
						)}
						{a.type === "text" && (
							<div
								className="flex items-center justify-center rounded-full bg-status-error font-bold text-white"
								style={{
									width: sizePx * 0.6,
									height: sizePx * 0.6,
									fontSize: sizePx * 0.3,
								}}
							>
								{idx + 1}
							</div>
						)}

						{/* 序号标签 */}
						{a.type !== "text" && (
							<div className="absolute -top-1 -left-1 flex size-5 items-center justify-center rounded-full bg-status-error text-[10px] font-bold text-white">
								{idx + 1}
							</div>
						)}

						{/* 悬浮提示（仅删除，无调整大小） */}
						{hoveredAnno === a.id && (
							<div className="absolute left-1/2 top-full z-10 mt-1 -translate-x-1/2 whitespace-pre-wrap rounded-md border border-border bg-popover px-3 py-2 text-xs text-popover-foreground shadow-md max-w-48">
								{a.content && <div className="font-medium">{a.content}</div>}
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
				);
			})}

			{/* 拖拽中的预览 */}
			{draft && draftSizePx > 0 && (
				<div
					className="pointer-events-none absolute"
					style={{
						left: `${draft.x}%`,
						top: `${draft.y}%`,
						transform: "translate(-50%, -50%)",
					}}
				>
					{draft.type === "circle" && (
						<div
							className="rounded-full border-2 border-status-error/70 bg-status-error/10"
							style={{ width: draftSizePx, height: draftSizePx }}
						/>
					)}
					{draft.type === "arrow" && (
						<div
							className="flex items-center justify-center text-status-error/70"
							style={{
								width: draftSizePx,
								height: draftSizePx,
								transform: `rotate(${draftAngle}deg)`,
							}}
						>
							<svg
								viewBox="0 0 24 24"
								fill="none"
								stroke="currentColor"
								strokeWidth="3"
								strokeLinecap="round"
								strokeLinejoin="round"
								className="size-full"
								role="img"
								aria-label="箭头标注预览"
							>
								<title>箭头标注预览</title>
								<path d="M5 12h14M13 6l6 6-6 6" />
							</svg>
						</div>
					)}
				</div>
			)}

			{/* 提示 */}
			{!readonly && !annotationContent.trim() && !draft && (
				<div className="pointer-events-none absolute bottom-2 left-1/2 -translate-x-1/2 rounded-md bg-black/60 px-3 py-1 text-xs text-white">
					{annotationType === "text"
						? "点击图片添加编号标注"
						: "长按拖拽添加圈/箭头（拖动距离决定大小，方向决定箭头朝向，松开后锁定）"}
				</div>
			)}
		</div>
	);
}
