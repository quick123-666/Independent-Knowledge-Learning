/**
 * ==========================================
 * 知识付费平台 - 入口文件
 * 启动 Express 服务器并配置中间件
 * ==========================================
 */

import express, { Application } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import dotenv from 'dotenv';
import path from 'path';

// 加载环境变量
// 必须在其他模块之前加载，确保配置可用
dotenv.config();

// 导入配置
import { config } from './config';

// 导入中间件
import { errorHandler } from './middleware/error-handler';

// 导入路由
import apiRoutes from './routes';

/**
 * 创建 Express 应用实例
 */
const app: Application = express();

/**
 * 全局中间件配置
 */

// 安全头部设置：使用 Helmet 防止常见 Web 漏洞
// 注意：contentSecurityPolicy 会阻止视频播放，开发环境放宽限制
app.use(
  helmet({
    contentSecurityPolicy: config.nodeEnv === 'development' ? false : undefined,
    crossOriginResourcePolicy: { policy: 'cross-origin' },
  })
);

// 跨域资源共享：允许前端应用访问 API
app.use(
  cors({
    origin: config.corsOrigin, // 允许的源，生产环境应配置具体域名
    credentials: true,         // 允许携带 Cookie
  })
);

// 解析 JSON 请求体
app.use(express.json());

// 解析 URL 编码的请求体
app.use(express.urlencoded({ extended: true }));

// 托管静态文件（本地视频、图片等资源）
// 访问路径: http://localhost:3001/uploads/videos/xxx.mp4
app.use('/uploads', express.static(path.join(process.cwd(), 'public')));

/**
 * 健康检查路由
 * 用于监控和负载均衡检测
 */
app.get('/health', (_req, res) => {
  res.status(200).json({
    status: 'ok',
    message: '知识付费平台 API 服务运行正常',
    timestamp: new Date().toISOString(),
    environment: config.nodeEnv,
  });
});

/**
 * API 路由注册
 * 所有业务路由统一通过 /api 前缀挂载
 */
app.use('/api', apiRoutes);

/**
 * 404 路由处理
 * 当没有任何路由匹配时返回
 */
app.use((_req, res) => {
  res.status(404).json({
    success: false,
    message: '请求的资源不存在',
    code: 'NOT_FOUND',
  });
});

/**
 * 全局错误处理中间件
 * 必须放在所有路由之后
 */
app.use(errorHandler);

/**
 * 启动服务器
 */
app.listen(config.port, () => {
  console.log('=====================================');
  console.log('🚀 知识付费平台 API 服务已启动');
  console.log(`📡 监听端口: ${config.port}`);
  console.log(`🌍 运行环境: ${config.nodeEnv}`);
  console.log(`🔗 健康检查: http://localhost:${config.port}/health`);
  console.log('=====================================');
});

// 导出 app 实例（用于测试）
export { app };
