// 支付宝封装(基于 alipay-sdk NPM 包)
// 文档: https://github.com/alipay/alipay-sdk-nodejs-all

import { AlipaySdk, type AlipaySdkCommonResult } from "alipay-sdk";
import { PAYMENT_CONFIG } from "./config";

let sdkInstance: AlipaySdk | null = null;

function getSdk(): AlipaySdk {
	if (sdkInstance) return sdkInstance;
	const cfg = PAYMENT_CONFIG.alipay;
	sdkInstance = new AlipaySdk({
		appId: cfg.appId,
		privateKey: cfg.privateKeyPem,
		alipayPublicKey: cfg.alipayPublicKeyPem,
		signType: "RSA2",
		gateway: "https://openapi.alipay.com/gateway.do",
		// 沙箱: https://openapi.alipaydev.com/gateway.do
	});
	return sdkInstance;
}

// ============================================================
// 创建当面付(扫码支付)订单
// ============================================================

export interface AlipayPrecreateResult {
	qr_code: string; // 二维码内容
	out_trade_no: string;
}

export async function createAlipayPrecreateOrder(
	orderNo: string,
	amountInYuan: number,
	subject: string,
): Promise<AlipayPrecreateResult> {
	const sdk = getSdk();
	const result = (await sdk.exec("alipay.trade.precreate", {
		bizContent: {
			out_trade_no: orderNo,
			total_amount: amountInYuan.toFixed(2),
			subject,
		},
	})) as AlipaySdkCommonResult & { qr_code: string };

	if (result.code !== "10000") {
		throw new Error(`支付宝下单失败: ${result.msg} ${result.sub_code ?? ""}`);
	}

	return {
		qr_code: result.qr_code,
		out_trade_no: orderNo,
	};
}

// ============================================================
// 回调验签
// ============================================================

export function verifyAlipayNotify(postData: Record<string, unknown>): boolean {
	const sdk = getSdk();
	// alipay-sdk 提供 checkNotifySignV2 验签
	// 注意: postData 应为支付宝回调的原始 POST 表单参数
	return sdk.checkNotifySignV2(postData);
}

// ============================================================
// 查询订单状态(可选,主动查询用)
// ============================================================

export async function queryAlipayOrder(
	orderNo: string,
): Promise<
	AlipaySdkCommonResult & { trade_status?: string; trade_no?: string }
> {
	const sdk = getSdk();
	const result = (await sdk.exec("alipay.trade.query", {
		bizContent: { out_trade_no: orderNo },
	})) as AlipaySdkCommonResult & { trade_status?: string; trade_no?: string };
	return result;
}
