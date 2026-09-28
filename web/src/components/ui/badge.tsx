import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";
import type * as React from "react";
import { cn } from "@/lib/utils";

const badgeVariants = cva(
	"inline-flex items-center justify-center rounded-full border px-2 py-0.5 text-xs font-medium w-fit whitespace-nowrap shrink-0 gap-1 transition-colors",
	{
		variants: {
			variant: {
				default: "border-transparent bg-brand text-white",
				secondary: "border-transparent bg-secondary text-secondary-foreground",
				outline: "text-foreground border-border",
				success: "border-transparent bg-status-active/15 text-status-active",
				warning: "border-transparent bg-status-warning/15 text-status-warning",
				danger: "border-transparent bg-status-error/15 text-status-error",
				info: "border-transparent bg-status-running/15 text-status-running",
			},
		},
		defaultVariants: { variant: "default" },
	},
);

export interface BadgeProps
	extends React.ComponentProps<"span">,
		VariantProps<typeof badgeVariants> {
	asChild?: boolean;
}

export function Badge({
	className,
	variant,
	asChild = false,
	...props
}: BadgeProps) {
	const Comp = asChild ? Slot : "span";
	return (
		<Comp
			data-slot="badge"
			className={cn(badgeVariants({ variant }), className)}
			{...props}
		/>
	);
}

export { badgeVariants };
