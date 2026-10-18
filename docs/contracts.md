# 契约冻结（R3）

> 目的：让“改了哪些契约、为什么”可核对（AC-61、AC-91）。导出签名、错误形状、分层边界在此冻结；`tests/contracts.test.mjs` 与 `tests/layering.test.mjs` 机械断言。

## 1. 模块导出

| 模块 | 导出 |
|---|---|
| `server/db.mjs` | `createPool(config)`、`migrate(client)`、`withTransaction(pool, fn)`、`runMigrations(pool)`、`resetDatabase(pool,{seed})`、`schemaVersion(pool)`、`isSeeded(pool)`、`checkDatabase(pool)`、`verifyMigrationChecksums(pool)`、`closePool(pool)` |
| `server/repositories/users.mjs` | `findByUsername`、`findById`、`create`、`list` |
| `server/repositories/sessions.mjs` | `create`、`findUserByToken`、`deleteByToken`、`purgeExpired` |
| `server/repositories/products.mjs` | `list`、`get`、`getForUpdate`、`update` |
| `server/repositories/orders.mjs` | `create`、`createItems`、`deductStock`、`assertSubtotal`、`findByClientOrderId`、`findByNumber`、`listByUser`、`listAll`、`itemsByOrderIds`、`loadOrder` |
| `server/services/auth.mjs` | `createAuthService({pool,repos,config,clock,dummyHash,rateLimiter,scryptGate})` → `{register,login,logout,me,resetRateLimiter,rateLimiter,verifyCsrf}` |
| `server/services/catalog.mjs` | `createCatalogService({pool,repos})` → `{listPublic,listAdmin,updateProduct}` |
| `server/services/orders.mjs` | `createOrderService({pool,repos,clock})` → `{checkout,listMine,getForViewer,listAll}`；`normalizeItems`、`OrderFailure` |
| `server/services/health.mjs` | `createHealthService({pool,config,clock})` → `{health}` |
| `server/services/index.mjs` | `createServices({pool,config,clock,repos})` |
| `server/app.mjs` | `createApp({config,clock})` → `{pool,services,handler,version,schemaVersion,close}`；`formatStartupError` |
| `server/router.mjs` | `createApiHandler({services,config,version})` |
| `server/allowlist.mjs` | `PUBLIC_ALLOWLIST`、`IMAGE_RE`、`isAllowedPublicPath`、`listPublicFiles`、`mimeTypeFor` |
| `config.mjs` | `loadConfig({env,databaseUrl})`、`readVersion`、`ConfigError` |

## 2. 分层与依赖规则

1. `router` 不 import `pg`/`repositories`/`db`；不含 SQL；
2. `services` 不 import HTTP/router；不接触 `req`/`res`；
3. `repositories` 不 import services/router；
4. `domain`（`assets/domain.mjs`）不依赖服务端模块；
5. `server/app.mjs` 是唯一组合根；
6. 依赖规则由 `tests/layering.test.mjs` 断言。

## 3. R2 → R3 契约变更

| 契约 | R2 | R3 | 原因 | 兼容性 |
|---|---|---|---|---|
| 数据库 | `node:sqlite` 单文件 | PostgreSQL 16 + `pg.Pool` | PRD 目标 1 | **破坏性**（部署形态变） |
| 依赖 | 零第三方依赖 | 恰好 `{pg}` | PRD 目标 1 | **破坏性**（课程口径正式变更） |
| `/api/health` | `dbPath` 字段 | `db:"up|down"`、`schemaVersion`、`uptimeSeconds`；down → 503 | 可部署探活 | **破坏性**（字段变） |
| 他人订单 | 403 `order-not-owned` | 404 `order-not-found` | 消除存在性泄露（D-57） | **破坏性**（状态码变） |
| 会话 | 无过期 | `expires_at` + Max-Age + 轮换 | 关闭 S-3 | 兼容（更严格） |
| CSRF | 无 | 双提交 Cookie + 头；登录/注册豁免 | 关闭安全缺口 | 前端需带 token |
| 认证/体校验优先级 | 认证先 | 体协议 → 405 → 401 → CSRF → 403 | 关闭 C-4 | **行为变更** |
| CLI 数据库参数 | `--db <path>` | `--url <DATABASE_URL>`；`--db` 用法错误 | PG 无文件库 | **破坏性** |
| CLI 命令 | `db init` | `db migrate`（幂等）；新增 `db backup/restore` | PG 迁移语义 | **破坏性** |
| 版本 | `2.0.0.0` | `VERSION=3.0.0.0`；`package.json=3.0.0` | npm SemVer 约束 | — |

## 4. 三层命名映射

| 概念 | DB 列 | HTTP JSON | CLI |
|---|---|---|---|
| 单价（分） | `unit_price_cents` | `unitPriceCents` | `--unit-price-cents` |
| 库存 | `stock` | `stock` | `--stock` |
| 上下架 | `listed`（boolean） | `listed`（boolean） | `unlist`/`relist` |
| 订单号 | `order_number` | `orderNumber` | 位置参数 |
| 幂等键 | `client_order_id` | `clientOrderId` | 前端生成（CLI 不暴露） |
| 用户 | `user_id` | `id`（统一 `{id,username,role}`） | `--username` |

## 5. 错误契约

`docs/error-catalog.md` 是唯一真源；`server/errors.mjs` 镜像；`tests/contracts.test.mjs` 断言集合一致。API 一律 `{ok:false,code,message,details?}`；静态层 `problem+json`。

## 6. 领域层复用

`assets/domain.mjs` 的纯函数与 `limits` 签名/实现不变；`tests/domain.test.mjs` 原样通过。服务端复用 `createOrderNumber`。
