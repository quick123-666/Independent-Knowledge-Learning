/**
 * ==========================================
 * 知识付费平台 - 配置管理模块
 * 集中管理所有环境变量和全局配置
 * ==========================================
 */

import { z } from 'zod';
import dotenv from 'dotenv';

// 确保环境变量在配置解析前加载
dotenv.config();

/**
 * 环境变量校验 Schema
 * 使用 Zod 进行运行时类型校验，确保必要配置存在且类型正确
 */
const envSchema = z.object({
  // 数据库连接地址（可选，SQLite 模式下由 prisma schema 直接配置）
  DATABASE_URL: z.string().optional(),

  // JWT 密钥（必填，建议至少 32 位）
  JWT_SECRET: z.string().min(1, 'JWT 密钥不能为空'),

  // JWT 过期时间（默认 7 天）
  JWT_EXPIRES_IN: z.string().default('7d'),

  // 服务器端口（默认 3000）
  PORT: z
    .string()
    .transform((val) => parseInt(val, 10))
    .default('3000'),

  // 运行环境（默认 development）
  NODE_ENV: z
    .enum(['development', 'production', 'test'])
    .default('development'),

  // Stripe 支付密钥（可选，模拟用途）
  STRIPE_SECRET_KEY: z.string().optional(),

  // 管理员邮箱（可选）
  ADMIN_EMAIL: z.string().email().optional(),

  // CORS 允许的源（默认允许所有，生产环境应限制）
  CORS_ORIGIN: z.string().default('*'),
});

/**
 * 解析并校验环境变量
 * 如果校验失败，会抛出详细错误信息
 */
const parsedEnv = envSchema.safeParse(process.env);

if (!parsedEnv.success) {
  console.error('❌ 环境变量配置错误:');
  parsedEnv.error.issues.forEach((issue) => {
    console.error(`   - ${issue.path.join('.')}: ${issue.message}`);
  });
  process.exit(1);
}

/**
 * 导出解析后的配置对象
 * 所有模块应从此处导入配置，避免直接访问 process.env
 */
export const config = {
  // 数据库
  databaseUrl: parsedEnv.data.DATABASE_URL,

  // JWT 配置
  jwtSecret: parsedEnv.data.JWT_SECRET,
  jwtExpiresIn: parsedEnv.data.JWT_EXPIRES_IN,

  // 服务器
  port: parsedEnv.data.PORT,
  nodeEnv: parsedEnv.data.NODE_ENV,

  // 支付
  stripeSecretKey: parsedEnv.data.STRIPE_SECRET_KEY,

  // 管理员
  adminEmail: parsedEnv.data.ADMIN_EMAIL,

  // CORS
  corsOrigin: parsedEnv.data.CORS_ORIGIN,

  // 便捷判断
  isDevelopment: parsedEnv.data.NODE_ENV === 'development',
  isProduction: parsedEnv.data.NODE_ENV === 'production',
  isTest: parsedEnv.data.NODE_ENV === 'test',
} as const;

/**
 * 配置类型导出
 * 用于 TypeScript 类型推断
 */
export type Config = typeof config;
