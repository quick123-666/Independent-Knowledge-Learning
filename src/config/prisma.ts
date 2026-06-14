import { PrismaClient } from "@prisma/client";

/**
 * Prisma Client 单例
 * 全局复用，避免开发环境下热重载时创建多个实例
 */
const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

export const prisma = globalForPrisma.prisma ?? new PrismaClient();

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma;
}
