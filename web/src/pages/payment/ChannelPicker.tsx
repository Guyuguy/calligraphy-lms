import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogFooter,
	DialogHeader,
	DialogTitle,
} from "@/components/ui/dialog";

interface ChannelPickerProps {
	open: boolean;
	amount: number;
	title: string;
	onClose: () => void;
	onConfirm: (channel: "wechat" | "alipay") => void;
}

export function ChannelPicker({
	open,
	amount,
	title,
	onClose,
	onConfirm,
}: ChannelPickerProps) {
	const [channel, setChannel] = useState<"wechat" | "alipay">("wechat");

	return (
		<Dialog open={open} onOpenChange={(v) => !v && onClose()}>
			<DialogContent className="sm:max-w-md">
				<DialogHeader>
					<DialogTitle>选择支付方式</DialogTitle>
					<DialogDescription>{title}</DialogDescription>
				</DialogHeader>

				<div className="space-y-2 py-2">
					<button
						type="button"
						onClick={() => setChannel("wechat")}
						className={`flex w-full items-center gap-3 rounded-lg border p-3 text-left transition-colors ${
							channel === "wechat"
								? "border-status-active bg-surface-2"
								: "border-border hover:bg-surface-2"
						}`}
					>
						<span
							className="flex size-10 items-center justify-center rounded-full text-white"
							style={{ backgroundColor: "#07C160" }}
						>
							<svg
								viewBox="0 0 24 24"
								className="size-6 fill-current"
								role="img"
								aria-label="微信支付"
							>
								<path d="M8.5 8.5c-.83 0-1.5-.67-1.5-1.5s.67-1.5 1.5-1.5 1.5.67 1.5 1.5-.67 1.5-1.5 1.5zm6 0c-.83 0-1.5-.67-1.5-1.5s.67-1.5 1.5-1.5 1.5.67 1.5 1.5-.67 1.5-1.5 1.5zM12 4C6.48 4 2 7.58 2 12c0 2.42 1.35 4.59 3.5 6.06L4 22l4.5-2.5c1.1.31 2.27.5 3.5.5 5.52 0 10-3.58 10-8s-4.48-8-10-8z" />
							</svg>
						</span>
						<div className="flex-1">
							<div className="font-medium">微信支付</div>
							<div className="text-xs text-text-muted">使用微信扫码支付</div>
						</div>
						{channel === "wechat" && (
							<span className="text-status-active">✓</span>
						)}
					</button>

					<button
						type="button"
						onClick={() => setChannel("alipay")}
						className={`flex w-full items-center gap-3 rounded-lg border p-3 text-left transition-colors ${
							channel === "alipay"
								? "border-status-active bg-surface-2"
								: "border-border hover:bg-surface-2"
						}`}
					>
						<span
							className="flex size-10 items-center justify-center rounded-full text-white"
							style={{ backgroundColor: "#1677FF" }}
						>
							<svg
								viewBox="0 0 24 24"
								className="size-6 fill-current"
								role="img"
								aria-label="支付宝"
							>
								<path d="M12 4C6.48 4 2 7.58 2 12s4.48 8 10 8 10-3.58 10-8-4.48-8-10-8zm3.5 8.5c-.83 0-1.5-.67-1.5-1.5s.67-1.5 1.5-1.5 1.5.67 1.5 1.5-.67 1.5-1.5 1.5zm-6 0c-.83 0-1.5-.67-1.5-1.5s.67-1.5 1.5-1.5 1.5.67 1.5 1.5-.67 1.5-1.5 1.5z" />
							</svg>
						</span>
						<div className="flex-1">
							<div className="font-medium">支付宝</div>
							<div className="text-xs text-text-muted">使用支付宝扫码支付</div>
						</div>
						{channel === "alipay" && (
							<span className="text-status-active">✓</span>
						)}
					</button>
				</div>

				<div className="flex items-center justify-between border-t border-border pt-3">
					<span className="text-sm text-text-muted">应付金额</span>
					<span className="font-serif text-xl font-semibold">
						¥{amount.toFixed(2)}
					</span>
				</div>

				<DialogFooter>
					<Button variant="outline" onClick={onClose} className="flex-1">
						取消
					</Button>
					<Button onClick={() => onConfirm(channel)} className="flex-1">
						确认支付
					</Button>
				</DialogFooter>
			</DialogContent>
		</Dialog>
	);
}
