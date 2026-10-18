// 一次性补丁：把 codex 同族复核 F-01..F-10 并入 SPEC.md（v1.0 → v1.1）。
// 用法：node evidence/codex/apply-spec-v1.1.mjs
// 每个替换必须命中一次；未命中的会打印出来，便于人工修正。
import fs from "node:fs";

const FILE = "SPEC.md";
let src = fs.readFileSync(FILE, "utf8");
const patches = [];
const add = (name, oldText, newText) => patches.push({ name, oldText, newText });

add("revision",
"| （待门禁） | v1.0 | 并入语义审查与同族第二智能体复核的修订；跨模型门禁状态如实记录 |",
"| 2026-10-18 | v1.1 | 并入语义审查 8 项修订与 codex 同族复核 10 条 findings 的处置：事务/23505 边界与幂等语义、service 工厂与组合根、容器 HOST/Public URL/健康检查 Host、DB 身份变量统一、SemVer 4 段映射、生产模式口令策略、连接池超时与 pool error、XFF 信任与限流上限、输入约束继承、测试处置表口径。跨模型门禁仍 `unavailable`（同族复核不冒充跨模型） |");

add("map-range",
"| 版本隔离 | R1/R2 零改动、命名/端口无碰撞 | AC-49/50/51/52/88 |",
"| 版本隔离 | R1/R2 零改动、命名/端口无碰撞 | AC-49/50/51/52/88 |\n| 复核修订 | codex 同族复核 F-01..F-10 的修订落到可测 AC | AC-97～AC-105 |");

add("ac55",
"| AC-55 | ship 后 `VERSION` 与包版本一致为 `3.0.0.0`；CHANGELOG 记录 breaking（依赖口径/端口/数据库/404 变更） | A16 | 文件 + 测试 |",
"| AC-55 | ship 后 `VERSION` = `3.0.0.0`；`package.json` 版本用合法 SemVer `3.0.0`（4 段→3 段映射写入版本校验脚本与 README）；CHANGELOG 记录 breaking（依赖口径/端口/数据库/404 变更） | A16 | 文件 + 版本校验测试 |");

add("ac64",
"| AC-64 | 同 `clientOrderId` 并发只产生一单、库存只扣一次 | 正确性 | 并发测试 |",
"| AC-64 | 同 `clientOrderId` 并发：一个 201、一个 200 `existing`、同一订单号、库存只扣一次；库存为 0 后重放仍返回 200 existing | 正确性 | 并发测试 |");

add("ac82",
"| AC-82 | 生产口令：`APP_ENV=production` 缺 `DEMO_PASSWORD` → seed 失败；`.env` 不入 git；无默认口令上公网 | A13 | CLI 测试 + 扫描 |",
"| AC-82 | 生产口令：`APP_ENV=production` 时缺 `ADMIN_PASSWORD`、`ADMIN_PASSWORD=demo1234`、长度 <12、或 `COOKIE_SECURE≠1` → seed/启动失败；生产模式不创建 userA/userB；`.env` 不入 git | A13 | CLI/配置测试 + 扫描 |");

add("ac91",
"| AC-91 | 除 D-48/D-64 明确变更的依赖断言外，原有 96 项测试语义逐项保留/迁移，迁移对照表在 BUILD.md | A8 | BUILD.md + 测试 |",
"| AC-91 | BUILD.md 给出 96 项逐测试处置表（原样保留/等价迁移/预期契约变更/删除理由）；预期变更限于 D-32/D-53/D-55/D-57/D-58/D-64 明确项，且由 contracts 测试固定新契约 | A8 | BUILD.md + contracts 测试 |");

