# R3 PRD：Postgres 化、三层架构与可部署交付

> **文档定位**：本文替代 R3 的 office-hours 环节。R3 从 **spec** 开始，共 **7 环**：spec → autoplan → build → review → qa → ship → retro。
> **工作目录**：`D:\vibecoding\easyvibe\r3-fruitlab`（从 R2 的 `5f4dd87` 克隆，保留 R1/R2 完整 Git 历史；标签 `r2-baseline` 标记起点）。
> **版本目标**：`3.0.0.0`。
> **一句话**：把 R2 的单机 SQLite 应用升级为 **Postgres + 逻辑三层 + 可容器化部署** 的版本，同时修掉 R2 遗留漏洞，并保证 **R1、R2、R3 三个版本都能独立启动、并排演示**。

---

## 1. 起点：R2 交付了什么、留下了什么

| 项 | 状态 |
|---|---|
| 版本 | `2.0.0.0`，96 项测试全绿，QA 健康分 95 |
| 形态 | Node 22 单进程：静态托管 + `/api` + `node:sqlite` 单文件库；零第三方依赖 |
| 演示 | R1（4173，冻结）、R2（4174，`node cli.mjs dev`）可并排 |
| 已知漏洞/债 | codex 复核 6 条（1 High）、官方 `/cso` 补测 4 条；5 项 TODOS；图片授权/尺寸降级；无远端 |

**R2 遗留 findings（R3 必须逐条处置）**：

| 来源 | 严重度 | 问题 |
|---|---|---|
| codex | **High** | `db reset` 在 WAL 未 checkpoint / 库被占用时可能“假成功” |
| codex | Medium | `enqueueWrite` 未接入写路径；BUSY 映射不全；无真实并发/持锁测试 |
| codex | Medium | 动态路由 405 不完整（`PATCH /api/orders/{num}` 等返回 404） |
| codex | Medium | 认证检查先于请求体校验，与 SPEC 冻结优先级冲突 |
| codex | Medium | `api-client` 超时在响应头返回后即清除，响应体卡住时超时失效 |
| codex | Low | 畸形百分号编码路径参数 → 500；`id` 与 `userId` 形状不一致 |
| cso | Medium | 登录时序侧信道可枚举用户名 |
| cso | Medium | 无登录限流/锁定 |
| cso | Medium | 会话永不过期（除登出不可撤销） |
| cso | Low | 他人订单 403 泄露订单号存在性（D-32 教学取舍） |

---

## 2. 版本隔离（本 PRD 的第一硬约束）

> **目标：R3 的开发不得影响 R1 与 R2；课堂演示时三个版本都能独立启动、并排对比。**
> 这是“升级迭代”课程的第三幕，任何版本被污染都等于破坏现场。

### 2.1 目录与冻结

| 版本 | 目录 | 状态 | 启动方式 |
|---|---|---|---|
| R1 | `D:\vibecoding\easyvibe\r1-fruitlab` | **永久冻结**，一行不改 | `node serve.mjs` → `4173` |
| R2 | `D:\vibecoding\easyvibe\r2-fruitlab` | **自 R3 起冻结**（基线 `5f4dd87` / `r2-baseline`） | `node cli.mjs dev` → `4174` |
| R3 | `D:\vibecoding\easyvibe\r3-fruitlab` | 本轮施工区（从 R2 克隆，保留历史） | `docker compose up --build` → `4175` |

**规则**：
1. R3 的任何改动**只能**写在 `r3-fruitlab` 内；
2. 不得把 R3 的 `package.json`、`pg` 依赖、Dockerfile、compose、Postgres 数据写回 R2；
3. R1/R2 的 Git 工作树必须保持干净（验收会跑 `git status --short`）；
4. R2 的 bug 不在 R2 里修——在 R3 里修（R2 作为“升级前”展品保留其缺陷与已知问题记录）。

### 2.2 端口、数据与资源命名（避免碰撞）

