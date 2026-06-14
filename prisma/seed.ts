/**
 * ==========================================
 * 知识付费平台 - Seed 数据脚本
 * 用于初始化示例分类、用户和课程数据
 * ==========================================
 */

import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function main(): Promise<void> {
  console.log('🌱 开始填充种子数据...');

  console.log('🧹 清空现有数据...');
  await prisma.review.deleteMany();
  await prisma.enrollment.deleteMany();
  await prisma.order.deleteMany();
  await prisma.contentBlock.deleteMany();
  await prisma.chapter.deleteMany();
  await prisma.course.deleteMany();
  await prisma.category.deleteMany();
  await prisma.user.deleteMany();

  console.log('📂 创建分类...');
  const categories = await Promise.all([
    prisma.category.create({ data: { name: '前端开发', slug: 'frontend', description: 'HTML、CSS、JavaScript、React、Vue 等前端技术课程', sortOrder: 1 } }),
    prisma.category.create({ data: { name: '后端开发', slug: 'backend', description: 'Node.js、Python、Java、Go 等后端技术课程', sortOrder: 2 } }),
    prisma.category.create({ data: { name: '人工智能', slug: 'ai', description: '机器学习、深度学习、大语言模型等 AI 技术课程', sortOrder: 3 } }),
    prisma.category.create({ data: { name: '产品设计', slug: 'design', description: 'UI/UX 设计、产品思维、交互设计等课程', sortOrder: 4 } }),
  ]);

  console.log('👤 创建用户...');
  const hashedPassword = await bcrypt.hash('123456', 10);
  const admin = await prisma.user.create({ data: { email: 'admin@example.com', password: hashedPassword, name: '系统管理员', avatar: 'https://api.dicebear.com/7.x/avataaars/svg?seed=admin', role: 'ADMIN' } });
  const instructor1 = await prisma.user.create({ data: { email: 'teacher1@example.com', password: hashedPassword, name: '张老师', avatar: 'https://api.dicebear.com/7.x/avataaars/svg?seed=teacher1', role: 'USER' } });
  const instructor2 = await prisma.user.create({ data: { email: 'teacher2@example.com', password: hashedPassword, name: '李老师', avatar: 'https://api.dicebear.com/7.x/avataaars/svg?seed=teacher2', role: 'USER' } });
  const student = await prisma.user.create({ data: { email: 'student@example.com', password: hashedPassword, name: '小明同学', avatar: 'https://api.dicebear.com/7.x/avataaars/svg?seed=student', role: 'USER' } });

  console.log('📚 创建课程...');

  // 课程1: React 18
  const course1 = await prisma.course.create({
    data: {
      title: 'React 18 全栈开发实战',
      slug: 'react-18-fullstack',
      description: '从零开始学习 React 18，包含 Hooks、Server Components、Next.js 等最新技术栈，通过实战项目掌握全栈开发能力。',
      coverImage: 'https://images.unsplash.com/photo-1633356122544-f134324a6cee?w=800',
      price: 299.00,
      originalPrice: 499.00,
      status: 'PUBLISHED',
      categoryId: categories[0].id,
      instructorId: instructor1.id,
    },
  });

  // 课程1 章节 + 内容块
  const c1ch1 = await prisma.chapter.create({
    data: {
      title: '第1章：React 基础入门',
      sortOrder: 1,
      isFree: true,
      courseId: course1.id,
      contentBlocks: {
        create: [
          { type: 'ARTICLE', title: 'React 发展历史与核心概念', content: 'React 是由 Facebook 开发的用于构建用户界面的 JavaScript 库。它采用组件化开发模式，通过虚拟 DOM 实现高效的界面更新。\n\n核心概念包括：\n1. JSX - JavaScript XML 语法扩展\n2. 组件 - 可复用的 UI 单元\n3. Props - 组件间数据传递\n4. State - 组件内部状态管理', sortOrder: 1 },
          { type: 'VIDEO', title: 'JSX 语法详解', url: 'https://interactive-examples.mdn.mozilla.net/media/cc0-videos/flower.mp4', duration: 600, sortOrder: 2 },
          { type: 'IMAGE', title: '组件生命周期图', url: 'https://images.unsplash.com/photo-1633356122544-f134324a6cee?w=800', content: 'React 组件生命周期各阶段示意图', sortOrder: 3 },
        ],
      },
    },
  });

  const c1ch2 = await prisma.chapter.create({
    data: {
      title: '第2章：Hooks 深度解析',
      sortOrder: 2,
      isFree: false,
      courseId: course1.id,
      contentBlocks: {
        create: [
          { type: 'VIDEO', title: 'useState 与 useEffect 实战', url: 'https://interactive-examples.mdn.mozilla.net/media/cc0-videos/flower.mp4', duration: 900, sortOrder: 1 },
          { type: 'ARTICLE', title: '自定义 Hooks 设计模式', content: '自定义 Hooks 是 React 中复用状态逻辑的最佳实践。通过提取组件中的通用逻辑，可以创建可复用的函数。\n\n常见自定义 Hooks：\n- useLocalStorage\n- useFetch\n- useDebounce\n- useMediaQuery', sortOrder: 2 },
          { type: 'AUDIO', title: 'Hooks 最佳实践讲解', url: 'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-1.mp3', duration: 480, sortOrder: 3 },
        ],
      },
    },
  });

  const c1ch3 = await prisma.chapter.create({
    data: {
      title: '第3章：Next.js 全栈开发',
      sortOrder: 3,
      isFree: false,
      courseId: course1.id,
      contentBlocks: {
        create: [
          { type: 'ARTICLE', title: 'Next.js 14 新特性概览', content: 'Next.js 14 引入了 Server Components、Server Actions、Partial Prerendering 等重要特性。\n\n主要更新：\n1. App Router 稳定版\n2. Server Actions 无需 API 路由\n3. Turbopack 开发服务器\n4. 图片优化升级', sortOrder: 1 },
          { type: 'VIDEO', title: 'App Router 实战项目', url: 'https://interactive-examples.mdn.mozilla.net/media/cc0-videos/flower.mp4', duration: 1200, sortOrder: 2 },
          { type: 'IMAGE', title: '项目架构图', url: 'https://images.unsplash.com/photo-1555066931-4365d14bab8c?w=800', content: 'Next.js 全栈项目目录结构', sortOrder: 3 },
        ],
      },
    },
  });

  // 课程2: Node.js
  const course2 = await prisma.course.create({
    data: {
      title: 'Node.js 高性能后端开发',
      slug: 'nodejs-backend',
      description: '深入学习 Node.js 后端开发，包含 Express、NestJS、数据库设计、性能优化等企业级开发技能。',
      coverImage: 'https://images.unsplash.com/photo-1627398242454-45a1465c2479?w=800',
      price: 399.00,
      originalPrice: 599.00,
      status: 'PUBLISHED',
      categoryId: categories[1].id,
      instructorId: instructor2.id,
    },
  });

  const c2ch1 = await prisma.chapter.create({
    data: {
      title: '第1章：Node.js 核心模块',
      sortOrder: 1,
      isFree: true,
      courseId: course2.id,
      contentBlocks: {
        create: [
          { type: 'VIDEO', title: 'Event Loop 机制详解', url: 'https://interactive-examples.mdn.mozilla.net/media/cc0-videos/flower.mp4', duration: 720, sortOrder: 1 },
          { type: 'ARTICLE', title: 'Buffer 与 Stream 处理', content: 'Buffer 是 Node.js 中处理二进制数据的核心类。Stream 则提供了高效的数据处理方式，适用于大文件读写场景。', sortOrder: 2 },
        ],
      },
    },
  });

  const c2ch2 = await prisma.chapter.create({
    data: {
      title: '第2章：Express 框架实战',
      sortOrder: 2,
      isFree: false,
      courseId: course2.id,
      contentBlocks: {
        create: [
          { type: 'ARTICLE', title: '中间件设计原理', content: 'Express 中间件是函数组成的处理管道，每个中间件可以访问请求对象、响应对象和 next 函数。', sortOrder: 1 },
          { type: 'VIDEO', title: 'RESTful API 设计实战', url: 'https://interactive-examples.mdn.mozilla.net/media/cc0-videos/flower.mp4', duration: 900, sortOrder: 2 },
          { type: 'AUDIO', title: '性能优化技巧', url: 'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-2.mp3', duration: 360, sortOrder: 3 },
        ],
      },
    },
  });

  // 课程3: ChatGPT
  const course3 = await prisma.course.create({
    data: {
      title: 'ChatGPT 与大语言模型实战',
      slug: 'llm-practice',
      description: '学习如何调用 OpenAI API、构建智能客服、文本生成应用，以及 LangChain 框架的使用。',
      coverImage: 'https://images.unsplash.com/photo-1677442136019-21780ecad995?w=800',
      price: 499.00,
      originalPrice: 799.00,
      status: 'PUBLISHED',
      categoryId: categories[2].id,
      instructorId: instructor1.id,
    },
  });

  const c3ch1 = await prisma.chapter.create({
    data: {
      title: '第1章：大语言模型基础',
      sortOrder: 1,
      isFree: true,
      courseId: course3.id,
      contentBlocks: {
        create: [
          { type: 'ARTICLE', title: 'GPT 模型演进史', content: '从 GPT-1 到 GPT-4，大语言模型经历了从单向语言模型到多模态智能体的演进。\n\n关键里程碑：\n- GPT-1 (2018): 1.17亿参数\n- GPT-2 (2019): 15亿参数\n- GPT-3 (2020): 1750亿参数\n- GPT-4 (2023): 多模态支持', sortOrder: 1 },
          { type: 'IMAGE', title: 'Transformer 架构图', url: 'https://images.unsplash.com/photo-1677442136019-21780ecad995?w=800', content: 'Attention is All You Need 论文中的 Transformer 架构', sortOrder: 2 },
        ],
      },
    },
  });

  const c3ch2 = await prisma.chapter.create({
    data: {
      title: '第2章：OpenAI API 实战',
      sortOrder: 2,
      isFree: false,
      courseId: course3.id,
      contentBlocks: {
        create: [
          { type: 'VIDEO', title: 'API 调用与参数调优', url: 'https://interactive-examples.mdn.mozilla.net/media/cc0-videos/flower.mp4', duration: 800, sortOrder: 1 },
          { type: 'ARTICLE', title: 'Prompt Engineering 技巧', content: 'Prompt Engineering 是通过优化输入提示来获得更好模型输出的技术。\n\n核心技巧：\n1. 角色设定 - 让模型扮演特定角色\n2.  few-shot 示例 - 提供输入输出样例\n3. Chain-of-Thought - 引导模型逐步推理\n4. 结构化输出 - 指定 JSON/XML 格式', sortOrder: 2 },
          { type: 'AUDIO', title: 'LangChain 框架介绍', url: 'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-3.mp3', duration: 600, sortOrder: 3 },
          { type: 'IMAGE', title: 'RAG 架构示意图', url: 'https://images.unsplash.com/photo-1620712943543-bcc4688e7485?w=800', content: '检索增强生成（RAG）系统架构', sortOrder: 4 },
        ],
      },
    },
  });

  console.log('🧾 创建订单...');
  await prisma.order.create({
    data: { userId: student.id, courseId: course1.id, amount: 299.00, status: 'PAID', paymentMethod: '微信支付', paidAt: new Date() },
  });

  console.log('📝 创建报名记录...');
  await prisma.enrollment.create({
    data: { userId: student.id, courseId: course1.id, progress: 35 },
  });

  console.log('⭐ 创建评价...');
  await prisma.review.create({
    data: { userId: student.id, courseId: course1.id, rating: 5, comment: '课程内容非常详细，老师讲解清晰，实战项目很有帮助！' },
  });

  console.log('✅ Seed 数据填充完成！');
  console.log('\n📋 示例账号：');
  console.log('   管理员: admin@example.com / 123456');
  console.log('   讲师1:  teacher1@example.com / 123456');
  console.log('   讲师2:  teacher2@example.com / 123456');
  console.log('   学员:   student@example.com / 123456');
}

main()
  .catch((e) => { console.error('❌ Seed 失败:', e); process.exit(1); })
  .finally(async () => { await prisma.$disconnect(); });
