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
		<div className={cn("mx-auto max-w-7xl p-6", className)}>
			<div className="mb-6 flex items-start justify-between gap-4">
				<div>
					<h1 className="font-serif text-2xl font-semibold text-text-primary">
						{title}
					</h1>
					{description && (
						<p className="mt-1 text-sm text-text-muted">{description}</p>
					)}
				</div>
				{actions && <div className="flex items-center gap-2">{actions}</div>}
			</div>
			{children}
		</div>
	);
}
