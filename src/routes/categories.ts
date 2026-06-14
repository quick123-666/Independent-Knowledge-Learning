import { Router, Request, Response } from "express";
import { z } from "zod";
import { prisma } from "@config/prisma";
import { sendSuccess, sendError } from "@utils/response";
import { authenticate, requireAdmin } from "@middleware/auth";

const router = Router();

// ==========================================
// Zod 输入校验 Schema
// ==========================================

/** 创建/更新分类请求体校验 */
const categorySchema = z.object({
  name: z.string().min(1, "分类名称不能为空").max(50, "分类名称不能超过 50 个字符"),
  slug: z
    .string()
    .min(1, "URL 标识不能为空")
    .max(50, "URL 标识不能超过 50 个字符")
    .regex(/^[a-z0-9-]+$/, "URL 标识只能包含小写字母、数字和连字符"),
  description: z.string().max(500, "描述不能超过 500 个字符").optional(),
  sortOrder: z.number().int().default(0),
});

// ==========================================
// 公开路由（无需认证）
// ==========================================

/**
 * GET /api/categories
 * 获取所有分类列表，按 sortOrder 升序排列
 */
router.get("/", async (_req: Request, res: Response) => {
  try {
    const categories = await prisma.category.findMany({
      orderBy: { sortOrder: "asc" },
      include: {
        _count: {
          select: { courses: true },
        },
      },
    });

    sendSuccess(res, categories);
  } catch (error) {
    sendError(res, "获取分类列表失败", 500, "INTERNAL_ERROR");
  }
});

// ==========================================
// 管理员路由（需要认证 + ADMIN 权限）
// ==========================================

/**
 * POST /api/categories
 * 创建分类（ADMIN 权限）
 */
router.post("/", authenticate, requireAdmin, async (req: Request, res: Response) => {
  try {
    const parsed = categorySchema.parse(req.body);
    const { name, slug, description, sortOrder } = parsed;

    // 检查名称是否已存在
    const existingByName = await prisma.category.findUnique({ where: { name } });
    if (existingByName) {
      sendError(res, "分类名称已被使用", 409, "NAME_EXISTS");
      return;
    }

    // 检查 slug 是否已存在
    const existingBySlug = await prisma.category.findUnique({ where: { slug } });
    if (existingBySlug) {
      sendError(res, "分类 URL 标识已被使用", 409, "SLUG_EXISTS");
      return;
    }

    const category = await prisma.category.create({
      data: {
        name,
        slug,
        description,
        sortOrder,
      },
    });

    sendSuccess(res, category, "分类创建成功", 201);
  } catch (error) {
    if (error instanceof z.ZodError) {
      sendError(res, error.errors[0].message, 400, "VALIDATION_ERROR");
      return;
    }
    sendError(res, "创建分类失败", 500, "INTERNAL_ERROR");
  }
});

/**
 * PUT /api/categories/:id
 * 更新分类（ADMIN 权限）
 */
router.put("/:id", authenticate, requireAdmin, async (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    // 检查分类是否存在
    const existingCategory = await prisma.category.findUnique({ where: { id } });
    if (!existingCategory) {
      sendError(res, "分类不存在", 404, "CATEGORY_NOT_FOUND");
      return;
    }

    const parsed = categorySchema.partial().parse(req.body);

    // 如果更新名称，检查是否冲突
    if (parsed.name && parsed.name !== existingCategory.name) {
      const nameConflict = await prisma.category.findUnique({
        where: { name: parsed.name },
      });
      if (nameConflict) {
        sendError(res, "分类名称已被使用", 409, "NAME_EXISTS");
        return;
      }
    }

    // 如果更新 slug，检查是否冲突
    if (parsed.slug && parsed.slug !== existingCategory.slug) {
      const slugConflict = await prisma.category.findUnique({
        where: { slug: parsed.slug },
      });
      if (slugConflict) {
        sendError(res, "分类 URL 标识已被使用", 409, "SLUG_EXISTS");
        return;
      }
    }

    const updatedCategory = await prisma.category.update({
      where: { id },
      data: parsed,
    });

    sendSuccess(res, updatedCategory, "分类更新成功");
  } catch (error) {
    if (error instanceof z.ZodError) {
      sendError(res, error.errors[0].message, 400, "VALIDATION_ERROR");
      return;
    }
    sendError(res, "更新分类失败", 500, "INTERNAL_ERROR");
  }
});

/**
 * DELETE /api/categories/:id
 * 删除分类（ADMIN 权限）
 * 注意：由于 Course 与 Category 关联设置了 onDelete: Restrict，
 * 若该分类下仍有课程，删除操作会被数据库拒绝。
 */
router.delete("/:id", authenticate, requireAdmin, async (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    // 检查分类是否存在
    const existingCategory = await prisma.category.findUnique({ where: { id } });
    if (!existingCategory) {
      sendError(res, "分类不存在", 404, "CATEGORY_NOT_FOUND");
      return;
    }

    await prisma.category.delete({ where: { id } });

    sendSuccess(res, null, "分类删除成功");
  } catch (error) {
    // Prisma 外键约束错误
    if (
      error &&
      typeof error === "object" &&
      "code" in error &&
      error.code === "P2003"
    ) {
      sendError(res, "该分类下仍有课程，无法删除", 409, "CATEGORY_HAS_COURSES");
      return;
    }
    sendError(res, "删除分类失败", 500, "INTERNAL_ERROR");
  }
});

export default router;
