# FruitLab R3 规格：Postgres 化、逻辑三层与可部署交付

> **状态**：`APPROVED v1.2`（spec 门禁 2026-10-18；autoplan 四方评审后并入 §16；用户已授权代理自审）
> **文档定位**：本文件替代 R2 的 `SPEC.md`。R3 共 **7 环**：spec → autoplan → build → review → qa → ship → retro；PRD 已替代 office-hours，不重跑。
> **上游输入**：`PRD-R3.md`（commit `9042c10`）、`HANDOFF.md` 第七节、R2 的 `SPEC.md`/`DECISIONS.md`/`BUILD.md`/`review.md`/`qa-report.md`/`docs/*`、R2 补测报告（codex `/review` 6 行 / 7 缺陷点 + 官方 `/cso` 4 条）、`evidence/toolchain-recon.md`。
> **基线**：`r3-fruitlab` HEAD `55f2cf0`；`r2-baseline` = R2 `5f4dd87`；R1 `3087a05` 永久冻结，R2 自 R3 起冻结。
> **目标版本**：`3.0.0.0`（ship 环落定）。
> **一句话**：把 R2 的单机 SQLite 应用升级为 **Postgres 16 + L1 逻辑三层 + L2 三容器 + 可备份恢复的可部署形态**，逐条收敛 11 个补测缺陷，并保证 R1/R2/R3 三版本独立可启动、并排可演示。

## 修订记录

| 日期 | 版本 | 变更 |
|---|---|---|
| 2026-10-18 | v1.0-draft | spec 环产出：R3 规格初稿。含 Postgres schema/迁移、L1 分层接口与依赖规则、HTTP 契约与优先级、安全设计（会话过期/限流/CSRF/时序/404）、L2 compose 拓扑、测试策略、AC-49～AC-96、F→OB 追溯设计 |
| 2026-10-18 | v1.1 | 并入语义审查 8 项修订与 codex 同族复核 10 条 findings 的处置：事务/23505 边界与幂等语义、service 工厂与组合根、容器 HOST/Public URL/健康检查 Host、DB 身份变量统一、SemVer 4 段映射、生产模式口令策略、连接池超时与 pool error、XFF 信任与限流上限、输入约束继承、测试处置表口径。跨模型门禁仍 `unavailable`（同族复核不冒充跨模型） |
| 2026-10-18 | v1.2 | autoplan 四阶段（CEO/DES/DX/ENG 均 FAIL）+ v1.1 第二轮同族复核（N-01..N-07）共 42 条发现 → 42 条 `OB-R3-*`；并入 §16：工时 35–45h、结果型 AC-106..118、R2 临时文件持久化、课程矩阵/demo 脚本、DB 身份全变量化、production/classroom seed 拆分、health 3s 时限、迁移 client 级 + advisory lock、锁顺序、异步 scrypt、web healthcheck、restore 停写/单事务、备份恢复契约、两桶限流、CSRF 轮换/恢复、int8 安全解析、路径规范化、quickstart/preflight、CLI 矩阵、陈旧口径扫描、R2 UI 回归 |

---

## 1. Context（为什么做这件事）

R1 交付了单机静态演示（`1.0.0.0`，4173，localStorage，10 商品，62 测试，永久冻结）。R2 交付了带数据库/账号/权限/管理员/CLI 的可运行系统（`2.0.0.0`，4174，`node:sqlite`，零第三方依赖，96 测试，QA 95，42 义务关闭，G1–G7 关闭），并在 ship/retro 之后做了补测：codex 第二智能体 6 行 findings（1 High）、官方 `/cso` 4 条 findings（3 Medium、1 Low），全部 `open`。

R3 是课程的第三幕：**补漏 + 换数据库 + 分层 + 走向可部署**。它要回答三个课堂问题：

1. 一个"跑在本机"的系统，离开本机需要补什么？（Postgres、连接池、事务、迁移、容器、健康检查、备份恢复、生产口令纪律）
2. 单进程同步数据库的代码，怎么在**不改变用户可见契约**的前提下拆成三层？（router → services → repositories）
3. 10 条 findings（11 个缺陷点）如何**逐条关闭或明确降级**，并留下可复测的证据？

同时，R3 必须遵守课程最硬的一条原则：**升级不覆盖旧版本**。R1/R2 一行不改，R3 只写自己的目录。

## 2. Current State（实测基线，不是复述）

| 项 | 实测值 | 证据 |
|---|---|---|
| 运行时 | Node `v22.20.0`；npm `10.9.3`；registry `https://registry.npmmirror.com` | `node --version`、`npm config get registry` |
| 依赖 | R2 无 `package.json`，零第三方依赖；`pg 8.23.1` 可安装 | `npm view pg version`、目录实查 |
| 数据库 | R2 `node:sqlite` 单文件 `data/fruitlab.db`；R3 目标 Postgres 16 | `server/db.mjs:1-173` |
| Docker | **Windows Docker Desktop 引擎未运行**；WSL Docker `29.9.1` + Compose `v5.6.0` 可用 | `docker version` 失败、`wsl -e docker version` 成功 |
| Postgres 可达性 | WSL `postgres:16-alpine` 以 `-p 55432:5432` 启动后，Windows `127.0.0.1:55432` **TCP OPEN**、`pg_isready` accepting | 本轮 spike（`evidence/spec-forensics.md` §1） |
| 镜像 | `postgres:16-alpine`、`node:22-alpine`、`caddy:2-alpine` 本地已有 | `wsl -e docker image ls` |
| codex | `C:\Users\cheng\AppData\Local\OpenAI\Codex\bin\9614f1d9b40d9c4f\codex.exe`（`0.162.0-alpha.17.2`，不在 PATH） | 存在性检查 |
| cso launcher | WSL `/mnt/c/Users/cheng/gstack/bin/gstack-cso-launcher` `3.0.0 (abi 3)` | `--version` 实测 |
| Git | R1 `3087a05` 干净；R2 `5f4dd87` 干净；R3 `55f2cf0` 干净（相对 `r2-baseline` 仅 PRD+README） | `git status --short`、`git diff --stat` |
| R2 测试 | 96 项（96 pass / 0 fail）；唯一计数 `evidence/test-count.txt` | 继承的计数文件 |
| R2 findings | codex 6 行 / 7 缺陷点；cso 4 条；全部 `open` | `evidence/ring-review-codex.md`、`evidence/ring-review-cso.md` |

**R2 → R3 的耦合点清单**（32 项，逐项含 `file:line`、替代形态、受影响测试）见 `evidence/spec-forensics.md` §2；本文不重复。

## 3. Decision Resolution（本规格锁定的决策）

> 编号续 R2（其 `docs/decision-log.md` 已用到 D-46）。用户已授权执行代理自行拍板；每条在 `docs/decision-log.md` 追加留痕。

