# spec 环取证：R2 → R3 的耦合点、测试结构与 findings 位置

> 性质：只读取证。基线 `r3-fruitlab` HEAD `55f2cf0`（`r2-baseline` = `5f4dd87`）。本文件不含产品代码改动。
> 规则：行号、命令、输出均来自真实读取/执行；未执行的写 `未执行`；不可用的写 `unavailable`。

## 1. 环境实证（2026-10-18，本机）

| 项 | 命令 | 实测结果 |
|---|---|---|
| Node | `node --version` | `v22.20.0` |
| npm | `npm --version` / `npm config get registry` | `10.9.3` / `https://registry.npmmirror.com` |
| pg 可用版本 | `npm view pg version` | `8.23.1` |
| Windows Docker CLI | `docker version` | 存在 `docker.exe`，但 Docker Desktop 引擎**未运行**（`dockerDesktopLinuxEngine` 管道不存在）→ Windows 侧不可用 |
| WSL Docker | `wsl -e docker version` | `29.9.1`，引擎可用 |
| WSL Compose | `wsl -e docker compose version` | `v5.6.0` |
| 镜像 | `wsl -e docker image ls` | `postgres:16-alpine`（420 MB）、`node:22-alpine`（238 MB）、`caddy:2-alpine`（本轮拉取成功） |
| Windows→WSL 端口 | 启动 `postgres:16-alpine` 于 `-p 55432:5432` 后，Windows `TcpClient` 连 `127.0.0.1:55432` | **TCP OPEN**；容器内 `pg_isready` → `accepting connections` |
| codex | `Test-Path ...codex.exe` | 存在（`0.162.0-alpha.17.2`，不在 PATH） |
| cso launcher | WSL `gstack-cso-launcher --version` | `{"version":"3.0.0","abi":3}`，launcher/core/watchdog 均在 |
| 三仓状态 | `git status --short` ×3 | R1/R2/R3 全空；R1 `3087a05`/`1.0.0.0`，R2 `5f4dd87`/`2.0.0.0`，R3 `55f2cf0`（`VERSION` 仍是 `2.0.0.0`） |

**结论**：R3 的测试与容器验收必须走 **WSL 引擎**（Windows Docker Desktop 未启动）；Windows Node 通过 `127.0.0.1:55432` 访问 WSL 发布的 Postgres 可行。所有 `docker`/`compose` 证据以 `wsl -e ...` 形式记录。

## 2. SQLite 耦合点（file:line → R3 替代形态 → 受影响测试）