| 资源 | R1 | R2 | R3 |
|---|---|---|---|
| 应用端口 | `4173` | `4174` | **`4175`** |
| 数据 | 浏览器 `localStorage` | `data/fruitlab.db`（SQLite 文件） | Postgres volume `fruitlab-r3-pgdata`；宿主端口 **`55432`** |
| 容器/镜像 | 无 | 无 | compose 项目 `fruitlab-r3`；镜像 `fruitlab-r3:3.0.0.0` |
| 依赖 | 零 | 零 | 仅 `pg`（见 §4.1） |

### 2.3 三版本并排验收

- 同时启动 R1、R2、R3 后：`curl 4173`、`curl 4174`、`curl 4175` 均 200；R3 `/api/health` 含 DB 状态。
- 三个版本的数据库/存储互不共享；停掉任一不影响其他。
- 提供 `scripts/start-all.mjs`（R3 内）：按顺序启动 R1/R2/R3 并打印三个 URL；`Ctrl+C` 全部停止；**不修改 R1/R2 文件**。

---

## 3. R3 目标

| # | 目标 | 说明 |
|---|---|---|
| 1 | **数据库 Postgres 化** | 用 Postgres 替代 `node:sqlite`；迁移、种子、事务、连接池、错误码、备份 |
| 2 | **应用分层** | L1 逻辑三层（router → services → repositories → Postgres）+ 依赖规则测试；L2 物理三层（web + api + db 容器） |
| 3 | **可部署交付** | Dockerfile + docker compose（app + Postgres，可选 Caddy）；本地容器跑通、健康检查、持久化、备份/恢复 |
| 4 | **遗留漏洞收敛** | codex/cso 的 10 条 findings 逐条关闭或明确降级 |
| 5 | **可复测** | 完成后重跑 codex `/review` + 官方 `/cso`，findings 从 open → closed |
| 6 | **版本隔离** | R1/R2 冻结，R3 独立；三版本可并排演示 |

---

## 4. 功能与非功能需求

### 4.1 Postgres 化与依赖约束

- **数据库**：PostgreSQL **16**（`postgres:16-alpine`，已实测可拉取）。
- **驱动**：仅允许 `pg`（`node-postgres`，实测 `8.23.1` 可用）作为**唯一运行时依赖**。
  - 约束变更：从 R2 的「零第三方依赖」正式改为「**除 `pg` 外零依赖**」；必须在 SPEC、README、CHANGELOG、`docs/decision-log.md` 四处留痕，不得悄悄改。
- **数据迁移**：**不迁移** R2 的 SQLite 演示订单；Postgres 直接建表 + seed（迁移脚本可作为可选教学附加项，不混入主路径）。
- **Schema**（与 R2 语义对齐，类型 Postgres 化）：
  - `users(user_id text pk, username citext/text unique, password_hash text, role text check, created_at timestamptz)`
  - `products(product_id text pk, name, unit, unit_price_cents integer check >=0, stock integer check >=0, listed boolean, image_path, image_alt, description, sort_order)`
  - `orders(order_id bigint generated always as identity pk, order_number text unique, user_id fk, client_order_id text, subtotal_cents integer, created_at timestamptz, unique(user_id, client_order_id))`
  - `order_items(... fk orders, product_id fk products, quantity check, unit_price_cents, subtotal_cents)`
  - `sessions(token_hash text pk, user_id fk, created_at timestamptz, expires_at timestamptz not null)`（新增过期）
- **连接与事务**：`pg.Pool`；`DATABASE_URL` 环境变量；`BEGIN/COMMIT/ROLLBACK` 用同一 client；连接池上限、`statement_timeout`、`lock_timeout` 可配。
- **错误映射**：`23505` 唯一冲突（订单号/幂等键）、`40001/40P01` 重试、`53300` 连接耗尽 → 稳定错误码；不得再依赖 SQLite 的 `BUSY` 字符串。
- **迁移**：启动时执行（幂等）或 `cli db migrate`；`schema_migrations` 表记录版本；`db init/seed/reset/check/backup` 语义按 Postgres 重定义。
- **备份/恢复**：`pg_dump` / `pg_restore` 脚本与文档；`db reset --yes` 先备份 schema+data，失败必须显式报错（直接修 codex High）。

