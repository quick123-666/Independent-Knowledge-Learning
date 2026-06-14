/**
 * 管理后台路由模块
 * 提供仪表盘、用户管理、订单管理、课程管理、统计数据等后台 API 接口
 * 所有接口需要 ADMIN 权限
 */

import { Router, Request, Response } from 'express';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import { prisma } from '../config/prisma';
import { sendSuccess, sendError } from '../utils/response';
import { authenticate, requireAdmin } from '../middleware/auth';

/** 订单状态常量 */
const ORDER_STATUS = { PENDING: 'PENDING', PAID: 'PAID', CANCELLED: 'CANCELLED', REFUNDED: 'REFUNDED' } as const;
/** 课程状态常量 */
const COURSE_STATUS = { DRAFT: 'DRAFT', PUBLISHED: 'PUBLISHED', ARCHIVED: 'ARCHIVED' } as const;

// 初始化路由器
const router = Router();

// ==========================================
// 文件上传配置
// ==========================================

/** 上传根目录 */
const UPLOAD_ROOT = path.join(process.cwd(), 'public');
/** 确保上传根目录存在 */
if (!fs.existsSync(UPLOAD_ROOT)) {
  fs.mkdirSync(UPLOAD_ROOT, { recursive: true });
}

/** 各类型子目录 */
const UPLOAD_VIDEOS = path.join(UPLOAD_ROOT, 'videos');
const UPLOAD_AUDIOS = path.join(UPLOAD_ROOT, 'audios');
const UPLOAD_IMAGES = path.join(UPLOAD_ROOT, 'images');
[UPLOAD_VIDEOS, UPLOAD_AUDIOS, UPLOAD_IMAGES].forEach((dir) => {
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
});

/** 根据文件类型决定存储目录 */
function getUploadDir(mimetype: string): string {
  if (mimetype.startsWith('video/')) return UPLOAD_VIDEOS;
  if (mimetype.startsWith('audio/')) return UPLOAD_AUDIOS;
  if (mimetype.startsWith('image/')) return UPLOAD_IMAGES;
  return UPLOAD_ROOT;
}

/** Multer 存储配置 */
const storage = multer.diskStorage({
  destination: (_req, file, cb) => {
    cb(null, getUploadDir(file.mimetype));
  },
  filename: (_req, file, cb) => {
    // 生成唯一文件名: timestamp-random.ext
    const ext = path.extname(file.originalname);
    const uniqueName = `${Date.now()}-${Math.random().toString(36).substring(2, 10)}${ext}`;
    cb(null, uniqueName);
  },
});

/** 文件过滤器：允许视频、音频、图片 */
const fileFilter = (_req: Request, file: Express.Multer.File, cb: multer.FileFilterCallback) => {
  const allowedTypes = [
    // 视频
    'video/mp4', 'video/webm', 'video/ogg', 'video/mov', 'video/quicktime',
    // 音频
    'audio/mpeg', 'audio/mp3', 'audio/wav', 'audio/ogg', 'audio/aac', 'audio/m4a',
    // 图片
    'image/jpeg', 'image/jpg', 'image/png', 'image/gif', 'image/webp', 'image/svg+xml',
  ];
  if (allowedTypes.includes(file.mimetype)) {
    cb(null, true);
  } else {
    cb(new Error('只允许上传 MP4/WebM/MOV 视频、MP3/WAV/OGG 音频、JPG/PNG/GIF/WebP 图片'));
  }
};

/** Multer 上传实例 */
const upload = multer({
  storage,
  fileFilter,
  limits: {
    fileSize: 500 * 1024 * 1024, // 最大 500MB
  },
});