| # | 位置 | 耦合点 | R3 目标形态 | 受影响测试 |
|---:|---|---|---|---|
| 1 | `server/db.mjs:3` | `import { DatabaseSync } from "node:sqlite"` | `pg.Pool`（仅 `pg` 依赖） | 全部 DB/API/CLI 测试 |
| 2 | `server/db.mjs:37-46` | `openDb` + `PRAGMA foreign_keys/busy_timeout/WAL` | `createPool({connectionString, options})`；`statement_timeout`/`lock_timeout` 可配 | `db`/`api`/`cli` |
| 3 | `server/db.mjs:48-50` | `PRAGMA user_version` | `schema_migrations(version, name, applied_at)` | `db.test` 迁移用例 |
| 4 | `server/db.mjs:52-107` | SQLite DDL（`INTEGER PRIMARY KEY AUTOINCREMENT`、`TEXT` 时间） | PG DDL：`bigint generated always as identity`、`timestamptz`、`bigint` 分 | 全部 DB 测试 |
| 5 | `server/db.mjs:119-153` | 同步 `db.prepare(...).run()` 种子 | repository + 参数化 SQL + `ON CONFLICT DO NOTHING` | `db`/`cli` |
| 6 | `server/db.mjs:155-161` | `enqueueWrite` 单写者队列（**无调用方**，findings C-2） | **退役**；Pool + 事务 + SQLSTATE 重试 | 并发/持锁测试 |
| 7 | `server/db.mjs:163-173` | `inTransaction` + `BEGIN IMMEDIATE` | `withTransaction(pool, fn)`（同一 client，`BEGIN/COMMIT/ROLLBACK`） | 订单事务测试 |
| 8 | `server/auth.mjs:39-47` | `createSession` 无过期 | `expires_at` + `SESSION_TTL_SECONDS` | 会话测试 |
| 9 | `server/auth.mjs:49-59` | `getSessionUser` 不校验过期 | 校验 `expires_at > now()`，惰性删除过期行 | 会话/API |
| 10 | `server/auth.mjs:82-88` | Cookie 无 `Max-Age`/`Secure` | `Max-Age` 跟随 TTL；`COOKIE_SECURE` 可配 | 认证/API |
| 11 | `server/router.mjs:92` | `createApiHandler({db, dbPath, ...})`（同步 db 句柄） | `createApiHandler({services, config})`，router 不 import `pg`/repositories | 全部 API |
| 12 | `server/router.mjs:106` | 认证在请求体校验之前（C-4） | 按冻结优先级：Host/Origin → 体协议（415/413/400）→ 405 → 401 → 403 | 优先级新测试 |
| 13 | `server/router.mjs:145` | 仅用户存在时跑 scrypt（S-1 时序） | 缺失用户跑 dummy scrypt + `timingSafeEqual` | 时序分支测试 |
| 14 | `server/router.mjs:183-192` | 动态路由手写判断；`decodeURIComponent` 直用（C-6） | 路由表（pattern→methods）+ 安全 decode（400） | 405/编码测试 |
| 15 | `server/router.mjs:189` | 他人订单 403（S-4/D-32） | **404 `order-not-found`**（D-32 superseded） | 越权测试改判 |
| 16 | `server/router.mjs:218-237` | 405 表不完整（C-3） | 统一路由形状表 + 表驱动 405 | 405 表驱动 |
| 17 | `server/orders.mjs:134-180` | 同步事务 + `lastInsertRowid` | `withTransaction` + `INSERT ... RETURNING` | 下单事务 |
| 18 | `server/orders.mjs:158` | `SELECT 全部订单号` 再生成 | 直接生成 + 唯一冲突 `23505` 捕获重试（上限 10） | 订单号/幂等 |
| 19 | `server/orders.mjs:184-190` | `message.includes("BUSY")`（C-2） | SQLSTATE 映射：`23505`/`40001`/`40P01`/`53300` | 错误映射测试 |
| 20 | `serve.mjs:8-9` | 启动即 `openDb` + `migrate` | `createPool` + `migrate`（启动重试） | API/静态测试 |
| 21 | `serve.mjs:15-47` | `PUBLIC_ALLOWLIST` 写死在 serve | 抽 `server/allowlist.mjs`，Node 与 web 构建共用 | 链接/静态测试 |
| 22 | `serve.mjs:105-179` | 静态 + API 同进程 | 保留（simple 模式）；L2 下 api 仅 API、Caddy 静态 | 容器验收 |
| 23 | `cli.mjs:7-10` | 直接 import SQLite 模块 | import pg 版 db/repositories | CLI 全部 |
| 24 | `cli.mjs:29-44` | `--db <path>` / `FRUITLAB_DB` | `--url <DATABASE_URL>` / `DATABASE_URL`（`--db` 移除） | CLI 帮助/退出码 |
| 25 | `cli.mjs:142-162` | `db reset` 文件复制+删除（C-1 High） | 先真实备份（pg_dump 或 SQL 导出），失败显式退出；SQL 事务重建 | CLI reset 失败路径 |
| 26 | `cli.mjs:163-179` | `PRAGMA integrity_check/foreign_key_check` | `db check`：迁移版本、约束存在性、种子计数、连接 | CLI check |
| 27 | `cli.mjs:276` | `message.includes("BUSY")` | SQLSTATE → 退出码 3 | CLI 暂时性失败 |
| 28 | `assets/api-client.mjs:88-113` | 超时定时器在响应头返回后清除（C-5） | `AbortSignal.timeout` 覆盖 body 读取与 JSON 解析 | 客户端超时测试 |
| 29 | `tests/helpers/db.mjs:9-23` | 临时 SQLite 文件库 | `tests/helpers/pg.mjs`：独立数据库 + 迁移 + 种子 + 清理 | DB/API/CLI |
| 30 | `tests/helpers/server.mjs:4-14` | `startTestServer(db)`（同步句柄） | `startTestServer({pool, services})` | API/static |
| 31 | `tests/static-scan.test.mjs:214-219` | 断言「无 package.json」 | 断言「允许 package.json，运行时依赖集合恰好 `{pg}`」 | 静态扫描 |
| 32 | `tests/contracts.test.mjs:29-42` | AC 唯一编号 / `OB-[A-Z]+-\d{2}` 42 条 | AC 续号、`OB-R3-<PHASE>-NN` | 契约测试 |

## 3. R2 测试结构（96 项）