add("ac97-105",
"| AC-96 | `verify.mjs` 全链 PASS（测试+链接+编号+追溯+证据+compose 配置）；证据索引无死链 | A15/A16 | verify 输出 |",
"| AC-96 | `verify.mjs` 全链 PASS（测试+链接+编号+追溯+证据+compose 配置）；证据索引无死链 | A15/A16 | verify 输出 |\n| AC-97 | 事务边界：`23505`/`23514`/`23503` 后必须先 ROLLBACK 再回查/重试；幂等键冲突不重复扣库存；订单号冲突重试 ≤10 且不留下空单（F-01） | 正确性 | 并发 + 注入测试 |\n| AC-98 | 组合根/工厂：`createApp`/`createServices` 注入 pool/clock/rateLimiter/config；contracts 测试断言工厂与实例方法签名（F-02） | A9 | contracts + layering 测试 |\n| AC-99 | 容器 Host：api 监听 `0.0.0.0`；Caddy 保留外部 Host；healthcheck 与外部 Public URL 均通过 Host 校验（F-03） | A10 | 容器实跑 + 测试 |\n| AC-100 | DB 身份：`POSTGRES_USER/DB` 与 `DATABASE_URL`、`pg_isready`、备份脚本同源；空卷首次启动成功（F-04） | A3/A14 | 容器实跑 |\n| AC-101 | npm 版本映射：`VERSION=3.0.0.0` 与 `package.json=3.0.0` 的映射由脚本机械校验（F-05） | A16 | 版本校验测试 |\n| AC-102 | 生产加固：production 缺/弱/默认 admin 口令或 `COOKIE_SECURE=0` 拒绝启动；不建演示用户（F-06） | A13 | CLI/配置测试 |\n| AC-103 | 连接池：`connectionTimeoutMillis`/pool error 处理；PG 不可达时 health ≤5s 返回 503 不挂起；DB 重启后自动恢复（F-07） | A13 | 故障注入测试 + 容器 |\n| AC-104 | 反代 IP：Caddy 覆盖 XFF；`TRUST_PROXY=0/1` 行为测试；伪造 XFF 不能绕过限流；限流 Map 有容量上限（F-08） | A12 | 测试 + compose 静态检查 |\n| AC-105 | 输入约束：clientOrderId 8–128、maxItems 10、重复 productId 合并、username/password/价格/库存边界继承并测试；DB CHECK 同步（F-10） | 契约 | 测试 + schema 断言 |");

add("client-order-check",
"  client_order_id text NOT NULL,\n  subtotal_cents  bigint NOT NULL CHECK (subtotal_cents >= 0),\n  created_at      timestamptz NOT NULL,\n  CONSTRAINT ux_orders_user_client UNIQUE (user_id, client_order_id)",
"  client_order_id text NOT NULL CHECK (char_length(client_order_id) BETWEEN 8 AND 128),\n  subtotal_cents  bigint NOT NULL CHECK (subtotal_cents >= 0),\n  created_at      timestamptz NOT NULL,\n  CONSTRAINT ux_orders_user_client UNIQUE (user_id, client_order_id)");

add("createpool",
"- `server/db.mjs` 导出：`createPool({connectionString, max, statementTimeoutMs, lockTimeoutMs})`、`migrate(pool)`、`withTransaction(pool, fn)`、`closePool(pool)`、`schemaVersion(pool)`、`isSeeded(pool)`。",
"- `server/db.mjs` 导出：`createPool({connectionString, max, connectionTimeoutMs, idleTimeoutMs, statementTimeoutMs, lockTimeoutMs})`、`migrate(pool)`、`withTransaction(pool, fn)`、`closePool(pool)`、`schemaVersion(pool)`、`isSeeded(pool)`。");

add("conn-params",
"- 连接参数：`max`（默认 10）、`statement_timeout`（默认 15000ms）、`lock_timeout`（默认 5000ms）、`application_name=fruitlab-r3`；均可由环境变量覆盖。",
"- 连接参数：`max`（默认 10）、`connectionTimeoutMillis`（默认 5000ms）、`idleTimeoutMillis`（默认 30000ms）、`statement_timeout`（默认 15000ms）、`lock_timeout`（默认 5000ms）、`application_name=fruitlab-r3`；均可由环境变量覆盖。");

