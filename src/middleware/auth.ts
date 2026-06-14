/**
 * ==========================================
 * 知识付费平台 - JWT 认证中间件
 * 验证请求中的 Token，区分 USER 和 ADMIN 角色
 * ==========================================
 */

import { Request, Response, NextFunction } from "express";
import jwt from "jsonwebtoken";
import { config } from "../config";

/** 用户角色常量 */
const USER_ROLE = { USER: "USER", ADMIN: "ADMIN" } as const;

/**
 * JWT 载荷接口定义
 * 与生成 Token 时的数据结构保持一致
 */
interface JwtPayload {
  userId: string; // 用户唯一标识
  email: string; // 用户邮箱
  role: UserRole; // 用户角色
}

/**
 * 扩展 Express 的 Request 类型
 * 在认证通过后，将用户信息附加到请求对象上
 */
declare global {
  namespace Express {
    interface Request {
      user?: JwtPayload; // 已认证的用户信息
    }
  }
}

/**
 * 认证中间件
 * 验证请求头中的 Bearer Token
 * 如果验证通过，将用户信息附加到 req.user
 * 如果验证失败，返回 401 未授权错误
 */
export const authenticate = (
  req: Request,
  res: Response,
  next: NextFunction
): void => {
  try {
    // 1. 从请求头中获取 Authorization
    const authHeader = req.headers.authorization;

    // 2. 检查 Authorization 头是否存在
    if (!authHeader) {
      res.status(401).json({
        success: false,
        message: "未提供认证令牌，请先登录",
        code: "UNAUTHORIZED",
      });
      return;
    }

    // 3. 检查格式是否为 "Bearer <token>"
    const parts = authHeader.split(" ");
    if (parts.length !== 2 || parts[0] !== "Bearer") {
      res.status(401).json({
        success: false,
        message: "认证令牌格式错误，应为: Bearer <token>",
        code: "INVALID_TOKEN_FORMAT",
      });
      return;
    }

    const token = parts[1];

    // 4. 验证 JWT Token
    const decoded = jwt.verify(token, config.jwtSecret) as JwtPayload;

    // 5. 将解码后的用户信息附加到请求对象
    req.user = decoded;

    // 6. 继续执行后续中间件或路由处理器
    next();
  } catch (error) {
    // Token 验证失败的各种情况
    if (error instanceof jwt.TokenExpiredError) {
      res.status(401).json({
        success: false,
        message: "认证令牌已过期，请重新登录",
        code: "TOKEN_EXPIRED",
      });
      return;
    }

    if (error instanceof jwt.JsonWebTokenError) {
      res.status(401).json({
        success: false,
        message: "认证令牌无效",
        code: "INVALID_TOKEN",
      });
      return;
    }

    // 其他未知错误
    res.status(401).json({
      success: false,
      message: "认证失败",
      code: "AUTHENTICATION_FAILED",
    });
  }
};

/**
 * 管理员权限中间件
 * 在 authenticate 之后使用，确保只有 ADMIN 角色可以访问
 * 用法: router.get('/admin-only', authenticate, requireAdmin, handler)
 */
export const requireAdmin = (
  req: Request,
  res: Response,
  next: NextFunction
): void => {
  // 1. 确保已经过认证中间件
  if (!req.user) {
    res.status(401).json({
      success: false,
      message: "未认证，无法访问该资源",
      code: "UNAUTHORIZED",
    });
    return;
  }

  // 2. 检查用户角色是否为管理员
  if (req.user.role !== USER_ROLE.ADMIN) {
    res.status(403).json({
      success: false,
      message: "权限不足，需要管理员权限",
      code: "FORBIDDEN",
    });
    return;
  }

  // 3. 权限校验通过，继续执行
  next();
};

/**
 * 可选认证中间件
 * 如果提供了有效的 Token，则附加用户信息
 * 如果没有提供或 Token 无效，仍然继续执行（req.user 为 undefined）
 * 适用于部分公开、部分需要登录的接口
 */
export const optionalAuth = (
  req: Request,
  _res: Response,
  next: NextFunction
): void => {
  try {
    const authHeader = req.headers.authorization;

    if (!authHeader) {
      next();
      return;
    }

    const parts = authHeader.split(" ");
    if (parts.length !== 2 || parts[0] !== "Bearer") {
      next();
      return;
    }

    const token = parts[1];
    const decoded = jwt.verify(token, config.jwtSecret) as JwtPayload;
    req.user = decoded;
    next();
  } catch {
    // 可选认证中，任何错误都静默忽略，继续执行
    next();
  }
};