| 文件 | 项数 | 对 Postgres 的迁移风险 | 说明 |
|---|---:|---|---|
| `tests/domain.test.mjs` | 17 | **无**（纯函数） | 原样保留，证明领域层未破坏 |
| `tests/controller.test.mjs` | 11 | 无（无 DOM reducer） | 原样保留 |
| `tests/app.test.mjs` | 19 | 无（fake DOM + stub 客户端） | 保留；api-client 新增 CSRF 头后需同步断言 |
| `tests/assets.test.mjs` | 3 | 无 | 原样保留 |
| `tests/static-scan.test.mjs` | 13 | 低 | 依赖断言改口径（package.json/pg）；新增 no-SQL-in-router 扫描 |
| `tests/contracts.test.mjs` | 4 | 低 | 编号/错误目录断言更新 |
| `tests/auth.test.mjs` | 5 | **中**（会话/用户表） | 重写为 PG + 过期/时序用例 |
| `tests/db.test.mjs` | 7 | **高**（SQLite 事务/约束） | 重写 + 并发/锁/唯一冲突用例 |
| `tests/cli.test.mjs` | 7 | **高**（临时文件库/退出码） | 重写为 DATABASE_URL + PG 测试库 |
| `tests/api.test.mjs` | 10 | **高**（HTTP + db 句柄） | 重写 + 405 表/优先级/CSRF/限流/404 |
| **合计** | **96** | | |

## 4. findings 精确位置（R3 逐条处置输入）

| 编号 | 来源/级别 | 位置 | 现状 |
|---|---|---|---|
| C-1 | codex / High | `cli.mjs:142-162` | 文件复制备份 + 忽略 `unlinkSync` 失败 |
| C-2 | codex / Medium | `server/db.mjs:155-161`、`server/orders.mjs:184-190` | `enqueueWrite` 无调用方；BUSY 仅建单路径 |
| C-3 | codex / Medium | `server/router.mjs:218-237` | `PATCH /api/orders/{num}`、`GET /api/admin/products/{id}` → 404 |
| C-4 | codex / Medium | `server/router.mjs:106,168-171,206-211` | 认证先于体校验 |
| C-5 | codex / Medium | `assets/api-client.mjs:88-113` | 响应头返回后清定时器 |
| C-6 | codex / Low | `server/router.mjs:185,209` | `decodeURIComponent` 抛错 → 500 |
| C-7 | codex / Low | `server/auth.mjs:53`、`server/router.mjs:152` | `userId` vs `id` |
| S-1 | cso / Medium | `server/router.mjs:144-146` | 时序枚举 |
| S-2 | cso / Medium | `server/router.mjs:137-155` | 无限流 |
| S-3 | cso / Medium | `server/db.mjs:91-95`、`server/auth.mjs:39-59` | 会话无过期 |
| S-4 | cso / Low | `server/router.mjs:188-190` | 403 存在性泄露 |

> 粒度：C-6 行同时包含「畸形百分号 500」与「id/userId 形状」两个缺陷点（R2 报告合并为一行）。R3 台账拆为 **11 条**（C-1..C-7、S-1..S-4）。

## 5. 证据链现状与改进输入

- 唯一计数 `evidence/test-count.txt` 记录 `tests=96 pass=96 fail=0`，`git: 17a1c0e...`；该文件与 QA-01 修复同批提交为 `c6164e4`——计数是在 `17a1c0e` 之上带未提交修复运行的，**只记 HEAD、不记工作树状态**。R3 的 `record-test-count.mjs` 追加 `treeStatus`（`git status --short` 摘要）与 `treeHash`（`git stash create` 的树对象或 `git write-tree`），避免"计数对应哪棵树"不可复现。
- R2 的 42 条 OB 全 `closed`，与本文件 §4 的 11 条 findings 不冲突：findings 产生于 ship/retro 之后的补测，从未进入 R2 台账。R3 需要 `F-R3-* → OB-R3-* → AC-*` 三段双向可查。

## 6. 已决口径（用户授权自主拍板，spec 落 SPEC/DECISIONS 双处）

| 决策点 | R3 选择 | 理由/边界 |
|---|---|---|
| A 认证 vs 体校验优先级 | **遵守冻结优先级**：415/413/400 invalid-json → 405 → 401 → 403 | 契约已冻结；体上限 64 KiB 使未认证解析的风险有界 |
| B 403 vs 404 | 他人订单 **404 `order-not-found`** | R3 面向可部署形态，消除存在性泄露；D-32 superseded，课堂演示改为"资源不存在" |
| C 限流存储 | **内存**（单实例；进程重启清零），按 `username+IP` | 与"不做水平扩展"一致；DB 计数会引入写热点与额外表 |
| D 编号 | AC 续号 `AC-49` 起；D 续号 `D-47` 起；OB 用 `OB-R3-<PHASE>-NN`；finding 用 `F-R3-NN` | 避免与 R2 已冻结的 AC-01..48 / D-01..46 / OB-* 歧义 |
| E 跨模型门禁 | 仍记 `unavailable`（codex 同族，无第二 provider） | 不用同族冒充跨模型；同族二次审阅单独标注 |
