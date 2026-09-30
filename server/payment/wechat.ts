// 微信支付 v3 封装
// 文档: https://pay.weixin.qq.com/wiki/doc/apiv3/wechatpay/wechatpay4_0.shtml
// 由于无成熟 TS SDK,直接用 node:crypto + fetch 实现

import crypto from "node:crypto";
import { PAYMENT_CONFIG } from "./config";

const BASE_URL = "https://api.mch.weixin.qq.com";

// ============================================================
// 工具: 生成随机串
// ============================================================

function randomNonce(length = 32): string {
	return crypto.randomBytes(length).toString("hex").slice(0, length);
}

// ============================================================
// 工具: RSA-SHA256 签名
// ============================================================

function signWithPrivateKey(privateKeyPem: string, message: string): string {
	const signer = crypto.createSign("RSA-SHA256");
	signer.update(message, "utf8");
	const sign = signer.sign(privateKeyPem, "base64");
	return sign;
}

// ============================================================
// 构造 Authorization 头
// ============================================================

function buildAuthHeader(
	method: string,
	url: string,
	timestamp: string,
	nonce: string,
	body: string,
): string {
	const cfg = PAYMENT_CONFIG.wechat;
	const message = `${method}\n${url}\n${timestamp}\n${nonce}\n${body}\n`;
	const signature = signWithPrivateKey(cfg.privateKeyPem, message);
	return `WECHATPAY2-SHA256-RSA2048 mchid="${cfg.mchId}",nonce_str="${nonce}",timestamp="${timestamp}",serial_no="${cfg.serialNo}",signature="${signature}"`;
}

// ============================================================
// Native 下单(扫码支付)
// ============================================================

export interface WechatNativeOrderResult {
	code_url: string; // 用于生成二维码
}

export async function createWechatNativeOrder(
	orderNo: string,
	amountInCents: number,
	description: string,
): Promise<WechatNativeOrderResult> {
	const cfg = PAYMENT_CONFIG.wechat;
	const url = "/v3/pay/transactions/native";
	const body = JSON.stringify({
		appid: cfg.appId,
		mchid: cfg.mchId,
		description,
		out_trade_no: orderNo,
		notify_url: cfg.notifyUrl,
		amount: { total: amountInCents, currency: "CNY" },
	});

	const timestamp = Math.floor(Date.now() / 1000).toString();
	const nonce = randomNonce();

	const authHeader = buildAuthHeader("POST", url, timestamp, nonce, body);

	const res = await fetch(`${BASE_URL}${url}`, {
		method: "POST",
		headers: {
			"Content-Type": "application/json",
			Accept: "application/json",
			Authorization: authHeader,
			"User-Agent": "calligraphy-lms/1.0",
		},
		body,
	});

	if (!res.ok) {
		const errText = await res.text();
		throw new Error(`微信下单失败: ${res.status} ${errText}`);
	}

	const data = (await res.json()) as WechatNativeOrderResult;
	return data;
}

// ============================================================
// 回调验签 + 解密
// ============================================================

export interface WechatNotifyPayload {
	id: string;
	create_time: string;
	event_type: string;
	resource_type: string;
	resource: {
		algorithm: string;
		ciphertext: string;
		associated_data: string;
		nonce: string;
	};
}

export interface WechatPayResult {
	out_trade_no: string;
	transaction_id: string;
	trade_state: string;
	amount?: { total: number };
}

// 验证回调签名(用微信平台证书)
// 注意: 完整实现需要拉取微信平台证书并验签,这里简化处理
// 生产环境务必实现完整验签流程
export function verifyWechatNotifySignature(
	_timestamp: string,
	_nonce: string,
	_body: string,
	_signature: string,
	_wechatpaySerial: string,
): boolean {
	// TODO: 生产环境用微信平台证书公钥验签
	// const message = `${timestamp}\n${nonce}\n${body}\n`;
	// const verifier = crypto.createVerify("RSA-SHA256");
	// verifier.update(message, "utf8");
	// return verifier.verify(platformCertPem, signature, "base64");
	// 开发期: 跳过验签,直接通过; 生产环境未实现完整验签,返回 false 阻止处理
	return PAYMENT_CONFIG.mock;
}

// AES-256-GCM 解密回调 resource
export function decryptWechatResource(
	ciphertext: string,
	associatedData: string,
	nonce: string,
): WechatPayResult {
	const cfg = PAYMENT_CONFIG.wechat;
	const key = Buffer.from(cfg.apiV3Key, "utf8");
	const cipherBuf = Buffer.from(ciphertext, "base64");
	const authTag = cipherBuf.slice(-16);
	const encryptedData = cipherBuf.slice(0, -16);

	const decipher = crypto.createDecipheriv(
		"aes-256-gcm",
		key,
		Buffer.from(nonce, "utf8"),
	);
	decipher.setAuthTag(authTag);
	if (associatedData) {
		decipher.setAAD(Buffer.from(associatedData, "utf8"));
	}

	const decrypted = Buffer.concat([
		decipher.update(encryptedData),
		decipher.final(),
	]).toString("utf8");

	return JSON.parse(decrypted) as WechatPayResult;
}
