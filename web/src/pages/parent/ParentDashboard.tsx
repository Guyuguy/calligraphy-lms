import { Award, HeartHandshake, TrendingUp, Wallet } from "lucide-react";
import { useEffect, useState } from "react";
import { api, type ParentChild, type Payment, type User } from "@/api/client";
import { PageContainer } from "@/components/layout/PageContainer";
import { Badge } from "@/components/ui/badge";
import {
	Card,
	CardContent,
	CardDescription,
	CardHeader,
	CardTitle,
} from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";

interface ParentDashboardProps {
	user: User;
	navigate: (path: string) => void;
}

export function ParentDashboard({ user, navigate }: ParentDashboardProps) {
	const [children, setChildren] = useState<ParentChild[]>([]);
	const [payments, setPayments] = useState<Payment[]>([]);
	const [loading, setLoading] = useState(true);

	useEffect(() => {
		Promise.all([
			api.get<{ children: ParentChild[] }>("/parent/children"),
			api.get<{ payments: Payment[] }>("/parent/payments"),
		])
			.then(([c, p]) => {
				setChildren(c.children);
				setPayments(p.payments);
			})
			.catch(() => {})
			.finally(() => setLoading(false));
	}, []);

	const pendingPayments = payments.filter((p) => p.status !== "paid");

	return (
		<PageContainer
			title="家长中心"
			description="关注孩子的学习进展与缴费情况"
			actions={
				<Badge variant="info" className="gap-1">
					<HeartHandshake className="size-3" />
					{user.name}
				</Badge>
			}
		>
			<div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
				<div className="space-y-6 lg:col-span-2">
					<Card>
						<CardHeader>
							<CardTitle className="flex items-center gap-2">
								<HeartHandshake className="size-4 text-brand" />
								我的孩子
							</CardTitle>
							<CardDescription>点击查看详细学习进度</CardDescription>
						</CardHeader>
						<CardContent className="space-y-3">
							{loading ? (
								<div className="py-6 text-center text-sm text-text-muted">
									加载中...
								</div>
							) : children.length === 0 ? (
								<div className="py-6 text-center text-sm text-text-muted">
									尚未关联任何孩子
								</div>
							) : (
								children.map((child) => {
									const summary = child.summary;
									return (
										<button
											key={child.user?.id ?? child.profile?.userId}
											type="button"
											onClick={() =>
												navigate(`/parent/child/${child.user?.id ?? ""}`)
											}
											className="w-full space-y-2 rounded-md border border-border p-4 text-left transition-colors hover:border-brand/40 hover:bg-surface-1"
										>
											<div className="flex items-center justify-between">
												<div className="flex items-center gap-3">
													<div className="flex size-10 items-center justify-center rounded-full bg-brand/10 text-brand font-medium">
														{(child.user?.name ?? "?").slice(0, 1)}
													</div>
													<div>
														<div className="font-medium">
															{child.user?.name ?? "未知"}
														</div>
														<div className="text-xs text-text-muted">
															{child.profile?.grade ?? "—"} ·{" "}
															{child.profile?.school ?? "—"}
														</div>
													</div>
												</div>
												<Badge variant="outline">
													{summary?.totalCourses ?? 0} 门课程
												</Badge>
											</div>
											{summary && (
												<>
													<Progress value={summary.overallPercent} />
													<div className="flex items-center justify-between text-xs text-text-muted">
														<span>
															{summary.totalCompleted}/{summary.totalUnits} 单元
														</span>
														<span>总体 {summary.overallPercent}%</span>
													</div>
												</>
											)}
										</button>
									);
								})
							)}
						</CardContent>
					</Card>
				</div>

				<div className="space-y-6">
					<Card>
						<CardHeader>
							<CardTitle className="flex items-center gap-2">
								<Wallet className="size-4 text-brand" />
								近期缴费
							</CardTitle>
							<CardDescription>
								{pendingPayments.length > 0
									? `${pendingPayments.length} 笔待缴`
									: "暂无待缴费用"}
							</CardDescription>
						</CardHeader>
						<CardContent className="space-y-2">
							{payments.slice(0, 3).map((p) => (
								<div
									key={p.id}
									className="flex items-center justify-between rounded-md border border-border bg-surface-1 px-3 py-2"
								>
									<div>
										<div className="text-sm font-medium">{p.title}</div>
										<div className="text-xs text-text-muted">
											截止 {p.dueAt.slice(0, 10)}
										</div>
									</div>
									<div className="flex items-center gap-2">
										<span className="text-sm font-medium">¥{p.amount}</span>
										<Badge
											variant={
												p.status === "paid"
													? "success"
													: p.status === "overdue"
														? "danger"
														: "warning"
											}
										>
											{p.status === "paid"
												? "已支付"
												: p.status === "overdue"
													? "已逾期"
													: "待支付"}
										</Badge>
									</div>
								</div>
							))}
							<button
								type="button"
								onClick={() => navigate("/parent/payments")}
								className="w-full rounded-md border border-border py-2 text-sm text-brand hover:bg-surface-2"
							>
								查看全部
							</button>
						</CardContent>
					</Card>

					<Card>
						<CardHeader>
							<CardTitle className="flex items-center gap-2">
								<Award className="size-4 text-brand" />
								评价入口
							</CardTitle>
							<CardDescription>对教师或课程进行评价</CardDescription>
						</CardHeader>
						<CardContent>
							<button
								type="button"
								onClick={() => navigate("/parent/evaluations")}
								className="w-full rounded-md bg-brand py-2 text-sm text-white hover:bg-brand/90"
							>
								前往评价
							</button>
						</CardContent>
					</Card>

					<Card>
						<CardHeader>
							<CardTitle className="flex items-center gap-2">
								<TrendingUp className="size-4 text-brand" />
								学习提示
							</CardTitle>
						</CardHeader>
						<CardContent className="text-sm text-text-muted">
							定期与孩子沟通学习进展，关注连续打卡与作业完成情况。如有疑问可联系教务老师。
						</CardContent>
					</Card>
				</div>
			</div>
		</PageContainer>
	);
}
