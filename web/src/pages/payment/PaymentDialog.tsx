import { useCallback, useEffect, useRef, useState } from "react";
import { api, type Order } from "@/api/client";
import { Button } from "@/components/ui/button";
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogFooter,
	DialogHeader,
	DialogTitle,
} from "@/components/ui/dialog";

interface PaymentDialogProps {
	open: boolean;
	orderNo: string;
	codeUrl?: string;
	channel: "wechat" | "alipay";
	amount: number;
	title: string;
	mock: boolean;
	onClose: () => void;
	onSuccess: (order: Order) => void;
}

const POLL_INTERVAL_MS = 2000;

export function PaymentDialog({
	open,
	orderNo,
	channel,
	amount,
	title,
	mock,
	onClose,
	onSuccess,
}: PaymentDialogProps) {
	const [status, setStatus] = useState<"polling" | "paid" | "failed">(
		"polling",
	);
	const [remainingSec, setRemainingSec] = useState<number>(0);
	const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

	const pollOnce = useCallback(async () => {
		try {
			const res = await api.get<{ order: Order }>(
				`/payments/orders/${orderNo}`,
			);
			// 倒计时
			const expireMs = new Date(res.order.expireAt).getTime();
			const remain = Math.max(0, Math.floor((expireMs - Date.now()) / 1000));
			setRemainingSec(remain);

			if (res.order.status === "paid") {
				setStatus("paid");
				if (timerRef.current) clearInterval(timerRef.current);
				onSuccess(res.order);
			} else if (res.order.status === "failed") {
				setStatus("failed");
				if (timerRef.current) clearInterval(timerRef.current);
			}
		} catch (err) {
			console.error("[payment] 轮询失败:", err);
		}
	}, [orderNo, onSuccess]);

	// 轮询订单状态
	useEffect(() => {
		if (!open || !orderNo) return;

		// 立即查一次
		void pollOnce();

		timerRef.current = setInterval(() => {
			void pollOnce();
		}, POLL_INTERVAL_MS);

		return () => {
			if (timerRef.current) clearInterval(timerRef.current);
			timerRef.current = null;
		};
	}, [open, orderNo, pollOnce]);

	const handleMockPay = useCallback(async () => {
		try {
			const res = await api.post<{ ok: boolean; order: Order }>(
				`/payments/orders/${orderNo}/mock-pay`,
				{},
			);
			setStatus("paid");
			if (timerRef.current) clearInterval(timerRef.current);
			onSuccess(res.order);
		} catch (err) {
			console.error("[payment] Mock 支付失败:", err);
			alert("模拟支付失败,请稍后重试");
		}
	}, [orderNo, onSuccess]);

	const channelLabel = channel === "wechat" ? "微信支付" : "支付宝";
	const channelColor = channel === "wechat" ? "#07C160" : "#1677FF";

	const mm = String(Math.floor(remainingSec / 60)).padStart(2, "0");
	const ss = String(remainingSec % 60).padStart(2, "0");

	return (
		<Dialog open={open} onOpenChange={(v) => !v && onClose()}>
			<DialogContent>
				<DialogHeader>
					<DialogTitle className="flex items-center gap-2">
						<span
							className="inline-block size-3 rounded-full"
							style={{ backgroundColor: channelColor }}
						/>
						{channelLabel} · 扫码支付
					</DialogTitle>
					<DialogDescription>
						请使用 {channelLabel} 扫描下方二维码完成支付
					</DialogDescription>
				</DialogHeader>

				<div className="flex flex-col items-center gap-4 py-4">
					<div className="rounded-lg border border-border bg-white p-4">
						<img
							src={
								channel === "wechat"
									? "/qrcodes/wechat.png"
									: "/qrcodes/alipay.png"
							}
							alt={`${channelLabel}收款码`}
							className="size-[200px] object-contain"
						/>
					</div>

					<div className="text-center">
						<div className="font-serif text-2xl font-semibold">
							¥{amount.toFixed(2)}
						</div>
						<div className="mt-1 text-sm text-text-muted">{title}</div>
						<div className="mt-1 text-xs text-text-muted">
							订单号: {orderNo}
						</div>
					</div>

					{status === "polling" && (
						<div className="text-center text-sm text-text-muted">
							<div>
								等待支付结果... 剩余有效时间 {mm}:{ss}
							</div>
							{mock && (
								<Button
									className="mt-3"
									size="sm"
									variant="outline"
									onClick={handleMockPay}
								>
									模拟支付成功(开发模式)
								</Button>
							)}
						</div>
					)}
					{status === "paid" && (
						<div className="text-center text-sm font-medium text-status-active">
							✓ 支付成功
						</div>
					)}
					{status === "failed" && (
						<div className="text-center text-sm font-medium text-status-error">
							✗ 支付失败,请重新下单
						</div>
					)}
				</div>

				<DialogFooter>
					<Button variant="outline" onClick={onClose} className="w-full">
						{status === "paid" ? "完成" : "关闭"}
					</Button>
				</DialogFooter>
			</DialogContent>
		</Dialog>
	);
}