| # | 决策 | 选择 | 理由 / 边界 |
|---|---|---|---|
| D-47 | 数据库 | **PostgreSQL 16**（`postgres:16-alpine`），`pg.Pool` 连接池，`DATABASE_URL` | PRD 已定；WSL 端口实证可行 |
| D-48 | 依赖 | 运行时依赖**恰好 `{pg}`**（`8.23.1`）；提交 `package-lock.json`；`npm ci` 可复现 | 对"零依赖"的正式变更；R2 仍零依赖，口径不得混用 |
| D-49 | 数据 | **不迁移** R2 SQLite 数据；Postgres 空库 + 迁移 + seed；迁移脚本不进主路径 | PRD 已定；避免"假平滑迁移" |
| D-50 | 用户名 | `text UNIQUE`，保持**大小写敏感**（不引入 `citext` 扩展） | 保留 R2 行为；避免扩展安装依赖 |
| D-51 | L1 分层 | `router → services → repositories → Postgres`；`domain` 纯函数不动；`db.mjs` 只做池/迁移/事务 | 依赖规则由测试机械断言（§5.3） |
| D-52 | L2 拓扑 | 默认 **web(Caddy)+api(Node)+db(Postgres)** 三容器；另提供 `compose.simple.yml`（api+db）对照 | PRD §4.3；web 只暴露 4175，api/db 不对外 |
| D-53 | 会话 | `expires_at`（`SESSION_TTL_SECONDS`，默认 86400s）；Cookie `Max-Age` 跟随；登录轮换旧会话；过期惰性/启动清理 | 关闭 S-3；无改密 API，故"改密撤销"不适用并记录 |
| D-54 | 登录限流 | **内存**计数，键 `username+IP`，15 分钟窗口失败 5 次 → 锁定 15 分钟，`429 auth-rate-limited` + `Retry-After`；成功清零 | 单实例设计；DB 计数会引入写热点 |
| D-55 | CSRF | 带会话的写请求要求**双提交**：`fruitlab_csrf` Cookie（JS 可读）+ `X-CSRF-Token` 头，常量时间比较；同时保留严格 `Origin`/`Sec-Fetch-Site`。登录/注册无会话，仅 Origin 校验 | 组合方案；边界写入 §5.5 与 README，不写成"完整 CSRF 防护" |
| D-56 | 登录时序 | 缺失用户也执行一次 **dummy scrypt** + `timingSafeEqual`；两条路径各一次 verify | 关闭 S-1；只声称"降低到不可测量"，不声称"消除" |
| D-57 | 越权返回码 | 他人订单返回 **404 `order-not-found`**；admin 可查任意订单 | **supersede D-32**；R3 面向可部署形态，消除存在性泄露；课堂演示改为"资源不存在" |
| D-58 | 判定优先级 | 冻结并实现：Host → Origin/Sec-Fetch → 体协议(415/413/400) → 405 → 401 → CSRF 403 → 角色 403 → 404 → 字段 400 → 业务 409 → 登录失败 401 / 限流 429 → 5xx | 关闭 C-4；与 R2 `SPEC.md` §5.2 冻结顺序一致（415 归入体协议） |
| D-59 | `db reset` | 先**真实备份**（SQL 逻辑导出；失败即中止）→ 事务内 drop/migrate/seed → 重建后校验（schema 版本/种子计数）→ 任一步失败非零退出并保留原库 | 关闭 C-1；不再有"复制文件+忽略删除失败"的假成功 |
| D-60 | 测试数据库 | 真实 Postgres；`TEST_DATABASE_URL`（默认 `postgres://postgres:postgres@127.0.0.1:55432/postgres`）；**每个测试用例独立数据库**，结束清理；连不上时 fail fast 并给出启动命令 | 关闭"SQLite 临时库"；隔离靠 `CREATE DATABASE` |
| D-61 | 静态与 web | 抽 `server/allowlist.mjs` 单一白名单；Node 服务在 simple 模式继续托管静态；L2 的 web 用 `scripts/build-public.mjs` 按白名单生成 `public/` 后由 Caddy 托管 | 白名单机械一致；不把 server 代码暴露给 web |
| D-62 | 健康检查 | `/api/health` 200 `{db:"up", schemaVersion, version, seeded, uptimeSeconds}`；DB down → **503** `{code:"db-unavailable", db:"down"}` | 供 compose healthcheck 与 A3/A5 |
| D-63 | 编号 | AC 续号 `AC-49` 起；决策续号 `D-47` 起；义务 `OB-R3-<PHASE>-NN`；缺陷 `F-R3-NN` | 避免与 R2 冻结编号歧义 |
| D-64 | 依赖扫描 | `static-scan` 断言：**允许 `package.json`，但 `dependencies` 集合恰好 `{pg}`**；无 devDependencies 参与运行时 | 关闭 R2 的"无 package.json"断言 |
| D-65 | 命名隔离 | compose 项目 `fruitlab-r3`；api 镜像 `fruitlab-r3:3.0.0.0`；web 镜像 `fruitlab-r3-web:3.0.0.0`；卷 `fruitlab-r3-pgdata`；端口 `4175`（web）/`55432`（调试）/`3000`（api 容器内）/`5432`（db 容器内） | PRD §2.2；A4/A6/A16 |
| D-66 | 备份 | `cli db backup` = SQL 逻辑导出（跨平台可跑，reset 的保险）；`scripts/backup.sh` / `restore.sh` = 容器内 `pg_dump`/`pg_restore`（A14 证据） | 两条路径都真实，不互相冒充 |
| D-67 | 生产口令 | `APP_ENV=production` 时 `DEMO_PASSWORD` 必填；缺失 → seed 明确失败；compose 用 `.env`，`.env` 不入 git，`.env.example` 只放占位符 | PRD §4.4；禁止默认 `demo1234` 进公开部署 |
| D-68 | Cookie | `HttpOnly; SameSite=Lax; Path=/; Max-Age=TTL`；`COOKIE_SECURE=1` 时加 `Secure`（本地默认 0） | 本地 localhost 无 TLS；上公网前必须置 1 |
| D-69 | 独立评审 | review 环用 **codex 子代理**执行只读复核；cso 用**官方 launcher** 真实 `start→submit→finish`；跨模型门禁仍记 `unavailable` | 用户明确要求；同族不冒充跨模型 |
| D-70 | 三版本启动 | `scripts/start-all.mjs`：R1 `node serve.mjs`、R2 `node cli.mjs --db :memory: dev`（内存库，避免写 R2 目录）、R3 `wsl -e docker compose up --build`；`Ctrl+C` 先停 R3 再停 Node | 不修改 R1/R2 文件；证据在 qa 环 |
| D-71 | 反代客户端 IP | Caddy 覆盖 `X-Forwarded-For`；api 仅在 `TRUST_PROXY=1` 且来自 compose 内网时信任；限流 Map 限键长/容量 | 关闭 F-08；防止伪造 XFF 绕过限流 |
| D-72 | 版本映射 | `VERSION` 保持 `3.0.0.0`（课程口径）；`package.json` 用合法 SemVer `3.0.0`；映射写入版本校验脚本 | 关闭 F-05；不破坏 `npm ci` |
| D-73 | 生产模式 | `APP_ENV=production` 要求独立 `ADMIN_PASSWORD`（≥12、非默认）、`COOKIE_SECURE=1`；不 seed `userA/userB` | 关闭 F-06；演示口令只留在 classroom |
| D-74 | 幂等/订单号事务边界 | 事务内**先插 orders 预留幂等**，再扣库存；`23505` 先 ROLLBACK 再回查/重试；重试回调无外部副作用 | 关闭 F-01；不重复扣库存、不产生空单 |
| D-75 | 组合根与工厂 | `server/app.mjs` 建池/迁移/seed/构造 services；各 service 用 `createXxxService(deps)`；router 只收已构造 services | 关闭 F-02；依赖注入与签名可测 |
| D-76 | 连接池故障 | `connectionTimeoutMillis`（默认 5000）、`idleTimeoutMillis`、`pool.on("error")`；池超时/连接终止 → `db-unavailable` 503 | 关闭 F-07；health 不挂起 |
| D-77 | Host/公开地址 | `PUBLIC_URL` 派生外部 Host；另允许 `127.0.0.1:<PORT>`/`localhost:<PORT>`（healthcheck）；api 容器 `HOST=0.0.0.0` | 关闭 F-03；Caddy→api 与 healthcheck 均通 |
| D-78 | DB 身份 | `POSTGRES_USER`/`POSTGRES_DB`/`POSTGRES_PASSWORD` 同源生成 `DATABASE_URL`、`pg_isready`、备份参数 | 关闭 F-04；空卷首启成功 |
| D-79 | 输入约束继承 | `clientOrderId` 8–128、maxItems 10、重复 productId 合并、username/password/价格/库存边界；DB `CHECK` 同步 | 关闭 F-10；与 R2 契约一致 |
| D-80 | 测试处置口径 | BUILD.md 逐测试处置表：原样保留/等价迁移/预期契约变更/删除理由；变更仅限已定决策 | 关闭 F-09；AC-91 可机械核对 |
| D-81 | 门禁复核 | codex 同族复核 10 条全部处置（采纳/部分采纳并改 SPEC）；跨模型仍 `unavailable` | 不冒充跨模型；处置见 evidence |

## 4. Proposed Change（目标与验收映射）

| 目标 | 内容 | 验收 |
|---|---|---|
| Postgres 化 | 连接池、迁移、种子、事务、SQLSTATE、health、备份 | AC-49～AC-58 |
| L1 分层 | router/services/repositories + 依赖规则 + 契约冻结 | AC-59～AC-61 |
| 正确性与并发 | 库存原子扣减、幂等、并发、死锁重试、404 越权 | AC-62～AC-69 |
| 11 个缺陷点（10 条 findings） | C-1..C-7、S-1..S-4 逐条关闭/降级 | AC-70～AC-80 |
| 安全边界 | 会话过期、限流、CSRF、时序、生产口令 | AC-77～AC-83 |
| L2 与可部署 | Dockerfile ×2、compose、Caddy、非 root、healthcheck、volume、备份恢复 | AC-84～AC-89 |
| 证据与文档 | 唯一计数、codex/cso、三版本并排、追溯、verify | AC-90～AC-96 |
| 版本隔离 | R1/R2 零改动、命名/端口无碰撞 | AC-49/50/51/52/88 |
| 复核修订 | codex 同族复核 F-01..F-10 的修订落到可测 AC | AC-97～AC-105 |

### 4.1 课程目标 → 课堂结果 → 验收（CEO-04）

| 课程目标 | 课堂可观察结果 | 对应 AC / 证据 |
|---|---|---|
| Postgres 与数据一致性 | 重启后订单/库存在；并发下单不超卖；DB down 时页面给出降级而不是白屏 | AC-62/63/85/108；容器重启日志、并发测试 |
| 逻辑三层与契约 | 改 service 不改 router；依赖规则测试能指出越层；错误码/优先级可机械核对 | AC-59/60/61/72/73；layering/contracts 测试 |
| 物理三层与可部署 | `4175` 经 Caddy 访问；三容器健康；非 root；备份→毁库→恢复一致 | AC-84/86/87/109；compose ps、pg_dump/restore 证据 |
| 安全补漏与质量闭环 | 11 个缺陷逐条关闭/降级；会话过期/限流/CSRF/时序可演示 | AC-68..83；obligations 台账、codex/cso 报告 |
| 版本隔离与教学叙事 | R1/R2/R3 同台；R2 仍能展示 SQLite 文件持久化 | AC-49..53/111；三版本并排截图、demo 脚本 |

## 5. Implementation Details

### 5.1 Postgres schema 与迁移

迁移文件：`server/migrations/0001_init.sql`（后续只追加，不改已发布文件）；加载器按文件名排序，在**单事务**内执行并写 `schema_migrations`。启动时自动迁移（幂等）；`cli db migrate` 可手动执行。

```sql
CREATE TABLE IF NOT EXISTS schema_migrations (
  version    integer PRIMARY KEY,
  name       text NOT NULL,
  applied_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS users (
  user_id       text PRIMARY KEY,
  username      text NOT NULL UNIQUE,
  password_hash text NOT NULL,
  role          text NOT NULL CHECK (role IN ('user','admin')),
  created_at    timestamptz NOT NULL
);

CREATE TABLE IF NOT EXISTS products (
  product_id       text PRIMARY KEY,
  name             text NOT NULL,
  unit             text NOT NULL,
  unit_price_cents bigint NOT NULL CHECK (unit_price_cents >= 0),
  stock            integer NOT NULL CHECK (stock >= 0),
  listed           boolean NOT NULL,
  image_path       text NOT NULL,
  image_alt        text NOT NULL,
  description      text NOT NULL,
  sort_order       integer NOT NULL
);

CREATE TABLE IF NOT EXISTS orders (
  order_id        bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  order_number    text NOT NULL UNIQUE,
  user_id         text NOT NULL REFERENCES users(user_id),
  client_order_id text NOT NULL CHECK (char_length(client_order_id) BETWEEN 8 AND 128),
  subtotal_cents  bigint NOT NULL CHECK (subtotal_cents >= 0),
  created_at      timestamptz NOT NULL,
  CONSTRAINT ux_orders_user_client UNIQUE (user_id, client_order_id)
);

CREATE TABLE IF NOT EXISTS order_items (
  item_id          bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  order_id         bigint NOT NULL REFERENCES orders(order_id) ON DELETE CASCADE,
  product_id       text NOT NULL REFERENCES products(product_id),
  quantity         integer NOT NULL CHECK (quantity BETWEEN 1 AND 99),
  unit_price_cents bigint NOT NULL CHECK (unit_price_cents >= 0),
  subtotal_cents   bigint NOT NULL CHECK (subtotal_cents >= 0)
);

CREATE TABLE IF NOT EXISTS sessions (
  token_hash text PRIMARY KEY,
  user_id    text NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL,
  expires_at timestamptz NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_orders_user ON orders(user_id);
CREATE INDEX IF NOT EXISTS idx_order_items_order ON order_items(order_id);
CREATE INDEX IF NOT EXISTS idx_sessions_user ON sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_sessions_expires ON sessions(expires_at);
```