add("tx-boundary",
"- 事务：同一 `client` 执行 `BEGIN/COMMIT/ROLLBACK`；`withTransaction` 在 `40001`（serialization_failure）与 `40P01`（deadlock_detected）上做**有界重试 3 次**（25/50/100ms），耗尽抛 `server-busy`。",
"- 事务：同一 `client` 执行 `BEGIN/COMMIT/ROLLBACK`；`withTransaction` 在 `40001`（serialization_failure）与 `40P01`（deadlock_detected）上做**有界重试 3 次**（25/50/100ms），耗尽抛 `server-busy`。回调必须是事务内、无外部副作用的操作（可重放）。\n- **23505 事务边界（不可在 aborted 事务里查库）**：任何语句抛 `23505`/`23514`/`23503` 后，必须 `ROLLBACK` 整事务，再由 service 在新事务里回查或重试；禁止在失败事务内继续 `SELECT`（会得到 `25P02`）。\n- **连接池故障**：`connectionTimeoutMillis` 保证池耗尽时不无限等待；监听 `pool.on(\"error\")` 记录并丢弃坏连接；本地池超时、`ETIMEDOUT`/`ECONNRESET`/`Connection terminated` 与连接类 SQLSTATE 统一映射 `db-unavailable` 503；DB 重启后池自动恢复。\n- **checkout 事务顺序（F-01）**：校验/合并 → 事务外幂等预查 → 事务内先 `INSERT orders`（幂等预留）→ 条件扣库存（影响行数=1）→ 插 `order_items` → 合计断言 → COMMIT。`ux_orders_user_client` 冲突：ROLLBACK → 新事务回查 → 200 existing；`orders_order_number_key` 冲突：ROLLBACK → 重新生成 → 重试整事务（≤10）；库存不足：ROLLBACK → 409。此顺序保证幂等冲突发生在扣库存之前，不会重复扣减。");

add("repo-table",
"| `server/repositories/orders.mjs` | `create(client, {userId, items, clientOrderId, now, suffixFactory})`（事务边界由 service 用 `withTransaction` 控制）；`findByClientOrderId`, `findByNumber`, `listByUser`, `listAll`, `itemsByOrderIds` |",
"| `server/repositories/orders.mjs` | `create(client, {orderNumber, userId, items, clientOrderId, subtotalCents, createdAt})`、`deductStock(client, {productId, quantity})`、`createItems(client, orderId, lines)`、`findByClientOrderId(clientOrPool, userId, clientOrderId)`、`findByNumber(pool, orderNumber)`、`listByUser(pool, userId, {limit})`、`listAll(pool, {limit})`、`itemsByOrderIds(pool, ids)`；事务边界由 service 用 `withTransaction` 控制 |");

add("service-table",
"| `server/services/auth.mjs` | `register({username,password})`, `login({username,password,ip,now})`, `logout(token)`, `me(token, now)`, `dummyVerify(password)`, `resetRateLimiter()`（测试用） |\n| `server/services/catalog.mjs` | `listPublic()`, `listAdmin()`, `updateProduct(id, patch)` |\n| `server/services/orders.mjs` | `checkout({userId, items, clientOrderId, now})`, `listMine(userId)`, `getForViewer(orderNumber, viewer)`, `listAll()` |\n| `server/services/health.mjs` | `health({version, startedAt})` |",
"| `server/app.mjs` | `createApp({config, clock})` → `{handler, pool, services, close}`：组合根（建池→迁移→按需 seed→构造 services），供 `serve.mjs`/`cli.mjs` 复用 |\n| `server/services/index.mjs` | `createServices({pool, config, clock, rateLimiter})` → `{auth, catalog, orders, health}` |\n| `server/services/auth.mjs` | `createAuthService({repos, config, clock})` → `{register, login, logout, me, dummyVerify, resetRateLimiter}` |\n| `server/services/catalog.mjs` | `createCatalogService({repos})` → `{listPublic, listAdmin, updateProduct}` |\n| `server/services/orders.mjs` | `createOrderService({pool, repos, clock, config})` → `{checkout, listMine, getForViewer, listAll}` |\n| `server/services/health.mjs` | `createHealthService({pool, config, clock})` → `{health}` |");

add("host-rules",
"**判定优先级（冻结，D-58）**：",
"**Host/Origin 允许集合（派生规则，F-03）**：`config.publicOrigin`（`PUBLIC_URL`，默认 `http://127.0.0.1:4175`）→ 允许 `publicOrigin.host`；另允许 `127.0.0.1:<PORT>` 与 `localhost:<PORT>`（容器内 healthcheck 用）；容器内 `HOST=0.0.0.0`。Caddy 必须保留外部 Host（`header_up Host {http.request.host}`）；web 容器 healthcheck 访问 api 时使用 public origin 的 Host。直连 simple 模式 PORT=4175，集合一致。\n\n**判定优先级（冻结，D-58）**：");

