import { Router, Request, Response } from "express";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { z } from "zod";
import { prisma } from '../config/prisma';
import { sendSuccess, sendError } from '../utils/response';
import { authenticate } from '../middleware/auth';
import { config } from '../config';

const router = Router();

// ==========================================
// Zod 输入校验 Schema
// ==========================================

/** 用户注册请求体校验 */
const registerSchema = z.object({
  email: z.string().email("邮箱格式不正确"),
  password: z.string().min(6, "密码长度至少为 6 位"),
  name: z.string().min(1, "昵称不能为空").max(50, "昵称长度不能超过 50 个字符"),
});

/** 用户登录请求体校验 */
const loginSchema = z.object({
  email: z.string().email("邮箱格式不正确"),
  password: z.string().min(1, "密码不能为空"),
});

/** 更新用户信息请求体校验 */
const updateProfileSchema = z.object({
  name: z.string().min(1, "昵称不能为空").max(50, "昵称长度不能超过 50 个字符").optional(),
  avatar: z.string().url("头像 URL 格式不正确").optional().nullable(),
  email: z.string().email("邮箱格式不正确").optional(),
});

// ==========================================
// 辅助函数
// ==========================================

/**
 * 生成 JWT Token
 * @param userId 用户 ID
 * @param email 用户邮箱
 * @param role 用户角色
 * @returns JWT 字符串
 */
function generateToken(userId: string, email: string, role: string): string {
  return jwt.sign({ userId, email, role }, config.jwtSecret, { expiresIn: config.jwtExpiresIn });
}

// ==========================================
// 路由定义
// ==========================================

/**
 * POST /api/auth/register
 * 用户注册：校验输入 -> bcrypt 加密密码 -> 创建用户 -> 返回 JWT
 */
router.post("/register", async (req: Request, res: Response) => {
  try {
    const parsed = registerSchema.parse(req.body);
    const { email, password, name } = parsed;

    // 检查邮箱是否已被注册
    const existingUser = await prisma.user.findUnique({
      where: { email },
    });

    if (existingUser) {
      sendError(res, "该邮箱已被注册", 409, "EMAIL_EXISTS");
      return;
    }

    // bcrypt 加密密码（salt rounds = 10）
    const hashedPassword = await bcrypt.hash(password, 10);

    // 创建用户
    const user = await prisma.user.create({
      data: {
        email,
        password: hashedPassword,
        name,
      },
      select: {
        id: true,
        email: true,
        name: true,
        avatar: true,
        role: true,
        createdAt: true,
      },
    });

    // 生成 JWT
    const token = generateToken(user.id, user.email, user.role);

    sendSuccess(
      res,
      { user, token },
      "注册成功",
      201
    );
  } catch (error) {
    if (error instanceof z.ZodError) {
      sendError(res, error.errors[0].message, 400, "VALIDATION_ERROR");
      return;
    }
    sendError(res, "注册失败，请稍后重试", 500, "INTERNAL_ERROR");
  }
});

/**
 * POST /api/auth/login
 * 用户登录：校验输入 -> 查找用户 -> bcrypt 比对密码 -> 返回 JWT
 */
router.post("/login", async (req: Request, res: Response) => {
  try {
    const parsed = loginSchema.parse(req.body);
    const { email, password } = parsed;

    // 查找用户
    const user = await prisma.user.findUnique({
      where: { email },
    });

    if (!user) {
      sendError(res, "邮箱或密码错误", 401, "INVALID_CREDENTIALS");
      return;
    }

    // 比对密码
    const isPasswordValid = await bcrypt.compare(password, user.password);

    if (!isPasswordValid) {
      sendError(res, "邮箱或密码错误", 401, "INVALID_CREDENTIALS");
      return;
    }

    // 生成 JWT
    const token = generateToken(user.id, user.email, user.role);

    // 返回用户信息（排除 password 字段）
    const { password: _, ...userWithoutPassword } = user;

    sendSuccess(res, { user: userWithoutPassword, token }, "登录成功");
  } catch (error) {
    if (error instanceof z.ZodError) {
      sendError(res, error.errors[0].message, 400, "VALIDATION_ERROR");
      return;
    }
    sendError(res, "登录失败，请稍后重试", 500, "INTERNAL_ERROR");
  }
});

/**
 * GET /api/auth/me
 * 获取当前用户信息：需要 JWT 认证
 */
router.get("/me", authenticate, async (req: Request, res: Response) => {
  try {
    // req.user 由 authenticate 中间件注入
    if (!req.user) {
      sendError(res, "未登录", 401, "UNAUTHORIZED");
      return;
    }

    // 重新查询以获取最新数据
    const user = await prisma.user.findUnique({
      where: { id: req.user.userId },
      select: {
        id: true,
        email: true,
        name: true,
        avatar: true,
        role: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    if (!user) {
      sendError(res, "用户不存在", 404, "USER_NOT_FOUND");
      return;
    }

    sendSuccess(res, { user });
  } catch (error) {
    sendError(res, "获取用户信息失败", 500, "INTERNAL_ERROR");
  }
});

/**
 * PUT /api/auth/profile
 * 更新用户信息：需要 JWT 认证
 */
router.put("/profile", authenticate, async (req: Request, res: Response) => {
  try {
    if (!req.user) {
      sendError(res, "未登录", 401, "UNAUTHORIZED");
      return;
    }

    const parsed = updateProfileSchema.parse(req.body);

    // 更新用户信息
    const updatedUser = await prisma.user.update({
      where: { id: req.user.userId },
      data: parsed,
      select: {
        id: true,
        email: true,
        name: true,
        avatar: true,
        role: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    sendSuccess(res, updatedUser, "个人信息更新成功");
  } catch (error) {
    if (error instanceof z.ZodError) {
      sendError(res, error.errors[0].message, 400, "VALIDATION_ERROR");
      return;
    }
    sendError(res, "更新失败，请稍后重试", 500, "INTERNAL_ERROR");
  }
});

/**
 * POST /api/auth/change-password
 * 修改密码：需要 JWT 认证
 */
router.post("/change-password", authenticate, async (req: Request, res: Response) => {
  try {
    if (!req.user) {
      sendError(res, "未登录", 401, "UNAUTHORIZED");
      return;
    }

    const { oldPassword, newPassword } = req.body;

    if (!oldPassword || !newPassword) {
      sendError(res, "请填写当前密码和新密码", 400, "MISSING_PASSWORD");
      return;
    }

    if (newPassword.length < 6) {
      sendError(res, "新密码长度不能少于6位", 400, "PASSWORD_TOO_SHORT");
      return;
    }

    // 查询用户
    const user = await prisma.user.findUnique({
      where: { id: req.user.userId },
    });

    if (!user) {
      sendError(res, "用户不存在", 404, "USER_NOT_FOUND");
      return;
    }

    // 验证旧密码
    const bcrypt = await import('bcrypt');
    const isMatch = await bcrypt.compare(oldPassword, user.password);

    if (!isMatch) {
      sendError(res, "当前密码不正确", 400, "INVALID_OLD_PASSWORD");
      return;
    }

    // 加密新密码
    const hashedPassword = await bcrypt.hash(newPassword, 10);

    await prisma.user.update({
      where: { id: req.user.userId },
      data: { password: hashedPassword },
    });

    sendSuccess(res, null, "密码修改成功");
  } catch (error) {
    console.error("修改密码接口异常:", error);
    sendError(res, "修改密码失败，请稍后重试", 500, "INTERNAL_ERROR");
  }
});

export default router;
