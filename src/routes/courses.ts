import { Router, Request, Response } from "express";
import { z } from "zod";
import { prisma } from "@config/prisma";
import { sendSuccess, sendError } from "@utils/response";
import { authenticate, requireAdmin } from "@middleware/auth";

const router = Router();

// ==========================================
// Zod 输入校验 Schema
// ==========================================

/** 创建/更新课程请求体校验 */
const courseSchema = z.object({
  title: z.string().min(1, "课程标题不能为空").max(200, "课程标题不能超过 200 个字符"),
  slug: z
    .string()
    .min(1, "URL 标识不能为空")
    .max(100, "URL 标识不能超过 100 个字符")
    .regex(/^[a-z0-9-]+$/, "URL 标识只能包含小写字母、数字和连字符"),
  description: z.string().optional(),
  coverImage: z.string().url("封面图 URL 格式不正确").optional().or(z.literal("")),
  price: z.number().min(0, "售价不能为负数").default(0),
  originalPrice: z.number().min(0, "原价不能为负数").optional(),
  status: z.enum(["DRAFT", "PUBLISHED", "ARCHIVED"]).optional(),
  categoryId: z.string().uuid("分类 ID 格式不正确"),
});

/** 查询参数校验（分页、筛选、搜索、排序） */
const listQuerySchema = z.object({
  page: z.coerce.number().min(1).default(1),
  pageSize: z.coerce.number().min(1).max(100).default(10),
  categoryId: z.string().optional(),
  keyword: z.string().optional(),
  sortBy: z.enum(["createdAt", "price", "title"]).default("createdAt"),
  sortOrder: z.enum(["asc", "desc"]).default("desc"),
});

// ==========================================
// 辅助函数
// ==========================================

/**
 * 检查当前用户是否已购买指定课程
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
// 公开路由（无需认证）
// ==========================================

/**
 * GET /api/courses
 * 获取课程列表：支持分页、按分类筛选、搜索关键词、排序
 */