**不变量（测试断言）**：

1. `username`、`order_number` 唯一；`(user_id, client_order_id)` 唯一；
2. 金额一律整数分（`bigint`，驱动侧 `int8` 解析为 `Number`；演示数据远小于 `2^53`，在 `server/db.mjs` 显式设置并注明边界）；
3. 订单行快照写入时冻结，后续改价不影响历史；
4. `listed=false` 不出现在公开列表；零库存仍出现并显示售罄；
5. 主单合计 = 明细合计之和（事务内断言，不等回滚）；
6. 删除商品不删除历史订单行（外键默认 `NO ACTION`，商品不物理删除，仅下架）；
7. 列表顺序确定：商品 `ORDER BY sort_order, product_id`；订单 `ORDER BY created_at DESC, order_id DESC`。

**种子**（§16 优先，D-91）：`seedClassroom` 写 14 商品 + 3 账号（`userA`/`userB`/`admin`）；`seedProductionAdmin` 只写 14 商品 + `admin`（不建演示用户）。`ON CONFLICT DO NOTHING` 幂等；口令只存 `scrypt` 哈希。`APP_ENV=production` 时用 `ADMIN_PASSWORD`（D-67 superseded）。

### 5.2 连接、事务、错误映射

- `server/db.mjs` 导出：`createPool({connectionString, max, connectionTimeoutMs, idleTimeoutMs, statementTimeoutMs, lockTimeoutMs})`、`migrate(pool)`、`withTransaction(pool, fn)`、`closePool(pool)`、`schemaVersion(pool)`、`isSeeded(pool)`。
- 连接参数：`max`（默认 10）、`connectionTimeoutMillis`（默认 5000ms）、`idleTimeoutMillis`（默认 30000ms）、`statement_timeout`（默认 15000ms）、`lock_timeout`（默认 5000ms）、`application_name=fruitlab-r3`；均可由环境变量覆盖。
- 启动：连接重试（最多 30 次，指数退避 250ms→2s），全部失败 → 进程退出 1 并打印可操作错误；成功后 `migrate` + 按需 seed。
- 事务：同一 `client` 执行 `BEGIN/COMMIT/ROLLBACK`；`withTransaction` 在 `40001`（serialization_failure）与 `40P01`（deadlock_detected）上做**有界重试 3 次**（25/50/100ms），耗尽抛 `server-busy`。回调必须是事务内、无外部副作用的操作（可重放）。
- **23505 事务边界（不可在 aborted 事务里查库）**：任何语句抛 `23505`/`23514`/`23503` 后，必须 `ROLLBACK` 整事务，再由 service 在新事务里回查或重试；禁止在失败事务内继续 `SELECT`（会得到 `25P02`）。
- **连接池故障**：`connectionTimeoutMillis` 保证池耗尽时不无限等待；监听 `pool.on("error")` 记录并丢弃坏连接；本地池超时、`ETIMEDOUT`/`ECONNRESET`/`Connection terminated` 与连接类 SQLSTATE 统一映射 `db-unavailable` 503；DB 重启后池自动恢复。
- **checkout 事务顺序（F-01）**：校验/合并 → 事务外幂等预查 → 事务内先 `INSERT orders`（幂等预留）→ 条件扣库存（影响行数=1）→ 插 `order_items` → 合计断言 → COMMIT。`ux_orders_user_client` 冲突：ROLLBACK → 新事务回查 → 200 existing；`orders_order_number_key` 冲突：ROLLBACK → 重新生成 → 重试整事务（≤10）；库存不足：ROLLBACK → 409。此顺序保证幂等冲突发生在扣库存之前，不会重复扣减。
- 错误映射表（`server/errors.mjs` 镜像，`docs/error-catalog.md` 唯一真源）：

| SQLSTATE / 条件 | 应用错误码 | HTTP | 备注 |
|---|---|---|---|
| `23505` on `users_username_key` | `auth-username-taken` | 409 | 注册重复 |
| `23505` on `orders_order_number_key` | 重新生成订单号（≤10 次） | — | 耗尽 → `order-number-exhausted` 409 |
| `23505` on `ux_orders_user_client` | 回查已有订单 → `200 existing` | 200 | 幂等 |
| `40001` / `40P01` | 重试；耗尽 `server-busy` | 503 | 有界 |
| `57014`（statement_timeout）/ `55P03`（lock_timeout） | `server-busy` | 503 | 可重试 |
| `53300`（too many connections）/ `08006` / `ECONNREFUSED` | `db-unavailable`（健康检查为 `down`） | 503 | 新增码 |
| 其它 | `internal-error`（脱敏，日志带 requestId） | 500 | 不回显堆栈 |

### 5.3 L1 分层与接口冻结

```text
HTTP        server/router.mjs          只做协议：Host/Origin、体读取、405、信封、Cookie、状态码
应用        server/services/*.mjs      用例：register/login/logout/me、catalog、checkout、lookup、health
数据        server/repositories/*.mjs  只做 SQL/事务/映射，不含业务分支
基础设施    server/db.mjs               Pool、迁移、事务、SQLSTATE → 错误
领域        assets/domain.mjs          纯函数（签名与实现不变）
```

**依赖规则（`tests/layering.test.mjs` 机械断言）**：

1. `router.mjs` 不得 import `pg`、`server/repositories/*`、`server/db.mjs`；不得出现 SQL 关键字（`SELECT|INSERT|UPDATE|DELETE|BEGIN|COMMIT` 作为语句）；
2. `services/*` 不得 import `node:http`/`node:https`/`serve.mjs`/`router.mjs`；不得读 `req`/`res`；
3. `repositories/*` 不得 import `services/*`/`router.mjs`/`serve.mjs`；
4. `assets/domain.mjs` 不得 import 任何 `server/*`/`node:http`/`node:fs`；
5. `server/errors.mjs` 不依赖上层（只被依赖）；
6. services 只通过注入的 repositories/pool 访问数据；repositories 不抛业务语义错误，返回行或抛数据库错误由 services 翻译。

**模块与导出（`docs/contracts.md` 冻结）**：

| 模块 | 导出（签名） |
|---|---|
| `server/db.mjs` | `createPool(config)`, `migrate(pool)`, `withTransaction(pool, fn)`, `schemaVersion(pool)`, `isSeeded(pool)`, `closePool(pool)` |
| `server/repositories/users.mjs` | `findByUsername(pool, username)`, `findById(pool, id)`, `create(pool, {user})`, `list(pool)` |
| `server/repositories/sessions.mjs` | `create(pool, {tokenHash, userId, createdAt, expiresAt})`, `findUserByToken(pool, tokenHash, now)`, `deleteByToken(pool, tokenHash)`, `purgeExpired(pool, now)` |
| `server/repositories/products.mjs` | `list(pool, {includeUnlisted})`, `get(pool, id)`, `update(pool, id, patch)` |
| `server/repositories/orders.mjs` | `create(client, {orderNumber, userId, items, clientOrderId, subtotalCents, createdAt})`、`deductStock(client, {productId, quantity})`、`createItems(client, orderId, lines)`、`findByClientOrderId(clientOrPool, userId, clientOrderId)`、`findByNumber(pool, orderNumber)`、`listByUser(pool, userId, {limit})`、`listAll(pool, {limit})`、`itemsByOrderIds(pool, ids)`；事务边界由 service 用 `withTransaction` 控制 |
| `server/app.mjs` | `createApp({config, clock})` → `{handler, pool, services, close}`：组合根（建池→迁移→按需 seed→构造 services），供 `serve.mjs`/`cli.mjs` 复用 |
| `server/services/index.mjs` | `createServices({pool, config, clock, rateLimiter})` → `{auth, catalog, orders, health}` |
| `server/services/auth.mjs` | `createAuthService({repos, config, clock})` → `{register, login, logout, me, dummyVerify, resetRateLimiter}` |
| `server/services/catalog.mjs` | `createCatalogService({repos})` → `{listPublic, listAdmin, updateProduct}` |
| `server/services/orders.mjs` | `createOrderService({pool, repos, clock, config})` → `{checkout, listMine, getForViewer, listAll}` |
| `server/services/health.mjs` | `createHealthService({pool, config, clock})` → `{health}` |
| `server/router.mjs` | `createApiHandler({services, config})` → `(req,res)=>Promise<boolean>` |
| `server/allowlist.mjs` | `PUBLIC_ALLOWLIST`, `IMAGE_RE`, `isAllowedPublicPath(pathname)`, `listPublicFiles()` |
| `serve.mjs` | `createStaticServer({port, host, services, config})`、`parseCliArgs`、`main` |
| `config.mjs` | `loadConfig(env)`（PORT、HOST、`PUBLIC_URL`、DATABASE_URL、TTL、Cookie、限流、`TRUST_PROXY`、APP_ENV、`DEMO_PASSWORD`、`ADMIN_PASSWORD`） |

### 5.4 HTTP API 契约（在 R2 基础上变更）

统一前缀 `/api`；成功 `{ok:true,...}`；失败 `{ok:false,code,message,details?}`。**所有响应**带 `X-Request-Id` 与 `Cache-Control: no-store`。

| 方法 | 路径 | 权限 | 变更 |
|---|---|---|---|
| `GET` | `/api/health` | 公开 | 新增 `db`/`schemaVersion`；DB down → 503 |
| `GET` | `/api/products` | 公开 | 不变 |
| `POST` | `/api/auth/register` | 公开 | 返回 `{user:{id,username,role}}`；CSRF 不要求（无会话） |
| `POST` | `/api/auth/login` | 公开 | 统一 user 形状；`Set-Cookie` 会话（`Max-Age`）+ CSRF cookie（若缺失）；429 限流 |
| `POST` | `/api/auth/logout` | 会话（可选） | 有会话时要求 CSRF；204 + 清两个 Cookie |
| `GET` | `/api/auth/me` | 公开 | 返回 `{user:{id,username,role}}`（统一形状，C-7）；401 |
| `POST` | `/api/orders` | 登录 + CSRF | 201/200；幂等；并发安全 |
| `GET` | `/api/orders/mine` | 登录 | 不变 |
| `GET` | `/api/orders/{orderNumber}` | 登录 | **他人订单 → 404**；admin 任意；安全解码 |
| `GET` | `/api/admin/orders` | admin | 不变 |
| `GET` | `/api/admin/products` | admin | 不变（含下架） |
| `PATCH` | `/api/admin/products/{id}` | admin + CSRF | 安全解码；405 表补全 |

