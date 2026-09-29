import { Wallet } from "lucide-react";
import { useEffect, useState } from "react";
import { api, type Payment, type User } from "@/api/client";
import { PageContainer } from "@/components/layout/PageContainer";
import { Badge } from "@/components/ui/badge";
import {
	Card,
	CardContent,
	CardDescription,
	CardHeader,
	CardTitle,
} from "@/components/ui/card";

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

	useEffect(() => {
		api
			.get<{ payments: Payment[] }>("/parent/payments")
			.then((res) => setList(res.payments))
			.catch(() => setList([]))
			.finally(() => setLoading(false));
	}, []);

	const totalPaid = list
		.filter((p) => p.status === "paid")
		.reduce((sum, p) => sum + p.amount, 0);
	const totalPending = list
		.filter((p) => p.status !== "paid")
		.reduce((sum, p) => sum + p.amount, 0);

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
										</div>
									</div>
									<div className="flex items-center gap-3">
										<span className="font-medium">¥{p.amount}</span>
										<Badge variant={STATUS_VARIANT[p.status]}>
											{STATUS_LABEL[p.status]}
										</Badge>
									</div>
								</li>
							))}
						</ul>
					)}
				</CardContent>
			</Card>
		</PageContainer>
	);
}
