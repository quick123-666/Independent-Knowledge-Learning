/**
 * 支付宝支付服务
 * 封装支付宝沙箱支付的核心业务逻辑
 */

import { getAlipaySdk, isAlipayConfigured } from '../config/alipay';
import { prisma } from '../config/prisma';

/** 订单状态常量 */
const ORDER_STATUS = { PENDING: 'PENDING', PAID: 'PAID', CANCELLED: 'CANCELLED', REFUNDED: 'REFUNDED' } as const;

/** 服务返回结构 */
interface ServiceResult<T = unknown> {
  success: boolean;
  data?: T;
  message?: string;
}

function fail(message: string): ServiceResult {
  return { success: false, message };
}

function ok<T>(data: T, message?: string): ServiceResult<T> {
  return { success: true, data, message };
}

/**
 * 创建支付宝电脑网站支付订单
 * 返回支付宝支付页面 URL
 */
export async function createAlipayPagePay(
  orderId: string,
  amount: number,
  subject: string,
  body?: string,
  returnUrl?: string
): Promise<ServiceResult<{ payUrl: string }>> {
  if (!isAlipayConfigured) {
    return fail('支付宝支付未配置，请检查环境变量 ALIPAY_APP_ID、ALIPAY_PRIVATE_KEY、ALIPAY_PUBLIC_KEY');
  }

  try {
    const sdk = getAlipaySdk();
    const result = await sdk.exec('alipay.trade.page.pay', {
      notifyUrl: `${process.env.API_BASE_URL || 'http://localhost:3001'}/api/pay/alipay/notify`,
      returnUrl: returnUrl || `${process.env.WEB_URL || 'http://localhost:5173'}/student/my-orders`,
      bizContent: {
        outTradeNo: orderId,
        totalAmount: amount.toFixed(2),
        subject: subject.slice(0, 256),
        body: body?.slice(0, 128),
        productCode: 'FAST_INSTANT_TRADE_PAY',
      },
    });

    // alipay.trade.page.pay 返回的是支付页面 URL
    if (typeof result === 'string') {
      return ok({ payUrl: result }, '支付宝支付链接创建成功');
    }

    // 某些版本返回对象
    const payUrl = (result as any)?.body || (result as any);
    if (typeof payUrl === 'string' && payUrl.startsWith('http')) {
      return ok({ payUrl }, '支付宝支付链接创建成功');
    }

    return fail('创建支付宝支付链接失败');
  } catch (error: any) {
    console.error('创建支付宝支付订单失败:', error);
    return fail(error.message || '创建支付宝支付订单失败');
  }
}

/**
 * 查询支付宝订单支付状态
 */
export async function queryAlipayOrder(orderId: string): Promise<ServiceResult<any>> {
  if (!isAlipayConfigured) {
    return fail('支付宝支付未配置');
  }

  try {
    const sdk = getAlipaySdk();
    const result = await sdk.exec('alipay.trade.query', {
      bizContent: {
        outTradeNo: orderId,
      },
    });

    return ok(result, '查询成功');
  } catch (error: any) {
    console.error('查询支付宝订单失败:', error);
    return fail(error.message || '查询失败');
  }
}

/**
 * 处理支付宝异步通知
 * 验证签名并更新订单状态
 */
export async function handleAlipayNotify(notifyData: Record<string, any>): Promise<ServiceResult> {
  if (!isAlipayConfigured) {
    return fail('支付宝支付未配置');
  }

  try {
    const sdk = getAlipaySdk();
    // 验证签名
    const signVerified = sdk.checkNotifySign(notifyData);
    if (!signVerified) {
      console.error('支付宝通知签名验证失败');
      return fail('签名验证失败');
    }

    const { outTradeNo, tradeStatus, tradeNo } = notifyData;

    if (!outTradeNo) {
      return fail('缺少订单号');
    }

    // 查询订单
    const order = await prisma.order.findUnique({
      where: { id: outTradeNo },
    });

    if (!order) {
      return fail('订单不存在');
    }

    if (order.status === ORDER_STATUS.PAID) {
      return ok(null, '订单已支付');
    }

    // 支付成功状态：TRADE_SUCCESS 或 TRADE_FINISHED
    if (tradeStatus === 'TRADE_SUCCESS' || tradeStatus === 'TRADE_FINISHED') {
      // 更新订单状态
      await prisma.order.update({
        where: { id: outTradeNo },
        data: {
          status: ORDER_STATUS.PAID,
          paidAt: new Date(),
          paymentMethod: 'ALIPAY',
        },
      });

      // 创建学习记录
      try {
        await prisma.enrollment.create({
          data: {
            userId: order.userId,
            courseId: order.courseId,
          },
        });
      } catch {
        // 已存在则忽略
      }

      console.log(`支付宝支付成功: 订单 ${outTradeNo}, 支付宝交易号 ${tradeNo}`);
      return ok(null, '支付成功');
    }

    return ok(null, `交易状态: ${tradeStatus}`);
  } catch (error: any) {
    console.error('处理支付宝通知失败:', error);
    return fail(error.message || '处理通知失败');
  }
}

/**
 * 支付宝退款
 */
export async function alipayRefund(
  orderId: string,
  refundAmount: number,
  refundReason: string,
  outRequestNo: string
): Promise<ServiceResult<any>> {
  if (!isAlipayConfigured) {
    return fail('支付宝支付未配置');
  }

  try {
    const sdk = getAlipaySdk();
    const result = await sdk.exec('alipay.trade.refund', {
      bizContent: {
        outTradeNo: orderId,
        refundAmount: refundAmount.toFixed(2),
        refundReason: refundReason.slice(0, 256),
        outRequestNo,
      },
    });

    return ok(result, '退款申请已提交');
  } catch (error: any) {
    console.error('支付宝退款失败:', error);
    return fail(error.message || '退款失败');
  }
}