add("production",
"- **生产口令**（D-67）：`APP_ENV=production` 时 `DEMO_PASSWORD` 必填；`POSTGRES_PASSWORD` 由 `.env` 提供且 compose 用 `${...:?}` 强制；`.env` gitignore；README 写\"默认演示口令不得上公网\"。",
"- **生产加固**（D-67/D-73，F-06）：`APP_ENV=production` 时必须提供 `ADMIN_PASSWORD`（≥12 字符、≠`demo1234`、且不等于 `DEMO_PASSWORD`），必须 `COOKIE_SECURE=1`；生产模式只 seed 14 商品 + `admin`，**不创建 `userA`/`userB`**；`DEMO_PASSWORD` 仅 development/classroom 使用，默认值只在 localhost 生效；`POSTGRES_PASSWORD`/`POSTGRES_USER`/`POSTGRES_DB` 由 `.env` 提供，compose 用 `${...:?}` 强制；`.env` gitignore；README 分列 classroom 默认与 production checklist。");

add("xff",
"- **登录限流**（D-54）：内存 `Map<username|ip, {fails, firstAt, lockedUntil}>`；15 分钟窗口失败 5 次锁定 15 分钟；命中返回 429 + `Retry-After`；成功清零；定期清理过期条目；测试用可注入时钟。客户端 IP 在 `TRUST_PROXY=1` 时取 `X-Forwarded-For` 最左段（只信任已知反代，compose 内 web→api 时设置），否则用 socket 地址；直连暴露时不得开 `TRUST_PROXY`。边界：单实例、进程重启清零，不防分布式撞库，写入 README。",
"- **登录限流**（D-54/D-77，F-08）：内存 `Map<username|ip, {fails, firstAt, lockedUntil}>`；15 分钟窗口失败 5 次锁定 15 分钟；命中返回 429 + `Retry-After`；成功清零；定期清理过期条目；测试用可注入时钟。客户端 IP：**Caddy 必须覆盖** `X-Forwarded-For` 为 `{remote_host}`（不追加客户端自带值）；api 仅在 `TRUST_PROXY=1` 时信任该头，且只信任来自 compose 内网的请求；`TRUST_PROXY=0` 用 socket 地址。限流 Map 限制键长度（≤128）与条目上限（默认 10000，LRU 淘汰）。测试覆盖伪造 XFF 在 0/1 下的行为。边界：单实例、进程重启清零，不防分布式撞库，写入 README。");

add("config-row",
"| `config.mjs` | `loadConfig(env)`（端口、HOST、DB URL、TTL、Cookie、限流、`TRUST_PROXY`、APP_ENV、DEMO_PASSWORD） |",
"| `config.mjs` | `loadConfig(env)`（PORT、HOST、`PUBLIC_URL`、DATABASE_URL、TTL、Cookie、限流、`TRUST_PROXY`、APP_ENV、`DEMO_PASSWORD`、`ADMIN_PASSWORD`） |");

add("compose-env",
"- `docker-compose.yml`（默认三容器）：项目名 `fruitlab-r3`；db healthcheck `pg_isready`；api `depends_on: db: service_healthy`；web `depends_on: api: service_healthy`，`ports: [\"4175:8080\"]`；db 不映射宿主端口（调试用 `compose.debug.yml` 加 `55432:5432`）。",
"- `docker-compose.yml`（默认三容器，F-03/F-04）：项目名 `fruitlab-r3`；db 固定 `POSTGRES_USER=fruitlab`、`POSTGRES_DB=fruitlab`、密码来自 `${POSTGRES_PASSWORD:?}`，healthcheck `pg_isready -U fruitlab -d fruitlab`；api 的 `DATABASE_URL` 由同一组变量拼装，`HOST=0.0.0.0`、`PORT=3000`、`APP_ENV=${APP_ENV:-development}`、`PUBLIC_URL=${PUBLIC_URL:-http://127.0.0.1:4175}`；api `depends_on: db: service_healthy`；web `depends_on: api: service_healthy`，`ports: [\"4175:8080\"]`，Caddy `header_up Host {http.request.host}`、`header_up X-Forwarded-For {remote_host}`；web 也有 healthcheck（`wget -q -O /dev/null http://127.0.0.1:8080/`）；db 不映射宿主端口（调试用 `compose.debug.yml` 加 `55432:5432`）。密码含 URL 特殊字符时用 `encodeURIComponent` 拼装并文档说明。");

