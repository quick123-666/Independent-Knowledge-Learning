/**
 * ==========================================
 * 知识付费平台 - 统一响应格式工具
 * 规范所有 API 接口的返回数据结构
 * ==========================================
 */

import { Response } from "express";

/**
 * 统一成功响应接口
 * @template T 响应数据的类型
 */
export interface SuccessResponse<T = unknown> {
  success: true; // 标识请求成功
  data: T; // 响应数据
  message?: string; // 可选的提示信息
  meta?: ResponseMeta; // 可选的分页元数据
}

/**
 * 统一失败响应接口
 */
export interface ErrorResponse {
  success: false; // 标识请求失败
  message: string; // 错误描述
  code: string; // 业务错误码
  details?: unknown; // 可选的详细错误信息
}

/**
 * 分页元数据接口
 * 用于列表接口返回分页信息
 */
export interface ResponseMeta {
  page: number; // 当前页码
  pageSize: number; // 每页数量
  total: number; // 总记录数
  totalPages: number; // 总页数
  hasNext: boolean; // 是否有下一页
  hasPrev: boolean; // 是否有上一页
}

/**
 * 发送成功响应
 * 所有成功的 API 接口应使用此函数直接发送响应
 *
 * @param res - Express Response 对象
 * @param data - 响应数据
 * @param message - 可选的成功提示信息
 * @param statusCode - HTTP 状态码，默认 200
 *
 * 示例：
 * sendSuccess(res, { id: 1, name: '张三' }, '创建成功', 201)
 */
export function sendSuccess<T>(
  res: Response,
  data: T,
  message?: string,
  statusCode: number = 200
): void {
  const response: SuccessResponse<T> = {
    success: true,
    data,
  };

  if (message) {
    response.message = message;
  }

  res.status(statusCode).json(response);
}

/**
 * 发送带分页的成功响应
 * 用于列表查询接口，自动计算分页信息
 *
 * @param res - Express Response 对象
 * @param data - 当前页数据列表
 * @param total - 总记录数
 * @param page - 当前页码
 * @param pageSize - 每页数量
 * @param message - 可选的提示信息
 *
 * 示例：
 * sendSuccessPaginated(res, courses, 100, 1, 10)
 */
export function sendSuccessPaginated<T>(
  res: Response,
  data: T[],
  total: number,
  page: number,
  pageSize: number,
  message?: string
): void {
  const totalPages = Math.ceil(total / pageSize);

  const meta: ResponseMeta = {
    page,
    pageSize,
    total,
    totalPages,
    hasNext: page < totalPages,
    hasPrev: page > 1,
  };

  const response: SuccessResponse<T[]> = {
    success: true,
    data,
    meta,
  };

  if (message) {
    response.message = message;
  }

  res.status(200).json(response);
}

/**
 * 发送失败响应
 * 所有失败的 API 接口应使用此函数直接发送响应
 *
 * @param res - Express Response 对象
 * @param message - 错误描述
 * @param statusCode - HTTP 状态码，默认 400
 * @param code - 业务错误码
 * @param details - 可选的详细错误信息
 *
 * 示例：
 * sendError(res, '参数校验失败', 400, 'VALIDATION_ERROR', errors)
 */
export function sendError(
  res: Response,
  message: string,
  statusCode: number = 400,
  code: string = "INTERNAL_ERROR",
  details?: unknown
): void {
  const response: ErrorResponse = {
    success: false,
    message,
    code,
  };

  if (details !== undefined) {
    response.details = details;
  }

  res.status(statusCode).json(response);
}

// ==========================================
// 兼容旧版响应工具（返回对象，不直接发送）
// ==========================================

/**
 * 创建成功响应对象
 * @param data - 响应数据
 * @param message - 可选的成功提示信息
 * @returns 规范化的成功响应对象
 */
export function success<T>(data: T, message?: string): SuccessResponse<T> {
  const response: SuccessResponse<T> = {
    success: true,
    data,
  };

  if (message) {
    response.message = message;
  }

  return response;
}

/**
 * 创建带分页的成功响应对象
 * @param data - 当前页数据列表
 * @param total - 总记录数
 * @param page - 当前页码
 * @param pageSize - 每页数量
 * @param message - 可选的提示信息
 * @returns 带分页元数据的成功响应对象
 */
export function successPaginated<T>(
  data: T[],
  total: number,
  page: number,
  pageSize: number,
  message?: string
): SuccessResponse<T[]> {
  const totalPages = Math.ceil(total / pageSize);

  const meta: ResponseMeta = {
    page,
    pageSize,
    total,
    totalPages,
    hasNext: page < totalPages,
    hasPrev: page > 1,
  };

  const response: SuccessResponse<T[]> = {
    success: true,
    data,
    meta,
  };

  if (message) {
    response.message = message;
  }

  return response;
}

/**
 * 创建失败响应对象
 * @param message - 错误描述
 * @param code - 业务错误码
 * @param details - 可选的详细错误信息
 * @returns 规范化的失败响应对象
 */
export function error(
  message: string,
  code: string = "INTERNAL_ERROR",
  details?: unknown
): ErrorResponse {
  const response: ErrorResponse = {
    success: false,
    message,
    code,
  };

  if (details !== undefined) {
    response.details = details;
  }

  return response;
}

/**
 * 创建字段校验错误响应对象
 * @param fieldErrors - 字段错误映射
 * @returns 规范化的校验错误响应对象
 */
export function validationError(
  fieldErrors: Record<string, string>
): ErrorResponse {
  return error("请求参数校验失败", "VALIDATION_ERROR", fieldErrors);
}

/**
 * 创建未找到资源响应对象
 * @param resource - 资源名称
 * @returns 规范化的未找到响应对象
 */
export function notFoundError(resource: string = "资源"): ErrorResponse {
  return error(`${resource}不存在`, "NOT_FOUND");
}

/**
 * 创建无权限响应对象
 * @param message - 可选的自定义提示
 * @returns 规范化的无权限响应对象
 */
export function forbiddenError(
  message: string = "权限不足，无法执行该操作"
): ErrorResponse {
  return error(message, "FORBIDDEN");
}