**405 形状表**（在任何业务分派前判定；`Allow` 头必须准确）：

| 路径模式 | 允许方法 |
|---|---|
| `/api/health`、`/api/products`、`/api/auth/me`、`/api/orders/mine`、`/api/admin/orders`、`/api/admin/products` | `GET` |
| `/api/auth/register`、`/api/auth/login`、`/api/auth/logout`、`/api/orders` | `POST` |
| `/api/orders/{orderNumber}` | `GET` |
| `/api/admin/products/{id}` | `PATCH` |

**Host/Origin 允许集合（派生规则，F-03）**：`config.publicOrigin`（`PUBLIC_URL`，默认 `http://127.0.0.1:4175`）→ 允许 `publicOrigin.host`；另允许 `127.0.0.1:<PORT>` 与 `localhost:<PORT>`（容器内 healthcheck 用）；容器内 `HOST=0.0.0.0`。Caddy 必须保留外部 Host（`header_up Host {http.request.host}`）；web 容器 healthcheck 访问 api 时使用 public origin 的 Host。直连 simple 模式 PORT=4175，集合一致。

**判定优先级（冻结，D-58）**：

| 顺序 | 判定 | 结果 |
|---:|---|---|
| 1 | Host 不在允许集合 | 403 `host-not-allowed` |
| 2 | Origin / Sec-Fetch-Site 跨源 | 403 `cross-origin-blocked` |
| 3 | 体协议（POST/PATCH）：Content-Type 非 JSON → 415；体 >64 KiB → 413；非法 JSON → 400 `invalid-json` | 415 / 413 / 400 |
| 4 | 方法不允许（已知路由） | 405 + `Allow` |
| 5 | 无有效会话（受保护路由） | 401 `auth-required` |
| 6 | 带会话的写请求 CSRF 缺失/不符 | 403 `csrf-token-invalid` |
| 7 | 角色不足 | 403 `auth-forbidden` |
| 8 | 资源不存在（含**他人订单**） | 404 |
| 9 | 字段缺失/类型错 | 400 `invalid-request` |
| 10 | 业务校验（数量/价格/库存/上下架/重名） | 400 / 409 |
| 11 | 登录限流触发（在凭证校验之前） | 429 `auth-rate-limited` + `Retry-After` |
| 12 | 登录失败（凭证错误/用户不存在） | 401 `auth-invalid-credentials` |
| 13 | 服务端异常/忙/库不可用 | 500 / 503 |

> 登录路径：1 → 2 → 3 → 4 → 11（限流）→ 凭证校验 → 12（失败）/ 成功。
> 登录/注册不要求 CSRF token（无会话，靠 1/2 与 415/413 限制）；该边界写入 §5.5 与 README，不称"完整 CSRF 防护"。

**新增/变更错误码**：`csrf-token-invalid`(403)、`auth-rate-limited`(429)、`db-unavailable`(503)；移除 `order-not-owned`（D-57），`docs/error-catalog.md` 与 `tests/contracts.test.mjs` 同步。

### 5.5 安全设计

- **会话**：32 字节随机 token，库中只存 `sha256`；`expires_at = now + SESSION_TTL_SECONDS`；每次解析校验未过期；过期行惰性删除 + 启动清理；登录时删除当前 Cookie 对应旧会话并轮换；登出删除服务端行；Cookie `HttpOnly; SameSite=Lax; Path=/; Max-Age=TTL`，`COOKIE_SECURE=1` 时 `Secure`。
- **登录限流**（D-54/D-77，F-08）：内存 `Map<username|ip, {fails, firstAt, lockedUntil}>`；15 分钟窗口失败 5 次锁定 15 分钟；命中返回 429 + `Retry-After`；成功清零；定期清理过期条目；测试用可注入时钟。客户端 IP：**Caddy 必须覆盖** `X-Forwarded-For` 为 `{remote_host}`（不追加客户端自带值）；api 仅在 `TRUST_PROXY=1` 时信任该头，且只信任来自 compose 内网的请求；`TRUST_PROXY=0` 用 socket 地址。限流 Map 限制键长度（≤128）与条目上限（默认 10000，LRU 淘汰）。测试覆盖伪造 XFF 在 0/1 下的行为。边界：单实例、进程重启清零，不防分布式撞库，写入 README。
- **CSRF**（D-55）：安全方法（GET/HEAD）在响应缺失时下发 `fruitlab_csrf`（32 字节随机，非 HttpOnly，`SameSite=Lax`）；登录成功响应也补发（若缺失）；带会话的 `POST/PATCH/DELETE` 必须带 `X-CSRF-Token` 且与 Cookie 常量时间相等；否则 403 `csrf-token-invalid`。前端 `api-client` 自动读取 Cookie 并在写请求带头；Cookie 缺失时先 `GET /api/health` 取一次再重试（只重试一次）。
- **时序枚举**（D-56）：启动时生成一次 `DUMMY_HASH`（随机盐的 scrypt 哈希）；用户不存在时执行 `verifyPassword(password, DUMMY_HASH)`，存在时执行真实 `verifyPassword`；两条路径都只做一次 scrypt；报告写"降低到不可测量"，测试断言 dummy 分支被调用（注入计数），不做脆弱时间断言。
- **越权**：他人订单统一 404；admin 任意读；管理接口角色校验；静态层沿用 R1/R2 的穿越防护。
- **生产加固**（D-67/D-73，F-06）：`APP_ENV=production` 时必须提供 `ADMIN_PASSWORD`（≥12 字符、≠`demo1234`、且不等于 `DEMO_PASSWORD`），必须 `COOKIE_SECURE=1`；生产模式只 seed 14 商品 + `admin`，**不创建 `userA`/`userB`**；`DEMO_PASSWORD` 仅 development/classroom 使用，默认值只在 localhost 生效；`POSTGRES_PASSWORD`/`POSTGRES_USER`/`POSTGRES_DB` 由 `.env` 提供，compose 用 `${...:?}` 强制；`.env` gitignore；README 分列 classroom 默认与 production checklist。
- **明确边界**：无 HTTPS（`COOKIE_SECURE` 需部署方开启）、无审计日志、无多租户、无水平扩展；403→404 的课堂演示取舍写入 `docs/decision-log.md`。

### 5.6 CLI 与配置

```text
node cli.mjs [--url <DATABASE_URL>] [--json] <command>
  dev [--port <0-65535>]                 # 迁移 + 按需 seed + 启动（simple 模式含静态）
  db migrate | seed | check | backup [--out <dir>] | reset --yes [--out <dir>]
  user list | add --username <u> --password-stdin [--role user|admin]
  product list [--all] | set-price --id <id> --unit-price-cents <n> | set-stock --id <id> --stock <n>
          | unlist --id <id> | relist --id <id>
  orders list [--user <username>] | show <orderNumber>
  --help | --version
```

- `--db <path>` **移除**；数据库只由 `--url` 或 `DATABASE_URL` 指定（`--db` 出现即用法错误，退出 2，并提示改用 `--url`）；
- 退出码保持 `0/1/2/3/4`（成功/业务失败/用法/暂时性/内部）；stdout 数据、stderr 诊断；
- `db backup`：SQL 逻辑导出（`schema_migrations` 版本 + 每表 JSON Lines）到 `--out`，失败非零；`db reset --yes` 必须先成功 backup，再事务重建并校验，任一步失败非零且原库保留；
- `db check`：连接、迁移版本是否为最新、关键约束存在、种子计数、`SELECT 1`；
- 生产口令检查（§16/D-91）：`APP_ENV=production` 时缺 `ADMIN_PASSWORD`、`ADMIN_PASSWORD=demo1234`、长度 <12 或 `COOKIE_SECURE≠1` → seed/`dev` 退出 1 并提示；`DEMO_PASSWORD` 只在 classroom/development 使用。

### 5.7 测试策略（真实 Postgres）

- 前置：`TEST_DATABASE_URL`（默认 `postgres://postgres:postgres@127.0.0.1:55432/postgres`）；README 给出启动命令：
  `wsl -e docker run -d --rm --name fruitlab-r3-test-pg -e POSTGRES_PASSWORD=postgres -p 55432:5432 postgres:16-alpine`
- `tests/helpers/pg.mjs`：`createTestDatabase({seed=true})` → 唯一库名 `fruitlab_test_<random>`、`CREATE DATABASE`、`migrate`、`seed`；`close()` 断开并 `DROP DATABASE`；连接失败时**抛可操作错误**（不是 skip）。
- 隔离：每个测试用例一个数据库（CREATE/DROP），文件级并行由 `node --test` 调度；并发用例在同一库内用两个 Pool 验证。
- 原有 96 项迁移原则：纯逻辑（domain/controller/app/assets）保留；DB/auth/CLI/API 按 PG 重写并保留断言意图，逐项对照表进 `BUILD.md`；计数以 `scripts/record-test-count.mjs` 为唯一权威（追加 `treeStatus`/`treeHash`，见 `evidence/spec-forensics.md` §5）。
- 新增覆盖：迁移/种子幂等、约束、事务回滚、并发不超卖、同幂等键并发、死锁/锁超时重试、405 表驱动、优先级组合、CSRF、限流、会话过期/轮换、dummy scrypt 分支、畸形编码、`/auth/me` 形状、api-client 响应体超时、`db reset` 失败路径、`db backup` 往返、compose 静态检查（镜像/端口/卷/非 root/healthcheck/无明文口令）。
- 静态扫描：依赖口径（`{pg}`）、无远程资源、无注入 sink、router 无 SQL、分层 import 规则。

### 5.8 L2 拓扑与容器交付

```text
浏览器 ──4175──> web(Caddy :8080 容器内, 非 root) ── /api/* ──> api(Node :3000, 非 root)
                    │                                              │
                    └── 静态文件（public/，按白名单生成）            └──> db(postgres:16-alpine)
                                                                          volume fruitlab-r3-pgdata
```

