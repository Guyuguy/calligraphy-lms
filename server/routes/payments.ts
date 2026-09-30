import { Hono } from "hono";
import {
	courses,
	orders,
	parentProfiles,
	payments,
	studentProfiles,
	uid,
} from "../db";
import {
	createAlipayPrecreateOrder,
	verifyAlipayNotify,
} from "../payment/alipay";
import { PAYMENT_CONFIG } from "../payment/config";
import { mockAlipayQr, mockTransactionId, mockWechatQr } from "../payment/mock";
import {
	createWechatNativeOrder,
	decryptWechatResource,
	verifyWechatNotifySignature,
} from "../payment/wechat";
import type { Order, Payment } from "../types";
import { createNotification } from "./notifications";
import { requireAuth } from "./users";

export const paymentsRouter = new Hono();

// ============================================================
// 工具: 生成业务订单号(给支付平台)
// ============================================================

function genOrderNo(): string {
	const now = new Date();
	const ymd = `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, "0")}${String(now.getDate()).padStart(2, "0")}`;
	const rand = Math.random().toString(36).slice(2, 10).toUpperCase();
	return `CL${ymd}${rand}`;
}

// ============================================================
// 工具: 校验下单人对学生的权限
// ============================================================

function assertCanPayForStudent(
	parsed: { userId: string; role: string },
	studentId: string,
	// biome-ignore lint/suspicious/noExplicitAny: Hono Context
	c: any,
) {
	if (parsed.role === "student") {
		if (parsed.userId !== studentId)
			return c.json({ error: "forbidden", message: "只能为自己下单" }, 403);
		return null;
	}
	if (parsed.role === "parent") {
		const sp = studentProfiles.get(studentId);
		if (!sp?.parentIds.includes(parsed.userId))
			return c.json({ error: "forbidden", message: "无权为该学生下单" }, 403);
		return null;
	}
	// teacher / academic_head / admin / ta 放行
	return null;
}

// ============================================================
// 工具: 生成二维码内容(mock 或真实)
// ============================================================

async function generateCodeUrl(
	channel: "wechat" | "alipay",
	orderNo: string,
	amountInYuan: number,
	title: string,
): Promise<string> {
	if (PAYMENT_CONFIG.mock) {
		return channel === "wechat"
			? mockWechatQr(orderNo, amountInYuan)
			: mockAlipayQr(orderNo, amountInYuan);
	}
	if (channel === "wechat") {
		const amountInCents = Math.round(amountInYuan * 100);
		const result = await createWechatNativeOrder(orderNo, amountInCents, title);
		return result.code_url;
	}
	const result = await createAlipayPrecreateOrder(orderNo, amountInYuan, title);
	return result.qr_code;
}

// ============================================================
// 核心: 订单履约(支付成功后调用)
// ============================================================

function fulfillOrder(order: Order): void {
	const now = new Date().toISOString();
	order.status = "paid";
	order.paidAt = now;
	order.transactionId = order.transactionId ?? mockTransactionId(order.channel);
	orders.set(order.id, order);

	if (order.payableType === "course" && order.payableRef.courseId) {
		// 课程购买: 增加 enrolledCount,创建已支付的 Payment 记录
		const course = courses.get(order.payableRef.courseId);
		if (course) {
			course.enrolledCount += 1;
			courses.set(course.id, course);
		}
		const payment: Payment = {
			id: uid("pay"),
			studentId: order.studentId,
			parentId:
				order.role === "parent" ? order.userId : getParentId(order.studentId),
			title: `课程购买: ${order.payableRef.courseTitle ?? course?.title ?? ""}`,
			amount: order.amount,
			dueAt: now,
			status: "paid",
			createdAt: now,
			paidAt: now,
			payableType: "course",
			payableRef: {
				courseId: order.payableRef.courseId,
				courseTitle: order.payableRef.courseTitle,
			},
			method: order.channel,
			transactionId: order.transactionId,
		};
		payments.set(payment.id, payment);
	} else if (
		order.payableType === "manual_bill" &&
		order.payableRef.paymentId
	) {
		// 账单支付: 更新原 Payment 状态
		const p = payments.get(order.payableRef.paymentId);
		if (p) {
			p.status = "paid";
			p.paidAt = now;
			p.method = order.channel;
			p.transactionId = order.transactionId;
			payments.set(p.id, p);
		}
	}

	// 发通知
	createNotification(
		order.userId,
		"payment_due",
		"支付成功",
		`订单 ${order.orderNo} 已支付 ¥${order.amount}(${order.channel === "wechat" ? "微信支付" : "支付宝"})`,
		{ orderId: order.id, orderNo: order.orderNo, amount: order.amount },
	);
	if (order.studentId !== order.userId) {
		const course = order.payableRef.courseId
			? courses.get(order.payableRef.courseId)
			: null;
		createNotification(
			order.studentId,
			"payment_due",
			course ? `已报名课程: ${course.title}` : "报名成功",
			`您已成功报名 ${course?.title ?? "课程"},请按时上课`,
			{ courseId: order.payableRef.courseId },
		);
	}
}