add("backup-env",
"- `scripts/backup.sh` / `restore.sh`（WSL bash）：`docker compose exec -T db pg_dump -U fruitlab -d fruitlab -Fc` → `backups/*.dump`；恢复 `pg_restore --clean --if-exists`；打印校验（行数/种子计数）。",
"- `scripts/backup.sh` / `restore.sh`（WSL bash）：从 `.env` 读取 `POSTGRES_USER`/`POSTGRES_DB`（不硬编码），`docker compose exec -T db pg_dump -U \"$POSTGRES_USER\" -d \"$POSTGRES_DB\" -Fc` → `backups/*.dump`；恢复 `pg_restore --clean --if-exists`；打印校验（行数/种子计数）；恢复前提示停写（compose stop api）。");

add("files-app",
"**新增**：`package.json`、`package-lock.json`、",
"**新增**：`server/app.mjs`、`server/services/index.mjs`、`package.json`、`package-lock.json`、");

add("section15",
"## 15. 待办：门禁后并入\n\n1. 语义审查发现的内部矛盾/编号冲突（若有）→ 修订 §3/§5/§6；\n2. 脱敏扫描结果（HIGH/MEDIUM/LOW）→ 记录 `evidence/spec-quality-gate.md`；\n3. codex 同族复核 findings → 采纳/拒绝理由并入修订记录；\n4. 跨模型质量门 → `unavailable` 原始输出 + 理由；\n5. 项目负责人确认（已授权代理自审）→ 状态改 `APPROVED v1.0`。",
"## 15. spec 门禁结果（2026-10-18）\n\n| 门禁 | 状态 | 结果 |\n|---|---|---|\n| 语义审查（人工，逐项） | **通过** | 发现 8 项：计数口径（10 findings/11 缺陷点）、CSRF 登录后补发、反代 IP 失真、容器备份目录可写、测试处置范围、本机 WSL 执行现实、优先级顺序、事务边界模糊；全部已修 |\n| 脱敏扫描（本地 fail-closed） | **通过** | `node scripts/check-redaction.mjs`：HIGH 0 / MEDIUM 0 / WARN 13（全部为 `127.0.0.1` 与版本号 `x.y.z.0` 误报） |\n| 同族第二智能体复核（codex） | **通过（需修订 → 已修订）** | 10 条 findings（F-01..F-10），全部采纳/部分采纳并落 v1.1；处置见 `evidence/codex/spec-review-disposition.md`；复核报告 `evidence/codex/spec-review-codex.md` |\n| 跨模型质量门 | **`unavailable`** | 无第二个模型家族：codex 配置为 `opencode-go/deepseek-v4.1-flash`（同族）；不换模型充数，不用同族冒充跨模型 |\n| 项目负责人确认 | **通过（授权代理自审）** | 用户明确授权执行代理自行完成选型与环审批；本环自审记录见 `evidence/ring-spec.md` |\n\n**状态**：`APPROVED v1.1`（2026-10-18，spec 环）。v1.0 快照保留在 `evidence/codex/SPEC-snapshot-v1.0.md`。");

let applied = 0;
for (const patch of patches) {
  const first = src.indexOf(patch.oldText);
  if (first === -1) {
    console.log(`MISS ${patch.name}`);
    continue;
  }
  if (src.indexOf(patch.oldText, first + 1) !== -1) {
    console.log(`DUPLICATE ${patch.name}`);
    continue;
  }
  const next = src.slice(0, first) + patch.newText + src.slice(first + patch.oldText.length);
  fs.writeFileSync(FILE, next, "utf8");
  console.log(`OK ${patch.name}`);
  applied += 1;
  // 重新读取，保证后续匹配基于最新内容
  src = fs.readFileSync(FILE, "utf8");
}
console.log(`applied ${applied}/${patches.length}`);
