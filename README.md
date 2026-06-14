# Knowledge Pay - 知识付费平台后端 API

基于 **Node.js + TypeScript + Express + Prisma + PostgreSQL** 构建的知识付费平台后端服务。

## 技术栈

| 技术 | 版本 | 说明 |
|------|------|------|
| Node.js | >= 18 | 运行时 |
| TypeScript | ^5.3 | 类型系统 |
| Express | ^4.18 | Web 框架 |
| Prisma | ^5.10 | ORM 与数据库迁移 |
| PostgreSQL | >= 14 | 关系型数据库 |
| Zod | ^3.22 | 运行时数据校验 |
| JWT | ^9.0 | 身份认证 |
| bcryptjs | ^2.4 | 密码加密 |

## 项目结构

```
knowledge-pay/
├── prisma/
│   ├── schema.prisma      # 数据库 Schema 定义
│   └── seed.ts            # 种子数据脚本
├── src/
│   ├── config/
│   │   └── index.ts       # 环境变量与全局配置
│   ├── middleware/
│   │   ├── auth.ts        # JWT 认证与权限中间件
│   │   └── error-handler.ts # 全局错误处理
│   ├── types/
│   │   └── index.ts       # 全局类型定义
│   ├── utils/
│   │   └── response.ts    # 统一响应格式工具
│   └── index.ts           # 应用入口
├── .env.example           # 环境变量模板
├── package.json
├── tsconfig.json
└── README.md
```

## 快速开始

### 1. 安装依赖

```bash
cd knowledge-pay
npm install
```

### 2. 配置环境变量

```bash
cp .env.example .env
# 编辑 .env，填写数据库连接等配置
```

### 3. 初始化数据库

```bash
# 生成 Prisma 客户端
npm run db:generate

# 执行数据库迁移
npm run db:migrate

# 填充示例数据
npm run db:seed
```

### 4. 启动开发服务器

```bash
npm run dev
```

服务启动后访问：`http://localhost:3000/health`

## 可用脚本

| 脚本 | 说明 |
|------|------|
| `npm run dev` | 开发模式，热重载 |
| `npm run build` | 编译 TypeScript |
| `npm start` | 生产模式运行 |
| `npm run db:generate` | 生成 Prisma Client |
| `npm run db:migrate` | 执行数据库迁移 |
| `npm run db:seed` | 填充种子数据 |
| `npm run db:studio` | 打开 Prisma Studio |

## 数据库模型

### 核心实体关系

- **User** (用户) 1:N **Course** (讲师发布的课程)
- **User** 1:N **Order** (用户订单)
- **User** 1:N **Enrollment** (学习记录)
- **User** 1:N **Review** (课程评价)
- **Category** 1:N **Course** (分类下的课程)
- **Course** 1:N **Chapter** (课程章节)
- **Course** 1:N **Order** (课程的订单)
- **Course** 1:N **Enrollment** (课程的学员)
- **Course** 1:N **Review** (课程的评价)

### 示例账号

| 角色 | 邮箱 | 密码 |
|------|------|------|
| 管理员 | `admin@example.com` | `123456` |
| 讲师 | `teacher1@example.com` | `123456` |
| 学员 | `student@example.com` | `123456` |

## API 响应格式

### 成功响应

```json
{
  "success": true,
  "data": { ... },
  "message": "操作成功"
}
```

### 分页响应

```json
{
  "success": true,
  "data": [ ... ],
  "meta": {
    "page": 1,
    "pageSize": 10,
    "total": 100,
    "totalPages": 10,
    "hasNext": true,
    "hasPrev": false
  }
}
```

### 错误响应

```json
{
  "success": false,
  "message": "错误描述",
  "code": "ERROR_CODE"
}
```

## 认证方式

在请求头中携带 JWT Token：

```
Authorization: Bearer <your-jwt-token>
```

## 开发计划

- [x] 项目基础架构搭建
- [x] 数据库 Schema 设计
- [x] 认证与授权中间件
- [x] 统一响应格式
- [ ] 用户模块（注册/登录/个人中心）
- [ ] 课程模块（CRUD/分类/搜索）
- [ ] 订单模块（创建/支付/退款）
- [ ] 学习模块（进度/章节）
- [ ] 评价模块（评分/评论）
- [ ] 管理后台接口

## 许可证

MIT
