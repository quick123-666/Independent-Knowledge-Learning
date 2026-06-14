/**
 * 支付宝沙箱配置
 * 使用支付宝开放平台沙箱环境进行测试
 *
 * 沙箱环境地址：https://open.alipay.com/develop/sandbox
 *
 * 配置说明：
 * 1. 登录支付宝开放平台，进入沙箱应用获取 APPID
 * 2. 使用支付宝密钥工具生成 RSA2 密钥对
 * 3. 将应用公钥上传到沙箱应用，获取支付宝公钥
 * 4. 将应用私钥保存到环境变量或配置文件中
 */

import { AlipaySdk } from 'alipay-sdk';

/** 支付宝沙箱网关地址 */
const ALIPAY_GATEWAY = 'https://openapi-sandbox.dl.alipaydev.com/gateway.do';

/** 应用ID - 从支付宝开放平台沙箱应用获取 */
const APP_ID = process.env.ALIPAY_APP_ID || '';

/** 应用私钥 - 从密钥工具生成 */
const PRIVATE_KEY = process.env.ALIPAY_PRIVATE_KEY || '';

/** 支付宝公钥 - 从开放平台获取 */
const ALIPAY_PUBLIC_KEY = process.env.ALIPAY_PUBLIC_KEY || '';

/** 是否已配置 */
export const isAlipayConfigured = !!(APP_ID && PRIVATE_KEY && ALIPAY_PUBLIC_KEY);

/** 支付宝 SDK 实例（延迟初始化） */
let _alipaySdk: AlipaySdk | null = null;

export function getAlipaySdk(): AlipaySdk {
  if (!isAlipayConfigured) {
    throw new Error('支付宝支付未配置，请设置环境变量 ALIPAY_APP_ID、ALIPAY_PRIVATE_KEY、ALIPAY_PUBLIC_KEY');
  }
  if (!_alipaySdk) {
    _alipaySdk = new AlipaySdk({
      appId: APP_ID,
      signType: 'RSA2',
      gateway: ALIPAY_GATEWAY,
      privateKey: PRIVATE_KEY,
      alipayPublicKey: ALIPAY_PUBLIC_KEY,
      timeout: 15000,
      camelcase: true,
    });
  }
  return _alipaySdk;
}

/** 获取支付宝配置状态 */
export function getAlipayConfigStatus() {
  return {
    configured: isAlipayConfigured,
    appId: APP_ID ? `${APP_ID.slice(0, 6)}...` : '未配置',
    hasPrivateKey: !!PRIVATE_KEY,
    hasPublicKey: !!ALIPAY_PUBLIC_KEY,
  };
}
