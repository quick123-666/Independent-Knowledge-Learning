# Independent Knowledge Learning (IKL) 📚

一个基于 **Node.js + TypeScript + Express + Prisma + React** 的独立知识付费平台，支持课程管理、用户管理、订单管理、支付宝支付等完整功能。

#### 管理后台

![管理后台](https://via.placeholder.com/800x400?text=Admin+Dashboard)

#### 学员端

![学员端](https://via.placeholder.com/800x400?text=Student+Portal)

## 功能特性 🎯

- 完整的 **MVC 架构**，代码 **结构清晰**，易于维护，支持 `RESTful API` 和 `Web 界面`

- 支持 **课程管理**，包括课程创建、编辑、分类、章节管理

- 支持 **用户管理**，区分管理员和学员角色

- 支持 **订单管理**，包括创建订单、支付、退款

- 支持 **支付宝沙箱支付**，可接入真实支付环境

- 支持 **学习进度追踪**，学员可查看已购课程和学习进度

- 支持 **个人中心**，学员可编辑资料、修改密码、查看统计

- 支持 **分类管理**，课程可按分类组织

- 支持 **文件上传**，包括课程封面、头像等

- 支持 **JWT 认证**，安全的用户身份验证

## 技术栈 🛠

| 层级 | 技术 |
|------|------|
| 后端 | Node.js + Express + TypeScript |
| 数据库 | SQLite (Prisma ORM) |
| 前端 | React + TypeScript + Tailwind CSS + Vite |
| 认证 | JWT + bcrypt |
| 支付 | 支付宝 SDK (沙箱/真实环境) |
| 文件上传 | Multer |

## 系统要求 📦

| 项目 | 最低配置 | 推荐配置 |
|------|---------|---------|
| Node.js | 18.x | 20.x |
| 内存 | 2 GB | 4 GB |
| 硬盘 | 1 GB | 5 GB |

## 快速开始 🚀

### ① 克隆代码

```bash
git clone https://github.com/quick123-666/Independent-Knowledge-Learning.git
cd Independent-Knowledge-Learning
```

### ② 安装依赖

```bash
# 安装后端依赖
npm install

# 安装前端依赖
cd web
npm install
cd ..
```

### ③ 配置环境变量

```bash
# 复制环境变量模板
cp .env.example .env

# 编辑 .env 文件，配置以下参数：
# - JWT_SECRET: JWT 密钥
# - ALIPAY_APP_ID: 支付宝 App ID (可选)
# - ALIPAY_PRIVATE_KEY: 支付宝私钥 (可选)
# - ALIPAY_PUBLIC_KEY: 支付宝公钥 (可选)
```

### ④ 初始化数据库

```bash
npx prisma migrate dev
npx prisma db seed
```

### ⑤ 启动服务

```bash
# 启动后端 (端口 3001)
npm run dev

# 新终端启动前端 (端口 5173)
cd web
npm run dev
```

### ⑥ 访问系统

- 学员端: http://localhost:5173
- 管理后台: http://localhost:5173/admin
- API 文档: http://localhost:3001/api

## 默认账号 🔑

| 角色 | 邮箱 | 密码 |
|------|------|------|
| 管理员 | admin@example.com | 123456 |
| 学员 | student@example.com | 123456 |

## 项目结构 📁

```
Independent-Knowledge-Learning
├── src/                    # 后端源码
│   ├── config/            # 配置文件
│   ├── middleware/        # 中间件
│   ├── routes/            # 路由
│   ├── services/          # 业务逻辑
│   └── utils/             # 工具函数
├── web/                   # 前端源码
│   ├── src/
│   │   ├── components/    # 组件
│   │   ├── pages/         # 页面
│   │   ├── stores/        # 状态管理
│   │   └── lib/           # 工具库
│   └── public/            # 静态资源
├── prisma/                # 数据库模型
│   ├── schema.prisma      # Prisma 模型定义
│   └── seed.ts            # 种子数据
└── public/                # 上传文件目录
```

## API 接口 📡

### 认证

| 方法 | 路径 | 说明 |
|------|------|------|
| POST | /api/auth/register | 注册 |
| POST | /api/auth/login | 登录 |
| GET | /api/auth/me | 获取当前用户 |
| PUT | /api/auth/profile | 更新资料 |
| POST | /api/auth/change-password | 修改密码 |

### 课程

| 方法 | 路径 | 说明 |
|------|------|------|
| GET | /api/courses | 课程列表 |
| GET | /api/courses/:id | 课程详情 |
| POST | /api/courses/:id/enroll | 报名课程 |

### 订单

| 方法 | 路径 | 说明 |
|------|------|------|
| GET | /api/orders | 我的订单 |
| POST | /api/orders | 创建订单 |
| POST | /api/orders/:id/pay | 支付订单 |
| POST | /api/orders/:id/cancel | 取消订单 |

### 管理后台

| 方法 | 路径 | 说明 |
|------|------|------|
| GET | /api/admin/dashboard | 数据看板 |
| GET | /api/admin/users | 用户列表 |
| GET | /api/admin/courses | 课程列表 |
| GET | /api/admin/orders | 订单列表 |

### 支付

| 方法 | 路径 | 说明 |
|------|------|------|
| GET | /api/pay/alipay/status | 支付宝配置状态 |
| POST | /api/pay/alipay/create | 创建支付宝订单 |
| POST | /api/pay/alipay/notify | 支付宝回调 |

## 支付宝支付配置 💳

1. 登录 [支付宝开放平台](https://open.alipay.com/)
2. 进入沙箱应用获取 **APPID**
3. 使用密钥工具生成 **RSA2 密钥对**
4. 将应用公钥上传到沙箱应用，获取 **支付宝公钥**
5. 在 `.env` 文件中配置：

```env
ALIPAY_APP_ID=your_app_id
ALIPAY_PRIVATE_KEY=your_private_key
ALIPAY_PUBLIC_KEY=your_alipay_public_key
```

## 部署 🚀

### Docker 部署

```bash
docker build -t ikl .
docker run -p 3001:3001 -p 5173:5173 ikl
```

### 生产环境

```bash
# 构建前端
cd web
npm run build

# 构建后端
cd ..
npm run build

# 启动
npm start
```

## 常见问题 🤔

### Q: 如何重置数据库？

```bash
npx prisma migrate reset
```

### Q: 如何添加新的管理员？

直接在数据库中将用户的 `role` 字段改为 `ADMIN`。

### Q: 支付宝支付报错？

请检查 `.env` 中的支付宝配置是否正确。如果未配置，系统将使用模拟支付。

## 许可证 📄

[MIT](LICENSE)

## 贡献 🤝

欢迎提交 Issue 和 Pull Request！