function getParentId(studentId: string): string {
	const sp = studentProfiles.get(studentId);
	if (sp?.parentIds.length) return sp.parentIds[0];
	// 学生没有家长档案时,用占位 ID(Payment.parentId 必填)
	return `parent_of_${studentId}`;
}

// ============================================================
// 1. POST /api/payments/orders — 创建订单(统一下单)
// ============================================================

paymentsRouter.post("/orders", async (c) => {
	const parsed = requireAuth(c);
	if (!parsed) return c.json({ error: "unauthorized", message: "未登录" }, 401);

	let body: {
		payableType?: "course" | "manual_bill";
		payableRef?: { courseId?: string; paymentId?: string };
		channel?: "wechat" | "alipay";
		studentId?: string;
	};
	try {
		body = await c.req.json();
	} catch {
		body = {};
	}

	if (body.payableType !== "course" && body.payableType !== "manual_bill") {
		return c.json(
			{
				error: "invalid_params",
				message: "payableType 必须为 course/manual_bill",
			},
			400,
		);
	}
	if (body.channel !== "wechat" && body.channel !== "alipay") {
		return c.json(
			{ error: "invalid_params", message: "channel 必须为 wechat/alipay" },
			400,
		);
	}

	// 确定 studentId
	let studentId = body.studentId ?? "";
	if (parsed.role === "student") {
		studentId = parsed.userId;
	} else if (parsed.role === "parent") {
		if (!studentId) {
			const pp = parentProfiles.get(parsed.userId);
			studentId = pp?.childIds[0] ?? "";
		}
	}
	if (!studentId) {
		return c.json({ error: "invalid_params", message: "缺少 studentId" }, 400);
	}

	const forbidden = assertCanPayForStudent(parsed, studentId, c);
	if (forbidden) return forbidden;

	// 计算 amount + title + payableRef
	let amount = 0;
	let title = "";
	const payableRef: Order["payableRef"] = {};

	if (body.payableType === "course") {
		const courseId = body.payableRef?.courseId ?? "";
		const course = courses.get(courseId);
		if (!course)
			return c.json({ error: "not_found", message: "课程不存在" }, 404);
		amount = course.price;
		title = `课程购买: ${course.title}`;
		payableRef.courseId = course.id;
		payableRef.courseTitle = course.title;
	} else {
		const paymentId = body.payableRef?.paymentId ?? "";
		const p = payments.get(paymentId);
		if (!p) return c.json({ error: "not_found", message: "账单不存在" }, 404);
		if (p.status === "paid")
			return c.json({ error: "already_paid", message: "账单已支付" }, 400);
		// 校验家长对该账单的所有权
		if (parsed.role === "parent" && p.parentId !== parsed.userId) {
			return c.json({ error: "forbidden", message: "无权支付该账单" }, 403);
		}
		amount = p.amount;
		title = p.title;
		payableRef.paymentId = p.id;
	}

	// 重复支付防护: 检查是否已有 pending 订单
	const existing = Array.from(orders.values()).find(
		(o) =>
			o.userId === parsed.userId &&
			o.payableType === body.payableType &&
			JSON.stringify(o.payableRef) === JSON.stringify(payableRef) &&
			o.status === "pending",
	);
	if (existing) {
		return c.json({ order: existing, codeUrl: existing.codeUrl ?? "" });
	}

	// 创建订单
	const now = new Date();
	const expireAt = new Date(now.getTime() + 2 * 60 * 60 * 1000); // 2 小时
	const orderNo = genOrderNo();
	const order: Order = {
		id: uid("order"),
		orderNo,
		userId: parsed.userId,
		studentId,
		role: parsed.role,
		payableType: body.payableType,
		payableRef,
		amount,
		title,
		channel: body.channel,
		status: "pending",
		createdAt: now.toISOString(),
		expireAt: expireAt.toISOString(),
	};

	try {
		const codeUrl = await generateCodeUrl(body.channel, orderNo, amount, title);
		order.codeUrl = codeUrl;
	} catch (err) {
		console.error("[payments] 生成二维码失败:", err);
		return c.json(
			{ error: "payment_error", message: "生成支付二维码失败" },
			500,
		);
	}

	orders.set(order.id, order);
	return c.json({ order, codeUrl: order.codeUrl ?? "" }, 201);
});

// ============================================================
// 2. GET /api/payments/orders/:orderNo — 查询订单状态
// ============================================================

paymentsRouter.get("/orders/:orderNo", (c) => {
	const parsed = requireAuth(c);
	if (!parsed) return c.json({ error: "unauthorized", message: "未登录" }, 401);

	const orderNo = c.req.param("orderNo");
	const order = Array.from(orders.values()).find((o) => o.orderNo === orderNo);
	if (!order) return c.json({ error: "not_found", message: "订单不存在" }, 404);
	if (order.userId !== parsed.userId && parsed.role !== "admin") {
		return c.json({ error: "forbidden", message: "无权查看" }, 403);
	}
	return c.json({ order });
});

