/**
 * 路由统一入口模块
 * 注册所有业务路由，提供统一的 API 前缀和错误处理
 */

import { Router, Request, Response, NextFunction } from 'express';

// 导入各业务路由模块
import authRouter from './auth';
import coursesRouter from './courses';
import categoriesRouter from './categories';
import enrollmentsRouter from './enrollments';
import reviewsRouter from './reviews';
import ordersRouter from './orders';
import adminRouter from './admin';
import uploadRouter from './upload';
import alipayRouter from './alipay';

// 创建主路由器
const router = Router();

/**
 * 健康检查接口
 * 用于服务状态监控和负载均衡健康检测
 * GET /api/health
 */
router.get('/health', (_req: Request, res: Response) => {
  res.status(200).json({
    success: true,
    data: {
      status: 'ok',
      timestamp: new Date().toISOString(),
    },
    message: '服务运行正常',
  });
});

// ==========================================
// 注册业务路由
// ==========================================

/**
 * 用户认证路由
 * 提供注册、登录、获取个人信息、更新个人信息等功能
 * 基础路径: /api/auth
 */
router.use('/auth', authRouter);

/**
 * 课程管理路由
 * 提供课程列表、详情、章节查询，以及管理员创建/更新/删除课程等功能
 * 基础路径: /api/courses
 */
router.use('/courses', coursesRouter);

/**
 * 分类管理路由
 * 提供分类列表查询，以及管理员创建/更新/删除分类等功能
 * 基础路径: /api/categories
 */
router.use('/categories', categoriesRouter);

/**
 * 学习进度路由
 * 提供已购课程列表、学习进度查询与更新等功能
 * 基础路径: /api/enrollments
 */
router.use('/enrollments', enrollmentsRouter);

/**
 * 评价路由
 * 提供课程评价列表查询、提交评价等功能
 * 基础路径: /api/courses/:courseId/reviews
 * 注意：reviews 路由挂载在 courses 路由下，通过 mergeParams 获取 courseId
 */
router.use('/courses/:courseId/reviews', reviewsRouter);

/**
 * 订单支付路由
 * 提供订单创建、查询、支付、取消等功能
 * 基础路径: /api/orders
 */
router.use('/orders', ordersRouter);

/**
 * 管理后台路由
 * 提供仪表盘、用户管理、订单管理、课程管理、统计数据等功能
 * 需要 ADMIN 权限
 * 基础路径: /api/admin
 */
router.use('/admin', adminRouter);

/**
 * 通用上传路由
 * 提供用户头像上传等功能
 * 基础路径: /api/upload
 */
router.use('/upload', uploadRouter);

/**
 * 支付宝支付路由
 * 提供支付宝支付下单、回调通知、订单查询等功能
 * 基础路径: /api/pay/alipay
 */
router.use('/pay/alipay', alipayRouter);

// ==========================================
// 全局路由错误处理
// ==========================================

/**
 * 404 路由未找到处理
 * 当请求的路径没有匹配到任何已注册路由时返回
 */
router.use((_req: Request, res: Response) => {
  res.status(404).json({
    success: false,
    message: '请求的资源不存在',
    code: 'NOT_FOUND',
  });
});

/**
 * 全局错误处理中间件
 * 捕获所有路由处理过程中抛出的异常
 */
router.use((err: Error, _req: Request, res: Response, _next: NextFunction) => {
  console.error('路由处理异常:', err);

  res.status(500).json({
    success: false,
    message: '服务器内部错误',
    code: 'INTERNAL_ERROR',
  });
});

export default router;
