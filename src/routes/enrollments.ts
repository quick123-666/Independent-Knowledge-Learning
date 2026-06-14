import { Router, Request, Response } from "express";
import { z } from "zod";
import { prisma } from "@config/prisma";
import { sendSuccess, sendError } from "@utils/response";
import { authenticate } from "@middleware/auth";

const router = Router();

// ==========================================
// Zod 输入校验 Schema
// ==========================================

/** 更新学习进度请求体校验 */
const updateProgressSchema = z.object({
  progress: z.number().min(0).max(100, "学习进度必须在 0-100 之间"),
});

// ==========================================
// 路由定义（均需要 JWT 认证）
// ==========================================

/**
 * GET /api/enrollments
 * 获取当前用户的已购课程列表
 */
router.get("/", authenticate, async (req: Request, res: Response) => {
  try {
    if (!req.user) {
      sendError(res, "未登录", 401, "UNAUTHORIZED");
      return;
    }

    const enrollments = await prisma.enrollment.findMany({
      where: { userId: req.user.userId },
      orderBy: { createdAt: "desc" },
      include: {
        course: {
          select: {
            id: true,
            title: true,
            slug: true,
            coverImage: true,
            description: true,
            category: {
              select: { id: true, name: true },
            },
            instructor: {
              select: { id: true, name: true },
            },
          },
        },
      },
    });

    sendSuccess(res, enrollments);
  } catch (error) {
    sendError(res, "获取课程列表失败", 500, "INTERNAL_ERROR");
  }
});

/**
 * GET /api/enrollments/:courseId/progress
 * 获取指定课程的学习进度
 */
router.get("/:courseId/progress", authenticate, async (req: Request, res: Response) => {
  try {
    if (!req.user) {
      sendError(res, "未登录", 401, "UNAUTHORIZED");
      return;
    }

    const { courseId } = req.params;

    // 查询报名记录
    const enrollment = await prisma.enrollment.findUnique({
      where: {
        userId_courseId: {
          userId: req.user.userId,
          courseId,
        },
      },
      include: {
        course: {
          select: {
            id: true,
            title: true,
            slug: true,
          },
        },
      },
    });

    if (!enrollment) {
      sendError(res, "您尚未购买该课程", 404, "NOT_ENROLLED");
      return;
    }

    sendSuccess(res, {
      courseId: enrollment.courseId,
      course: enrollment.course,
      progress: enrollment.progress,
      completedAt: enrollment.completedAt,
      enrolledAt: enrollment.createdAt,
    });
  } catch (error) {
    sendError(res, "获取学习进度失败", 500, "INTERNAL_ERROR");
  }
});

/**
 * PUT /api/enrollments/:courseId/progress
 * 更新指定课程的学习进度
 * 当 progress 达到 100 时，自动记录完成时间
 */
router.put("/:courseId/progress", authenticate, async (req: Request, res: Response) => {
  try {
    if (!req.user) {
      sendError(res, "未登录", 401, "UNAUTHORIZED");
      return;
    }

    const { courseId } = req.params;
    const parsed = updateProgressSchema.parse(req.body);
    const { progress } = parsed;

    // 检查是否已报名该课程
    const existingEnrollment = await prisma.enrollment.findUnique({
      where: {
        userId_courseId: {
          userId: req.user.userId,
          courseId,
        },
      },
    });

    if (!existingEnrollment) {
      sendError(res, "您尚未购买该课程", 404, "NOT_ENROLLED");
      return;
    }

    // 更新进度，若 progress 为 100 且尚未完成，则设置 completedAt
    const updatedEnrollment = await prisma.enrollment.update({
      where: {
        userId_courseId: {
          userId: req.user.userId,
          courseId,
        },
      },
      data: {
        progress,
        completedAt: progress === 100 && !existingEnrollment.completedAt ? new Date() : undefined,
      },
      include: {
        course: {
          select: {
            id: true,
            title: true,
            slug: true,
          },
        },
      },
    });

    sendSuccess(res, updatedEnrollment, "学习进度更新成功");
  } catch (error) {
    if (error instanceof z.ZodError) {
      sendError(res, error.errors[0].message, 400, "VALIDATION_ERROR");
      return;
    }
    sendError(res, "更新学习进度失败", 500, "INTERNAL_ERROR");
  }
});

export default router;
