/**
 * ==========================================
 * 知识付费平台 - 全局错误处理中间件
 * 统一捕获和处理应用中的所有错误
 * ==========================================
 */

import { Request, Response, NextFunction } from 'express';
import { config } from '../config';

/**
 * 自定义应用错误类
 * 用于区分业务逻辑错误和系统错误
 * 业务错误可以设置状态码和错误码，便于前端处理
 */
export class AppError extends Error {
  public readonly statusCode: number;   // HTTP 状态码
  public readonly code: string;         // 业务错误码
  public readonly isOperational: boolean; // 是否为可预期的业务错误

  constructor(
    message: string,
    statusCode: number = 500,
    code: string = 'INTERNAL_ERROR'
  ) {
    super(message);
    this.statusCode = statusCode;
    this.code = code;
    this.isOperational = true; // 标记为业务错误

    // 修复原型链，确保 instanceof 正常工作
    Object.setPrototypeOf(this, AppError.prototype);

    // 捕获堆栈跟踪（排除构造函数本身）
    Error.captureStackTrace(this, this.constructor);
  }
}

/**
 * 404 资源未找到错误
 * 当查询的资源不存在时抛出
 */
export class NotFoundError extends AppError {
  constructor(message: string = '请求的资源不存在') {
    super(message, 404, 'NOT_FOUND');
  }
}

/**
 * 400 请求参数错误
 * 当请求参数校验失败时抛出
 */
export class BadRequestError extends AppError {
  constructor(message: string = '请求参数错误') {
    super(message, 400, 'BAD_REQUEST');
  }
}

/**
 * 401 未授权错误
 * 当用户未登录或 Token 无效时抛出
 */
export class UnauthorizedError extends AppError {
  constructor(message: string = '未授权，请先登录') {
    super(message, 401, 'UNAUTHORIZED');
  }
}

/**
 * 403 权限不足错误
 * 当用户没有权限访问资源时抛出
 */
export class ForbiddenError extends AppError {
  constructor(message: string = '权限不足') {
    super(message, 403, 'FORBIDDEN');
  }
}

/**
 * 409 资源冲突错误
 * 当数据唯一性约束冲突时抛出
 */
export class ConflictError extends AppError {
  constructor(message: string = '资源已存在') {
    super(message, 409, 'CONFLICT');
  }
}

/**
 * 全局错误处理中间件
 * Express 四参数中间件，捕获所有路由中抛出的错误
 *
 * 错误响应格式：
 * {
 *   success: false,
 *   message: "错误描述",
 *   code: "ERROR_CODE",
 *   stack?: "堆栈信息（仅开发环境）"
 * }
 */
export const errorHandler = (
  err: Error,
  _req: Request,
  res: Response,
  _next: NextFunction
): void => {
  // 默认错误信息
  let statusCode = 500;
  let message = '服务器内部错误';
  let code = 'INTERNAL_ERROR';
  let stack: string | undefined;

  // 处理自定义应用错误
  if (err instanceof AppError) {
    statusCode = err.statusCode;
    message = err.message;
    code = err.code;
  }
  // 处理 Prisma 唯一约束冲突错误（P2002）
  else if (err.name === 'PrismaClientKnownRequestError') {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const prismaError = err as any;
    if (prismaError.code === 'P2002') {
      statusCode = 409;
      message = '数据已存在，请检查唯一字段';
      code = 'UNIQUE_CONSTRAINT_VIOLATION';
    } else if (prismaError.code === 'P2025') {
      statusCode = 404;
      message = '记录不存在';
      code = 'RECORD_NOT_FOUND';
    } else if (prismaError.code === 'P2003') {
      statusCode = 400;
      message = '外键约束失败';
      code = 'FOREIGN_KEY_CONSTRAINT';
    }
  }
  // 处理 JWT 错误
  else if (err.name === 'JsonWebTokenError') {
    statusCode = 401;
    message = '无效的认证令牌';
    code = 'INVALID_TOKEN';
  } else if (err.name === 'TokenExpiredError') {
    statusCode = 401;
    message = '认证令牌已过期';
    code = 'TOKEN_EXPIRED';
  }
  // 处理语法错误（如 JSON 解析失败）
  else if (err instanceof SyntaxError && 'body' in err) {
    statusCode = 400;
    message = '请求体 JSON 格式错误';
    code = 'INVALID_JSON';
  }

  // 开发环境显示详细堆栈信息
  if (config.isDevelopment) {
    stack = err.stack;
  }

  // 记录错误日志（生产环境可使用 Winston 等日志库）
  if (statusCode >= 500) {
    console.error('❌ 服务器错误:', err);
  } else {
    console.warn('⚠️ 业务错误:', { message: err.message, code, statusCode });
  }

  // 构造错误响应
  const errorResponse: Record<string, unknown> = {
    success: false,
    message,
    code,
  };

  // 开发环境附加堆栈信息
  if (stack) {
    errorResponse.stack = stack;
  }

  res.status(statusCode).json(errorResponse);
};

/**
 * 异步路由处理器包装器
 * 用于捕获异步函数中的错误并传递给错误处理中间件
 * 用法: router.get('/', asyncHandler(async (req, res) => { ... }))
 */
export const asyncHandler = (
  fn: (req: Request, res: Response, next: NextFunction) => Promise<unknown>
) => {
  return (req: Request, res: Response, next: NextFunction): void => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
};