- `Dockerfile`（api，多阶段）：`npm ci --omit=dev` → `node:22-alpine`，预建并 `chown node` 可写的 `/app/backups`（`db backup/reset` 用），`USER node`，`HEALTHCHECK` 用 Node `fetch` 调 `/api/health`，`CMD ["node","serve.mjs","--port","3000"]`；启动自动迁移 + 按需 seed；`SIGTERM` 优雅停机（关 server + pool）。
- `Dockerfile.web`（web，多阶段）：builder 跑 `scripts/build-public.mjs` 生成 `public/`（按 `server/allowlist.mjs`，缺文件即失败）→ `caddy:2-alpine` 拷入，`USER 1000`，`XDG_DATA_HOME=/tmp/caddy-data`、`XDG_CONFIG_HOME=/tmp/caddy-config`（非 root 可写），监听 `:8080`。
- `Caddyfile`：`handle /api/* { reverse_proxy api:3000 }`；静态 handler 下发 CSP/nosniff/DENY/no-store；`file_server`。
- `docker-compose.yml`（默认三容器，F-03/F-04）：项目名 `fruitlab-r3`；db 固定 `POSTGRES_USER=fruitlab`、`POSTGRES_DB=fruitlab`、密码来自 `${POSTGRES_PASSWORD:?}`，healthcheck `pg_isready -U fruitlab -d fruitlab`；api 的 `DATABASE_URL` 由同一组变量拼装，`HOST=0.0.0.0`、`PORT=3000`、`APP_ENV=${APP_ENV:-development}`、`PUBLIC_URL=${PUBLIC_URL:-http://127.0.0.1:4175}`；api `depends_on: db: service_healthy`；web `depends_on: api: service_healthy`，`ports: ["4175:8080"]`，Caddy `header_up Host {http.request.host}`、`header_up X-Forwarded-For {remote_host}`；web 也有 healthcheck（`wget -q -O /dev/null http://127.0.0.1:8080/`）；db 不映射宿主端口（调试用 `compose.debug.yml` 加 `55432:5432`）。密码含 URL 特殊字符时用 `encodeURIComponent` 拼装并文档说明。
- `compose.simple.yml`：db + api，api 暴露 `4175:3000`、`SERVE_STATIC=1`（对照用）。
- `.env.example`：`POSTGRES_USER` / `POSTGRES_DB` / `POSTGRES_PASSWORD` / `APP_ENV` / `PUBLIC_URL` / `ADMIN_PASSWORD` / `DEMO_PASSWORD` / `SESSION_TTL_SECONDS` / `COOKIE_SECURE` / `RATE_LIMIT_*`；`.env` 进 `.gitignore`。
- `.dockerignore`：`.git`、`node_modules`、`data/`、`backups/`、`.env`、`.gstack`、`.context`。
- `scripts/backup.sh` / `scripts/restore.sh`（WSL bash）：从 `.env` 读取 `POSTGRES_USER`/`POSTGRES_DB`（不硬编码），`docker compose exec -T db pg_dump -U "$POSTGRES_USER" -d "$POSTGRES_DB" -Fc` → `backups/*.dump`；恢复 `pg_restore --clean --if-exists`；打印校验（行数/种子计数）；恢复前提示停写（`docker compose stop api`）。
- 非 root 验证：`docker compose exec api id -u`（1000）、`web id -u`（1000）；db 以官方镜像 `postgres` 用户运行（记录）。
- **本机执行现实**：Windows Docker Desktop 引擎未运行，所有 compose 命令在本机经 WSL 执行（`wsl -e docker compose -f /mnt/d/vibecoding/easyvibe/r3-fruitlab/docker-compose.yml ...`）；这改变的是**证据命令形态**，不改变 PRD 的目标命令语义（`docker compose up --build`）。README 同时给出"有 Docker Desktop 时"与"本机 WSL 时"两种写法，证据只记录实际执行的那种。

### 5.9 静态托管与白名单

- `server/allowlist.mjs` 为唯一白名单（R2 集合 + R3 新增文档）；`scripts/build-public.mjs` 按白名单复制文件，缺失即失败（G1 的机械保证延续）；
- Node 服务在 simple 模式继续托管静态（沿用 R2 的穿越/编码/405/脱敏 500 规则）；L2 下 api 不托管静态；
- Caddy 静态响应的安全头与 Node 保持一致（CSP 无 `unsafe-inline`，`frame-ancestors 'none'` 由头下发）。

### 5.10 可观测性与配置

- 启动结构化摘要（JSON 一行）：`{event:"listening", url, port, db, schema, seeded, version}`；
- 每个 API 响应 `X-Request-Id`；错误日志含 `requestId`、方法、路径、SQLSTATE（不含口令/令牌/哈希）；
- `/api/health`（D-62）；`--log` 访问日志可选（simple 模式）；
- 配置全部经 `config.mjs` 从环境变量读取；不在代码里写死口令/密钥。

### 5.11 文档、证据与义务追溯

- 7 环产物：`SPEC.md`、`DECISIONS.md`、`BUILD.md`、`review.md`、`qa-report.md`、`CHANGELOG.md`、`retro.md`；
- 新增/更新：`docs/architecture.md`、`docs/contracts.md`、`docs/api.md`、`docs/error-catalog.md`、`docs/deploy.md`、`docs/backup-restore.md`、`docs/obligations.md`、`docs/branch-matrix.md`、`docs/decision-log.md`、`docs/coverage-audit.md`；
- 证据：`evidence/ring-*.md`、`evidence/spec-forensics.md`、`evidence/spec-quality-gate.md`、`evidence/test-count.txt`、`evidence/manifest.json`、`evidence/visual/`、`evidence/container/`、`evidence/codex/`、`evidence/cso/`；
- 追溯链：`F-R3-NN → OB-R3-<PHASE>-NN → AC-NN → 证据路径`；`BUILD.md` 验收表同时引 `AC` 与 `OB`；`scripts/check-traceability.mjs` 机械校验；
- 判定只用 `closed` / `downgraded`（附理由）/ `not-covered`（附理由）；不得把"未覆盖"写成"通过"。

### 5.12 R1/R2 隔离（硬约束）

1. R3 只写 `r3-fruitlab`；不把 `package.json`/`pg`/Dockerfile/compose/Postgres 数据写回 R2；
2. 不运行会写入 R1/R2 文件的命令；`start-all.mjs` 用 R2 内存库；
3. 每环收尾跑 `git -C ..\r1-fruitlab status --short` 与 `..\r2-fruitlab status --short`，必须为空；
4. 端口/卷/镜像/项目名固定（D-65），并发演示无碰撞。

## 6. Acceptance Criteria（AC-49 起）

