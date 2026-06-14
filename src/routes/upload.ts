/**
 * 通用上传路由模块
 * 提供用户头像上传、邮箱验证码等功能
 * 不需要 ADMIN 权限
 */

import { Router, Request, Response } from 'express';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import { sendSuccess, sendError } from '../utils/response';
import { authenticate } from '../middleware/auth';

// 初始化路由器
const router = Router();

// ==========================================
// 文件上传配置
// ==========================================

/** 上传根目录 */
const UPLOAD_ROOT = path.join(process.cwd(), 'public');
/** 确保上传根目录存在 */
if (!fs.existsSync(UPLOAD_ROOT)) {
  fs.mkdirSync(UPLOAD_ROOT, { recursive: true });
}

/** 图片子目录 */
const UPLOAD_IMAGES = path.join(UPLOAD_ROOT, 'images');
if (!fs.existsSync(UPLOAD_IMAGES)) fs.mkdirSync(UPLOAD_IMAGES, { recursive: true });

/** Multer 存储配置 */
const storage = multer.diskStorage({
  destination: (_req, file, cb) => {
    cb(null, UPLOAD_IMAGES);
  },
  filename: (_req, file, cb) => {
    const ext = path.extname(file.originalname);
    const uniqueName = `${Date.now()}-${Math.random().toString(36).substring(2, 10)}${ext}`;
    cb(null, uniqueName);
  },
});

/** 文件过滤器：只允许图片 */
const fileFilter = (_req: Request, file: Express.Multer.File, cb: multer.FileFilterCallback) => {
  const allowedTypes = [
    'image/jpeg', 'image/jpg', 'image/png', 'image/gif', 'image/webp', 'image/svg+xml',
  ];
  if (allowedTypes.includes(file.mimetype)) {
    cb(null, true);
  } else {
    cb(new Error('只允许上传 JPG/PNG/GIF/WebP/SVG 图片'));
  }
};

/** Multer 上传实例 */
const upload = multer({
  storage,
  fileFilter,
  limits: {
    fileSize: 10 * 1024 * 1024, // 最大 10MB
  },
});

// ==========================================
// POST /api/upload/avatar — 上传头像
// ==========================================
router.post('/avatar', authenticate, upload.single('file'), (req: Request, res: Response) => {
  try {
    if (!req.file) {
      sendError(res, '未找到上传的文件', 400, 'FILE_NOT_FOUND');
      return;
    }

    const fileUrl = `/uploads/images/${req.file.filename}`;

    sendSuccess(res, {
      url: fileUrl,
      originalName: req.file.originalname,
      size: req.file.size,
    }, '头像上传成功');
  } catch (error) {
    console.error('头像上传异常:', error);
    sendError(res, '头像上传失败', 500, 'UPLOAD_ERROR');
  }
});

export default router;