// ==========================================
// GET /api/admin/dashboard — 仪表盘数据
// ==========================================
router.get('/dashboard', authenticate, requireAdmin, async (_req: Request, res: Response) => {
  try {
    // 并行查询核心统计数据
    const [
      totalUsers,
      totalCourses,
      totalOrders,
      revenueResult,
    ] = await Promise.all([
      // 用户总数
      prisma.user.count(),
      // 课程总数
      prisma.course.count(),
      // 订单总数
      prisma.order.count(),
      // 收入总额（已支付订单的金额总和）
      prisma.order.aggregate({
        where: {
          status: 'PAID',
        },
        _sum: {
          amount: true,
        },
      }),
    ]);

    // 今日新增数据
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const [
      todayNewUsers,
      todayNewOrders,
      todayRevenue,
    ] = await Promise.all([
      prisma.user.count({
        where: {
          createdAt: { gte: today },
        },
      }),
      prisma.order.count({
        where: {
          createdAt: { gte: today },
        },
      }),
      prisma.order.aggregate({
        where: {
          paidAt: { gte: today },
          status: 'PAID',
        },
        _sum: {
          amount: true,
        },
      }),
    ]);

    sendSuccess(res, {
      overview: {
        totalUsers,
        totalCourses,
        totalOrders,
        totalRevenue: revenueResult._sum.amount || 0,
      },
      today: {
        newUsers: todayNewUsers,
        newOrders: todayNewOrders,
        revenue: todayRevenue._sum.amount || 0,
      },
    }, '获取仪表盘数据成功');
  } catch (error) {
    console.error('获取仪表盘数据接口异常:', error);
    sendError(res, '服务器内部错误', 500, 'INTERNAL_ERROR');
  }
});

// ==========================================
// GET /api/admin/users — 用户列表（支持分页、搜索）
// ==========================================
router.get('/users', authenticate, requireAdmin, async (req: Request, res: Response) => {
  try {
    const {
      keyword,
      page = '1',
      limit = '10',
      role,
    } = req.query;

    // 分页参数处理
    const pageNum = Math.max(1, parseInt(page as string, 10) || 1);
    const pageSize = Math.min(100, Math.max(1, parseInt(limit as string, 10) || 10));
    const skip = (pageNum - 1) * pageSize;

    // 构建查询条件
    const whereCondition: {
      role?: string;
      OR?: Array<{
        email?: { contains: string; mode: 'insensitive' };
        name?: { contains: string; mode: 'insensitive' };
      }>;
    } = {};

    // 角色筛选
    if (role && typeof role === 'string') {
      whereCondition.role = role.toUpperCase();
    }

    // 关键词搜索（支持邮箱和姓名模糊搜索）
    if (keyword && typeof keyword === 'string' && keyword.trim()) {
      whereCondition.OR = [
        { email: { contains: keyword.trim(), mode: 'insensitive' } },
        { name: { contains: keyword.trim(), mode: 'insensitive' } },
      ];
    }

    // 查询用户列表
    const [users, total] = await Promise.all([
      prisma.user.findMany({
        where: whereCondition,
        select: {
          id: true,
          email: true,
          name: true,
          avatar: true,
          role: true,
          isBanned: true,
          bannedAt: true,
          bannedReason: true,
          createdAt: true,
          updatedAt: true,
          // 统计用户订单数
          _count: {
            select: {
              orders: true,
              enrollments: true,
            },
          },
        },
        orderBy: { createdAt: 'desc' },
        skip,
        take: pageSize,
      }),
      prisma.user.count({ where: whereCondition }),
    ]);

    sendSuccess(res, {
      list: users,
      pagination: {
        page: pageNum,
        limit: pageSize,
        total,
        totalPages: Math.ceil(total / pageSize),
      },
    }, '获取用户列表成功');
  } catch (error) {
    console.error('获取用户列表接口异常:', error);
    sendError(res, '服务器内部错误', 500, 'INTERNAL_ERROR');
  }
});

