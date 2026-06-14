declare global {
  namespace Express {
    interface Request {
      /** 当前登录用户信息（由 JWT 认证中间件注入） */
      user?: {
        userId: string;
        email: string;
        role: string;
      };
    }
  }
}

export {};
