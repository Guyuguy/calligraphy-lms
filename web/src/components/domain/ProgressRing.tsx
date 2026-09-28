interface ProgressRingProps {
	value: number; // 0-100
	size?: number;
	thickness?: number;
	color?: string;
	label?: string;
}

export function ProgressRing({
	value,
	size = 80,
	thickness = 6,
	color = "var(--color-brand)",
	label,
}: ProgressRingProps) {
	const r = (size - thickness) / 2;
	const cx = size / 2;
	const cy = size / 2;
	const circumference = 2 * Math.PI * r;
	const offset =
		circumference - (Math.max(0, Math.min(100, value)) / 100) * circumference;

	return (
		<div
			className="relative inline-flex items-center justify-center"
			style={{ width: size, height: size }}
		>
			<svg
				width={size}
				height={size}
				className="-rotate-90"
				role="img"
				aria-label={`${Math.round(value)}%`}
			>
				<circle
					cx={cx}
					cy={cy}
					r={r}
					fill="none"
					stroke="var(--color-muted)"
					strokeWidth={thickness}
				/>
				<circle
					cx={cx}
					cy={cy}
					r={r}
					fill="none"
					stroke={color}
					strokeWidth={thickness}
					strokeDasharray={circumference}
					strokeDashoffset={offset}
					strokeLinecap="round"
					style={{ transition: "stroke-dashoffset 0.5s ease" }}
				/>
			</svg>
			<div className="absolute inset-0 flex flex-col items-center justify-center">
				<span className="font-serif text-lg font-semibold">
					{Math.round(value)}%
				</span>
				{label && <span className="text-xs text-text-muted">{label}</span>}
			</div>
		</div>
	);
}
