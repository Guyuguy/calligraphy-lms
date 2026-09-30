// 支付配置加载
// 开发期(MOCK_PAYMENT=1)走 Mock 流程,无需真实密钥
// 生产期填 .env 真实密钥后自动切换

export interface PaymentConfig {
	mock: boolean;
	wechat: {
		appId: string;
		mchId: string;
		apiV3Key: string;
		serialNo: string;
		privateKeyPem: string;
		certSerialNo: string;
		notifyUrl: string;
	};
	alipay: {
		appId: string;
		privateKeyPem: string;
		alipayPublicKeyPem: string;
		notifyUrl: string;
	};
}

function truthy(v: string | undefined): boolean {
	return v === "1" || v === "true" || v === "yes";
}

export function loadPaymentConfig(): PaymentConfig {
	const mock = truthy(process.env.MOCK_PAYMENT) || !process.env.WECHAT_APPID;
	return {
		mock,
		wechat: {
			appId: process.env.WECHAT_APPID ?? "",
			mchId: process.env.WECHAT_MCH_ID ?? "",
			apiV3Key: process.env.WECHAT_API_V3_KEY ?? "",
			serialNo: process.env.WECHAT_SERIAL_NO ?? "",
			privateKeyPem: process.env.WECHAT_PRIVATE_KEY_PEM ?? "",
			certSerialNo: process.env.WECHAT_CERT_SERIAL_NO ?? "",
			notifyUrl:
				process.env.WECHAT_NOTIFY_URL ??
				"http://localhost:3001/api/payments/wechat/notify",
		},
		alipay: {
			appId: process.env.ALIPAY_APP_ID ?? "",
			privateKeyPem: process.env.ALIPAY_PRIVATE_KEY_PEM ?? "",
			alipayPublicKeyPem: process.env.ALIPAY_PUBLIC_KEY_PEM ?? "",
			notifyUrl:
				process.env.ALIPAY_NOTIFY_URL ??
				"http://localhost:3001/api/payments/alipay/notify",
		},
	};
}

export const PAYMENT_CONFIG = loadPaymentConfig();