// ============================================================
// 3. POST /api/payments/orders/:orderNo/mock-pay — Mock 支付(仅 MOCK 模式)
// ============================================================

paymentsRouter.post("/orders/:orderNo/mock-pay", (c) => {
	const parsed = requireAuth(c);
	if (!parsed) return c.json({ error: "unauthorized", message: "未登录" }, 401);

	if (!PAYMENT_CONFIG.mock) {
		return c.json({ error: "forbidden", message: "Mock 模式未启用" }, 403);
	}

	const orderNo = c.req.param("orderNo");
	const order = Array.from(orders.values()).find((o) => o.orderNo === orderNo);
	if (!order) return c.json({ error: "not_found", message: "订单不存在" }, 404);
	if (order.userId !== parsed.userId && parsed.role !== "admin") {
		return c.json({ error: "forbidden", message: "无权操作" }, 403);
	}
	if (order.status !== "pending") {
		return c.json(
			{ error: "invalid_status", message: "订单状态不允许支付" },
			400,
		);
	}

	fulfillOrder(order);
	return c.json({ ok: true, order });
});

// ============================================================
// 4. POST /api/payments/wechat/notify — 微信支付回调
// ============================================================

paymentsRouter.post("/wechat/notify", async (c) => {
	if (PAYMENT_CONFIG.mock) {
		return c.json({ code: "FAIL", message: "Mock 模式不接受真实回调" }, 400);
	}

	const timestamp = c.req.header("Wechatpay-Timestamp") ?? "";
	const nonce = c.req.header("Wechatpay-Nonce") ?? "";
	const signature = c.req.header("Wechatpay-Signature") ?? "";
	const wechatpaySerial = c.req.header("Wechatpay-Serial") ?? "";
	const body = await c.req.text();

	// 验签(简化: 生产环境需用微信平台证书验签)
	const verified = verifyWechatNotifySignature(
		timestamp,
		nonce,
		body,
		signature,
		wechatpaySerial,
	);
	if (!verified) {
		return c.json({ code: "FAIL", message: "验签失败" }, 400);
	}

	try {
		const payload = JSON.parse(body) as {
			resource: { ciphertext: string; associated_data: string; nonce: string };
		};
		const result = decryptWechatResource(
			payload.resource.ciphertext,
			payload.resource.associated_data,
			payload.resource.nonce,
		);
		const order = Array.from(orders.values()).find(
			(o) => o.orderNo === result.out_trade_no,
		);
		if (!order) {
			return c.json({ code: "FAIL", message: "订单不存在" }, 404);
		}
		if (order.status === "pending") {
			order.transactionId = result.transaction_id;
			fulfillOrder(order);
		}
		return c.json({ code: "SUCCESS" });
	} catch (err) {
		console.error("[wechat-notify] 处理失败:", err);
		return c.json({ code: "FAIL", message: "处理失败" }, 500);
	}
});

// ============================================================
// 5. POST /api/payments/alipay/notify — 支付宝回调
// ============================================================

paymentsRouter.post("/alipay/notify", async (c) => {
	if (PAYMENT_CONFIG.mock) {
		return c.json({ code: "FAIL", message: "Mock 模式不接受真实回调" }, 400);
	}

	const formData = await c.req.formData();
	const params: Record<string, unknown> = {};
	for (const [k, v] of formData.entries()) {
		params[k] = v;
	}

	const verified = verifyAlipayNotify(params);
	if (!verified) {
		return c.json({ code: "FAIL", message: "验签失败" }, 400);
	}

	const orderNo = (params.out_trade_no as string) ?? "";
	const tradeStatus = (params.trade_status as string) ?? "";
	const tradeNo = (params.trade_no as string) ?? "";

	const order = Array.from(orders.values()).find((o) => o.orderNo === orderNo);
	if (!order) {
		return c.json({ code: "FAIL", message: "订单不存在" }, 404);
	}
	if (order.status === "pending" && tradeStatus === "TRADE_SUCCESS") {
		order.transactionId = tradeNo;
		fulfillOrder(order);
	}
	return c.json({ code: "SUCCESS" });
});

// ============================================================
// 6. GET /api/payments/methods — 查询可用支付方式
// ============================================================

paymentsRouter.get("/methods", (c) => {
	const parsed = requireAuth(c);
	if (!parsed) return c.json({ error: "unauthorized", message: "未登录" }, 401);

	const cfg = PAYMENT_CONFIG;
	return c.json({
		mock: cfg.mock,
		wechat: !cfg.mock && !!cfg.wechat.appId,
		alipay: !cfg.mock && !!cfg.alipay.appId,
	});
});