// ==========================================
// GET /api/admin/users/:id — 用户详情（订单 + 学习进度）
// ==========================================
router.get('/users/:id', authenticate, requireAdmin, async (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    // 查询用户基本信息
    const user = await prisma.user.findUnique({
      where: { id },
      select: {
        id: true,
        email: true,
        name: true,
        avatar: true,
        role: true,
        createdAt: true,
      },
    });

    if (!user) {
      sendError(res, '用户不存在', 404, 'USER_NOT_FOUND');
      return;
    }

    // 查询用户的已支付订单（购买的课程）
    const orders = await prisma.order.findMany({
      where: { userId: id, status: 'PAID' },
      include: {
        course: {
          select: {
            id: true,
            title: true,
            coverImage: true,
            price: true,
            slug: true,
            chapters: {
              select: { id: true, title: true, sortOrder: true },
              orderBy: { sortOrder: 'asc' },
            },
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    // 查询用户的学习记录
    const enrollments = await prisma.enrollment.findMany({
      where: { userId: id },
      include: {
        course: {
          select: {
            id: true,
            title: true,
            coverImage: true,
            chapters: {
              select: { id: true, title: true, sortOrder: true },
              orderBy: { sortOrder: 'asc' },
            },
          },
        },
        chapterProgress: {
          select: { chapterId: true, isCompleted: true, completedAt: true },
        },
      },
    });

    // 计算总消费金额
    const totalSpent = orders.reduce((sum, o) => sum + o.amount, 0);

    // 构建课程学习详情
    const courseDetails = orders.map((order) => {
      const enrollment = enrollments.find((e) => e.courseId === order.courseId);
      const course = order.course;
      const totalChapters = course.chapters.length;
      const completedChapterIds = new Set(
        enrollment?.chapterProgress.filter((cp) => cp.isCompleted).map((cp) => cp.chapterId) || []
      );
      const completedChapters = course.chapters.filter((ch) => completedChapterIds.has(ch.id));
      const uncompletedChapters = course.chapters.filter((ch) => !completedChapterIds.has(ch.id));

      return {
        orderId: order.id,
        courseId: course.id,
        title: course.title,
        coverImage: course.coverImage,
        price: order.amount,
        purchasedAt: order.createdAt,
        orderStatus: order.status,
        progress: enrollment?.progress || 0,
        isCompleted: enrollment?.completedAt ? true : false,
        totalChapters,
        completedCount: completedChapters.length,
        completedChapters: completedChapters.map((ch) => ({ id: ch.id, title: ch.title })),
        uncompletedChapters: uncompletedChapters.map((ch) => ({ id: ch.id, title: ch.title })),
      };
    });

    sendSuccess(res, {
      user,
      totalSpent,
      totalOrders: orders.length,
      totalEnrollments: enrollments.length,
      courses: courseDetails,
    }, '获取用户详情成功');
  } catch (error) {
    console.error('获取用户详情接口异常:', error);
    sendError(res, '服务器内部错误', 500, 'INTERNAL_ERROR');
  }
});

// ==========================================
// POST /api/admin/orders/:id/refund — 退款
// ==========================================
router.post('/orders/:id/refund', authenticate, requireAdmin, async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { reason } = req.body;

    if (!reason || typeof reason !== 'string' || !reason.trim()) {
      sendError(res, '退款原因不能为空', 400, 'VALIDATION_ERROR');
      return;
    }

    // 查询订单
    const order = await prisma.order.findUnique({ where: { id } });

    if (!order) {
      sendError(res, '订单不存在', 404, 'ORDER_NOT_FOUND');
      return;
    }

    if (order.status !== 'PAID') {
      sendError(res, '只有已支付的订单才能退款', 400, 'INVALID_ORDER_STATUS');
      return;
    }

    // 更新订单状态为已退款
    const updatedOrder = await prisma.order.update({
      where: { id },
      data: {
        status: 'REFUNDED',
        refundedAt: new Date(),
        refundReason: reason.trim(),
      },
      include: {
        user: { select: { id: true, email: true, name: true } },
        course: { select: { id: true, title: true, coverImage: true } },
      },
    });

    // 删除对应的学习记录（取消学习资格）
    try {
      await prisma.enrollment.deleteMany({
        where: {
          userId: order.userId,
          courseId: order.courseId,
        },
      });
    } catch (enrollmentError) {
      console.error('删除学习记录失败（不影响退款）:', enrollmentError);
    }

    sendSuccess(res, updatedOrder, '退款成功');
  } catch (error) {
    console.error('退款接口异常:', error);
    sendError(res, '服务器内部错误', 500, 'INTERNAL_ERROR');
  }
});

// ==========================================
// POST /api/admin/users/:id/ban — 封号
// ==========================================
router.post('/users/:id/ban', authenticate, requireAdmin, async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { reason } = req.body;

    if (!reason || typeof reason !== 'string' || !reason.trim()) {
      sendError(res, '封号原因不能为空', 400, 'VALIDATION_ERROR');
      return;
    }

    const user = await prisma.user.findUnique({ where: { id } });

    if (!user) {
      sendError(res, '用户不存在', 404, 'USER_NOT_FOUND');
      return;
    }

    const updatedUser = await prisma.user.update({
      where: { id },
      data: {
        isBanned: true,
        bannedAt: new Date(),
        bannedReason: reason.trim(),
      },
      select: {
        id: true,
        email: true,
        name: true,
        avatar: true,
        role: true,
        isBanned: true,
        bannedAt: true,
        bannedReason: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    sendSuccess(res, updatedUser, '封号成功');
  } catch (error) {
    console.error('封号接口异常:', error);
    sendError(res, '服务器内部错误', 500, 'INTERNAL_ERROR');
  }
});

// ==========================================
// POST /api/admin/users/:id/unban — 解封
// ==========================================
router.post('/users/:id/unban', authenticate, requireAdmin, async (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    const user = await prisma.user.findUnique({ where: { id } });

    if (!user) {
      sendError(res, '用户不存在', 404, 'USER_NOT_FOUND');
      return;
    }

    const updatedUser = await prisma.user.update({
      where: { id },
      data: {
        isBanned: false,
        bannedAt: null,
        bannedReason: null,
      },
      select: {
        id: true,
        email: true,
        name: true,
        avatar: true,
        role: true,
        isBanned: true,
        bannedAt: true,
        bannedReason: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    sendSuccess(res, updatedUser, '解封成功');
  } catch (error) {
    console.error('解封接口异常:', error);
    sendError(res, '服务器内部错误', 500, 'INTERNAL_ERROR');
  }
});

// ==========================================
// POST /api/admin/users/:id/reset-password — 重置密码
// ==========================================
router.post('/users/:id/reset-password', authenticate, requireAdmin, async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { newPassword } = req.body;

    if (!newPassword || newPassword.length < 6) {
      sendError(res, '新密码长度不能少于6位', 400, 'INVALID_PASSWORD');
      return;
    }

    const user = await prisma.user.findUnique({ where: { id } });

    if (!user) {
      sendError(res, '用户不存在', 404, 'USER_NOT_FOUND');
      return;
    }

    // 使用 bcrypt 加密新密码
    const bcrypt = await import('bcrypt');
    const hashedPassword = await bcrypt.hash(newPassword, 10);

    await prisma.user.update({
      where: { id },
      data: { password: hashedPassword },
    });

    sendSuccess(res, { userId: id, email: user.email, name: user.name }, '密码重置成功');
  } catch (error) {
    console.error('重置密码接口异常:', error);
    sendError(res, '服务器内部错误', 500, 'INTERNAL_ERROR');
  }
});

// ==========================================
// GET /api/admin/orders — 所有订单列表（支持按状态筛选）
// ==========================================
router.get('/orders', authenticate, requireAdmin, async (req: Request, res: Response) => {
  try {
    const {
      status,
      page = '1',
      limit = '10',
    } = req.query;

    // 分页参数处理
    const pageNum = Math.max(1, parseInt(page as string, 10) || 1);
    const pageSize = Math.min(100, Math.max(1, parseInt(limit as string, 10) || 10));
    const skip = (pageNum - 1) * pageSize;

    // 构建查询条件
    const whereCondition: { status?: string } = {};

    if (status && typeof status === 'string') {
      const upperStatus = status.toUpperCase();
      if (Object.values(ORDER_STATUS).includes(upperStatus as typeof ORDER_STATUS[keyof typeof ORDER_STATUS])) {
        whereCondition.status = upperStatus;
      }
    }

    // 查询订单列表
    const [orders, total] = await Promise.all([
      prisma.order.findMany({
        where: whereCondition,
        include: {
          user: {
            select: {
              id: true,
              email: true,
              name: true,
            },
          },
          course: {
            select: {
              id: true,
              title: true,
              coverImage: true,
            },
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
// GET /api/admin/courses — 所有课程列表（支持按状态筛选）
// ==========================================
router.get('/courses', authenticate, requireAdmin, async (req: Request, res: Response) => {
  try {
    const {
      status,
      keyword,
      page = '1',
      limit = '10',
    } = req.query;

    // 分页参数处理
    const pageNum = Math.max(1, parseInt(page as string, 10) || 1);
    const pageSize = Math.min(100, Math.max(1, parseInt(limit as string, 10) || 10));
    const skip = (pageNum - 1) * pageSize;

    // 构建查询条件
    const whereCondition: {
      status?: string;
      title?: { contains: string; mode: 'insensitive' };
    } = {};

    if (status && typeof status === 'string') {
      const upperStatus = status.toUpperCase();
      if (Object.values(COURSE_STATUS).includes(upperStatus as typeof COURSE_STATUS[keyof typeof COURSE_STATUS])) {
        whereCondition.status = upperStatus;
      }
    }

    // 标题关键词搜索
    if (keyword && typeof keyword === 'string' && keyword.trim()) {
      whereCondition.title = { contains: keyword.trim(), mode: 'insensitive' };
    }

    // 查询课程列表
    const [courses, total] = await Promise.all([
      prisma.course.findMany({
        where: whereCondition,
        include: {
          category: {
            select: {
              id: true,
              name: true,
            },
          },
          instructor: {
            select: {
              id: true,
              name: true,
              email: true,
            },
          },
          _count: {
            select: {
              chapters: true,
              enrollments: true,
            },
          },
        },
        orderBy: { createdAt: 'desc' },
        skip,
        take: pageSize,
      }),
      prisma.course.count({ where: whereCondition }),
    ]);

    sendSuccess(res, {
      list: courses,
      pagination: {
        page: pageNum,
        limit: pageSize,
        total,
        totalPages: Math.ceil(total / pageSize),
      },
    }, '获取课程列表成功');
  } catch (error) {
    console.error('获取课程列表接口异常:', error);
    sendError(res, '服务器内部错误', 500, 'INTERNAL_ERROR');
  }
});

// ==========================================
// PUT /api/admin/courses/:id/status — 更新课程状态
// ==========================================
router.put('/courses/:id/status', authenticate, requireAdmin, async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { status } = req.body;

    // 参数校验
    if (!status || !Object.values(COURSE_STATUS).includes(status as typeof COURSE_STATUS[keyof typeof COURSE_STATUS])) {
      sendError(
        res,
        `状态参数无效，可选值: ${Object.values(COURSE_STATUS).join(', ')}`,
        400,
        'VALIDATION_ERROR'
      );
      return;
    }

    // 检查课程是否存在
    const existingCourse = await prisma.course.findUnique({
      where: { id },
    });

    if (!existingCourse) {
      sendError(res, '课程不存在', 404, 'NOT_FOUND');
      return;
    }

    // 更新课程状态
    const updatedCourse = await prisma.course.update({
      where: { id },
      data: {
        status: status as string,
      },
      include: {
        category: {
          select: {
            id: true,
            name: true,
          },
        },
        instructor: {
          select: {
            id: true,
            name: true,
          },
        },
      },
    });

    sendSuccess(res, updatedCourse, '课程状态更新成功');
  } catch (error) {
    console.error('更新课程状态接口异常:', error);
    sendError(res, '服务器内部错误', 500, 'INTERNAL_ERROR');
  }
});

// ==========================================
// POST /api/admin/courses — 创建课程
// ==========================================
router.post('/courses', authenticate, requireAdmin, async (req: Request, res: Response) => {
  try {
    const { title, description, categoryId, price, coverImage, status } = req.body;

    if (!title || !categoryId) {
      sendError(res, '课程名称和分类不能为空', 400, 'VALIDATION_ERROR');
      return;
    }

    // 自动生成 slug
    const slug = title.toLowerCase()
      .replace(/\s+/g, '-')
      .replace(/[^a-z0-9\u4e00-\u9fff-]/g, '')
      + '-' + Date.now().toString(36);

    const course = await prisma.course.create({
      data: {
        title,
        slug,
        description: description || '',
        categoryId: String(categoryId),
        price: Number(price) || 0,
        coverImage: coverImage || '',
        status: status || COURSE_STATUS.DRAFT,
        instructorId: req.user!.userId,
      },
      include: {
        category: { select: { id: true, name: true } },
        instructor: { select: { id: true, name: true, email: true } },
      },
    });

    sendSuccess(res, course, '课程创建成功', 201);
  } catch (error) {
    console.error('创建课程接口异常:', error);
    sendError(res, '服务器内部错误', 500, 'INTERNAL_ERROR');
  }
});

// ==========================================
// PUT /api/admin/courses/:id — 更新课程
// ==========================================
router.put('/courses/:id', authenticate, requireAdmin, async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { title, description, categoryId, price, coverImage, status } = req.body;

    const existing = await prisma.course.findUnique({ where: { id } });
    if (!existing) {
      sendError(res, '课程不存在', 404, 'NOT_FOUND');
      return;
    }

    const data: any = {
      ...(title !== undefined && {
        title,
        slug: title.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9\u4e00-\u9fff-]/g, '') + '-' + Date.now().toString(36),
      }),
      ...(description !== undefined && { description }),
      ...(categoryId !== undefined && { categoryId: String(categoryId) }),
      ...(price !== undefined && { price: Number(price) }),
      ...(coverImage !== undefined && { coverImage }),
      ...(status !== undefined && { status }),
    };

    const course = await prisma.course.update({
      where: { id },
      data,
      include: {
        category: { select: { id: true, name: true } },
        instructor: { select: { id: true, name: true, email: true } },
      },
    });

    sendSuccess(res, course, '课程更新成功');
  } catch (error) {
    console.error('更新课程接口异常:', error);
    sendError(res, '服务器内部错误', 500, 'INTERNAL_ERROR');
  }
});

// ==========================================
// DELETE /api/admin/courses/:id — 删除课程
// ==========================================
router.delete('/courses/:id', authenticate, requireAdmin, async (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    const existing = await prisma.course.findUnique({ where: { id } });
    if (!existing) {
      sendError(res, '课程不存在', 404, 'NOT_FOUND');
      return;
    }

    await prisma.course.delete({ where: { id } });
    sendSuccess(res, null, '课程删除成功');
  } catch (error) {
    console.error('删除课程接口异常:', error);
    sendError(res, '服务器内部错误', 500, 'INTERNAL_ERROR');
  }
});

// ==========================================
// POST /api/admin/courses/:id/chapters — 创建章节（含内容块）
// ==========================================
router.post('/courses/:id/chapters', authenticate, requireAdmin, async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { title, isFree, sortOrder, contentBlocks } = req.body;

    if (!title) {
      sendError(res, '章节标题不能为空', 400, 'VALIDATION_ERROR');
      return;
    }

    const course = await prisma.course.findUnique({ where: { id } });
    if (!course) {
      sendError(res, '课程不存在', 404, 'NOT_FOUND');
      return;
    }

    const chapter = await prisma.chapter.create({
      data: {
        title,
        isFree: isFree || false,
        sortOrder: sortOrder || 1,
        courseId: id,
        contentBlocks: {
          create: (contentBlocks || []).map((block: any, index: number) => ({
            type: block.type || 'ARTICLE',
            title: block.title || '',
            content: block.content || '',
            url: block.url || '',
            duration: block.duration || null,
            sortOrder: block.sortOrder || index + 1,
          })),
        },
      },
      include: { contentBlocks: { orderBy: { sortOrder: 'asc' } } },
    });

    sendSuccess(res, chapter, '章节创建成功', 201);
  } catch (error) {
    console.error('创建章节接口异常:', error);
    sendError(res, '服务器内部错误', 500, 'INTERNAL_ERROR');
  }
});

// ==========================================
// PUT /api/admin/chapters/:chapterId — 更新章节（含内容块）
// ==========================================
router.put('/chapters/:chapterId', authenticate, requireAdmin, async (req: Request, res: Response) => {
  try {
    const { chapterId } = req.params;
    const { title, isFree, sortOrder } = req.body;

    const existing = await prisma.chapter.findUnique({ where: { id: chapterId } });
    if (!existing) {
      sendError(res, '章节不存在', 404, 'NOT_FOUND');
      return;
    }

    const chapter = await prisma.chapter.update({
      where: { id: chapterId },
      data: {
        ...(title !== undefined && { title }),
        ...(isFree !== undefined && { isFree }),
        ...(sortOrder !== undefined && { sortOrder }),
      },
      include: { contentBlocks: { orderBy: { sortOrder: 'asc' } } },
    });

    sendSuccess(res, chapter, '章节更新成功');
  } catch (error) {
    console.error('更新章节接口异常:', error);
    sendError(res, '服务器内部错误', 500, 'INTERNAL_ERROR');
  }
});

// ==========================================
// DELETE /api/admin/chapters/:chapterId — 删除章节
// ==========================================
router.delete('/chapters/:chapterId', authenticate, requireAdmin, async (req: Request, res: Response) => {
  try {
    const { chapterId } = req.params;

    const existing = await prisma.chapter.findUnique({ where: { id: chapterId } });
    if (!existing) {
      sendError(res, '章节不存在', 404, 'NOT_FOUND');
      return;
    }

    await prisma.chapter.delete({ where: { id: chapterId } });
    sendSuccess(res, null, '章节删除成功');
  } catch (error) {
    console.error('删除章节接口异常:', error);
    sendError(res, '服务器内部错误', 500, 'INTERNAL_ERROR');
  }
});

// ==========================================
// POST /api/admin/chapters/:chapterId/blocks — 创建内容块
// ==========================================
router.post('/chapters/:chapterId/blocks', authenticate, requireAdmin, async (req: Request, res: Response) => {
  try {
    const { chapterId } = req.params;
    const { type, title, content, url, duration, sortOrder } = req.body;

    if (!type || !title) {
      sendError(res, '内容块类型和标题不能为空', 400, 'VALIDATION_ERROR');
      return;
    }

    const chapter = await prisma.chapter.findUnique({ where: { id: chapterId } });
    if (!chapter) {
      sendError(res, '章节不存在', 404, 'NOT_FOUND');
      return;
    }

    const block = await prisma.contentBlock.create({
      data: {
        type,
        title,
        content: content || '',
        url: url || '',
        duration: duration || null,
        sortOrder: sortOrder || 1,
        chapterId,
      },
    });

    sendSuccess(res, block, '内容块创建成功', 201);
  } catch (error) {
    console.error('创建内容块接口异常:', error);
    sendError(res, '服务器内部错误', 500, 'INTERNAL_ERROR');
  }
});

// ==========================================
// PUT /api/admin/blocks/:blockId — 更新内容块
// ==========================================
router.put('/blocks/:blockId', authenticate, requireAdmin, async (req: Request, res: Response) => {
  try {
    const { blockId } = req.params;
    const { type, title, content, url, duration, sortOrder } = req.body;

    const existing = await prisma.contentBlock.findUnique({ where: { id: blockId } });
    if (!existing) {
      sendError(res, '内容块不存在', 404, 'NOT_FOUND');
      return;
    }

    const block = await prisma.contentBlock.update({
      where: { id: blockId },
      data: {
        ...(type !== undefined && { type }),
        ...(title !== undefined && { title }),
        ...(content !== undefined && { content }),
        ...(url !== undefined && { url }),
        ...(duration !== undefined && { duration }),
        ...(sortOrder !== undefined && { sortOrder }),
      },
    });

    sendSuccess(res, block, '内容块更新成功');
  } catch (error) {
    console.error('更新内容块接口异常:', error);
    sendError(res, '服务器内部错误', 500, 'INTERNAL_ERROR');
  }
});

// ==========================================
// DELETE /api/admin/blocks/:blockId — 删除内容块
// ==========================================
router.delete('/blocks/:blockId', authenticate, requireAdmin, async (req: Request, res: Response) => {
  try {
    const { blockId } = req.params;

    const existing = await prisma.contentBlock.findUnique({ where: { id: blockId } });
    if (!existing) {
      sendError(res, '内容块不存在', 404, 'NOT_FOUND');
      return;
    }

    await prisma.contentBlock.delete({ where: { id: blockId } });
    sendSuccess(res, null, '内容块删除成功');
  } catch (error) {
    console.error('删除内容块接口异常:', error);
    sendError(res, '服务器内部错误', 500, 'INTERNAL_ERROR');
  }
});

// ==========================================
// POST /api/admin/upload — 上传本地文件（视频/音频/图片）
// ==========================================
router.post('/upload', authenticate, requireAdmin, upload.single('file'), (req: Request, res: Response) => {
  try {
    if (!req.file) {
      sendError(res, '未找到上传的文件', 400, 'FILE_NOT_FOUND');
      return;
    }

    // 根据 mimetype 决定 URL 路径
    let subDir = '';
    if (req.file.mimetype.startsWith('video/')) subDir = 'videos';
    else if (req.file.mimetype.startsWith('audio/')) subDir = 'audios';
    else if (req.file.mimetype.startsWith('image/')) subDir = 'images';

    // 构建可访问的 URL
    // 例如: http://localhost:3001/uploads/videos/1718345601234-abc123.mp4
    const fileUrl = `/uploads/${subDir}/${req.file.filename}`;

    sendSuccess(res, {
      originalName: req.file.originalname,
      filename: req.file.filename,
      size: req.file.size,
      mimetype: req.file.mimetype,
      url: fileUrl,
    }, '文件上传成功');
  } catch (error) {
    console.error('文件上传接口异常:', error);
    sendError(res, '文件上传失败', 500, 'UPLOAD_ERROR');
  }
});

// ==========================================
// GET /api/admin/categories — 管理后台分类列表
// ==========================================
router.get('/categories', authenticate, requireAdmin, async (_req: Request, res: Response) => {
  try {
    const categories = await prisma.category.findMany({
      orderBy: { sortOrder: 'asc' },
      include: {
        _count: { select: { courses: true } },
      },
    });
    sendSuccess(res, categories);
  } catch (error) {
    console.error('获取分类列表接口异常:', error);
    sendError(res, '服务器内部错误', 500, 'INTERNAL_ERROR');
  }
});

// ==========================================
// POST /api/admin/categories — 创建分类
// ==========================================
router.post('/categories', authenticate, requireAdmin, async (req: Request, res: Response) => {
  try {
    const { name, description } = req.body;

    if (!name) {
      sendError(res, '分类名称不能为空', 400, 'VALIDATION_ERROR');
      return;
    }

    const slug = name.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9\u4e00-\u9fff-]/g, '');

    const category = await prisma.category.create({
      data: {
        name,
        slug,
        description: description || '',
        sortOrder: 0,
      },
    });

    sendSuccess(res, category, '分类创建成功', 201);
  } catch (error) {
    console.error('创建分类接口异常:', error);
    sendError(res, '服务器内部错误', 500, 'INTERNAL_ERROR');
  }
});

// ==========================================
// PUT /api/admin/categories/:id — 更新分类
// ==========================================
router.put('/categories/:id', authenticate, requireAdmin, async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { name, description } = req.body;

    const existing = await prisma.category.findUnique({ where: { id } });
    if (!existing) {
      sendError(res, '分类不存在', 404, 'NOT_FOUND');
      return;
    }

    const data: any = {};
    if (name !== undefined) {
      data.name = name;
      data.slug = name.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9\u4e00-\u9fff-]/g, '');
    }
    if (description !== undefined) {
      data.description = description;
    }

    const category = await prisma.category.update({
      where: { id },
      data,
    });

    sendSuccess(res, category, '分类更新成功');
  } catch (error) {
    console.error('更新分类接口异常:', error);
    sendError(res, '服务器内部错误', 500, 'INTERNAL_ERROR');
  }
});

