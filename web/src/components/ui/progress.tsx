import type * as React from "react";
import { cn } from "@/lib/utils";

export interface ProgressProps extends React.ComponentProps<"div"> {
	value: number; // 0-100
	size?: "sm" | "md" | "lg";
	color?: "brand" | "success" | "warning" | "danger" | "info";
}

const sizeClasses = { sm: "h-1.5", md: "h-2", lg: "h-3" };
const colorClasses = {
	brand: "bg-brand",
	success: "bg-status-active",
	warning: "bg-status-warning",
	danger: "bg-status-error",
	info: "bg-status-running",
};

export function Progress({
	value,
	size = "md",
	color = "brand",
	className,
	...props
}: ProgressProps) {
	const pct = Math.max(0, Math.min(100, value));
	return (
		<div
			data-slot="progress"
			className={cn(
				"relative w-full overflow-hidden rounded-full bg-muted",
				sizeClasses[size],
				className,
			)}
			{...props}
		>
			<div
				className={cn(
					"h-full rounded-full transition-all duration-500",
					colorClasses[color],
				)}
				style={{ width: `${pct}%` }}
			/>
		</div>
	);
}
