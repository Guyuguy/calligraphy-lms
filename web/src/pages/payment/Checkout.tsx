import { useEffect, useState } from "react";
import {
	api,
	type Order,
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
import { PaymentDialog } from "./PaymentDialog";

interface CheckoutProps {
	user: User;
	courseId: string;
	navigate: (p: string) => void;
}

export function Checkout({ user, courseId, navigate }: CheckoutProps) {
	const [methods, setMethods] = useState<PaymentMethodsResponse | null>(null);
	const [channel, setChannel] = useState<"wechat" | "alipay">("wechat");
	const [creating, setCreating] = useState(false);
	const [activeOrder, setActiveOrder] = useState<{
		orderNo: string;
		codeUrl: string;
		amount: number;
		title: string;
	} | null>(null);

	useEffect(() => {
		api
			.get<PaymentMethodsResponse>("/payments/methods")
			.then(setMethods)
			.catch(() => setMethods({ mock: true, wechat: false, alipay: false }));
	}, []);

	async function handleCreateOrder() {
		setCreating(true);
		try {
			const studentId = user.role === "student" ? user.id : "";
			const res = await api.post<{ order: Order; codeUrl: string }>(
				"/payments/orders",
				{
					payableType: "course",
					payableRef: { courseId },
					channel,
					studentId,
				},
			);
			setActiveOrder({
				orderNo: res.order.orderNo,
				codeUrl: res.codeUrl,
				amount: res.order.amount,
				title: res.order.title,
			});
		} catch (err) {
			console.error("[checkout] 创建订单失败:", err);
			alert("创建订单失败,请稍后重试");
		} finally {
			setCreating(false);
		}
	}

	function handleSuccess(_order: Order) {
		// 支付成功后跳转回课程详情
		setTimeout(() => {
			navigate(`/courses/${courseId}`);
		}, 1500);
	}

	return (
		<PageContainer title="课程结算" description="选择支付方式完成报名">
			<div className="mx-auto max-w-2xl space-y-6">
				<Card>
					<CardHeader>
						<CardTitle>订单摘要</CardTitle>
						<CardDescription>请确认订单信息后选择支付方式</CardDescription>
					</CardHeader>
					<CardContent className="space-y-3">
						<div className="flex items-center justify-between">
							<span className="text-sm text-text-muted">课程 ID</span>
							<span className="font-mono text-sm">{courseId}</span>
						</div>
						<div className="flex items-center justify-between">
							<span className="text-sm text-text-muted">下单人</span>
							<span className="text-sm">
								{user.name}({user.role})
							</span>
						</div>
						<div className="flex items-center justify-between">
							<span className="text-sm text-text-muted">支付方式</span>
							<div className="flex gap-2">
								<Button
									size="sm"
									variant={channel === "wechat" ? "default" : "outline"}
									onClick={() => setChannel("wechat")}
								>
									微信支付
								</Button>
								<Button
									size="sm"
									variant={channel === "alipay" ? "default" : "outline"}
									onClick={() => setChannel("alipay")}
								>
									支付宝
								</Button>
							</div>
						</div>
						{methods?.mock && (
							<Badge variant="warning" className="block w-fit">
								开发模式(Mock 支付)
							</Badge>
						)}
					</CardContent>
				</Card>

				<Button
					className="w-full"
					size="lg"
					disabled={creating}
					onClick={handleCreateOrder}
				>
					{creating
						? "生成二维码中..."
						: `立即支付(¥${channel === "wechat" ? "微信支付" : "支付宝"})`}
				</Button>

				<Button
					variant="ghost"
					className="w-full"
					onClick={() => navigate(`/courses/${courseId}`)}
				>
					返回课程详情
				</Button>
			</div>

			{activeOrder && (
				<PaymentDialog
					open={true}
					orderNo={activeOrder.orderNo}
					codeUrl={activeOrder.codeUrl}
					channel={channel}
					amount={activeOrder.amount}
					title={activeOrder.title}
					mock={methods?.mock ?? true}
					onClose={() => setActiveOrder(null)}
					onSuccess={handleSuccess}
				/>
			)}
		</PageContainer>
	);
}
