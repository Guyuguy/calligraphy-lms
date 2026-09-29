import type * as React from "react";
import { cn } from "@/lib/utils";

interface PageContainerProps {
	title: string;
	description?: string;
	actions?: React.ReactNode;
	children: React.ReactNode;
	className?: string;
}

export function PageContainer({
	title,
	description,
	actions,
	children,
	className,
}: PageContainerProps) {
	return (
		<div
			className={cn("mx-auto w-full max-w-7xl p-4 sm:p-6 lg:p-8", className)}
		>
			<div className="mb-4 flex flex-col gap-3 sm:mb-6 sm:flex-row sm:items-start sm:justify-between sm:gap-4">
				<div className="min-w-0">
					<h1 className="truncate font-serif text-xl font-semibold text-text-primary sm:text-2xl">
						{title}
					</h1>
					{description && (
						<p className="mt-1 text-sm text-text-muted">{description}</p>
					)}
				</div>
				{actions && (
					<div className="flex shrink-0 flex-wrap items-center gap-2">
						{actions}
					</div>
				)}
			</div>
			{children}
		</div>
	);
}