router.get("/", async (req: Request, res: Response) => {
  try {
    const query = listQuerySchema.parse(req.query);
    const { page, pageSize, categoryId, keyword, sortBy, sortOrder } = query;

    // 构建 where 条件
    const where: Record<string, unknown> = {
      status: "PUBLISHED", // 公开列表只展示已发布课程
    };

    if (categoryId) {
      where.categoryId = categoryId;
    }

    if (keyword) {
      where.OR = [
        { title: { contains: keyword, mode: "insensitive" } },
        { description: { contains: keyword, mode: "insensitive" } },
      ];
    }

    // 查询总数
    const total = await prisma.course.count({ where });

    // 查询课程列表
    const courses = await prisma.course.findMany({
      where,
      skip: (page - 1) * pageSize,
      take: pageSize,
      orderBy: { [sortBy]: sortOrder },
      include: {
        category: {
          select: { id: true, name: true, slug: true },
        },
        instructor: {
          select: { id: true, name: true, avatar: true },
        },
        _count: {
          select: { chapters: true, enrollments: true, reviews: true },
        },
      },
    });

    // 查询每个课程的平均评分
    const courseIds = courses.map((c) => c.id);
    const avgRatings = await prisma.review.groupBy({
      by: ["courseId"],
      where: { courseId: { in: courseIds } },
      _avg: { rating: true },
    });

    const ratingMap = new Map(avgRatings.map((r) => [r.courseId, r._avg.rating ?? 0]));

    const coursesWithRating = courses.map((course) => ({
      ...course,
      averageRating: ratingMap.get(course.id) ?? 0,
    }));

    sendSuccess(res, {
      list: coursesWithRating,
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
    sendError(res, "获取课程列表失败", 500, "INTERNAL_ERROR");
  }
});

/**
 * GET /api/courses/:slug/chapters
 * 获取课程章节列表（必须在 /:slug 之前注册）
 */
router.get("/:slug/chapters", async (req: Request, res: Response) => {
  try {
    const { slug } = req.params;

    const course = await prisma.course.findFirst({
      where: { OR: [{ slug }, { id: slug }] },
      select: { id: true, status: true },
    });

    if (!course || course.status !== "PUBLISHED") {
      sendError(res, "课程不存在", 404, "COURSE_NOT_FOUND");
      return;
    }

    const chapters = await prisma.chapter.findMany({
      where: { courseId: course.id },
      orderBy: { sortOrder: "asc" },
      include: {
        contentBlocks: {
          orderBy: { sortOrder: "asc" },
          select: {
            id: true,
            type: true,
            title: true,
            content: true,
            url: true,
            duration: true,
            sortOrder: true,
          },
        },
        _count: {
          select: { contentBlocks: true },
        },
      },
    });

    sendSuccess(res, chapters);
  } catch (error) {
    sendError(res, "获取章节列表失败", 500, "INTERNAL_ERROR");
  }
});

/**
 * GET /api/courses/:slug/chapters/:chapterId
 * 获取单个章节内容
 * 已购用户可访问完整内容，未购用户只能访问 isFree=true 的章节
 */
router.get("/:slug/chapters/:chapterId", authenticate, async (req: Request, res: Response) => {
  try {
    const { slug, chapterId } = req.params;

    // 查询课程
    const course = await prisma.course.findFirst({
      where: { OR: [{ slug }, { id: slug }] },
      select: { id: true, status: true },
    });

    if (!course || course.status !== "PUBLISHED") {
      sendError(res, "课程不存在", 404, "COURSE_NOT_FOUND");
      return;
    }

    // 查询章节（包含内容块）
    const chapter = await prisma.chapter.findFirst({
      where: { id: chapterId, courseId: course.id },
      include: {
        contentBlocks: {
          orderBy: { sortOrder: "asc" },
        },
      },
    });

    if (!chapter) {
      sendError(res, "章节不存在", 404, "CHAPTER_NOT_FOUND");
      return;
    }

    // 判断用户是否已购买该课程
    const userId = req.user?.userId;
    const purchased = userId ? await hasPurchased(userId, course.id) : false;

    // 未购买且章节不免费，则拒绝访问
    if (!purchased && !chapter.isFree) {
      sendError(res, "该章节为付费内容，请先购买课程", 403, "CONTENT_LOCKED");
      return;
    }

    sendSuccess(res, chapter);
  } catch (error) {
    sendError(res, "获取章节内容失败", 500, "INTERNAL_ERROR");
  }
});

/**
 * GET /api/courses/:slug
 * 获取课程详情（包含章节列表）
 * 注意：这个路由必须放在所有 /:slug/xxx 路由之后
 */
router.get("/:slug", async (req: Request, res: Response) => {
  try {
    const { slug } = req.params;

    // 同时支持 id 和 slug 查找
    const course = await prisma.course.findFirst({
      where: {
        OR: [
          { slug },
          { id: slug },
        ],
      },
      include: {
        category: {
          select: { id: true, name: true, slug: true },
        },
        instructor: {
          select: { id: true, name: true, avatar: true },
        },
        chapters: {
          orderBy: { sortOrder: "asc" },
          include: {
            contentBlocks: {
              orderBy: { sortOrder: "asc" },
              select: {
                id: true,
                type: true,
                title: true,
                content: true,
                url: true,
                duration: true,
                sortOrder: true,
              },
            },
            _count: {
              select: { contentBlocks: true },
            },
          },
        },
        _count: {
          select: { enrollments: true, reviews: true },
        },
      },
    });

    if (!course) {
      sendError(res, "课程不存在", 404, "COURSE_NOT_FOUND");
      return;
    }

    // 未发布课程仅管理员可见
    if (course.status !== "PUBLISHED") {
      sendError(res, "课程不存在", 404, "COURSE_NOT_FOUND");
      return;
    }

    // 查询课程平均评分
    const aggregate = await prisma.review.aggregate({
      where: { courseId: course.id },
      _avg: { rating: true },
    });

    sendSuccess(res, {
      ...course,
      averageRating: aggregate._avg.rating ?? 0,
    });
  } catch (error) {
    sendError(res, "获取课程详情失败", 500, "INTERNAL_ERROR");
  }
});

// ==========================================
// 管理员路由（需要认证 + ADMIN 权限）
// ==========================================

/**
 * POST /api/courses
 * 创建课程（ADMIN 权限）
 */
router.post("/", authenticate, requireAdmin, async (req: Request, res: Response) => {
  try {
    const parsed = courseSchema.parse(req.body);
    const { title, slug, description, coverImage, price, originalPrice, status, categoryId } =
      parsed;

    // 检查 slug 是否已存在
    const existing = await prisma.course.findUnique({ where: { slug } });
    if (existing) {
      sendError(res, "课程 URL 标识已被使用", 409, "SLUG_EXISTS");
      return;
    }

    // 检查分类是否存在
    const category = await prisma.category.findUnique({ where: { id: categoryId } });
    if (!category) {
      sendError(res, "分类不存在", 400, "CATEGORY_NOT_FOUND");
      return;
    }

    // 创建课程
    const course = await prisma.course.create({
      data: {
        title,
        slug,
        description,
        coverImage: coverImage || null,
        price,
        originalPrice: originalPrice || null,
        status: status || "DRAFT",
        categoryId,
        instructorId: req.user!.userId,
      },
      include: {
        category: { select: { id: true, name: true } },
        instructor: { select: { id: true, name: true } },
      },
    });

    sendSuccess(res, course, "课程创建成功", 201);
  } catch (error) {
    if (error instanceof z.ZodError) {
      sendError(res, error.errors[0].message, 400, "VALIDATION_ERROR");
      return;
    }
    sendError(res, "创建课程失败", 500, "INTERNAL_ERROR");
  }
});

/**
 * PUT /api/courses/:id
 * 更新课程（ADMIN 权限）
 */
router.put("/:id", authenticate, requireAdmin, async (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    // 检查课程是否存在
    const existingCourse = await prisma.course.findUnique({ where: { id } });
    if (!existingCourse) {
      sendError(res, "课程不存在", 404, "COURSE_NOT_FOUND");
      return;
    }

    const parsed = courseSchema.partial().parse(req.body);

    // 如果更新 slug，检查是否冲突
    if (parsed.slug && parsed.slug !== existingCourse.slug) {
      const slugConflict = await prisma.course.findUnique({ where: { slug: parsed.slug } });
      if (slugConflict) {
        sendError(res, "课程 URL 标识已被使用", 409, "SLUG_EXISTS");
        return;
      }
    }

    // 如果更新分类，检查分类是否存在
    if (parsed.categoryId) {
      const category = await prisma.category.findUnique({ where: { id: parsed.categoryId } });
      if (!category) {
        sendError(res, "分类不存在", 400, "CATEGORY_NOT_FOUND");
        return;
      }
    }

    const updatedCourse = await prisma.course.update({
      where: { id },
      data: parsed,
      include: {
        category: { select: { id: true, name: true } },
        instructor: { select: { id: true, name: true } },
      },
    });

    sendSuccess(res, updatedCourse, "课程更新成功");
  } catch (error) {
    if (error instanceof z.ZodError) {
      sendError(res, error.errors[0].message, 400, "VALIDATION_ERROR");
      return;
    }
    sendError(res, "更新课程失败", 500, "INTERNAL_ERROR");
  }
});

/**
 * DELETE /api/courses/:id
 * 删除课程（ADMIN 权限）
 */
router.delete("/:id", authenticate, requireAdmin, async (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    // 检查课程是否存在
    const existingCourse = await prisma.course.findUnique({ where: { id } });
    if (!existingCourse) {
      sendError(res, "课程不存在", 404, "COURSE_NOT_FOUND");
      return;
    }

    await prisma.course.delete({ where: { id } });

    sendSuccess(res, null, "课程删除成功");
  } catch (error) {
    sendError(res, "删除课程失败", 500, "INTERNAL_ERROR");
  }
});

export default router;
