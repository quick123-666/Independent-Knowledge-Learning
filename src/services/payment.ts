/**
 * 支付服务模块
 * 提供订单创建、支付处理、支付验证等核心支付功能
 * 支付成功后自动创建 Enrollment（选课）记录
 */

import { PrismaClient } from '@prisma/client';
import { CourseAccessService } from './course-access';

/** 订单状态常量 */
const ORDER_STATUS = { PENDING: 'PENDING', PAID: 'PAID', CANCELLED: 'CANCELLED', REFUNDED: 'REFUNDED' } as const;

/** 服务层统一返回结构 */
interface ServiceResult<T = unknown> {
  success: boolean;
  data?: T;
  message?: string;
}

/** 服务层错误返回 */
function fail(message: string): ServiceResult {
  return { success: false, message };
}

/** 服务层成功返回 */
function ok<T>(data: T, message?: string): ServiceResult<T> {
  return { success: true, data, message };
}

/**
 * 支付服务类
 * 封装订单创建、支付处理、支付验证等核心业务逻辑
 */
export class PaymentService {
  private prisma: PrismaClient;
  private courseAccessService: CourseAccessService;

  constructor(prismaClient: PrismaClient) {
    this.prisma = prismaClient;
    this.courseAccessService = new CourseAccessService(this.prisma);
  }

  /**
   * 创建订单
   * 检查用户是否已购买该课程，若未购买则生成订单记录
   */
  async createOrder(userId: string, courseId: string): Promise<ServiceResult> {
    try {
      // 检查课程是否存在且已发布
      const course = await this.prisma.course.findUnique({
        where: { id: courseId },
      });

      if (!course) {
        return fail('课程不存在');
      }

      if (course.status !== 'PUBLISHED') {
        return fail('课程未发布，暂无法购买');
      }

      // 检查用户是否已购买该课程
      const hasPurchased = await this.courseAccessService.hasPurchased(userId, courseId);
      if (hasPurchased) {
        return fail('您已购买该课程，无需重复购买');
      }

      // 检查是否存在未支付的订单
      const existingOrder = await this.prisma.order.findFirst({
        where: { userId, courseId, status: ORDER_STATUS.PENDING },
      });

      if (existingOrder) {
        return fail('您有未完成的订单，请先完成或取消后再购买');
      }

      // 创建订单记录
      const order = await this.prisma.order.create({
        data: {
          userId,
          courseId,
          amount: course.price,
          status: ORDER_STATUS.PENDING,
        },
        include: {
          course: {
            select: { id: true, title: true, coverImage: true, price: true },
          },
        },
      });

      return ok(order, '订单创建成功');
    } catch (error) {
      console.error('创建订单失败:', error);
      return fail('创建订单失败，请稍后重试');
    }
  }

  /**
   * 处理支付（模拟支付）
   * 直接标记订单为已支付，并创建 Enrollment 记录
   */
  async processPayment(orderId: string, userId: string): Promise<ServiceResult> {
    try {
      const order = await this.prisma.order.findUnique({ where: { id: orderId } });

      if (!order) {
        return fail('订单不存在');
      }

      if (order.userId !== userId) {
        return fail('无权操作该订单');
      }

      if (order.status !== ORDER_STATUS.PENDING) {
        return fail('订单状态异常，无法支付');
      }

      // 模拟支付：更新订单状态
      const updatedOrder = await this.prisma.order.update({
        where: { id: orderId },
        data: {
          status: ORDER_STATUS.PAID,
          paidAt: new Date(),
          paymentMethod: 'SIMULATED',
        },
      });

      // 支付成功后自动创建选课记录
      let enrollment = null;
      try {
        enrollment = await this.prisma.enrollment.create({
          data: { userId: order.userId, courseId: order.courseId },
        });
      } catch {
        // 选课记录已存在则查询
        enrollment = await this.prisma.enrollment.findFirst({
          where: { userId: order.userId, courseId: order.courseId },
        });
      }

      return ok({ order: updatedOrder, enrollment }, '支付成功');
    } catch (error) {
      console.error('支付处理失败:', error);
      return fail('支付处理失败，请稍后重试');
    }
  }

  /**
   * 验证支付状态
   */
  async verifyPayment(orderId: string, userId: string): Promise<ServiceResult> {
    try {
      const order = await this.prisma.order.findUnique({
        where: { id: orderId },
        include: {
          course: { select: { id: true, title: true, coverImage: true, price: true } },
        },
      });

      if (!order) {
        return fail('订单不存在');
      }

      if (order.userId !== userId) {
        return fail('无权查看该订单');
      }

      return ok({
        orderId: order.id,
        status: order.status,
        amount: order.amount,
        paidAt: order.paidAt,
        paymentMethod: order.paymentMethod,
        course: order.course,
        createdAt: order.createdAt,
      }, '查询成功');
    } catch (error) {
      console.error('验证支付状态失败:', error);
      return fail('查询支付状态失败，请稍后重试');
    }
  }

  /**
   * 取消订单
   */
  async cancelOrder(orderId: string, userId: string): Promise<ServiceResult> {
    try {
      const order = await this.prisma.order.findUnique({ where: { id: orderId } });

      if (!order) {
        return fail('订单不存在');
      }

      if (order.userId !== userId) {
        return fail('无权操作该订单');
      }

      if (order.status !== ORDER_STATUS.PENDING) {
        return fail('订单状态异常，无法取消');
      }

      const updatedOrder = await this.prisma.order.update({
        where: { id: orderId },
        data: { status: ORDER_STATUS.CANCELLED },
      });

      return ok(updatedOrder, '订单已取消');
    } catch (error) {
      console.error('取消订单失败:', error);
      return fail('取消订单失败，请稍后重试');
    }
  }
}

export default PaymentService;
