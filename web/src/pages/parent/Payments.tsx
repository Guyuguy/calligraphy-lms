import { Wallet } from "lucide-react";
import { useEffect, useState } from "react";
import {
	api,
	type Order,
	type Payment,
	type PaymentMethodsResponse,
	type User,
} from "@/api/client";
import { PageContainer } from "@/components/layout/PageContainer";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
	Card,
	CardContent,
	CardDescription,
	CardHeader,
	CardTitle,
} from "@/components/ui/card";
import { PaymentDialog } from "@/pages/payment/PaymentDialog";

interface PaymentsProps {
	user: User;
}

const STATUS_LABEL: Record<Payment["status"], string> = {
	paid: "已支付",
	pending: "待支付",
	overdue: "已逾期",
};

const STATUS_VARIANT: Record<
	Payment["status"],
	"success" | "warning" | "danger"
> = {
	paid: "success",
	pending: "warning",
	overdue: "danger",
};

export function Payments({ user }: PaymentsProps) {
	const [list, setList] = useState<Payment[]>([]);
	const [loading, setLoading] = useState(true);
	const [methods, setMethods] = useState<PaymentMethodsResponse | null>(null);
	const [payChannel, setPayChannel] = useState<"wechat" | "alipay">("wechat");
	const [payDialog, setPayDialog] = useState<{
		orderNo: string;
		codeUrl: string;
		amount: number;
		title: string;
	} | null>(null);
	const [channelPickerFor, setChannelPickerFor] = useState<Payment | null>(
		null,
	);

	const reload = () => {
		api
			.get<{ payments: Payment[] }>("/parent/payments")
			.then((res) => setList(res.payments))
			.catch(() => setList([]))
			.finally(() => setLoading(false));
	};

	// biome-ignore lint/correctness/useExhaustiveDependencies: reload 是稳定引用,只在 mount 时调用一次
	useEffect(() => {
		reload();
		api
			.get<PaymentMethodsResponse>("/payments/methods")
			.then(setMethods)
			.catch(() => setMethods({ mock: true, wechat: false, alipay: false }));
	}, []);

	const totalPaid = list
		.filter((p) => p.status === "paid")
		.reduce((sum, p) => sum + p.amount, 0);
	const totalPending = list
		.filter((p) => p.status !== "paid")
		.reduce((sum, p) => sum + p.amount, 0);

	async function handlePay(p: Payment, channel: "wechat" | "alipay") {
		try {
			const res = await api.post<{ order: Order; codeUrl: string }>(
				`/parent/payments/${p.id}/pay`,
				{ channel },
			);
			setChannelPickerFor(null);
			setPayDialog({
				orderNo: res.order.orderNo,
				codeUrl: res.codeUrl,
				amount: res.order.amount,
				title: res.order.title,
			});
		} catch (err) {
			console.error("[pay] 创建账单支付订单失败:", err);
			alert("创建支付订单失败");
		}
	}

	return (
		<PageContainer title="缴费记录" description={`${user.name} 的缴费明细`}>
			<div className="grid grid-cols-1 gap-4 sm:grid-cols-3 mb-6">
				<Card>
					<CardContent className="pt-6">
						<div className="text-xs text-text-muted">已支付总额</div>
						<div className="mt-1 font-serif text-2xl font-semibold text-status-active">
							¥{totalPaid}
						</div>
					</CardContent>
				</Card>
				<Card>
					<CardContent className="pt-6">
						<div className="text-xs text-text-muted">待支付总额</div>
						<div className="mt-1 font-serif text-2xl font-semibold text-status-warning">
							¥{totalPending}
						</div>
					</CardContent>
				</Card>
				<Card>
					<CardContent className="pt-6">
						<div className="text-xs text-text-muted">账单总数</div>
						<div className="mt-1 font-serif text-2xl font-semibold">
							{list.length}
						</div>
					</CardContent>
				</Card>
			</div>

			<Card>
				<CardHeader>
					<CardTitle className="flex items-center gap-2">
						<Wallet className="size-4 text-brand" />
						账单列表
					</CardTitle>
					<CardDescription>按截止日期倒序排列</CardDescription>
				</CardHeader>
				<CardContent>
					{loading ? (
						<div className="py-12 text-center text-sm text-text-muted">
							加载中...
						</div>
					) : list.length === 0 ? (
						<div className="py-12 text-center text-sm text-text-muted">
							暂无缴费记录
						</div>
					) : (
						<ul className="space-y-2">
							{list.map((p) => (
								<li
									key={p.id}
									className="flex items-center justify-between rounded-md border border-border bg-surface-1 px-4 py-3"
								>
									<div className="flex-1">
										<div className="font-medium">{p.title}</div>
										<div className="mt-0.5 text-xs text-text-muted">
											截止 {p.dueAt.slice(0, 10)}
											{p.paidAt && ` · 已于 ${p.paidAt.slice(0, 10)} 支付`}
											{p.method &&
												` · ${p.method === "wechat" ? "微信支付" : p.method === "alipay" ? "支付宝" : "线下"}`}
											{p.transactionId &&
												` · 交易号 ${p.transactionId.slice(0, 16)}...`}
										</div>
									</div>
									<div className="flex items-center gap-3">
										<span className="font-medium">¥{p.amount}</span>
										<Badge variant={STATUS_VARIANT[p.status]}>
											{STATUS_LABEL[p.status]}
										</Badge>
										{p.status !== "paid" &&
											(channelPickerFor?.id === p.id ? (
												<div className="flex gap-1">
													<Button
														size="sm"
														variant={
															payChannel === "wechat" ? "default" : "outline"
														}
														onClick={() => setPayChannel("wechat")}
													>
														微信
													</Button>
													<Button
														size="sm"
														variant={
															payChannel === "alipay" ? "default" : "outline"
														}
														onClick={() => setPayChannel("alipay")}
													>
														支付宝
													</Button>
													<Button
														size="sm"
														onClick={() => handlePay(p, payChannel)}
													>
														确认
													</Button>
													<Button
														size="sm"
														variant="ghost"
														onClick={() => setChannelPickerFor(null)}
													>
														取消
													</Button>
												</div>
											) : (
												<Button
													size="sm"
													onClick={() => setChannelPickerFor(p)}
												>
													立即支付
												</Button>
											))}
									</div>
								</li>
							))}
						</ul>
					)}
				</CardContent>
			</Card>

			{payDialog && (
				<PaymentDialog
					open={true}
					orderNo={payDialog.orderNo}
					codeUrl={payDialog.codeUrl}
					channel={payChannel}
					amount={payDialog.amount}
					title={payDialog.title}
					mock={methods?.mock ?? true}
					onClose={() => setPayDialog(null)}
					onSuccess={() => {
						setPayDialog(null);
						reload();
					}}
				/>
			)}
		</PageContainer>
	);
}
