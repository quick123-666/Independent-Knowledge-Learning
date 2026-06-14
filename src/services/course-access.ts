/**
 * 课程访问控制服务模块
 * 提供课程购买检查、章节访问权限控制、可访问内容获取等功能
 */

import { PrismaClient, Course, Chapter } from '@prisma/client';

/** 服务层统一返回结构 */
interface ServiceResult<T = unknown> {
  success: boolean;
  data?: T;
  message?: string;
}

/** 服务层错误返回 */
function fail(message: string): ServiceResult {
  return { success: false, message };
}

/** 服务层成功返回 */
function ok<T>(data: T, message?: string): ServiceResult<T> {
  return { success: true, data, message };
}

/**
 * 可访问内容结构
 */
export interface AccessibleContent {
  course: Course;
  chapters: Chapter[];
  progress?: {
    completedChapters: string[];
    totalChapters: number;
    completedCount: number;
  };
}

/**
 * 课程访问控制服务类
 * 封装课程权限检查、访问控制等核心业务逻辑
 */
export class CourseAccessService {
  private prisma: PrismaClient;

  constructor(prismaClient: PrismaClient) {
    this.prisma = prismaClient;
  }

  /**
   * 检查用户是否已购买指定课程
   */
  async hasPurchased(userId: string, courseId: string): Promise<boolean> {
    try {
      const enrollment = await this.prisma.enrollment.findFirst({
        where: { userId, courseId },
      });
      return !!enrollment;
    } catch (error) {
      console.error('检查购买状态失败:', error);
      return false;
    }
  }

  /**
   * 检查用户是否可以访问指定章节
   */
  async canAccessChapter(userId: string, courseId: string, chapterId: string): Promise<boolean> {
    try {
      // 检查章节是否属于该课程
      const chapter = await this.prisma.chapter.findFirst({
        where: { id: chapterId, courseId },
      });

      if (!chapter) {
        return false;
      }

      // 免费章节无需购买即可访问
      if (chapter.isFree) {
        return true;
      }

      // 非免费章节需要已购买
      return this.hasPurchased(userId, courseId);
    } catch (error) {
      console.error('检查章节访问权限失败:', error);
      return false;
    }
  }

  /**
   * 获取用户可访问的课程内容
   */
  async getAccessibleContent(userId: string, courseId: string): Promise<ServiceResult<AccessibleContent>> {
    try {
      const course = await this.prisma.course.findUnique({ where: { id: courseId } });

      if (!course) {
        return fail('课程不存在');
      }

      const chapters = await this.prisma.chapter.findMany({
        where: { courseId },
        orderBy: { sortOrder: 'asc' },
      });

      const hasAccess = await this.hasPurchased(userId, courseId);

      // 未购买：只返回免费试看章节
      if (!hasAccess) {
        const freeChapters = chapters.filter((ch) => ch.isFree);
        return ok({ course, chapters: freeChapters }, '获取成功（仅显示免费试看章节）');
      }

      // 已购买：返回全部章节
      return ok(
        {
          course,
          chapters,
          progress: {
            completedChapters: [],
            totalChapters: chapters.length,
            completedCount: 0,
          },
        },
        '获取成功'
      );
    } catch (error) {
      console.error('获取课程内容失败:', error);
      return fail('获取课程内容失败，请稍后重试');
    }
  }

  /**
   * 获取用户的所有已购课程列表
   */
  async getPurchasedCourses(userId: string): Promise<ServiceResult> {
    try {
      const enrollments = await this.prisma.enrollment.findMany({
        where: { userId },
        include: {
          course: {
            include: {
              category: { select: { id: true, name: true } },
              _count: { select: { chapters: true } },
            },
          },
        },
        orderBy: { createdAt: 'desc' },
      });

      const courses = enrollments.map((e) => ({
        enrollmentId: e.id,
        enrolledAt: e.createdAt,
        course: {
          id: e.course.id,
          title: e.course.title,
          description: e.course.description,
          coverImage: e.course.coverImage,
          category: e.course.category,
          totalChapters: e.course._count.chapters,
        },
      }));

      return ok(courses, '获取已购课程列表成功');
    } catch (error) {
      console.error('获取已购课程列表失败:', error);
      return fail('获取已购课程列表失败，请稍后重试');
    }
  }
}

export default CourseAccessService;
