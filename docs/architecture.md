# R3 架构（L1 逻辑分层 + L2 物理拓扑）

> 目标：在不改变用户可见契约的前提下，把 R2 的同步 SQLite 单体拆成 **router → services → repositories → Postgres**，并用容器把 web/api/db 分成三层。

## 1. L1 逻辑分层

```text
浏览器
  │  HTTP
  ▼
server/router.mjs        协议层：Host/Origin、体读取(415/413/400)、405 表、会话/Cookie、CSRF、信封
  │  只调用 services
  ▼
server/services/*.mjs    用例层：register/login/logout/me、catalog、checkout、lookup、health
  │  只调用 repositories
  ▼
server/repositories/*.mjs 数据层：参数化 SQL、事务内操作、行映射；无业务分支
  │
  ▼
PostgreSQL 16（pg.Pool）
```

基础设施：`server/db.mjs`（连接池、迁移、事务、advisory lock、SQLSTATE 映射）；`server/seed.mjs`（classroom/production 两种种子）；`server/app.mjs`（唯一组合根）。

领域层：`assets/domain.mjs` 纯函数（金额、订单号、校验），**签名与实现不变**。

### 依赖规则（`tests/layering.test.mjs`）

1. `router` 不 import `pg`/`repositories`/`db`；不含 SQL 语句；
2. `services` 不 import `node:http`/`router`；不接触 `req`/`res`；
3. `repositories` 不 import `services`/`router`；
4. `domain` 不 import `server/*`/`node:http`/`node:fs`；
5. `server/app.mjs` 是唯一同时 import db + repositories + services + router 的组合根。

## 2. L2 物理拓扑

```text
浏览器 ──4175──> web(Caddy :8080, 非 root)
                    │  /api/*  reverse_proxy
                    ▼
                 api(Node :3000, 非 root, pg.Pool)
                    │
                    ▼
                 db(postgres:16-alpine, 非 root 进程)
                    └── volume fruitlab-r3-pgdata
```

- 同源访问 `http://127.0.0.1:4175`，无 CORS；Cookie 同源；
- api/db 不向宿主暴露端口（`compose.debug.yml` 才映射 55432）；
- `compose.simple.yml`：api+db 两容器对照（api 直接托管静态，端口 4175）。

## 3. 请求生命周期（写请求）

1. Host/Origin/Sec-Fetch-Site 校验；
2. 体协议：Content-Type JSON、64 KiB 流式上限、JSON 解析；
3. 路由表判定（精确 + 动态），方法不符 → 405 + `Allow`；
4. 会话解析（`sha256` 查 `sessions`，校验 `expires_at`）；
5. CSRF（双提交 Cookie + `X-CSRF-Token`，登录/注册豁免）；
6. 角色（admin）与资源存在性（他人订单 404）；
7. service 用例 → repository SQL（事务内）；
8. 统一信封 `{ok:true,...}` / `{ok:false,code,message}`；`X-Request-Id`。

## 4. 数据模型

`users` / `products` / `orders` / `order_items` / `sessions` + `schema_migrations`；金额整数分；订单行快照；`(user_id, client_order_id)` 唯一；`sessions.expires_at` 非空；迁移带 checksum。

## 5. 错误与一致性

- SQLSTATE → 稳定码：`23505` 唯一冲突、`40001/40P01` 有界重试、`57014/55P03` 超时、连接类 → `db-unavailable`；
- `23505` 后必须先 ROLLBACK 再回查/重试；订单先插幂等预留行，再按 productId 排序扣库存；
- `withTransaction` 只重试可重试事务错误；回调无外部副作用。