### 4.2 应用分层（L1 逻辑三层）

```
HTTP 层        server/router.mjs           只做协议：解析、状态码、信封、Cookie
应用层         server/services/*.mjs       用例：checkout、lookup、admin、auth session
数据层         server/repositories/*.mjs   只做 SQL/事务/连接池，不含业务分支
领域层         assets/domain.mjs            纯函数（保持不变）
```

- **依赖规则（由测试强制）**：`router` 不得 import `pg` 或 repositories；`services` 不得 import HTTP 对象；`repositories` 不得 import services/router；`domain` 不依赖任何服务端模块。
- 现有 `server/products.mjs`、`orders.mjs`、`auth.mjs` 拆分为 `services/` + `repositories/`；保留对外行为与错误码契约。
- 产出 `docs/architecture.md`（含 ASCII 分层图）与 `docs/contracts.md`（更新）。

### 4.3 物理三层（L2 部署拓扑）

- `docker compose` 三服务：
  - `web`：Caddy（或 Nginx）静态托管 + 反向代理 `/api` → `api`；对外仅暴露 `4175`；
  - `api`：Node 22 + `pg`，不对外暴露端口（仅 compose 内网）；
  - `db`：`postgres:16-alpine`，volume 持久化，不对外暴露（调试用宿主 `55432` 可选）。
- 同源访问（`http://localhost:4175`），避免 CORS；Cookie 仍为同源。
- 保留“两容器”简化模式（`--profile simple`：api+db，无 web）作为对照。
- L3（auth 单独服务）与 L4（全量微服务）**不在 R3**，见 §6。

### 4.4 容器与本地部署

- `Dockerfile`（多阶段）：build 阶段 `npm ci`；运行阶段 `node:22-alpine`、非 root 用户、只拷贝必要文件；`HEALTHCHECK` 调 `/api/health`（含 DB ping）。
- `.dockerignore` 排除 `data/`、`.git/`、`evidence/`、`node_modules` 等。
- `docker-compose.yml`：app + db（+ web）；`depends_on.condition: service_healthy`；`.env.example`；本地 `.env` 不进 git。
- 启动/停止/重启持久化/备份恢复，均给出可复制的命令与证据要求。
- 生产化配置：`PORT`、`DATABASE_URL`、`PUBLIC_URL`、`COOKIE_SECURE`、`DEMO_PASSWORD`（**禁止默认口令上公网**）、日志级别。
- 单实例声明：Postgres 可多连接，但应用按单实例设计；不做水平扩展（写入一致性仍由事务保证）。

### 4.5 安全补漏（R2 findings + 公网前置）

**必须关闭（机械/正确性）**：`db reset` 假成功、`enqueueWrite`/BUSY 映射（Postgres 下改为 SQLSTATE + 重试）、动态路由 405、认证与体校验优先级（按 SPEC 冻结口径，或显式改口径并测试）、`api-client` 超时覆盖响应体、畸形路径参数 500、`id/userId` 形状统一。

**安全边界（R3 放开，不再沿用 R2 的“明确不做”）**：
- 会话 `expires_at` + 校验 + 清理；登出/改密撤销；
- 登录失败限流/退避（内存或 DB 计数，两者取一）；
- CSRF：同源 `Origin` 校验 + CSRF Token（二选一或组合，写清边界）；
- 登录时序枚举：缺失用户也执行 dummy scrypt；
- 403 订单存在性泄露：改为 404 或保留并显式记录（由 spec 的决策点定）；
- 生产口令必须来自环境变量，禁止默认 `demo1234` 进入任何公开部署。

### 4.6 CLI 与配置

```
node cli.mjs dev [--port 4175]           # 本地开发（需 DATABASE_URL，或 compose）
node cli.mjs db migrate|seed|check|backup|reset --yes
node cli.mjs user|product|orders ...     # 语义不变
```