| 编号 | 判定 | 对应 | 证据形态 |
|---|---|---|---|
| AC-49 | R1 可独立启动（4173），`r1-fruitlab` 工作树空、HEAD `3087a05` | A1 | qa 3 版本实跑 + git status |
| AC-50 | R2 可独立启动（4174），`r2-fruitlab` 工作树空、仍零依赖、HEAD `5f4dd87` | A2 | qa 实跑 + git status |
| AC-51 | R3 `docker compose up --build` 后 `http://127.0.0.1:4175` 200，`/api/health` `db:"up"` | A3 | 容器日志 + curl |
| AC-52 | R1/R2/R3 同时启动，各自可访问、互不影响、端口/数据/容器无碰撞 | A4 | qa 三版本并排截图 |
| AC-53 | `scripts/start-all.mjs` 存在，能按序启动三版本且不写 R1/R2 | A4 | 脚本 + qa 记录 |
| AC-54 | `package.json` 运行时依赖恰好 `{pg}`，lockfile 已提交；无其它第三方依赖 | A6 | static-scan + `npm ls --omit=dev` |
| AC-55 | ship 后 `VERSION` = `3.0.0.0`；`package.json` 版本用合法 SemVer `3.0.0`（4 段→3 段映射写入版本校验脚本与 README）；CHANGELOG 记录 breaking（依赖口径/端口/数据库/404 变更） | A16 | 文件 + 版本校验测试 |
| AC-56 | 迁移幂等：重复执行不改变 schema，`schema_migrations` 记录版本 | A7 | db 测试 |
| AC-57 | seed 幂等且分模式：classroom = 14 商品 + 3 账号；production = 14 商品 + admin（无演示用户）；重复执行不重复数据 | A7 | db/CLI 测试 |
| AC-58 | 不依赖 R2 的 SQLite 文件；R3 空库可启动并 seed | A7 | 代码扫描 + 容器 |
| AC-59 | L1 分层成立：router 不含 SQL/pg/repositories；services 不含 HTTP；repositories 不含业务分支 | A9 | `tests/layering.test.mjs` |
| AC-60 | 依赖规则由测试机械断言（import 图 + SQL 关键字扫描） | A9 | 同上 |
| AC-61 | 各层导出签名与 `docs/contracts.md` 一致 | A9 | contracts 测试 |
| AC-62 | 下单事务原子性：库存不足不落单、库存不为负 | 正确性 | db 测试 |
| AC-63 | 并发两次下单不超卖（真实并发连接，库存 1 只有 1 单成功） | 正确性 | 并发测试 |
| AC-64 | 同 `clientOrderId` 并发：一个 201、一个 200 `existing`、同一订单号、库存只扣一次；库存为 0 后重放仍返回 200 existing | 正确性 | 并发测试 |
| AC-65 | `40001/40P01` 有界重试；耗尽返回 `server-busy` 503 | 正确性 | 单元 + 注入测试 |
| AC-66 | 订单号唯一冲突重试 ≤10；耗尽 409 `order-number-exhausted` | 正确性 | 注入测试 |
| AC-67 | 订单列表/详情无 N+1（批量/JOIN），按用户隔离 | 正确性 | db 测试 + SQL 断言 |
| AC-68 | 他人订单返回 404 `order-not-found`；admin 可查任意（D-32 superseded） | A12 | API 测试 |
| AC-69 | 管理端可查/改/重新上架下架商品 | 功能 | API 测试 |
| AC-70 | C-1：`db reset` 备份失败即中止、数据保留；成功重置后校验 schema/种子；无"假成功" | A7 | CLI 测试（失败/成功两路） |
| AC-71 | C-2：SQLSTATE 映射齐全（23505/40001/40P01/53300）；真实并发/持锁测试；`enqueueWrite` 退役留痕 | A11 | 测试 + decision-log |
| AC-72 | C-3：全部已知路由（含动态）405 表驱动，`Allow` 正确 | A11 | 表驱动测试 |
| AC-73 | C-4：未登录 + 非法 JSON/415/413 先返回体协议错误（非 401） | A11 | 优先级组合测试 |
| AC-74 | C-5：api-client 超时覆盖响应体卡住；headers-then-hang/abort/非 JSON 测试 | A11 | 客户端单测 |
| AC-75 | C-6：畸形百分号路径 → 400 稳定码，不再 500 | A11 | API 测试 |
| AC-76 | C-7：login/register/me 统一 `{id,username,role}`，形状断言 | A11 | API 测试 |
| AC-77 | S-1：缺失用户执行 dummy scrypt；两条登录路径各一次 verify（分支断言） | A12 | auth 测试 |
| AC-78 | S-2：15 分钟窗口失败 5 次 → 429 + `Retry-After`；成功清零 | A12 | auth 测试（注入时钟） |
| AC-79 | S-3：过期会话 401；过期清理；登录轮换；Cookie `Max-Age` | A12 | auth/API 测试 |
| AC-80 | S-4：已由 AC-68 覆盖（404），decision-log 记录 D-32 superseded | A12 | 文档 + 测试 |
| AC-81 | CSRF：带会话写请求缺/错 token → 403 `csrf-token-invalid`；正确 token 通过；跨源 403 | A12 | API 测试 |
| AC-82 | 生产口令：`APP_ENV=production` 时缺 `ADMIN_PASSWORD`、`ADMIN_PASSWORD=demo1234`、长度 <12、或 `COOKIE_SECURE≠1` → seed/启动失败；生产模式不创建 userA/userB；`.env` 不入 git | A13 | CLI/配置测试 + 扫描 |
| AC-83 | 库内无明文口令/令牌；日志与 CLI 不打印口令/哈希 | A13 | 测试 + 扫描 |
| AC-84 | compose 三容器健康（web/api/db），`4175` 同源 `/api` 经 Caddy 反代可达 | A10 | 容器实跑 + curl |
| AC-85 | volume 持久化：重启后订单/库存仍在 | A5 | 容器重启证据 |
| AC-86 | api/web 非 root；healthcheck 有效；`SIGTERM` 优雅停机 | A13 | `id -u` + 日志 |
| AC-87 | 备份/恢复：`pg_dump`/`pg_restore` 真实命令，恢复后数据一致 | A14 | 备份文件 + 恢复后查询 |
| AC-88 | 镜像/项目/卷/端口命名 `fruitlab-r3*`、`4175`/`55432`，不与 R1/R2 冲突 | A4/A16 | compose 静态检查 |
| AC-89 | `compose.simple.yml` 两容器模式可启动（api+db，无 web） | A10 | qa 记录 |
| AC-90 | 测试跑真实 Postgres；README 写明 Docker 前置；测试计数唯一来源 | A8 | 测试输出 + test-count |
| AC-91 | BUILD.md 给出 96 项逐测试处置表（原样保留/等价迁移/预期契约变更/删除理由）；预期变更限于 D-32/D-53/D-55/D-57/D-58/D-64 明确项，且由 contracts 测试固定新契约 | A8 | BUILD.md + contracts 测试 |
| AC-92 | codex 独立子代理 `/review` 报告落盘（同族标注，不冒充跨模型） | A15 | `evidence/codex/` |
| AC-93 | 官方 `/cso` run 完成（start/submit/finish），findings 与 `partial` 边界如实记录 | A15 | `evidence/cso/` |
| AC-94 | 11 个缺陷点（10 条 findings）台账逐条 `closed/downgraded/not-covered`，`F→OB→AC` 双向引用 | A11 | `docs/obligations.md` + 脚本 |
| AC-95 | `BUILD.md` 同时引 AC 与 OB；`check-traceability.mjs` 通过 | A11 | 脚本输出 |
| AC-96 | `verify.mjs` 全链 PASS（测试+链接+编号+追溯+证据+compose 配置）；证据索引无死链 | A15/A16 | verify 输出 |
| AC-97 | 事务边界：`23505`/`23514`/`23503` 后必须先 ROLLBACK 再回查/重试；幂等键冲突不重复扣库存；订单号冲突重试 ≤10 且不留下空单（F-01） | 正确性 | 并发 + 注入测试 |
| AC-98 | 组合根/工厂：`createApp`/`createServices` 注入 pool/clock/rateLimiter/config；contracts 测试断言工厂与实例方法签名（F-02） | A9 | contracts + layering 测试 |
| AC-99 | 容器 Host：api 监听 `0.0.0.0`；Caddy 保留外部 Host；healthcheck 与外部 Public URL 均通过 Host 校验（F-03） | A10 | 容器实跑 + 测试 |
| AC-100 | DB 身份：`POSTGRES_USER/DB` 与 `DATABASE_URL`、`pg_isready`、备份脚本同源；空卷首次启动成功（F-04） | A3/A14 | 容器实跑 |
| AC-101 | npm 版本映射：`VERSION=3.0.0.0` 与 `package.json=3.0.0` 的映射由脚本机械校验（F-05） | A16 | 版本校验测试 |
| AC-102 | 生产加固：production 缺/弱/默认 admin 口令或 `COOKIE_SECURE=0` 拒绝启动；不建演示用户（F-06） | A13 | CLI/配置测试 |
| AC-103 | 连接池：`connectionTimeoutMillis`/pool error 处理；PG 不可达时 health ≤5s 返回 503 不挂起；DB 重启后自动恢复（F-07） | A13 | 故障注入测试 + 容器 |
| AC-104 | 反代 IP：Caddy 覆盖 XFF；`TRUST_PROXY=0/1` 行为测试；伪造 XFF 不能绕过限流；限流 Map 有容量上限（F-08） | A12 | 测试 + compose 静态检查 |
| AC-105 | 输入约束：clientOrderId 8–128、maxItems 10、重复 productId 合并、username/password/价格/库存边界继承并测试；DB CHECK 同步（F-10） | 契约 | 测试 + schema 断言 |

## 7. Testing Plan

1. **纯逻辑**：domain 17 项、controller 11 项、app fake DOM 19 项、assets 3 项——保留；
2. **数据库集成**（真实 PG，每用例独立库）：迁移/种子/约束/事务回滚/并发扣减/幂等并发/死锁重试/订单号耗尽/会话过期/清理；
3. **HTTP**：端口 0 真实服务器，覆盖全部路由、权限、405 表、优先级组合、CSRF、限流、404、413/415/400、500 脱敏、health up/down；
4. **CLI**：`spawnSync` 子进程，覆盖 0/1/2/3/4、`--url`、`db backup` 往返、`db reset` 失败/成功、`--json` 形状、生产口令检查；
5. **客户端**：`createApiClient` 超时/响应体卡住/abort/非 JSON/CSRF 头；
6. **静态/契约**：依赖口径、无远程资源、无注入、router 无 SQL、分层 import、错误码集合、编号、compose 静态检查；
7. **回归**：R1 的 8 条交互契约与静态扫描禁令；`tests/domain.test.mjs` 原样通过；
8. **容器/浏览器**：qa 环实跑 compose、三版本并排、重启持久化、备份恢复、Chromium 五断点截图。
9. **测试基础设施**（§16）：`test-pg.mjs up/status/down` readiness；测试池 `max=2`；`--test-concurrency=4`；残留 `fruitlab_test_*` 清理；总时长预算 120s。

## 8. Rules for the Implementing Agent

1. R1/R2 一行不改；R3 只写自己目录；
2. 运行时依赖只允许 `{pg}`；不引入 CDN/远程字体/远程图片；
3. 不伪造证据：代码、命令、输出、测试、哈希必须来自真实执行；
4. 门禁不可用写 `unavailable`；未测写 `UNVERIFIED`；不完整写 `partial`；不得换模型/工具充数；
5. 没发现问题写"未发现"，不为凑数编造缺陷；
6. 机械型缺陷直接修；需要取舍的先记录再执行（本规格已把 A–E 拍板，见 D-54/D-55/D-57/D-58/D-63）；
7. 文档与代码同一提交；每环证据落 `evidence/`；
8. 测试计数只从 `evidence/test-count.txt` 读；
9. 编号先定义后引用；
10. 每环收尾自检产物与证据，再进入下一环（用户已授权代理自行审批，但产物与证据必须真实）。

## 9. Rollback Plan

- 代码回退：`git reset --hard r2-baseline`（R3 内回到 R2 快照；R2 仓库独立，不受影响）；
- 数据回退：删卷重建 `wsl -e docker volume rm fruitlab-r3-pgdata` + `compose up`（仅演示数据）；
- 容器回退：`docker compose down`；镜像保留 `fruitlab-r3:3.0.0.0`；
- 契约回退：`docs/contracts.md` 记录 R2→R3 变更；404 越权变更可按 git 回退；
- 版本回退：`CHANGELOG.md` 记录 `3.0.0.0`，失败可回 `2.0.0.0`（R2 目录不动）。

## 10. Effort Estimate

| 环节 | 预估 | 说明 |
|---|---|---|
| spec | 已完成 | 本文件 + 取证 + 门禁 |
| autoplan | 0.5 天 | 四方评审（codex 外部声音）+ OB 清单 + 终门 |
| build M1 | 4–6 h | package/pg、迁移、repositories/services、测试基础设施 |
| build M2 | 4–6 h | 11 findings + 安全四项 + 测试 |
| build M3 | 4–6 h | Dockerfile×2、compose、Caddy、备份恢复、容器验收 |
| review | 0.5 天 | codex 复核 + 官方 cso + 处置 |
| qa | 0.5 天 | 容器/浏览器/三版本/持久化/备份恢复 |
| ship | 0.3 天 | 覆盖率审计、文档同步、版本、verify |
| retro | 0.2 天 | 量化复盘 |
| **合计** | **约 35–45 agent 工时** | 不含等待审批；里程碑可独立验收/回退（§16 覆盖） |

## 11. Files Reference

