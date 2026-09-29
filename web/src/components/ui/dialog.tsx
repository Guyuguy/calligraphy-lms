import * as DialogPrimitive from "@radix-ui/react-dialog";
import { X } from "lucide-react";
import type * as React from "react";
import { cn } from "@/lib/utils";

export const Dialog = DialogPrimitive.Root;
export const DialogTrigger = DialogPrimitive.Trigger;
export const DialogClose = DialogPrimitive.Close;

export function DialogOverlay({
	className,
	...props
}: React.ComponentProps<typeof DialogPrimitive.Overlay>) {
	return (
		<DialogPrimitive.Overlay
			className={cn(
				"fixed inset-0 z-50 bg-black/40 backdrop-blur-sm data-[state=open]:animate-in data-[state=closed]:animate-out",
				className,
			)}
			{...props}
		/>
	);
}

export function DialogContent({
	className,
	children,
	...props
}: React.ComponentProps<typeof DialogPrimitive.Content>) {
	return (
		<DialogPrimitive.Portal>
			<DialogOverlay />
			<DialogPrimitive.Content
				className={cn(
					"fixed z-50 grid gap-4 border bg-card shadow-lg",
					// 移动端：全屏
					"inset-0 h-full w-full max-h-full translate-x-0 translate-y-0 rounded-none p-4 overflow-y-auto",
					// sm+：居中对话框
					"sm:inset-auto sm:left-1/2 sm:top-1/2 sm:h-auto sm:max-h-[90vh] sm:w-full sm:max-w-lg sm:-translate-x-1/2 sm:-translate-y-1/2 sm:rounded-xl sm:p-6 sm:overflow-y-auto",
					className,
				)}
				{...props}
			>
				{children}
				<DialogPrimitive.Close className="absolute right-3 top-3 rounded-sm opacity-70 hover:opacity-100 transition-opacity sm:right-4 sm:top-4">
					<X className="size-4" />
					<span className="sr-only">关闭</span>
				</DialogPrimitive.Close>
			</DialogPrimitive.Content>
		</DialogPrimitive.Portal>
	);
}

export function DialogHeader({
	className,
	...props
}: React.ComponentProps<"div">) {
	return (
		<div
			className={cn("flex flex-col gap-1.5 text-left", className)}
			{...props}
		/>
	);
}

export function DialogFooter({
	className,
	...props
}: React.ComponentProps<"div">) {
	return (
		<div
			className={cn(
				"flex flex-col-reverse gap-2 sm:flex-row sm:justify-end",
				className,
			)}
			{...props}
		/>
	);
}

export function DialogTitle({
	className,
	...props
}: React.ComponentProps<typeof DialogPrimitive.Title>) {
	return (
		<DialogPrimitive.Title
			className={cn("text-lg font-semibold", className)}
			{...props}
		/>
	);
}

export function DialogDescription({
	className,
	...props
}: React.ComponentProps<typeof DialogPrimitive.Description>) {
	return (
		<DialogPrimitive.Description
			className={cn("text-sm text-muted-foreground", className)}
			{...props}
		/>
	);
}