- `--db <path>` 废弃，改为 `--url <DATABASE_URL>` 或环境变量；退出码维持 0/1/2/3/4。
- `serve.mjs` 支持 `--port`、`HOST`、`DATABASE_URL`；`/api/health` 返回 `db: "up|down"`、schema 版本、版本号。

### 4.7 测试

- **测试必须跑真实 Postgres**（Docker 容器，端口 55432 或随机）。
- 隔离策略：每个测试文件/运行创建独立 schema（或 `TRUNCATE`），使用事务回滚；测试结束清理。
- 现有 96 项测试全部保留/改造；新增：并发下单、同幂等键并发、持锁/超时、405 表驱动、校验优先级、api-client 超时、时序枚举（可断言分支而非时间）、会话过期、限流、CSRF。
- 测试计数仍以 `scripts/record-test-count.mjs` 为唯一权威；`node --test` 前置条件（Docker）写入 README。
- `tests/static-scan.test.mjs` 的「无 package.json」断言更新为：**允许 `package.json`，但运行时依赖集合必须恰好是 `{pg}`**。

### 4.8 文档与证据

- 7 环产物：`SPEC.md`、`DECISIONS.md`、`BUILD.md`、`review.md`、`qa-report.md`、`CHANGELOG.md`、`retro.md`。
- `docs/architecture.md`、`docs/contracts.md`、`docs/api.md`、`docs/error-catalog.md`、`docs/deploy.md`、`docs/backup-restore.md`。
- `evidence/`：容器构建/启动/健康/重启持久化/备份恢复、codex 复核、官方 cso 复测、三版本并排截图。
- 义务追溯继续：`OB-*` + `AC-*` 双向引用，`scripts/verify.mjs` 扩展（含 compose 配置检查）。

---

## 5. 验收标准

| # | 验收项 |
|---|---|
| A1 | R1 可独立启动（4173），`r1-fruitlab` Git 工作树干净 |
| A2 | R2 可独立启动（4174），`r2-fruitlab` Git 工作树干净，仍为零依赖 |
| A3 | R3 可独立启动（4175，`docker compose up`），`/api/health` 显示 DB up |
| A4 | R1/R2/R3 同时启动、各自可访问、互不影响；端口/数据/容器名无碰撞 |
| A5 | Postgres 数据在容器/服务重启后仍在（volume 持久化） |
| A6 | 运行时依赖恰好 `{pg}`；无其它第三方依赖；文档与 static-scan 一致 |
| A7 | migrations 与 seed 幂等；`db reset` 失败必须显式报错（codex High 关闭） |
| A8 | 测试（真实 Postgres）全绿；计数唯一来源；README 写明 Docker 前置 |
| A9 | L1 分层成立：依赖规则测试通过；router 不含 SQL，repositories 不含业务分支 |
| A10 | L2 三容器拓扑成立：web/api/db 健康，`/api` 经反代同源可达 |
| A11 | codex/cso findings 逐条关闭或明确降级并留证 |
| A12 | 会话过期、登录限流、CSRF、时序枚举四项按 spec 决策实现并测试 |
| A13 | 容器非 root、healthcheck、优雅停机、日志、`.env` 不入 git、生产口令非默认 |
| A14 | 备份/恢复可用（`pg_dump`/`pg_restore`），有真实命令与证据 |
| A15 | 重跑 codex `/review` 与官方 `/cso`，输出新报告；同族/partial 如实标注 |
| A16 | `3.0.0.0` + CHANGELOG；R1/R2 未被 R3 改动（`git status` 为空） |

---

## 6. 非目标

- **不做完整微服务**（auth/orders/products 各自服务+独立库、服务发现、分布式事务）。
- **不做云平台部署**（Fly/VPS/Vercel/CF）：R3 先交付“镜像 + 本地容器”；平台部署作为 M5 选修，需账号/令牌后再定。
- 不做 Vercel/Cloudflare 运行时改写（与 Postgres 方向亦冲突：D1 是 SQLite）。
- 不做 CI/CD、域名/HTTPS 公网证书（本地容器用 `localhost` 即可；平台部署时再补）。
- 不做水平扩展/读写分离/分库分表；不做多租户。
- 不做真实支付、物流、退款；不做 R1/R2 的任何修改。