**保留不动**：`assets/domain.mjs`、`tests/domain.test.mjs`、`PRD-R2.md`、`PRD-R3.md`、`assets/images/products/*.jpg`、`R1-*` 文档。
**改造**：`server/db.mjs`、`server/auth.mjs`、`server/products.mjs`、`server/orders.mjs`、`server/router.mjs`、`server/errors.mjs`、`serve.mjs`、`cli.mjs`、`assets/api-client.mjs`、`tests/*`、`README.md`、`CHANGELOG.md`、`BUILD.md`、`review.md`、`qa-report.md`、`retro.md`、`docs/*`、`scripts/*`、`SPEC.md`、`DECISIONS.md`（autoplan）。
**新增**：`server/app.mjs`、`server/services/index.mjs`、`package.json`、`package-lock.json`、`Dockerfile`、`Dockerfile.web`、`Caddyfile`、`docker-compose.yml`、`compose.simple.yml`、`compose.debug.yml`、`.dockerignore`、`.env.example`、`server/migrations/0001_init.sql`、`server/repositories/*.mjs`、`server/services/*.mjs`、`server/allowlist.mjs`、`config.mjs`、`scripts/build-public.mjs`、`scripts/check-redaction.mjs`、`scripts/check-docs-stale.mjs`、`scripts/check-compose.mjs`、`scripts/preflight.mjs`、`scripts/test-pg.mjs`、`scripts/backup.sh`、`scripts/restore.sh`、`scripts/backup.ps1`、`scripts/restore.ps1`、`scripts/start-all.mjs`、`tests/helpers/pg.mjs`、`tests/layering.test.mjs`、`tests/compose.test.mjs`、`evidence/*`。
**退役**：`tests/helpers/db.mjs`（改为 pg helper）、`server/db.mjs` 的 `enqueueWrite`。

## 12. Out of Scope

PRD §6 全部非目标，另加：完整微服务/L3/L4、云平台部署（M5 选修）、Vercel/CF 运行时改写、CI/CD、水平扩展/读写分离/多租户、真实支付/物流/退款、审计日志、密码找回/改密、深色模式、分页（默认上限 100）、R1 localStorage 迁移、R2 SQLite 数据迁移、图片重制。

## 13. Related

- `PRD-R3.md` — R3 需求（本规格输入）
- `HANDOFF.md` 第七节 — 当前权威状态与工具链
- `evidence/spec-forensics.md` — 32 项耦合点 / 96 项测试结构 / 11 findings 位置
- `docs/decision-log.md` — D-47～D-70 追加留痕
- R2 `SPEC.md`/`DECISIONS.md`/`BUILD.md`/`review.md`/`qa-report.md` — 契约与缺陷基线

## 14. 风险与降级边界

| # | 风险 | 应对 |
|---|---|---|
| 1 | 测试从 SQLite 迁到真实 PG，夹具/断言重写量大 | 先 spike（端口/并发/隔离），按层迁移，逐项对照断言 |
| 2 | Windows Node ↔ WSL Docker 55432 的确定性 | 固定端口/每用例独立库/健康轮询；失败保留原始输出，不静默重跑 |
| 3 | 容器构建联网/供应链 | `postgres:16-alpine`、`node:22-alpine`、`caddy:2-alpine` 本地已有；lockfile 锁定 pg |
| 4 | `db reset`/备份恢复破坏性 | 先备份后重建；失败显式退出；容器内先在临时卷演练 |
| 5 | 证据链门槛多（codex/cso/容器/浏览器） | 先定证据矩阵，逐项真实执行；门禁不可用如实 `unavailable` |
| 6 | 范围与工期 | M1–M3 分里程碑；每段可停可回退；复核后如实记录 |
| 7 | R1/R2 冻结纪律 | 每环跑两次 `git status`；R3 只写自己目录 |

**降级边界**：跨模型门禁 `unavailable`（同族第二智能体复核替代，单独标注）；cso 离线 `partial`（scanner profiles/history-inputs 不可用）；读屏器人工审查 `UNVERIFIED`；云平台部署 `requires-remote`（M5）。以上降级必须在 obligations/BUILD/qa 三处留痕。

---

## 15. spec 门禁结果（2026-10-18）

| 门禁 | 状态 | 结果 |
|---|---|---|
| 语义审查（人工，逐项） | **通过** | 发现 8 项：计数口径（10 findings/11 缺陷点）、CSRF 登录后补发、反代 IP 失真、容器备份目录可写、测试处置范围、本机 WSL 执行现实、优先级顺序、事务边界模糊；全部已修 |
| 脱敏扫描（本地 fail-closed） | **通过** | `node scripts/check-redaction.mjs`：HIGH 0 / MEDIUM 0 / WARN 13（全部为 `127.0.0.1` 与版本号 `x.y.z.0` 误报） |
| 同族第二智能体复核（codex） | **通过（需修订 → 已修订）** | 10 条 findings（F-01..F-10），全部采纳/部分采纳并落 v1.1；处置见 `evidence/codex/spec-review-disposition.md`；复核报告 `evidence/codex/spec-review-codex.md` |
| 跨模型质量门 | **`unavailable`** | 无第二个模型家族：codex 配置为 `opencode-go/deepseek-v4.1-flash`（同族）；不换模型充数，不用同族冒充跨模型 |
| 项目负责人确认 | **通过（授权代理自审）** | 用户明确授权执行代理自行完成选型与环审批；本环自审记录见 `evidence/ring-spec.md` |

**状态**：v1.1 门禁记录（2026-10-18）。当前生效版本为 **v1.2**（§16 优先于前文）；v1.0/v1.1 快照保留在 `evidence/codex/`。

---

## 16. autoplan 修订并入（v1.2，优先于前文冲突条款）

> 本节为 v1.2 新增。autoplan 四阶段（CEO 6.0 / Design 6.0 / DX 5.0 / Eng 7.0，均 FAIL）+ spec v1.1 第二轮同族复核（N-01..N-07）共 42 条发现，去重后转为 **42 条义务**（`OB-R3-*`，见 `DECISIONS.md`）。本节把**会改变实现或验收**的部分并入；**与 §1–§15 冲突时以本节为准**；施工依据是本节 + `DECISIONS.md` 的 OB 清单。

### 16.1 关键修订

