// Mock 支付(开发期)
// 生成假的二维码内容,前端轮询 + 模拟支付成功按钮触发"已支付"

export function mockWechatQr(orderNo: string, amount: number): string {
	// 模拟微信 Native 支付 code_url 格式
	return `weixin://wxpay/bizpayurl?pr=${orderNo}&amount=${amount}&mock=1`;
}

export function mockAlipayQr(orderNo: string, amount: number): string {
	// 模拟支付宝扫码支付链接
	return `https://openapi.alipaydev.com/gateway.do?out_trade_no=${orderNo}&total_amount=${amount}&mock=1`;
}

// 生成假的交易号(模拟支付成功后回填)
export function mockTransactionId(channel: "wechat" | "alipay"): string {
	const prefix = channel === "wechat" ? "wx_mock_" : "ali_mock_";
	return `${prefix}${Date.now()}${Math.floor(Math.random() * 10000)}`;
}