// ==========================================
// DELETE /api/admin/categories/:id — 删除分类
// ==========================================
router.delete('/categories/:id', authenticate, requireAdmin, async (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    const existing = await prisma.category.findUnique({ where: { id } });
    if (!existing) {
      sendError(res, '分类不存在', 404, 'NOT_FOUND');
      return;
    }

    await prisma.category.delete({ where: { id } });
    sendSuccess(res, null, '分类删除成功');
  } catch (error: any) {
    if (error?.code === 'P2003') {
      sendError(res, '该分类下仍有课程，无法删除', 409, 'CATEGORY_HAS_COURSES');
      return;
    }
    console.error('删除分类接口异常:', error);
    sendError(res, '服务器内部错误', 500, 'INTERNAL_ERROR');
  }
});

// ==========================================
// GET /api/admin/stats — 统计数据（近7天订单、收入趋势）
// ==========================================
router.get('/stats', authenticate, requireAdmin, async (_req: Request, res: Response) => {
  try {
    // 计算近7天的日期范围
    const dates: Date[] = [];
    for (let i = 6; i >= 0; i--) {
      const date = new Date();
      date.setDate(date.getDate() - i);
      date.setHours(0, 0, 0, 0);
      dates.push(date);
    }

    // 并行查询每天的订单数和收入
    const dailyStats = await Promise.all(
      dates.map(async (date) => {
        const nextDate = new Date(date);
        nextDate.setDate(nextDate.getDate() + 1);

        const [orderCount, revenue] = await Promise.all([
          prisma.order.count({
            where: {
              createdAt: {
                gte: date,
                lt: nextDate,
              },
            },
          }),
          prisma.order.aggregate({
            where: {
              paidAt: {
                gte: date,
                lt: nextDate,
              },
              status: 'PAID',
            },
            _sum: {
              amount: true,
            },
          }),
        ]);

        // 格式化日期为 YYYY-MM-DD
        const dateStr = date.toISOString().split('T')[0];

        return {
          date: dateStr,
          orderCount,
          revenue: revenue._sum.amount || 0,
        };
      })
    );

    // 计算近7天汇总数据
    const totalOrders7d = dailyStats.reduce((sum, day) => sum + day.orderCount, 0);
    const totalRevenue7d = dailyStats.reduce((sum, day) => day.revenue ? Number(day.revenue) : 0 + sum, 0);

    // 查询订单状态分布
    const orderStatusDistribution = await prisma.order.groupBy({
      by: ['status'],
      _count: {
        status: true,
      },
    });

    sendSuccess(res, {
      dailyTrend: dailyStats,
      summary7d: {
        totalOrders: totalOrders7d,
        totalRevenue: totalRevenue7d,
        averageDailyOrders: Math.round(totalOrders7d / 7),
        averageDailyRevenue: Math.round(totalRevenue7d / 7),
      },
      orderStatusDistribution: orderStatusDistribution.map((item) => ({
        status: item.status,
        count: item._count.status,
      })),
    }, '获取统计数据成功');
  } catch (error) {
    console.error('获取统计数据接口异常:', error);
    sendError(res, '服务器内部错误', 500, 'INTERNAL_ERROR');
  }
});

export default router;