| # | 涉及条款 | v1.1 原状 | v1.2 修订 | 依据 |
|---:|---|---|---|---|
| 1 | §10 工时 | 20–30 agent 工时 | **35–45 agent 工时**；M1 8–10h、M2 8–10h、M3 10–14h、review/qa/ship/retro 各 0.5–1 天；每段有停止线 | OB-R3-CEO-01 |
| 2 | §6 验收 | 48 条机制 AC | 增 **AC-106 用户旅程 / AC-107 管理变更可见 / AC-108 DB down 降级 / AC-109 备份恢复一致 / AC-110 demo 脚本与课程矩阵 / AC-111 R2 持久化演示 / AC-112 R2 UI 回归 / AC-113 quickstart 与 verify 模式 / AC-114 文档口径扫描 / AC-115 启动诊断 / AC-116 CSRF 客户端恢复 / AC-117 迁移并发 / AC-118 测试基础设施** | OB-R3-CEO-02/04、DES-01..06、DX-01/07、ENG-07 |
| 3 | D-70/AC-53 | R2 用 `--db :memory:` 启动 | R2 用**仓库外临时 SQLite 文件**（`%TEMP%/fruitlab-r2-demo.db` / `$TMPDIR`），重启后数据仍在；不写 R2 工作树 | OB-R3-CEO-03 |
| 4 | §4 | 无课程目标矩阵 | 增加“课程目标 → 课堂可观察结果 → AC/证据”矩阵，并写入 `evidence/demo-script.md`（5–8 分钟三幕） | OB-R3-CEO-04 |
| 5 | 范围 | CEO 建议砍 CSRF/simple/备份/N+1 | **拒绝**：CSRF、simple 对照、备份恢复、N+1 均为 PRD 硬约束；`compose.debug.yml` 降为可选附录，证据按需 | OB-R3-CEO-05（partial/rejected） |
| 6 | §5.8/AC-51 | 只认 WSL 命令 | `start-all.mjs` 自动探测原生 Docker（`docker info`）→ 否则 WSL；README 给两种预检；证据记录实际路径 | OB-R3-CEO-06 |
| 7 | §5.11 | 无陈旧口径扫描 | 新增 `scripts/check-docs-stale.mjs`：R3 学员文档不得出现未标注的 4174/`--db`/SQLite/“零依赖”；R2 文档标历史材料 | OB-R3-CEO-07 |
| 8 | ×N-01/D-78 | compose 写死 `fruitlab` 用户/库 | compose/db/healthcheck/DSN/备份**全部变量化**：`POSTGRES_USER=${POSTGRES_USER:?}`、`POSTGRES_DB=${POSTGRES_DB:?}`、`pg_isready -U "$POSTGRES_USER"`；AC-100 用非默认值实测 | OB-R3-SPEC-01 |
| 9 | ×N-02/D-67 | production 要 `DEMO_PASSWORD`，seed 固定 14+3 | **D-67 superseded**：拆 `seedClassroom`（14 商品 + userA/userB/admin）与 `seedProductionAdmin`（14 商品 + admin）；production 校验 `ADMIN_PASSWORD`/`COOKIE_SECURE=1`，不建 demo 用户；AC-57 分模式断言 | OB-R3-SPEC-02 |
| 10 | ×N-03/AC-103 | health ≤5s 无实现路径 | health 专用 `healthTimeoutMs=3000` + `Promise.race`；`createPool` 明确 `connectionTimeoutMs → connectionTimeoutMillis`、`idleTimeoutMs → idleTimeoutMillis` 映射；AC-103 分连接拒绝/池耗尽/慢查询/DB 重启四路 | OB-R3-SPEC-03 |
| 11 | ×N-04/AC-91 | 变更白名单缺项 | 白名单补 **D-47（换库）、D-62（health 形状）、D-79（输入约束）、D-82（XFF）**；F-09 单独映射 AC-91 | OB-R3-SPEC-04 |
| 12 | ×N-05/D-71 | decision-log 仍留“XFF 最左段”旧口径 | **D-71 superseded by D-82**；SPEC 只引 D-82；compose `TRUST_PROXY=1`，simple 模式 0；AC-104 三路 | OB-R3-SPEC-05 |
| 13 | ×N-06/AC-105 | DB CHECK 范围超 schema | schema 增 `username` 3–32 CHECK、`unit_price_cents ≤ 9999999`、`stock ≤ 99999`；password 只在 service 校验；AC-105 拆 schema/API 两组断言 | OB-R3-SPEC-06 |
| 14 | ×N-07 | 头仍 DRAFT v1.0、D 范围旧 | 头改 `APPROVED v1.2`；Related 覆盖 D-47..D-108；§15 标注“v1.1 门禁记录，生效版本见 §16” | OB-R3-SPEC-07 |
| 15 | ENG-01/migrate | `migrate(pool)` 自开事务，reset 无法同事务 | `migrate(client)`、`seed(client, {mode})`、`resetDatabase(client, deps)` 均接受 **client**；reset 全程同一 client/同一事务；补“迁移失败/seed 失败/重建失败”三路测试 | OB-R3-ENG-01 |
| 16 | ENG-02 锁顺序 | 按请求商品顺序扣库存 | 事务前按 `productId` **字典序排序**再扣；测试“相反顺序两购物车”不死锁 | OB-R3-ENG-02 |
| 17 | ENG-03 scrypt | `scryptSync` 阻塞事件循环 | 改 **异步 `crypto.scrypt`** + 全局并发信号量 4 + 队列上限 100；限流在 scrypt 之前；测试并发登录下 health/普通 API 延迟 | OB-R3-ENG-03 |
| 18 | ENG-04/web health | web 无 healthcheck | Caddy `/healthz` 返回 200；compose web healthcheck（wget，interval 5s/timeout 3s/retries 20） | OB-R3-ENG-04 |
| 19 | ENG-05 恢复流程 | 未停写、未 single-transaction | `restore.sh`：停 api → 断残留连接 → `pg_restore --single-transaction --exit-on-error` → 校验 schema/种子/行数 → 启 api；失败保留可诊断状态 | OB-R3-ENG-05 |
| 20 | ENG-06/DX-03 备份契约 | CLI 备份无 restore；容器 backups 不持久 | CLI 增 `db restore --in <file> --yes`（JSON Lines 往返：schema 版本 + 每表数据）；compose 挂 `./backups:/app/backups`；`pg_dump/pg_restore` 为生产路径，两者不互相冒充 | OB-R3-ENG-06、OB-R3-DX-03 |
| 21 | ENG-07 测试基础设施 | 每用例建库 + 默认并发 | 测试池 `max=2`；`node --test --test-concurrency=4`；启动清理残留 `fruitlab_test_*`；总时长预算 120s；`scripts/test-pg.mjs up\|status\|down`（readiness 轮询） | OB-R3-ENG-07、OB-R3-DX-05 |
| 22 | ENG-08 限流 | 仅 username+IP | **两桶**：账号 5 次/15 分钟 + IP 50 次/15 分钟；锁定 15 分钟；测试“同 IP 遍历 username”“单账号多 IP” | OB-R3-ENG-08 |
| 23 | ENG-09 CSRF | token 只在缺失时补发 | 登录成功与会话轮换**重新生成** CSRF token；`Secure` 跟随 `COOKIE_SECURE`；登出清两个 Cookie；客户端 `ensureCsrfToken()` + 403 重试一次（沿用同一 `clientOrderId`） | OB-R3-ENG-09、OB-R3-DES-02 |
| 24 | ENG-10 int8 | 全局 `setTypeParser(20, Number)` | 改为**显式安全解析**（`Number.isSafeInteger` 不满足则报错）；ID 不暴露给 JSON；contracts 注明可安全转换列 | OB-R3-ENG-10 |
| 25 | ENG-11 迁移并发 | 无 advisory lock/checksum | 迁移事务前 `pg_advisory_xact_lock`；`schema_migrations` 记录 `checksum`（sha256）；并发 migrate 测试 | OB-R3-ENG-11 |
| 26 | ENG-12 路径 | 405 表无规范化 | 先规范化再匹配：尾斜杠→404、编码分隔符→404、空动态段→404、`%zz`→**400 `invalid-path`**；表驱动覆盖 | OB-R3-ENG-12 |
| 27 | DX-01/07 | 无 clean-room、verify 无 preflight | `scripts/preflight.mjs`（Node/npm/Docker/Compose/PG 探测）；`verify.mjs --quick`（纯逻辑/静态）与 `--full`（PG+compose）；README 60 秒启动卡 | OB-R3-DX-01、OB-R3-DX-07 |
| 28 | DX-02/09 | 版本/镜像可漂移 | `engines` + `packageManager`；记录三个镜像 digest；lockfile resolved URL 说明；`npm ci` 烟测 | OB-R3-DX-02、OB-R3-DX-09 |
| 29 | DX-06 CLI | 伪语法 | `docs/cli.md` 命令矩阵：exact argv、env、stdin、stdout/stderr、JSON 信封、退出码、补救；help/文档/解析器一致性测试 | OB-R3-DX-06 |
| 30 | DX-08 路径 | 硬编码 `/mnt/d/...` | 文档用相对路径；WSL 用 `wslpath`；补 `backup.ps1`/`restore.ps1` 包装 | OB-R3-DX-08 |
| 31 | DES-01 | 无 Caddy/4175 E2E | AC-106：真实 Chromium 从 4175 完成注册→登录→加购→下单→我的订单，断言 CSRF Cookie/头、无重复扣库存 | OB-R3-DES-01 |
| 32 | DES-03 | 新错误码无文案 | `docs/error-catalog.md` 补 `csrf-token-invalid`/`auth-rate-limited`/`db-unavailable` 的 surface/中文文案/恢复；health 503 用统一信封；前端映射测试 | OB-R3-DES-03 |
| 33 | DES-04 | README/demo 仍旧 | README 改为 R3 运行说明；`demo-script.md` 重写为 5–8 分钟三幕；AC-110 | OB-R3-DES-04 |
| 34 | DES-05 | 启动失败不可诊断 | 启动错误模板：stage/尝试次数/SQLSTATE/requestId/脱敏 DSN/下一步命令；README 四类排障；AC-115 | OB-R3-DES-05 |
| 35 | DES-06 | R2 UI 回归无门 | R2 UI 回归矩阵：390/834/1440 无横向滚动、键盘全流程、焦点、aria、错误文案；AC-112 | OB-R3-DES-06 |
| 36 | ENG-13 | v1.0 快照与已接受决策不一致 | v1.2 全量并入并重冻快照；build 只认 v1.2 哈希 | OB-R3-ENG-13 |

### 16.2 新增/修订 AC（AC-106～AC-118）

| 编号 | 判定 | 对应 OB |
|---|---|---|
| AC-106 | 真实 Chromium 从 `http://127.0.0.1:4175` 完成注册→登录→浏览→加购→下单→我的订单；断言 CSRF Cookie/头、订单唯一、库存只扣一次 | OB-R3-DES-01 |
| AC-107 | admin 改价/下架后用户端刷新可见，历史订单金额不变；下架项不出现 | OB-R3-CEO-02 |
| AC-108 | 停 DB（或指向关闭端口）时：`/api/health` 3s 内 503，页面显示可理解降级文案而非白屏 | OB-R3-CEO-02、OB-R3-SPEC-03 |
| AC-109 | 备份→毁库→恢复后：商品/账号/订单/库存一致；CLI JSON 往返与 `pg_dump/pg_restore` 至少各一条真实证据 | OB-R3-CEO-02、OB-R3-ENG-05/06 |
| AC-110 | `evidence/demo-script.md` 为 5–8 分钟三幕脚本（R1 localStorage / R2 文件库 / R3 PG+三层+容器），含预期输出与回退动作；SPEC §4 有课程目标矩阵 | OB-R3-CEO-04、OB-R3-DES-04 |
| AC-111 | `start-all.mjs` 用仓库外临时 SQLite 启动 R2；重启后 R2 订单仍在；不写 R1/R2 工作树 | OB-R3-CEO-03 |
| AC-112 | R2 UI 回归：390/834/1440 无横向滚动；键盘可完成浏览→加购→结账；查单焦点、`aria-invalid`、`aria-live`、错误文案保持 | OB-R3-DES-06 |
| AC-113 | clean-room quickstart 可复制执行：preflight 输出缺项与补救；`verify --quick` 与 `--full` 有明确前置与退出码 | OB-R3-DX-01、OB-R3-DX-07 |
| AC-114 | `scripts/check-docs-stale.mjs` 通过：R3 学员文档无未标注的 4174/`--db`/SQLite/“零依赖”旧口径 | OB-R3-CEO-07 |
| AC-115 | 启动失败输出 stage/尝试次数/SQLSTATE/requestId/脱敏目标/下一步命令；README 覆盖四类排障 | OB-R3-DES-05 |
| AC-116 | CSRF 客户端恢复：缺 token/403 各重试一次（同 clientOrderId），再失败给“刷新并允许 Cookie”文案；有测试 | OB-R3-DES-02、OB-R3-ENG-09 |
| AC-117 | 并发两次 `db migrate`：advisory lock 保证一次执行、另一次安全通过；checksum 被记录；改动已发布迁移会被发现 | OB-R3-ENG-11 |
| AC-118 | 测试基础设施：`test-pg.mjs up/status/down` 可复现；测试池 `max=2`；`--test-concurrency=4`；残留库清理；总时长 ≤120s | OB-R3-ENG-07、OB-R3-DX-05 |

### 16.3 被拒绝/降级的建议（留痕）

| 建议 | 来源 | 处置 | 理由 |
|---|---|---|---|
| 砍 CSRF（降级为严格 Origin） | CEO-05 | **拒绝** | PRD A12 明确要求 CSRF 在 R3 实现；不能为课时砍掉已定验收 |
| 砍 simple 两容器对照 | CEO-05 | **拒绝** | PRD §4.3 明确要求保留两容器简化模式作对照；实现成本低（一个 compose 文件） |
| 砍 N+1 硬门禁 | CEO-05 | **拒绝** | 是 R2 AC 的延续，且实现成本低（批量查询已在 R2 验证） |
| `compose.debug.yml` 必做 | — | **降级为可选** | 仅调试用，不影响 A3/A5/A10；有则记录，无则 README 说明 |
| 迁移脚本 checksum 只记不校验历史 | ENG-11 部分 | **部分采纳** | 记录 checksum；对已发布迁移的改动检测写入 verify，不阻塞启动 |
