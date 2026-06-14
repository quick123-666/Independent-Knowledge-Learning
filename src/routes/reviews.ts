import { Router, Request, Response } from "express";
import { z } from "zod";
import { prisma } from "@config/prisma";
import { sendSuccess, sendError } from "@utils/response";
import { authenticate } from "@middleware/auth";

const router = Router({ mergeParams: true });

// ==========================================
// Zod 输入校验 Schema
// ==========================================

/** 提交评价请求体校验 */
const createReviewSchema = z.object({
  rating: z.number().min(1, "评分最低为 1").max(5, "评分最高为 5"),
  comment: z.string().max(2000, "评价内容不能超过 2000 个字符").optional(),
});

/** 查询参数校验（分页） */
const listQuerySchema = z.object({
  page: z.coerce.number().min(1).default(1),
  pageSize: z.coerce.number().min(1).max(50).default(10),
});

// ==========================================
// 辅助函数
// ==========================================

/**
 * 检查用户是否已购买指定课程
 * @param userId 用户 ID
 * @param courseId 课程 ID
 * @returns 是否已购买
 */
async function hasPurchased(userId: string, courseId: string): Promise<boolean> {
  const enrollment = await prisma.enrollment.findUnique({
    where: { userId_courseId: { userId, courseId } },
  });
  return !!enrollment;
}

// ==========================================
// 路由定义
// ==========================================

/**
 * GET /api/courses/:courseId/reviews
 * 获取课程评价列表（支持分页）
 */
router.get("/", async (req: Request, res: Response) => {
  try {
    const { courseId } = req.params;
    const query = listQuerySchema.parse(req.query);
    const { page, pageSize } = query;

    // 检查课程是否存在且已发布
    const course = await prisma.course.findUnique({
      where: { id: courseId },
      select: { id: true, status: true },
    });

    if (!course || course.status !== "PUBLISHED") {
      sendError(res, "课程不存在", 404, "COURSE_NOT_FOUND");
      return;
    }

    // 查询评价总数
    const total = await prisma.review.count({ where: { courseId } });

    // 查询评价列表
    const reviews = await prisma.review.findMany({
      where: { courseId },
      skip: (page - 1) * pageSize,
      take: pageSize,
      orderBy: { createdAt: "desc" },
      include: {
        user: {
          select: {
            id: true,
            name: true,
            avatar: true,
          },
        },
      },
    });

    // 计算平均评分
    const aggregate = await prisma.review.aggregate({
      where: { courseId },
      _avg: { rating: true },
    });

    sendSuccess(res, {
      list: reviews,
      averageRating: aggregate._avg.rating ?? 0,
      pagination: {
        page,
        pageSize,
        total,
        totalPages: Math.ceil(total / pageSize),
      },
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      sendError(res, error.errors[0].message, 400, "VALIDATION_ERROR");
      return;
    }
    sendError(res, "获取评价列表失败", 500, "INTERNAL_ERROR");
  }
});

/**
 * POST /api/courses/:courseId/reviews
 * 提交评价（需要已购课程 + JWT 认证）
 * 同一用户对同一门课程只能评价一次
 */
router.post("/", authenticate, async (req: Request, res: Response) => {
  try {
    if (!req.user) {
      sendError(res, "未登录", 401, "UNAUTHORIZED");
      return;
    }

    const { courseId } = req.params;
    const parsed = createReviewSchema.parse(req.body);
    const { rating, comment } = parsed;

    // 检查课程是否存在且已发布
    const course = await prisma.course.findUnique({
      where: { id: courseId },
      select: { id: true, status: true },
    });

    if (!course || course.status !== "PUBLISHED") {
      sendError(res, "课程不存在", 404, "COURSE_NOT_FOUND");
      return;
    }

    // 检查用户是否已购买该课程
    const purchased = await hasPurchased(req.user.userId, courseId);
    if (!purchased) {
      sendError(res, "您尚未购买该课程，无法评价", 403, "NOT_PURCHASED");
      return;
    }

    // 检查是否已评价过
    const existingReview = await prisma.review.findUnique({
      where: {
        userId_courseId: {
          userId: req.user.userId,
          courseId,
        },
      },
    });

    if (existingReview) {
      sendError(res, "您已评价过该课程", 409, "ALREADY_REVIEWED");
      return;
    }

    // 创建评价
    const review = await prisma.review.create({
      data: {
        userId: req.user.userId,
        courseId,
        rating,
        comment,
      },
      include: {
        user: {
          select: {
            id: true,
            name: true,
            avatar: true,
          },
        },
      },
    });

    sendSuccess(res, review, "评价提交成功", 201);
  } catch (error) {
    if (error instanceof z.ZodError) {
      sendError(res, error.errors[0].message, 400, "VALIDATION_ERROR");
      return;
    }
    sendError(res, "提交评价失败", 500, "INTERNAL_ERROR");
  }
});

export default router;
