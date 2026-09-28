import type { SkillRadar } from "@/api/client";

interface SkillRadarProps {
	radar: SkillRadar;
	size?: number;
}

const LABELS: Array<{ key: keyof SkillRadar; label: string }> = [
	{ key: "strokes", label: "笔画" },
	{ key: "structure", label: "结构" },
	{ key: "layout", label: "章法" },
	{ key: "speed", label: "速度" },
	{ key: "stability", label: "稳定性" },
];

export function SkillRadarChart({ radar, size = 240 }: SkillRadarProps) {
	const cx = size / 2;
	const cy = size / 2;
	const r = size / 2 - 40;
	const n = LABELS.length;

	// 计算每个顶点坐标
	const points = LABELS.map((_, i) => {
		const angle = (Math.PI * 2 * i) / n - Math.PI / 2;
		return { x: cx + r * Math.cos(angle), y: cy + r * Math.sin(angle) };
	});

	// 数据多边形
	const dataPoints = LABELS.map((l, i) => {
		const angle = (Math.PI * 2 * i) / n - Math.PI / 2;
		const val = radar[l.key] / 100;
		return {
			x: cx + r * val * Math.cos(angle),
			y: cy + r * val * Math.sin(angle),
		};
	});

	const polygon = (pts: { x: number; y: number }[]) =>
		pts.map((p) => `${p.x},${p.y}`).join(" ");

	// 同心圆网格（5 层）
	const rings = [0.2, 0.4, 0.6, 0.8, 1.0];

	return (
		<svg
			width={size}
			height={size}
			viewBox={`0 0 ${size} ${size}`}
			className="overflow-visible"
			role="img"
			aria-label="技能雷达图"
		>
			{/* 同心多边形网格 */}
			{rings.map((ratio) => {
				const ringPts = LABELS.map((_, i) => {
					const angle = (Math.PI * 2 * i) / n - Math.PI / 2;
					return {
						x: cx + r * ratio * Math.cos(angle),
						y: cy + r * ratio * Math.sin(angle),
					};
				});
				return (
					<polygon
						key={`ring-${ratio}`}
						points={polygon(ringPts)}
						fill="none"
						stroke="var(--color-border)"
						strokeWidth={1}
						opacity={0.6}
					/>
				);
			})}

			{/* 轴线 */}
			{points.map((p) => (
				<line
					key={`axis-${p.x}-${p.y}`}
					x1={cx}
					y1={cy}
					x2={p.x}
					y2={p.y}
					stroke="var(--color-border)"
					strokeWidth={1}
					opacity={0.6}
				/>
			))}

			{/* 数据多边形 */}
			<polygon
				points={polygon(dataPoints)}
				fill="var(--color-brand)"
				fillOpacity={0.2}
				stroke="var(--color-brand)"
				strokeWidth={2}
			/>

			{/* 数据点 */}
			{dataPoints.map((p) => (
				<circle
					key={`pt-${p.x}-${p.y}`}
					cx={p.x}
					cy={p.y}
					r={3}
					fill="var(--color-brand)"
				/>
			))}

			{/* 标签 */}
			{LABELS.map((l, i) => {
				const angle = (Math.PI * 2 * i) / n - Math.PI / 2;
				const lx = cx + (r + 18) * Math.cos(angle);
				const ly = cy + (r + 18) * Math.sin(angle);
				return (
					<text
						key={l.key}
						x={lx}
						y={ly}
						textAnchor="middle"
						dominantBaseline="middle"
						fontSize={12}
						fill="var(--color-text-secondary)"
						fontWeight={500}
					>
						{l.label}
					</text>
				);
			})}
		</svg>
	);
}
