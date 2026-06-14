/**
 * ==========================================
 * 知识付费平台 - 类型定义模块
 * 定义全局类型、接口和类型辅助工具
 * ==========================================
 */

import { Request } from 'express';

// ==========================================
// 认证相关类型
// ==========================================

/** 用户角色类型 */
export type UserRole = 'USER' | 'ADMIN';

/**
 * 已认证用户信息
 * 从 JWT Token 中解码出的用户数据
 * 通过认证中间件附加到 Request 对象上
 */
export interface AuthenticatedUser {
  userId: string;    // 用户唯一标识（UUID）
  email: string;     // 用户邮箱地址
  role: UserRole;    // 用户角色（USER / ADMIN）
}

/**
 * 扩展 Express Request 类型声明
 * 在认证通过后，req.user 将包含已认证用户信息
 *
 * 注意：此声明与 src/middleware/auth.ts 中的 declare global 保持一致
 * 确保 TypeScript 编译器能正确识别 req.user 属性
 */
declare global {
  namespace Express {
    interface Request {
      /**
       * 已认证的用户信息
       * 仅在通过 authenticate 中间件后存在
       */
      user?: AuthenticatedUser;
    }
  }
}

// ==========================================
// API 响应相关类型
// ==========================================

/**
 * 分页查询参数
 * 用于列表接口的查询参数标准化
 */
export interface PaginationParams {
  page: number;      // 当前页码（从 1 开始）
  pageSize: number;  // 每页数量
}

/**
 * 排序查询参数
 * 用于列表接口的排序配置
 */
export interface SortParams {
  sortBy: string;    // 排序字段
  sortOrder: 'asc' | 'desc'; // 排序方向
}

/**
 * 列表查询参数
 * 组合分页和排序的通用查询参数
 */
export interface ListQueryParams extends PaginationParams, SortParams {
  search?: string;   // 可选的搜索关键词
}

// ==========================================
// 业务数据类型
// ==========================================

/**
 * 课程状态（与 Prisma 枚举保持一致，用于类型安全）
 */
export type CourseStatus = 'DRAFT' | 'PUBLISHED' | 'ARCHIVED';

/**
 * 订单状态（与 Prisma 枚举保持一致）
 */
export type OrderStatus = 'PENDING' | 'PAID' | 'CANCELLED' | 'REFUNDED';

/**
 * JWT Token 载荷
 * 生成和验证 JWT 时使用的数据结构
 */
export interface JwtPayload {
  userId: string;
  email: string;
  role: UserRole;
  iat?: number;      // 签发时间（由 jwt.sign 自动添加）
  exp?: number;      // 过期时间（由 jwt.sign 自动添加）
}

// ==========================================
// 通用工具类型
// ==========================================

/**
 * 可选部分类型
 * 将对象的所有属性变为可选
 */
export type Partial<T> = {
  [P in keyof T]?: T[P];
};

/**
 * API 处理器函数类型
 * 用于定义 Express 路由处理器的标准类型
 */
export type ApiHandler = (
  req: Request,
  res: Response,
  next: import('express').NextFunction
) => void | Promise<void>;

/**
 * 服务层函数返回类型
 * 统一服务层函数的返回结构
 */
export interface ServiceResult<T = unknown> {
  success: boolean;
  data?: T;
  error?: string;
  code?: string;
}
