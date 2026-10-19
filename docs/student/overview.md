# FruitLab Overview（当前版本 3.5.0.0）

> 本文只描述**当前版本**的架构与功能，不涉及历史版本演进。
> FruitLab 是教学演示商城，不是生产支付/电商系统。

## 1. 它是什么

FruitLab 是一个“按份买水果”的演示商城，用来展示一个真实可运行、可部署、可测试的 Web 应用：

- 浏览器端：商品浏览、购物袋、登录/注册、下单、我的订单、查订单、管理员面板
- 服务端：Node.js + PostgreSQL，HTTP API、会话、权限、订单事务
- 部署：Docker Compose 三容器（web / api / db），也支持本地 Node + Postgres
- 质量：真实 PostgreSQL 上的自动化测试、契约/文档/编号/证据检查

## 2. 功能清单

### 2.1 商城（普通用户）

| 功能 | 说明 |
|---|---|
| 商品列表 | 14 种水果；显示图片、名称、规格、价格、库存状态 |
| 售罄 | 售罄商品仍保留在列表，但不可加购 |
| 下架 | 下架商品不在商城展示 |
| 购物袋 | 页面内存购物袋；加购、减购、移除、合计 |
| 登录/注册 | 用户名 + 口令；注册后登录 |
| 下单 | 登录后结账；服务端校验库存/价格，写订单与订单项 |
| 我的订单 | 当前用户订单列表，可刷新 |
| 查订单 | 按订单号查询，仅能查自己的订单 |
| 会话 | Cookie 会话，带过期时间，登录轮换 |

### 2.2 管理员

| 功能 | 说明 |
|---|---|
| 管理入口 | 仅 `admin` 角色可见“管理”导航 |
| 订单面板 | 查看全部用户订单，刷新 |
| 商品面板 | 查看全部商品（含下架）；修改价格（分）、库存、上/下架；保存 |
| 持久化 | 管理修改直接写 PostgreSQL，重启后保留 |

### 2.3 运维 / CLI

- `node cli.mjs db migrate|seed|reset|backup|restore|check`
- `node cli.mjs dev` 本地启动静态 + API
- `node cli.mjs user ...`、`product ...`、`orders ...`
- `node serve.mjs --port/--host/--url`
- `node scripts/preflight.mjs`、`pgctl.mjs`、`verify.mjs`

## 3. 总体架构

```text
浏览器
  │ HTTP
  ▼
web 容器（Caddy）
  ├─ 静态文件（index.html、assets、docs、evidence）
  └─ /api/* 反向代理
          │
          ▼
api 容器（Node.js 22）
  ├─ router       协议层：Host/Origin、体大小、方法/405、Cookie、状态码
  ├─ services     用例层：auth/catalog/orders/health
  ├─ repositories 数据层：users/sessions/products/orders
  └─ app.mjs      组合根：建池、迁移、seed、组装依赖
          │
          ▼
db 容器（PostgreSQL 16）
  └─ volume：fruitlab-*-pgdata
```

### 3.1 逻辑分层（L1）

| 层 | 职责 | 约束 |
|---|---|---|
| `router.mjs` | HTTP 协议、路由、错误信封 | 不 import `pg`/repositories，不含 SQL |
| `services/*` | 业务用例、权限、事务调用 | 不 import http/router |
| `repositories/*` | SQL、行映射 | 不 import services |
| `app.mjs` | 唯一组合根 | 建池、迁移、seed、组装 |

依赖规则由 `tests/layering.test.mjs` 机械断言。

### 3.2 物理分层（L2）

| 容器 | 镜像 | 职责 |
|---|---|---|
| web | Caddy 2（非 root） | 静态托管 + `/api` 反向代理 + `/healthz` |
| api | Node 22（非 root） | API、迁移、seed、health |
| db | PostgreSQL 16 | 数据持久化 |

## 4. 数据模型

| 表 | 作用 |
|---|---|
| `users` | 用户名、口令哈希、角色（user/admin） |
| `sessions` | 会话令牌哈希、过期时间 |
| `products` | 商品、价格（分）、库存、是否上架 |
| `orders` | 订单头、用户、幂等键、金额、时间 |
| `order_items` | 订单行、商品快照、数量、单价 |
| `schema_migrations` | 迁移版本与 checksum |
| `app_meta` | seed 模式等元信息 |

- 迁移：`0001_init.sql`、`0002_app_meta.sql`
- 订单写入：幂等键 + 按 `productId` 排序扣库存 + 事务
- seed：classroom（userA/userB/admin）与 production（仅 admin）分离

## 5. 安全与边界

- 口令：scrypt + 盐 + `timingSafeEqual`
- 会话：过期时间、登录轮换、过期清理
- CSRF：双提交 Cookie + `X-CSRF-Token`
- 限流：账号桶 + IP 桶
- 时序：缺失用户 dummy scrypt
- 越权：他人订单 404（隐藏存在性）
- Host/Origin：默认白名单；学生 demo 可用 `DEMO_ALLOW_ANY_HOST=1` 跳过（仅非 production）
- 生产：`APP_ENV=production` 强制 `ADMIN_PASSWORD`、`COOKIE_SECURE=1`，不 seed 演示账号
- 容器：非 root、healthcheck、命名卷、日志轮转

## 6. 部署形态

| 形态 | 适用 |
|---|---|
| Killercoda / Linux 虚机 + Docker Compose | 课堂、演示、快速验证 |
| 单台云主机 + Docker Compose + 反向代理 | 小规模部署 |
| 本地 Node 22 + PostgreSQL 16（无 Docker） | 克隆后研究、二次开发、无 Docker 机器 |
| 云容器/PaaS | 可选，需平台账号 |

镜像：

- Docker Hub：`chengzh/fruitlab-r3:3.5.0.0`、`chengzh/fruitlab-r3-web:3.5.0.0`
- ACR：`registry.cn-hangzhou.aliyuncs.com/chengzh/...:3.5.0.0`
- 官方 Postgres：`postgres:16-alpine`

## 7. 代码目录

| 路径 | 内容 |
|---|---|
| `server/` | `db`、`migrations/`、`repositories/`、`services/`、`router`、`app`、`auth`、`errors` |
| `assets/` | 前端模块与 14 张商品图 |
| `tests/` | 真实 PG 集成、纯逻辑、fake DOM、客户端、分层/契约 |
| `scripts/` | 迁移/测试/校验/备份/启动脚本 |
| `docs/` | 架构、API、契约、部署、备份恢复、错误目录 |
| `deploy/` | 生产 compose、学生 compose、启动脚本 |
| `evidence/` | 测试计数、逐环/部署证据 |

## 8. 已知边界（当前版本）

- 不做支付、退款、取消订单、发票
- 不做审计日志、分页、多租户、水平扩展
- 限流是单实例内存实现，重启清零
- 容器镜像内置 Caddy 只提供 HTTP；TLS 由外部反代终止
- `DEMO_ALLOW_ANY_HOST=1` 仅用于学生 demo，不用于生产
- 演示账号口令固定 `demo1234`，只用于开发/课堂

## 9. 相关文档

- 快速测试：[`quickstart.md`](quickstart.md)
- 克隆与二次开发：[`development.md`](development.md)
- 排错：[`troubleshooting.md`](troubleshooting.md)
- 入口：[`README.md`](README.md)