---

## 7. 风险

| # | 风险 | 应对 |
|---|---|---|
| 1 | **零依赖约束变更**引发文档/测试/课程口径连锁 | 四处留痕；static-scan 改为“仅 pg”；CHANGELOG 记录 breaking |
| 2 | 测试从 SQLite 迁到真实 Postgres，基础设施与耗時上升 | Docker compose test 服务；schema 隔离；README 明示前置 |
| 3 | SQL 方言/事务/错误码差异导致回归 | 逐条改造 + 并发/唯一冲突/重试测试；错误目录同步 |
| 4 | 端口/容器名/卷与 R1/R2 冲突 | §2.2 固定命名；验收 A4 实跑三版本 |
| 5 | `db reset`、备份恢复的破坏性 | 强制 `--yes` + `pg_dump` 先备份；失败显式退出 |
| 6 | 镜像构建联网/供应链 | 锁定 `pg` 版本与 lockfile；镜像固定 `postgres:16-alpine` digest 可记录 |
| 7 | R2 冻结纪律被破坏 | R3 只写 r3 目录；验收 A1/A2/A16 检查 git status |
| 8 | 平台部署延后导致 ship 仍 `requires-remote` | 本地容器交付作为 R3 的“可部署”验收；平台部署单独 M5 |

---

## 8. 里程碑与 7 环映射

| 里程碑 | 内容 | 对应环 |
|---|---|---|
| M0 | PRD/spec：规格、决策、义务清单 | spec |
| M1 | Postgres 迁移 + L1 分层 + 测试基础设施 | build（前半） |
| M2 | 安全补漏（findings + 会话/限流/CSRF/时序） | build（后半） |
| M3 | Dockerfile + compose（app+db，L2 web） + 本地容器验收 | build/ship |
| M4 | codex `/review` + 官方 `/cso` 复测、qa、ship、retro | review/qa/ship/retro |
| M5（选修） | Fly/VPS/Vercel(Neon) 平台部署（需账号） | 后续迭代 |

**7 环**：spec（本 PRD 为输入）→ autoplan（四方评审，产出义务）→ build（M1–M3）→ review → qa → ship → retro。每环边界停下汇报，得到许可才流转。

---

## 9. 命令与端口速查

```powershell
# R1（冻结）
cd D:\vibecoding\easyvibe\r1-fruitlab; node serve.mjs          # 4173

# R2（冻结）
cd D:\vibecoding\easyvibe\r2-fruitlab; node cli.mjs dev        # 4174

# R3（本轮）
cd D:\vibecoding\easyvibe\r3-fruitlab
docker compose up --build                                      # 4175
node scripts/start-all.mjs                                     # 三版本一起起
```

| 版本 | URL | 数据 |
|---|---|---|
| R1 | http://127.0.0.1:4173 | localStorage |
| R2 | http://127.0.0.1:4174 | `data/fruitlab.db` |
| R3 | http://127.0.0.1:4175 | Postgres volume `fruitlab-r3-pgdata`（宿主 55432） |

---

## 10. 与 R1/R2 的关系（教学叙事）

- **R1**：八环从零做出来，证明“一句话需求 → 可运行、可追溯交付”。
- **R2**：七环做一次真实升级，证明“已交付系统能按流程演进”，并留下 codex/cso 补测发现。
- **R3**：七环做“**补漏 + 换数据库 + 分层 + 可部署**”，证明“系统能安全地离开本机、进入可部署形态”，并让三个版本**同台可演示**。

> 关键教学点：**升级不是覆盖旧版本**。R1/R2 保留原样，R3 在独立目录演进；每个版本都能单独启动、单独讲解、单独回退。
