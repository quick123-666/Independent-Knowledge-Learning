/**
 * 订单支付路由模块
 * 提供订单创建、查询、支付、取消等 RESTful API 接口
 * 所有接口需要用户登录（JWT 认证）
 */

import { Router, Request, Response } from 'express';
import { prisma } from '../config/prisma';
import { sendSuccess, sendError } from '../utils/response';
import { authenticate } from '../middleware/auth';
import { PaymentService } from '../services/payment';

/** 订单状态常量 */
const ORDER_STATUS = { PENDING: 'PENDING', PAID: 'PAID', CANCELLED: 'CANCELLED', REFUNDED: 'REFUNDED' } as const;

// 初始化路由器和支付服务
const router = Router();
const paymentService = new PaymentService(prisma);

// ==========================================
// POST /api/orders — 创建订单
// ==========================================
router.post('/', authenticate, async (req: Request, res: Response) => {
  try {
    if (!req.user) {
      sendError(res, '未登录，请先登录', 401, 'UNAUTHORIZED');
      return;
    }

    const userId = req.user.userId;
    const { courseId } = req.body;

    if (!courseId || typeof courseId !== 'string') {
      sendError(res, '课程ID不能为空', 400, 'VALIDATION_ERROR');
      return;
    }

    const result = await paymentService.createOrder(userId, courseId);

    if (!result.success) {
      sendError(res, result.message!, 400, 'BAD_REQUEST');
      return;
    }

    sendSuccess(res, result.data, result.message, 201);
  } catch (error) {
    console.error('创建订单接口异常:', error);
    sendError(res, '服务器内部错误', 500, 'INTERNAL_ERROR');
  }
});

// ==========================================
// GET /api/orders — 获取我的订单列表
// ==========================================
router.get('/', authenticate, async (req: Request, res: Response) => {
  try {
    if (!req.user) {
      sendError(res, '未登录，请先登录', 401, 'UNAUTHORIZED');
      return;
    }

    const userId = req.user.userId;
    const { status, page = '1', limit = '10' } = req.query;

    const pageNum = Math.max(1, parseInt(page as string, 10) || 1);
    const pageSize = Math.min(100, Math.max(1, parseInt(limit as string, 10) || 10));
    const skip = (pageNum - 1) * pageSize;

    const whereCondition: { userId: string; status?: string } = { userId };

    if (status && typeof status === 'string') {
      const upperStatus = status.toUpperCase();
      if (Object.values(ORDER_STATUS).includes(upperStatus as typeof ORDER_STATUS[keyof typeof ORDER_STATUS])) {
        whereCondition.status = upperStatus;
      }
    }

    const [orders, total] = await Promise.all([
      prisma.order.findMany({
        where: whereCondition,
        include: {
          course: {
            select: { id: true, title: true, coverImage: true, price: true },
          },
        },
        orderBy: { createdAt: 'desc' },
        skip,
        take: pageSize,
      }),
      prisma.order.count({ where: whereCondition }),
    ]);

    sendSuccess(res, {
      list: orders,
      pagination: {
        page: pageNum,
        limit: pageSize,
        total,
        totalPages: Math.ceil(total / pageSize),
      },
    }, '获取订单列表成功');
  } catch (error) {
    console.error('获取订单列表接口异常:', error);
    sendError(res, '服务器内部错误', 500, 'INTERNAL_ERROR');
  }
});

// ==========================================
// GET /api/orders/:id — 获取订单详情
// ==========================================
router.get('/:id', authenticate, async (req: Request, res: Response) => {
  try {
    if (!req.user) {
      sendError(res, '未登录，请先登录', 401, 'UNAUTHORIZED');
      return;
    }

    const userId = req.user.userId;
    const { id } = req.params;

    const order = await prisma.order.findUnique({
      where: { id },
      include: {
        course: {
          select: {
            id: true,
            title: true,
            description: true,
            coverImage: true,
            price: true,
          },
        },
      },
    });

    if (!order) {
      sendError(res, '订单不存在', 404, 'NOT_FOUND');
      return;
    }

    if (order.userId !== userId) {
      sendError(res, '无权查看该订单', 403, 'FORBIDDEN');
      return;
    }

    sendSuccess(res, order, '获取订单详情成功');
  } catch (error) {
    console.error('获取订单详情接口异常:', error);
    sendError(res, '服务器内部错误', 500, 'INTERNAL_ERROR');
  }
});

// ==========================================
// POST /api/orders/:id/pay — 模拟支付
// ==========================================
router.post('/:id/pay', authenticate, async (req: Request, res: Response) => {
  try {
    if (!req.user) {
      sendError(res, '未登录，请先登录', 401, 'UNAUTHORIZED');
      return;
    }

    const userId = req.user.userId;
    const { id } = req.params;

    const result = await paymentService.processPayment(id, userId);

    if (!result.success) {
      sendError(res, result.message!, 400, 'BAD_REQUEST');
      return;
    }

    sendSuccess(res, result.data, result.message);
  } catch (error) {
    console.error('支付接口异常:', error);
    sendError(res, '服务器内部错误', 500, 'INTERNAL_ERROR');
  }
});

// ==========================================
// POST /api/orders/:id/cancel — 取消订单
// ==========================================
router.post('/:id/cancel', authenticate, async (req: Request, res: Response) => {
  try {
    if (!req.user) {
      sendError(res, '未登录，请先登录', 401, 'UNAUTHORIZED');
      return;
    }

    const userId = req.user.userId;
    const { id } = req.params;

    const result = await paymentService.cancelOrder(id, userId);

    if (!result.success) {
      sendError(res, result.message!, 400, 'BAD_REQUEST');
      return;
    }

    sendSuccess(res, result.data, result.message);
  } catch (error) {
    console.error('取消订单接口异常:', error);
    sendError(res, '服务器内部错误', 500, 'INTERNAL_ERROR');
  }
});

export default router;
