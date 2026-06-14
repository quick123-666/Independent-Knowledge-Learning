/**
 * 支付宝支付路由模块
 * 提供支付宝支付下单、回调通知、订单查询等接口
 */

import { Router, Request, Response } from 'express';
import { prisma } from '../config/prisma';
import { sendSuccess, sendError } from '../utils/response';
import { authenticate } from '../middleware/auth';
import { createAlipayPagePay, handleAlipayNotify, queryAlipayOrder, alipayRefund } from '../services/alipay';
import { isAlipayConfigured } from '../config/alipay';

const router = Router();

// ==========================================
// GET /api/pay/alipay/status — 支付宝配置状态
// ==========================================
router.get('/status', (_req: Request, res: Response) => {
  sendSuccess(res, {
    configured: isAlipayConfigured,
    message: isAlipayConfigured
      ? '支付宝支付已配置'
      : '支付宝支付未配置，请设置环境变量 ALIPAY_APP_ID、ALIPAY_PRIVATE_KEY、ALIPAY_PUBLIC_KEY',
  }, '获取配置状态成功');
});

// ==========================================
// POST /api/pay/alipay/create — 创建支付宝支付订单
// ==========================================
router.post('/create', authenticate, async (req: Request, res: Response) => {
  try {
    if (!req.user) {
      sendError(res, '未登录', 401, 'UNAUTHORIZED');
      return;
    }

    const { orderId } = req.body;

    if (!orderId || typeof orderId !== 'string') {
      sendError(res, '订单ID不能为空', 400, 'VALIDATION_ERROR');
      return;
    }

    // 查询订单
    const order = await prisma.order.findUnique({
      where: { id: orderId },
      include: {
        course: { select: { title: true } },
      },
    });

    if (!order) {
      sendError(res, '订单不存在', 404, 'NOT_FOUND');
      return;
    }

    if (order.userId !== req.user.userId) {
      sendError(res, '无权操作该订单', 403, 'FORBIDDEN');
      return;
    }

    if (order.status !== 'PENDING') {
      sendError(res, '订单状态异常，无法支付', 400, 'INVALID_STATUS');
      return;
    }

    // 创建支付宝支付链接
    const result = await createAlipayPagePay(
      order.id,
      order.amount,
      order.course.title,
      `购买课程：${order.course.title}`,
      `${process.env.WEB_URL || 'http://localhost:5173'}/student/my-orders`
    );

    if (!result.success) {
      sendError(res, result.message!, 400, 'ALIPAY_ERROR');
      return;
    }

    sendSuccess(res, { payUrl: result.data?.payUrl }, '支付宝支付链接创建成功');
  } catch (error) {
    console.error('创建支付宝支付订单异常:', error);
    sendError(res, '服务器内部错误', 500, 'INTERNAL_ERROR');
  }
});

// ==========================================
// POST /api/pay/alipay/notify — 支付宝异步通知回调
// ==========================================
router.post('/notify', async (req: Request, res: Response) => {
  try {
    console.log('收到支付宝通知:', req.body);

    const result = await handleAlipayNotify(req.body);

    // 支付宝要求返回 'success' 或 'fail'
    if (result.success) {
      res.send('success');
    } else {
      res.send('fail');
    }
  } catch (error) {
    console.error('处理支付宝通知异常:', error);
    res.send('fail');
  }
});

// ==========================================
// GET /api/pay/alipay/query — 查询支付宝订单状态
// ==========================================
router.get('/query', authenticate, async (req: Request, res: Response) => {
  try {
    if (!req.user) {
      sendError(res, '未登录', 401, 'UNAUTHORIZED');
      return;
    }

    const { orderId } = req.query;

    if (!orderId || typeof orderId !== 'string') {
      sendError(res, '订单ID不能为空', 400, 'VALIDATION_ERROR');
      return;
    }

    // 验证订单归属
    const order = await prisma.order.findUnique({
      where: { id: orderId },
    });

    if (!order) {
      sendError(res, '订单不存在', 404, 'NOT_FOUND');
      return;
    }

    if (order.userId !== req.user.userId) {
      sendError(res, '无权查看该订单', 403, 'FORBIDDEN');
      return;
    }

    const result = await queryAlipayOrder(orderId);

    if (!result.success) {
      sendError(res, result.message!, 400, 'ALIPAY_ERROR');
      return;
    }

    sendSuccess(res, result.data, '查询成功');
  } catch (error) {
    console.error('查询支付宝订单异常:', error);
    sendError(res, '服务器内部错误', 500, 'INTERNAL_ERROR');
  }
});

// ==========================================
// POST /api/pay/alipay/refund — 支付宝退款（管理员）
// ==========================================
router.post('/refund', authenticate, async (req: Request, res: Response) => {
  try {
    if (!req.user) {
      sendError(res, '未登录', 401, 'UNAUTHORIZED');
      return;
    }

    // 检查管理员权限
    if (req.user.role !== 'ADMIN') {
      sendError(res, '无权操作', 403, 'FORBIDDEN');
      return;
    }

    const { orderId, refundAmount, refundReason } = req.body;

    if (!orderId || !refundAmount || !refundReason) {
      sendError(res, '参数不完整', 400, 'VALIDATION_ERROR');
      return;
    }

    const outRequestNo = `REFUND_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`;

    const result = await alipayRefund(orderId, refundAmount, refundReason, outRequestNo);

    if (!result.success) {
      sendError(res, result.message!, 400, 'ALIPAY_ERROR');
      return;
    }

    sendSuccess(res, result.data, '退款申请已提交');
  } catch (error) {
    console.error('支付宝退款异常:', error);
    sendError(res, '服务器内部错误', 500, 'INTERNAL_ERROR');
  }
});

export default router;
