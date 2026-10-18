# FruitLab R2 规格：从单机演示到带角色的持久化系统（含视觉重塑）

> **状态**：`APPROVED v1.1`（2026-10-18 项目负责人确认 v1.0；同日 autoplan 终门批准后并入修订，见 §15）
> **文档定位**：本文件替代 R1 的 `SPEC.md`。R1 原始版本由 git 标签 `r1-baseline`（commit `c1167e0`）与 `D:\vibecoding\easyvibe\r1-fruitlab` 双重保留，本文件不覆盖历史、只推进当前实现。
> **上游输入**：`PRD-R2.md`（替代 office-hours）、R1 八环产物、`R1-义务覆盖率核查.md`、`R1-八环讲解记录.md`、`R1-操作经验教训.md`
> **下游**：`DECISIONS.md`（autoplan）→ `BUILD.md` → `review.md` → `qa-report.md` → `CHANGELOG.md` → `retro.md`
> **基线实测**：Node.js `v22.20.0`；本目录 `node --test` 实测 **62 项（61 通过 / 1 平台跳过 / 0 失败）**；工作树基线 commit `c1167e0`，标签 `r1-baseline`。

## 修订记录

| 日期 | 版本 | 变更 |
|---|---|---|
| 2026-10-18 | v1.0-draft | spec 环节产出：R2 规格初稿。含数据模型、API、CLI、Apple 风格视觉规范、义务追溯与文档证据形态、降级边界 |
| 2026-10-18 | v1.1 | 并入 autoplan 四阶段接受的 42 条义务修订：工时/里程碑、AC-31 拆分（访客查单按 U2=A 移除）、管理端商品接口、下单幂等、会话登出、CLI 契约（dev/health/--json/退出码/--password-stdin）、错误单源、Origin/Host 规则、单写者队列、图片 fallback、verify 入口、CSP 单源、校验上限等。**§15 覆盖前文冲突条款** |

---

## 1. Context（为什么做这件事）

R1 交付了一个**单机演示**：10 种水果、浏览器 `localStorage` 存订单、`serve.mjs` 只做静态托管、零第三方依赖、62 项测试。它是课堂「升级前」的展品，已冻结。

R2 是同一门课程的第二幕，要演示「**一次真实迭代升级**」：把单机演示演进成带服务端、数据库与角色的系统，同时收敛 R1 暴露的 7 项缺口，并补上 R1 缺失的**义务追溯机制**。课堂需要 R1/R2 两个目录**同时启动并排对比**。

本规格回答四件事：功能怎么定、契约怎么变、视觉怎么换、证据怎么留。

## 2. Current State（实测基线，不是复述）

| 项 | 实测值 | 证据 |
|---|---|---|
| 运行时 | Node.js `v22.20.0` | `node --version` |
| 测试 | 62 项：61 通过 / 1 跳过 / 0 失败 | `node --test` 原始输出（`# tests 62`、`# pass 61`、`# skipped 1`、`# fail 0`） |
| 版本 | `1.0.0.0` | `VERSION` |
| 端口 | 默认 `127.0.0.1:4173`，支持 `--port` | `serve.mjs:6-7`、`serve.mjs:242-281` |
| 静态白名单 | 22 条，其中 **4 条在磁盘上不存在**（`/BUILD-LOG.md`、`/evidence/clean-run.md`、`/evidence/index.md`、`/evidence/manual-checks/browser.md`） | `serve.mjs:10-31`；`index.html:129` 页脚还链向 `./evidence/index.md` |
| CSP | `connect-src 'none'`、`img-src 'self' data:`、`script-src 'self'`、`style-src 'self'` | `index.html:6-9`、`serve.mjs:42-52` |
| 存储接缝 | `readOrders(storage)`、`appendOrder(storage, order)`，存储对象参数注入 | `assets/order-store.mjs:16,53` |
| 领域层 | 10 个纯函数 + `limits`，全部无 DOM/存储依赖 | `assets/domain.mjs:35-269` |
| 控制器 | 无 DOM 的 reducer：`checkoutReducer`、`lookupReducer`、`runCheckout`、`performLookup`、`resolveUnknownCheckout` | `assets/controller.mjs:42-436` |
| 商品目录 | 硬编码 10 种，字段 `id/name/unit/unitPriceCents/description`，无图片、无库存、无上下架 | `assets/catalog.mjs:1-75` |
| 前端 | 单页，果摊招牌视觉；商品为纯文字卡；订单存 `localStorage["fruitlab.orders.v1"]` | `index.html`、`assets/styles.css` |
| 依赖 | 无 `package.json`、零第三方依赖 | `tests/static-scan.test.mjs` 已断言 |
| Git | `main` 分支；`r1-baseline` = `c1167e0` | `git tag -l` |

**R1 已知缺口（本规格第 5.11 节逐项处置）**：G1 四个失效链接、G2 证据包未生成、G3 契约冻结不完整、G4 查单框缺 `aria-invalid`、G5 引用了不存在的检查项编号、G6 测试计数三处不一致、G7 发布分支未合回 `main`（**实测已合并**：`release/r1-fruitlab-ring7` 是 `main` 祖先）。

## 3. Decision Resolution（本规格锁定的决策）

| # | 决策 | 选择 | 依据 / 备注 |
|---|---|---|---|
| D-01 | 持久化载体 | **SQLite 单文件数据库**，用 Node 内置 `node:sqlite`（`DatabaseSync`） | 本机实测：无需标志位即可 `require`；文件库写入→关闭→重开→读回成功；仅一条 `ExperimentalWarning`，如实记录不隐藏。满足「零第三方依赖 + 一个数据库实例」 |
| D-02 | 数据表 | **4 + 1 张表**：`users`、`products`、`orders`、`order_items` + `sessions` | 对齐 `01_` 蓝本的 4+1 精神（主体/资源/主单/子项 + 辅助表），按本业务命名 |
| D-03 | 会话 | 服务端 `sessions` 表 + `HttpOnly` Cookie，令牌 32 字节随机十六进制 | 已定方案 A；Cookie `Path=/; HttpOnly; SameSite=Lax`，**无 `Secure`**（无 HTTPS），边界写入第 12 节 |
| D-04 | 口令 | `node:crypto` 的 `scrypt` + 每用户随机盐 + `timingSafeEqual` | 零依赖；格式 `scrypt$<N>$<r>$<p>$<salt_b64>$<hash_b64>`；不存明文、不记日志 |
| D-05 | 端口 | R2 默认 **`127.0.0.1:4174`** | 与 R1 的 `4173` 并存，供课堂并排对比；`--port` 仍可覆盖 |
| D-06 | 注册 | 开放注册，默认 `role='user'`；`admin` 只能由 CLI 或种子创建 | PRD FR-2 |
| D-07 | 库存语义 | 下单时**原子扣减**库存（`UPDATE ... WHERE stock >= ?`，同一事务）；零库存仍出现在列表并标「已售罄」；下架商品不出现在列表 | 沿用 PRD FR-4 已定语义；扣减是「库存」成立的必要行为 |
| D-08 | 视觉方向 | **苹果官网式高冷克制风**，**替代** PRD FR-7 的「参照亚马逊」 | 项目负责人 2026-10-18 指示。属**方向变更**：不修改 PRD 原文，在本规格与 `DECISIONS.md` 双处记录，A11 判定口径随本规格重写 |
| D-09 | 商品照片 | **Openverse API** 检索（CC0 / CC BY，排除 NC/ND），14 张，下载进仓库 `assets/images/products/` | 本机实测 Openverse API 可用且返回 `license/creator/url`，回源图片可下载（JPEG 119 KB）；Pexels/Unsplash/Pixabay 直连 401/403 不可靠。台账见 5.8 |
| D-10 | 契约演进 | `order-store` 的 `readOrders`/`appendOrder` 保留函数名但首参从 `storage` 换成 `db` 并加用户归属；领域层纯函数**原样不动** | PRD 第 5 节；对照表见 5.4 |
| D-11 | 追溯机制 | 义务编号 `OB-<阶段>-<序号>`；`BUILD.md` 验收表同时引用 `AC-xx` 与 `OB-xx`；`docs/obligations.md` 单一台账；脚本机械核对 | PRD 第 6 节 |
| D-12 | 降级边界 | 见 5.12：分「不可降级 / 可降级（外部依赖）/ 可替代形态」三档，降级必须三处留痕 | 项目负责人授权按此执行 |
| D-13 | 文档形态 | 见 5.11：`docs/`（决策台账、契约、API、错误目录、分支矩阵、设计词元、图片授权）+ `evidence/`（逐环证据、清单、唯一测试计数） | 项目负责人要求「文档记录便于复盘」 |
| D-14 | 基线标签 | `r1-baseline` 打在 `c1167e0`，任何改动可 diff、可回退 | 课堂对比与回退需要 |
| D-15 | SPEC 覆盖方式 | R2 规格覆盖写入 `SPEC.md`，R1 版本由标签与 `r1-fruitlab` 保留 | 保持「每环一个产物文件」约定 |
| D-21 | 会话令牌存储 | 库中存 `sha256(token)`，不存明文 | 降低库泄露风险；改动小 |
| D-22 | 下单事务边界 | 主单、明细、扣库存**同一事务**；`busy_timeout` + 有界重试；失败回滚 | 防「订单已建、库存未扣」 |
| D-23 | 请求体上限 | API 请求体 ≤ 64 KiB，超限 413 | 防内存放大；零依赖 |
| D-24 | 视觉验收方式 | qa 环真实 Chromium 在 1440/1024/390 三视口截图 + 人工确认，截图入 `evidence/` | fake DOM 证明不了布局，必须实机 |
| D-25 | schema 版本与迁移 | `PRAGMA user_version` + 迁移函数，`db init` 建 v1 | 实验 API 也要有版本位 |
| D-26 | R1 数据迁移 | **不迁移** R1 浏览器 `localStorage` 订单；R2 从空订单开始 | PRD 未要求；不假装「平滑迁移」 |
| D-27 | 状态变更请求校验 | `POST`/`PATCH` 校验 `Origin`/`Sec-Fetch-Site` 同源；**部分缓解，不构成 CSRF 防护** | 低成本降低跨站风险，边界照 PRD 写清 |
| D-28 | CLI 库路径 | `--db <path>` + `FRUITLAB_DB`，与 `serve.mjs` 共用 | 测试用临时库，避免与运行库互踩 |
| D-29 | 数据完整性 | 商品/订单确定性排序 + 事务内合计断言 | 防顺序漂移与主单/明细合计不一致 |
| D-30 | 未知写入语义 | 不做幂等键；`save-unknown` 后**不自动重试**，引导「我的订单」核对 | 延续 R1 DX1，防重复下单 |
| D-31 | sqlite 风险 | 启动自检 Node/sqlite；接受 `DatabaseSync` 同步阻塞（单进程演示） | 零依赖现实，风险显式记录 |
| D-32 | 越权返回码 | 他人订单返回 `403`（不统一为 404），接受订单号存在性泄露 | 课堂需要可演示的水平越权拒绝 |

## 4. Proposed Change

| 目标 | 内容 | 验收 |
|---|---|---|
| 功能演进 | 持久化、用户与身份、权限、管理员、命令行、14 种商品 | AC-01～AC-08 |
| 缺口收敛 | G1～G7 逐项处置（关闭或明确降级） | AC-09、AC-19～AC-25 |
| 机制补强 | 义务追溯、契约冻结、唯一计数、机械校验 | AC-10、AC-21、AC-24 |
| 视觉重塑 | Apple 式版式 + 14 张本地真实照片 + 授权台账 | AC-14～AC-18 |
| 文档证据 | 决策台账、逐环证据、可复盘索引 | AC-33～AC-36 |

## 5. Implementation Details

### 5.1 数据模型（SQLite，4+1 张表）

建库文件：`data/fruitlab.db`（`data/` 加入 `.gitignore`；建库与种子由 CLI 完成，见 5.5）。

```sql
PRAGMA journal_mode = WAL;
PRAGMA foreign_keys = ON;

CREATE TABLE users (
  user_id       TEXT PRIMARY KEY,
  username      TEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  role          TEXT NOT NULL CHECK (role IN ('user','admin')),
  created_at    TEXT NOT NULL
);

CREATE TABLE products (
  product_id       TEXT PRIMARY KEY,
  name             TEXT NOT NULL,
  unit             TEXT NOT NULL,
  unit_price_cents INTEGER NOT NULL CHECK (unit_price_cents >= 0),
  stock            INTEGER NOT NULL CHECK (stock >= 0),
  listed           INTEGER NOT NULL CHECK (listed IN (0,1)),
  image_path       TEXT NOT NULL,
  image_alt        TEXT NOT NULL,
  description      TEXT NOT NULL,
  sort_order       INTEGER NOT NULL
);

CREATE TABLE orders (
  order_id       INTEGER PRIMARY KEY AUTOINCREMENT,
  order_number   TEXT NOT NULL UNIQUE,
  user_id        TEXT NOT NULL REFERENCES users(user_id),
  subtotal_cents INTEGER NOT NULL CHECK (subtotal_cents >= 0),
  created_at     TEXT NOT NULL
);

CREATE TABLE order_items (
  item_id          INTEGER PRIMARY KEY AUTOINCREMENT,
  order_id         INTEGER NOT NULL REFERENCES orders(order_id),
  product_id       TEXT NOT NULL REFERENCES products(product_id),
  quantity         INTEGER NOT NULL CHECK (quantity BETWEEN 1 AND 99),
  unit_price_cents INTEGER NOT NULL CHECK (unit_price_cents >= 0),
  subtotal_cents   INTEGER NOT NULL CHECK (subtotal_cents >= 0)
);

CREATE TABLE sessions (
  token      TEXT PRIMARY KEY,
  user_id    TEXT NOT NULL REFERENCES users(user_id),
  created_at TEXT NOT NULL
);

CREATE INDEX idx_orders_user ON orders(user_id);
CREATE INDEX idx_order_items_order ON order_items(order_id);
CREATE INDEX idx_sessions_user ON sessions(user_id);
```

**不变量**：
1. `users.username` 唯一；`orders.order_number` 唯一；
2. 订单行快照（`unit_price_cents`、`subtotal_cents`）在写入时冻结，后续改价不影响历史订单；
3. 金额一律整数分；商品最多 10 行（沿用 R1 `limits.maxItems`）；数量 1～99；
4. 下架（`listed=0`）商品不出现在商品列表；零库存商品仍出现并显示售罄；
5. 删除商品不删除历史订单行（`order_items` 保留快照，`product_id` 引用保留）；
6. 列表顺序确定：商品 `ORDER BY sort_order, product_id`，订单 `ORDER BY created_at DESC, order_id DESC`（D-29）；
7. 事务内断言 `orders.subtotal_cents = SUM(order_items.subtotal_cents)`，不等则回滚。

**种子数据**：14 种商品（10 种 R1 原样迁入 + 新增 `cherry` 车厘子、`mango` 贵妃芒、`kiwi` 猕猴桃、`strawberry` 草莓）；3 个账号 `userA`、`userB`、`admin`（口令由种子脚本生成并写入 README 的演示口令表；**数据库只存哈希**，见 5.3）。

**事务与并发**：
- `PRAGMA busy_timeout = 5000`；
- 下单：`BEGIN IMMEDIATE` → 校验并扣库存（`UPDATE products SET stock = stock - ? WHERE product_id = ? AND stock >= ?`，受影响行数必须为 1）→ 插入 `orders` → 插入 `order_items` → `COMMIT`；任一步失败 `ROLLBACK`，库存不变，返回 409 或 500；
- `order_number` 唯一冲突：在事务内重试生成，最多 10 次（沿用 R1 `generateUniqueOrderNumber` 预算），耗尽返回 `409 order-number-exhausted`；
- `SQLITE_BUSY`：事务整体重试 ≤ 3 次（退避 50/100/200ms），仍失败返回 `503 server-busy`。

**schema 版本与迁移**：`PRAGMA user_version = 1`；迁移函数按版本递增执行；`db init` 幂等（已有 v1 则跳过）；`--force` 仅删库重建且需显式确认文本；不提供降级迁移。

**R1 数据迁移**：不迁移 R1 浏览器 `localStorage` 中的历史订单（D-26）；R2 从空订单开始，README 明确说明，避免「平滑迁移」的误导。

**N+1 规避**：管理端「全部订单」列表用**一条 JOIN 查询**取主单 + 行数/合计摘要，禁止循环查子表（第 5 环的经典靶点，本规格主动规避并留测试）。

### 5.2 HTTP API 契约

统一前缀 `/api`；请求与响应均为 JSON；成功体 `{ "ok": true, ... }`；失败体 `{ "ok": false, "code": "<稳定码>", "message": "<中文文案>", "details": ... }`。

| 方法 | 路径 | 权限 | 说明 |
|---|---|---|---|
| `GET` | `/api/products` | 公开 | 商品列表（只含 `listed=1`）；响应 `{ok, products:[{id,name,unit,unitPriceCents,stock,soldOut,image,alt,description}]}` |
| `POST` | `/api/auth/register` | 公开 | `{username,password}`；201；重名 409 `auth-username-taken` |
| `POST` | `/api/auth/login` | 公开 | `{username,password}`；200 + `Set-Cookie`；失败 401 `auth-invalid-credentials` |
| `POST` | `/api/auth/logout` | 会话 | 204；清 Cookie |
| `GET` | `/api/auth/me` | 公开 | 200 `{ok,user}` 或 401 `auth-required` |
| `POST` | `/api/orders` | 登录 | `{items:[{productId,quantity}]}`；201；库存不足 409 `insufficient-stock`；校验失败 400 |
| `GET` | `/api/orders/mine` | 登录 | 200 `{ok,orders}`（按 `created_at` 倒序） |
| `GET` | `/api/orders/{orderNumber}` | 登录 | 自己的订单 200；他人订单 403 `order-not-owned`；不存在 404 `order-not-found` |
| `GET` | `/api/admin/orders` | admin | 200 全部订单（JOIN 摘要）；非 admin 403 `auth-forbidden` |
| `PATCH` | `/api/admin/products/{id}` | admin | `{unitPriceCents?, stock?, listed?}`；200；非法值 400；不存在 404 |

**失败形状冻结**（G3 的一部分）：

- `400 invalid-request`：字段缺失/类型错；`400 invalid-quantity`：数量越界；`400 invalid-price` / `400 invalid-stock`：负值或非整数；
- `401 auth-required`：无会话或会话无效；`401 auth-invalid-credentials`：登录失败（**不区分用户名不存在与口令错误**）；
- `403 auth-forbidden`：角色不足；`403 order-not-owned`：水平越权；
- `404 product-not-found` / `404 order-not-found` / `404 not-found`（静态）；
- `409 auth-username-taken` / `409 insufficient-stock` / `409 duplicate-order-number`；
- `405`：静态层非 GET/HEAD，带 `Allow`；API 层方法不匹配，带 `Allow`；
- `500 internal-error`：脱敏，不回显堆栈；服务端日志留 `requestId`；
- `413 payload-too-large`：请求体超过 64 KiB（D-23）；
- `400 invalid-json`：请求体不是合法 JSON；
- `503 server-busy`：SQLite 忙且重试耗尽（D-22）。

**判定优先级**（同一请求多处不满足时按顺序返回，只返回第一个）：

| 顺序 | 判定 | 错误 |
|---|---|---|
| 1 | 请求体超限 / 非法 JSON | `413` / `400 invalid-json` |
| 2 | 方法不允许 | `405`（带 `Allow`） |
| 3 | 会话无效 | `401 auth-required` |
| 4 | 角色不足 | `403 auth-forbidden` |
| 5 | 资源不存在 | `404 product-not-found` / `404 order-not-found` |
| 6 | 字段缺失/类型错 | `400 invalid-request` |
| 7 | 业务校验（数量、价格、库存、上下架） | `400 invalid-quantity` / `invalid-price` / `invalid-stock` / `invalid-listed` |
| 8 | 业务冲突（库存不足、订单号耗尽、重名） | `409 insufficient-stock` / `order-number-exhausted` / `auth-username-taken` |
| 9 | 服务端异常 | `500 internal-error` / `503 server-busy` |

**补充定义**：
- 下单时商品不存在 → `404 product-not-found`；已下架 → `409 product-unlisted`；
- `PATCH` 边界：`unitPriceCents` 为 0～9,999,999 的整数；`stock` 为 0～99,999 的整数；`listed` 仅 0/1；越界 → `400`；
- `order-number-exhausted`（409）：订单号重生成 10 次仍冲突；
- **存在性泄露取舍**：他人订单返回 `403 order-not-owned`（而非 404），便于课堂演示水平越权；代价是泄露「该订单号存在」。这是有意识的取舍，记录在 `docs/decision-log.md`（D-32），**不得写成「无信息泄露」**。

**请求体与分页**：请求体上限 65536 字节（含流式读取限长，不只看 `Content-Length`）；本版不做分页（商品 14 条、订单量小），写入第 12 节。

**静态层**：沿用 R1 的「显式白名单 + 拒绝点文件/反斜杠/NUL/编码分隔符/大小写混写遍历/查询变体/symlink 逃逸」；新增 `assets/images/products/*.jpg` 与新增模块进白名单；**每个白名单项必须真实存在**（G1 的机械保证，见 5.11）。`MIME_TYPES` 增加 `.jpg`/`.png`/`.webp`。

### 5.3 会话与权限

- 登录成功：`token = crypto.randomBytes(32).toString("hex")`；库中只存 `sha256(token)`；`Set-Cookie: fruitlab_session=<token>; Path=/; HttpOnly; SameSite=Lax`（无 `Secure`，无 `Max-Age`，即浏览器会话 Cookie）；
- 每个受保护请求：解析 Cookie → `sha256(token)` 查 `sessions` → 查 `users` → 附 `req.user`；无会话 → 401；
- 权限矩阵：
  - `user`：只能 `GET /api/orders/mine`、`GET /api/orders/{自己订单号}`、`POST /api/orders`；
  - `admin`：上述 + `GET /api/admin/orders`、`PATCH /api/admin/products/*`、`GET /api/orders/{任意}`；
  - 越权一律 403，且**拒绝行为必须有用例**（水平越权与垂直越权各至少一条）；
- 状态变更请求（`POST` / `PATCH`）校验 `Origin` 或 `Sec-Fetch-Site` 为同源，不匹配返回 `403 cross-origin-blocked`；这是**部分**缓解，不构成 CSRF 防护（PRD 边界，不得写成「已做 CSRF」；D-27）；
- 口令：`scrypt`（`N=16384, r=8, p=1`，盐 16 字节，派生 64 字节），校验用 `timingSafeEqual`；种子账号口令写入 README「演示口令表」，**数据库只存哈希**（教学演示性质，明确标注非生产）；
- 本版明确不做（边界）：会话过期/续期、CSRF 防护、失败次数限制与锁定、HTTPS/`Secure`、记住我、跨设备会话、审计日志。**不得暗示这是生产级安全**。
- **风险接受（明确声明）**：以上边界来自 PRD FR-2 的「本版明确不做」，是**有意识的取舍而非遗漏**；演示服务只监听回环地址、无真实用户数据。风险接受写入 `docs/decision-log.md`，任何文档不得把它写成「已具备」。

### 5.4 领域层与存储契约演进

| 契约 | R1 | R2 | 变更原因 | 兼容性 |
|---|---|---|---|---|
| `readOrders(storage)` | `readOrders(storage)` → `{ok, raw, orders}` | `readOrders(db, { userId })` → `{ok, orders}`（服务端模块） | 数据源从浏览器存储变为服务端库；按用户过滤 | **破坏性**（首参语义变、返回去 `raw`） |
| `appendOrder(storage, order)` | `appendOrder(storage, order)` → `{status, code, raw…}` | `appendOrder(db, order)` → `{status, code, order}`；`status ∈ {saved, not-written, duplicate-order-number, save-unknown}` 保留 | 服务端权威写入；`save-unknown` 语义在 DB 层不再出现，改由**客户端网络失败**映射 | **破坏性但状态词表保留** |
| `runCheckout({cart, catalogById, storage, now, suffixFactory})` | 参数注入 storage | `runCheckout({cart, catalogById, db, userId, now, suffixFactory})` | 订单归属用户 | 有限演进 |
| `performLookup({input, storage})` | 返回本地订单 | `performLookup({input, db, viewer})`，按 `viewer` 过滤 | 权限隔离 | 有限演进 |
| 领域纯函数（`domain.mjs` 10 个 + `limits`） | 无依赖 | **原样复用，不改签名** | 证明 R1 分层有效 | 完全兼容 |
| `assets/order-store.mjs` | 浏览器存储实现 | **退役**；职责拆为 `server/order-store.mjs`（DB）与 `assets/api-client.mjs`（前端） | 前端不再直摸存储 | 文件删除，契约对照见上 |
| `PUBLIC_ALLOWLIST` | 仅静态文件 | 静态文件 + 图片 + API 路由 | 新需求 | 扩展 |
| CSP `connect-src` | `'none'` | `'self'` | 前端必须调用同源 API | **必须改**，否则登录/下单全部被拦截 |
| 默认端口 | `4173` | `4174` | 与 R1 并存 | 变更 |
| 版本 | `1.0.0.0` | `2.0.0.0` | 发布 | 变更 |

**验收口径**：`A7` 要求「R1 哪些契约被保住、哪些被改、为什么」能回答——上表即答案；`BUILD.md` 必须引用本表并给出逐项测试位置。

### 5.5 命令行契约

服务端启动（沿用 R1 契约）：

```
node serve.mjs [--port <0-65535>] [--db <path>] [--help] [--version]
```

- 默认 `127.0.0.1:4174`；`--port` 非法 → 退出码 2，文案沿用 R1；端口占用 → 打印可操作提示（含 `--port` 建议）；
- `--help` / `--version` 成功退出 0；未知参数退出 2。

运维与管理员 CLI（新增 `cli.mjs`）：

```
node cli.mjs db init [--force]
node cli.mjs db seed
node cli.mjs user list
node cli.mjs user add --username <u> --password <p> [--role user|admin]
node cli.mjs product list
node cli.mjs product set-price --id <product-id> --cents <n>
node cli.mjs product set-stock --id <product-id> --units <n>
node cli.mjs product list|unlist --id <product-id>
node cli.mjs orders list [--user <username>]
node cli.mjs --help | --version
```

- 全局选项 `--db <path>`（或环境变量 `FRUITLAB_DB`）置于子命令之前，默认 `data/fruitlab.db`；CLI 与 `serve.mjs` 必须能指向同一临时库，否则测试与运维会互相踩库（D-28）；
- 退出码：`0` 成功 / `1` 运行期错误（库不可写、库未初始化等）/ `2` 参数错误；
- 所有输出为纯文本，可管道；**不得打印口令或哈希**；
- `db init` 幂等（存在则报错并提示 `--force`，`--force` 需显式确认文本）；
- CLI 与 HTTP 共享同一组 `server/*.mjs` 模块，避免第二套业务逻辑。

### 5.6 前端结构（必须保住 R1 的交互契约）

页面仍为**单页、零构建**；`index.html` 重组为：

| 区域 | 内容 |
|---|---|
| 顶部导航 | 标识、`商城`、`查订单`、`我的订单`、`管理`（仅 admin 可见）、`登录/注册`、购物袋入口 |
| 首屏 | 标题、简短副标题、商品网格 |
| 商品网格 | 14 张卡（照片、名称、规格、价格、加入购物袋）；售罄态；下架不出现在此 |
| 购物袋 | 行算式、合计、结账（未登录先引导登录） |
| 查订单 | 顶层入口（R1 契约）；查询后**聚焦结果标题**；输入即清过期结果；格式错误给 `aria-invalid` |
| 我的订单 | 登录用户的订单列表与详情 |
| 管理 | `订单`（全部订单）/ `商品`（价格、库存、上下架） |
| 登录/注册 | 表单；错误码到中文文案的映射 |
| 页脚 | 运行说明、证据索引（真实存在的文件） |

**R1 交互契约（必须全部保留，AC-31 逐条验证）**：
1. 顶层「查订单」入口存在且可达；
2. 查询成功后焦点落在结果标题；
3. 数量输入框失焦重绘不吞掉紧随其后的点击；
4. 数量边界 1/99 时加减按钮禁用；
5. 购物车变动或新结账时隐藏旧收据；查单输入即清旧结果；
6. 存储/网络失败显示**按错误码对应的具体文案**，不是笼统「出错了」；
7. 结账中（saving）状态可见且按钮禁用；未知结果（`save-unknown`）锁定重试并要求人工核对；
8. 移动端（<720px）购物袋有紧凑入口，不必滚到页底。

**R2 的 `save-unknown` 处理**：不实现幂等键（PRD 未要求）；客户端在未知结果后**不自动重试**，提示用户到「我的订单」核对（延续 R1 DX1「未知写入必须人工核对」的决定），避免重复下单（D-30）。

**前端模块**：`assets/api-client.mjs`（fetch 封装、Cookie 同源、错误码映射）、`assets/controller.mjs`（纯 reducer 扩展登录/管理态，仍不依赖 DOM）、`assets/app.mjs`（渲染与事件）、`assets/domain.mjs`（不动）、`assets/catalog.mjs`（退役，改由 API 提供）、`assets/order-store.mjs`（退役）。

### 5.7 视觉规范（Apple 式高冷克制）

> 这是方向变更：PRD FR-7 原写「参照亚马逊商品列表风格」。本节取代该方向，A11 判定以下文为准。

**设计词元**（写入 `docs/design-tokens.md`，CSS 变量落 `assets/styles.css`）：

| 类别 | 值 |
|---|---|
| 背景 / 表面 | `#ffffff` / `#f5f5f7` |
| 主文字 / 次文字 | `#1d1d1f` / `#6e6e73` |
| 分隔线 | `rgba(0, 0, 0, 0.08)` |
| 强调色（仅主 CTA 与链接） | `#0071e3` |
| 危险色 | `#b3261e` |
| 字体 | 系统栈：`-apple-system, BlinkMacSystemFont, "SF Pro Text", "Helvetica Neue", "Segoe UI", system-ui, sans-serif`；**不引入任何外部字体** |
| 字号 | 12 / 14 / 17 / 21 / 28 / 40 / 56，`display` 用 `clamp(40px, 6vw, 56px)`；大标题字距 `-0.01em` |
| 字重 | 400 / 500 / 600，不加 700+ |
| 圆角 | 图片瓦片 `18px`；按钮胶囊 `980px` |
| 间距 | 8 / 12 / 16 / 24 / 32 / 48 / 64 / 96 |
| 容器 | 最大宽 `1280px`；页边距 24px（≥1024px 时 48px） |
| 动效 | 220ms `cubic-bezier(0.25, 0.1, 0.25, 1)`；尊重 `prefers-reduced-motion` |

**版式规则**：
1. **留白优先**：首屏上下留白 ≥ 96px；区块之间 ≥ 48px；不做密集堆叠。
2. **商品网格**：4 列（≥1068px）/ 3 列（≥834px）/ 2 列（≥600px）/ 1 列（<600px）；间距 20～24px。
3. **商品卡**：无边框、无投影；照片区为 1:1 浅灰底（`#f5f5f7`）瓦片，`object-fit: contain`，四周留白；名称 17px/600（最多两行）；规格 14px 次文字；价格 17px/600；CTA 胶囊按钮「加入购物袋」。
4. **售罄**：照片区降饱和度/降透明度，文字「已售罄」，按钮禁用（灰底）。
5. **高冷约束**：不做渐变、不做 emoji、不做促销角标、不做大红大紫、不做卡片投影、不使用感叹号。文案短句、克制、只陈述事实。
6. **响应式**：≥1440px 居中最大宽 1280；移动端导航收为一行可横向滚动的文字链；购物袋在 <720px 使用紧凑入口条。
7. **无障碍**：正文对比度 ≥ 4.5:1；所有图片有 `alt`；焦点环 3px `#0071e3` + 2px offset；状态区 `aria-live`；键盘可完成浏览→加购→结账→查单全流程。

**禁止项（视觉验收会逐条查）**：外部字体、远程图片、渐变横幅、emoji 装饰、多色促销块、超过两级文字颜色。

### 5.8 商品照片资产

- **数量与命名**：14 张，`assets/images/products/<product-id>.jpg`（如 `fuji-apple.jpg`），1:1 裁切、最短边 ≥ 800px、JPEG q≥80、单张 ≤ 300 KB；
- **来源**：Openverse API（`https://api.openverse.org/v1/images/?q=...&license=cc0,by`），回源下载；**仅 CC0 / CC BY**，排除 NC / ND / SA 歧义；
- **授权台账**：`docs/assets-credits.md`（人读）+ `evidence/assets-manifest.json`（机读，字段：`product_id`、`file`、`sha256`、`title`、`creator`、`license`、`license_url`、`source_url`、`retrieved_at`）；
- CC BY 图片在页脚「图片来源与授权」链接到台账，履行署名义务；
- **品种匹配**：优先找品种级照片；找不到时用同品类真实照片，并在台账 `title` 中标明「品类级」，不得用 AI 生成图或插画冒充；
- `alt` = 商品名 + 规格（如「红富士苹果 500g」），由种子数据生成，不手写 14 份散落在 HTML 里。

### 5.9 静态服务与 CSP

- CSP 调整为：`default-src 'self'; script-src 'self'; style-src 'self'; img-src 'self' data:; connect-src 'self'; object-src 'none'; base-uri 'none'; frame-ancestors 'none'; form-action 'self'`（`connect-src` 从 `'none'` 改 `'self'` 是本轮**必要**变更）；
- 启动自检：Node ≥ 22 且 `node:sqlite` 可用；不可用则打印稳定码 `[sqlite-unavailable]`、退出码 1。`node:sqlite` 为实验特性，同步 `DatabaseSync` 会阻塞事件循环；本版接受该限制（单进程演示），记录在 `docs/decision-log.md`（D-31）；
- 白名单条目必须与磁盘一致，由 `scripts/check-links.mjs` 机械校验（G1）；
- 静态层拒绝规则、`problem+json`、405 `Allow`、脱敏 500、`no-store` 全部保留并加测试。

### 5.10 测试策略

| 层 | 覆盖 |
|---|---|
| 领域纯函数 | `tests/domain.test.mjs` **原样保留**，证明 R1 领域层未被破坏 |
| DB 集成 | 临时文件库（`fs.mkdtemp`）+ 建表 + 种子；覆盖建表、唯一约束、外键、库存原子扣减（并发两次只成功一次）、事务回滚 |
| 认证 | 哈希/校验、错误口令、重名注册、会话创建/失效、Cookie 属性 |
| 权限 | userA 查 userB 订单 403；user 调管理接口 403；admin 可查全部 |
| HTTP | 端口 0 启动；状态码、`Set-Cookie`、失败形状、405 `Allow`、404、500 脱敏 |
| CLI | 子进程 `spawnSync` 跑 `cli.mjs`；退出码 0/1/2；`--help`/`--version`；帮助不泄漏口令 |
| 静态扫描 | 沿用 `innerHTML`/`outerHTML`/`insertAdjacentHTML`/`document.write` 禁令；新增「无远程资源」扫描 |
| 前端 DOM | 最小 fake DOM，覆盖登录态渲染、购物袋、查单聚焦、错误码文案 |
| 机械校验 | 链接存在、编号一致、义务追溯、证据清单逐一可验证 |

**测试计数权威**：`scripts/record-test-count.mjs` 运行 `node --test`，把命令、原始输出、git hash、时间写入 `evidence/test-count.txt`；其它文档出现计数时只允许引用该文件（AC-12/AC-24）。

### 5.11 追溯、文档与 G1–G7 机械形态

**义务编号**：`OB-<阶段>-<序号>`（`OB-CEO-01`…、`OB-DES-01`…、`OB-DX-01`…、`OB-ENG-01`…），在 autoplan 阶段产生；R1 的 F/DF/DX/E 编号不被复用，避免歧义。**时序说明**：spec 阶段 `docs/obligations.md` 只有表头与来源说明（义务尚未产生）；`check-traceability.mjs` 在 build 环才要求每条 OB 有内容与证据——这是流程时序，不构成缺口。

**单一台账** `docs/obligations.md`：

| 编号 | 来源发现 | 义务原文 | 完成判据（机械可查） | 判定 | 证据位置 |
|---|---|---|---|---|---|

判定只允许：`closed` / `downgraded`（附理由）/ `not-covered`（附理由并上报）。**文档类义务必须给出可机械核对的形态**（文件存在、链接可解析、矩阵条目、哈希、脚本输出），不得以「已实现」代替。

**`BUILD.md` 验收表**：`AC 编号 | 规格条款 | OB 编号 | 证据位置 | 判定`。`review.md` / `qa-report.md` 各加义务逐项核对表。

**机械校验脚本**（全部零依赖）：
- `scripts/check-links.mjs`：白名单、页脚、文档内部链接目标必须存在；
- `scripts/check-numbering.mjs`：扫描 `SPEC/DECISIONS/BUILD/review/qa-report/retro` 中 `AC-`、`OB-`、`M\d+` 引用，必须能解析到定义；
- `scripts/check-traceability.mjs`：每个 OB 在 BUILD 表出现且证据路径存在；每个 AC 有映射；
- `scripts/record-test-count.mjs`：生成唯一计数；
- `scripts/verify-evidence.mjs`：按 `evidence/manifest.json` 重算 SHA-256 并比对。

**G1–G7 处置**：

| # | 处置 | 机械形态 |
|---|---|---|
| G1 | 生成 `evidence/index.md`、`evidence/clean-run.md`、`evidence/manual-checks/browser.md`；`/BUILD-LOG.md` 引用改指真实 `BUILD.md`；页脚链接指向真实文件 | `check-links.mjs` 通过 |
| G2 | 生成 `evidence/manifest.json`（逐文件 SHA-256）+ `evidence/clean-run.sha256` + 校验脚本，替代完整证据包 | `verify-evidence.mjs` 输出 `OK` |
| G3 | `docs/contracts.md` 逐导出冻结签名/类型/精确失败形状；`docs/branch-matrix.md` 命名分支矩阵；`tests/contracts.test.mjs` 断言导出形状 | 测试 + 文档存在 |
| G4 | 查单输入框加 `aria-invalid` 与 `aria-describedby` 指向错误文案；补测试 | 测试断言 |
| G5 | `check-numbering.mjs` 通过；`M18/M19` 若需要先定义再用，否则删除引用 | 脚本通过 |
| G6 | 唯一计数文件；文档禁止硬编码计数 | `record-test-count.mjs` + `check-numbering.mjs` |
| G7 | 记录合并证据（`git merge-base --is-ancestor` 输出）到 `evidence/g7-release-merge.txt` | 文件存在 |

**文档清单**（复盘的依据）：

| 文件 | 内容 |
|---|---|
| `docs/decision-log.md` | 追加式决策台账：日期、编号、决策、备选项、理由、影响面 |
| `docs/obligations.md` | 义务单一台账 |
| `docs/contracts.md` | 契约冻结（签名/类型/失败形状） |
| `docs/branch-matrix.md` | 状态/结果码 × 测试的命名矩阵 |
| `docs/api.md` | API 契约（含示例请求/响应） |
| `docs/error-catalog.md` | 错误码目录（R1 基础上扩充 API 层） |
| `docs/design-tokens.md` | 视觉词元与版式规则 |
| `docs/assets-credits.md` | 14 张照片的来源与授权 |
| `evidence/index.md` | 证据索引（真实链接） |
| `evidence/test-count.txt` | 唯一测试计数 |
| `evidence/manifest.json` | 证据文件哈希清单 |
| `evidence/ring-*.md` | 逐环证据：真实命令、原始输出、门禁行为、决策记录、环境坑 |

### 5.12 降级边界

| 档 | 项 | 规则 |
|---|---|---|
| **不可降级** | 登录与账号隔离、管理员三项能力、重启后数据仍在、G1–G7 逐项处置、义务追溯表、契约对照表、唯一测试计数、无失效链接、14 张本地照片+授权台账、alt 与无远程资源、Apple 版式核心规则 | 缺一即本轮不合格 |
| **可降级（唯一原因是外部能力不可用）** | 跨模型外部评审（`unavailable`）、人工浏览器验收（`UNVERIFIED`）、推送/PR/部署（`requires-remote`）、完整 WCAG 人工审查（`provisional`） | 如实标注，不伪造；标注位置：对应环报告 + `evidence/` |
| **可替代形态** | G2 证据包（PRD 允许「一次校验替代」）、G3 契约冻结中的「分支矩阵」（允许机读矩阵 + 测试，不要求人工清单） | 必须在 `docs/obligations.md` 写明替代形态与理由 |

**降级留痕规则**：任何降级必须同时出现在 ① `docs/obligations.md` 的判定 ② `BUILD.md` 验收表 ③ 最终 A5 汇总。只出现在一处视为未留痕。

## 6. Acceptance Criteria（验收标准）

| 编号 | 判定 | 对应 PRD |
|---|---|---|
| AC-01 | `userA`、`userB`、`admin` 三个种子账号可登录，登录后 Cookie 为 `HttpOnly` 且同源请求生效 | A1 |
| AC-02 | `userA` 查询 `userB` 的订单号返回 403 `order-not-owned`；`userA` 的「我的订单」不含 `userB` 数据 | A1 |
| AC-03 | 未登录访问受保护接口返回 401 `auth-required` | A1 |
| AC-04 | `admin` 改价格后商品列表价格立即变化，且历史订单金额不变 | A2 |
| AC-05 | `admin` 改库存后列表显示变化；库存 0 显示「已售罄」且不可加购 | A2 |
| AC-06 | `admin` 下架后商品从列表消失；上架后重新出现 | A2 |
| AC-07 | 下单 → 停服 → 重启 → 订单与库存扣减仍在（数据库文件持久） | A3 |
| AC-08 | `cli.mjs` 的 `db init/seed`、`user`、`product`、`orders` 子命令可运行；退出码 0/1/2 正确；`serve.mjs --help/--version/--port` 沿用 R1 契约 | A4 |
| AC-09 | G1–G7 处置结果逐项列出（关闭/降级 + 理由 + 证据位置） | A5 |
| AC-10 | 义务追溯表存在；每条 OB 在 `BUILD.md` 出现且有证据路径；`check-traceability.mjs` 通过 | A6 |
| AC-11 | 契约变更前后对照表存在（旧签名/新签名/原因/兼容性） | A7 |
| AC-12 | 测试计数只有一个权威来源；文档中不出现互相矛盾的数字 | A8 |
| AC-13 | 白名单、页脚、文档链接全部可解析；`check-links.mjs` 通过 | A9 |
| AC-14 | 14 张商品照片均为仓库内本地文件；每张在台账中有 `license` 与 `source_url`；`verify-evidence.mjs` 通过 | A10 |
| AC-15 | 商品列表呈现 Apple 式版式：最大宽 1280、4/3/2/1 列断点、卡片结构符合 5.7 | A11 |
| AC-16 | 商品卡包含照片、名称、规格、价格、CTA；不再有纯文字卡 | A11 |
| AC-17 | 售罄态与下架态视觉符合 5.7（售罄在列表、下架不出现） | A11 |
| AC-18 | 每张商品图有非空 `alt`；页面无外部字体/远程图片请求 | A12 |
| AC-19 | G1：4 个失效引用全部有真实目标，`check-links.mjs` 通过 | G1 |
| AC-20 | G2：`evidence/manifest.json` 与校验脚本存在，重算哈希一致 | G2 |
| AC-21 | G3：`docs/contracts.md` + `docs/branch-matrix.md` 存在，`contracts.test.mjs` 通过 | G3 |
| AC-22 | G4：查单格式错误时输入框有 `aria-invalid="true"`，错误文案被 `aria-describedby` 关联 | G4 |
| AC-23 | G5：`check-numbering.mjs` 通过，无悬空编号引用 | G5 |
| AC-24 | G6：`evidence/test-count.txt` 为唯一计数，文档无冲突数字 | G6 |
| AC-25 | G7：合并证据文件存在，`main` 包含 release 分支 | G7 |
| AC-26 | 所有 SQL 使用参数化（`prepare` + 绑定），无字符串拼接 SQL；静态扫描断言 | 安全 |
| AC-27 | 水平越权与垂直越权各有测试并返回 403 | 安全 |
| AC-28 | 数据库内无明文口令；口令哈希带盐；日志与 CLI 输出不含口令 | 安全 |
| AC-29 | 会话令牌不可预测（32 字节随机）；退出登录后旧令牌失效 | 安全 |
| AC-30 | 仓库中无密钥/口令明文（种子口令只出现在 README 演示口令表，且标注非生产） | 安全 |
| AC-31 | R1 的 8 条交互契约全部成立（5.6 逐条验证）；**访客查单按 U2=A 移除**：查单需登录、只能查自己的订单，breaking 变更写入 README/CHANGELOG | 兼容 |
| AC-32 | `tests/domain.test.mjs` 原样通过（领域层未被破坏） | 兼容 |
| AC-33 | `docs/decision-log.md` 存在且为追加式，覆盖本规格 D-01～D-32 与后续各环决策 | 文档 |
| AC-34 | 每个环节有 `evidence/ring-*.md`，含真实命令、原始输出、门禁行为、决策记录、环境坑 | 文档 |
| AC-35 | `README.md` 更新为 R2 运行说明（4174、建库、种子、演示口令、测试命令） | 文档 |
| AC-36 | `docs/error-catalog.md` 覆盖新增 API 错误码，逐码给 surface/文案/补救 | 文档 |
| AC-37 | 页面加载无失败请求；`GET /api/products` 返回 14 条且下架项不出现 | 功能 |
| AC-38 | 10 种 R1 商品的 `id/name/unit/price` 与 R1 一致（迁入数据库不丢数据） | 功能 |
| AC-39 | 下单事务原子性：库存不足时订单与明细均不落库；并发两次下单只有一次成功、库存不为负 | 正确性 |
| AC-40 | 请求体超过 64 KiB 返回 413 `payload-too-large`；非法 JSON 返回 400 `invalid-json` | 安全 |
| AC-41 | **端到端用户旅程**：新用户注册→登录→浏览 14 商品→加购→下单→「我的订单」看到该单，全程不超过 3 分钟（真实 Chromium 记录） | Outcome |
| AC-42 | `evidence/demo-script.md` 存在，可照做的 5 分钟演示脚本（含预期截图位） | Outcome |
| AC-43 | `node cli.mjs dev` 一键启动（自动 init+seed+serve）；`GET /api/health` 返回 200 且含 `version/schemaVersion/dbPath/seeded`；README 有 60 秒快速开始 | DX |
| AC-44 | 同一 `clientOrderId` 并发两次下单只产生一单、库存只扣一次 | 正确性 |
| AC-45 | `GET /api/admin/products` 返回含下架商品的全量列表，admin 可据此重新上架 | 功能 |
| AC-46 | 登出后旧 Cookie 访问 `/api/auth/me` 返回 401（服务端会话行已删除） | 安全 |
| AC-47 | `docs/error-catalog.md` 为唯一真源；`tests/contracts.test.mjs` 断言实现错误码集合与其一致 | 契约 |
| AC-48 | CLI `--json` 输出稳定形状；退出码 0/1/2/3/4 正确；`--help` 与文档命令集合一致 | DX |

**AC-15～AC-18 的验证方式（D-24）**：qa 环用真实 Chromium 在 1440/1068/834/600/390 五个断点截图，逐条对照 5.7 判定；截图存入 `evidence/`。无法自动判定的布局项由人工确认并在证据文件签字，记为 `manual-verified`；**不得**用 fake DOM 断言冒充视觉验收。

## 7. Testing Plan

1. **单元**：领域纯函数（原样）、认证工具、错误映射；
2. **集成**：临时库建表/种子/约束/事务/库存并发/`SQLITE_BUSY` 重试/失败回滚；会话生命周期与令牌哈希；
3. **HTTP**：端口 0 的真实服务器，覆盖全部路由、权限矩阵、失败形状、405/404/500 脱敏、Cookie 属性、413 与非法 JSON；
4. **CLI**：`spawnSync` 子进程，覆盖退出码与输出脱敏；
5. **前端**：最小 fake DOM 覆盖登录态、购物袋、查单聚焦、错误码文案等**交互状态**；视觉与布局由 qa 环真实 Chromium 三视口截图验收（D-24），人工判定项如实记 `manual-verified` 或 `UNVERIFIED`，不用 fake DOM 冒充视觉证据；
6. **机械**：链接、编号、追溯、证据清单、测试计数；
7. **回归**：`tests/domain.test.mjs` 与 R1 静态扫描禁令必须原样通过。

## 8. Rules for the Implementing Agent

1. **`D:\vibecoding\easyvibe\r1-fruitlab` 一行都不能改**；本目录任何改动不得写回 R1；
2. **零第三方依赖**：不新增 `package.json` 依赖、不引入 CDN/远程字体/远程图片；
3. **不伪造证据**：代码、终端输出、测试结果、哈希必须来自真实执行；
4. **门禁不可用就写「不可用」**：不得换模型充数、不得把「未覆盖」写成「通过」；
5. **没发现问题就写「未发现」**：不得为凑数编造缺陷；
6. **机械型缺陷直接修；需要权衡的先问人**；不静默修正已知问题；
7. **文档与代码同一提交**：改了行为就同步 `docs/` 与 `evidence/`；
8. **测试计数只从 `evidence/test-count.txt` 读**，不手写；
9. **义务编号先定义后引用**，任何 `OB-`/`AC-`/`M` 编号必须可解析；
10. **每环结束只核对产物是否就位，不越权审内容**；环间制衡交给下游环节。

## 9. Rollback Plan

- 代码回退：`git reset --hard r1-baseline`（`r1-baseline` 是当前 `main` 的祖先，重置即回到 R1 状态；若已推送远端则改用 `git revert`，不重写公共历史）；
- 数据回退：删除 `data/` 目录，`node cli.mjs db init && node cli.mjs db seed` 重建；
- 视觉回退：`assets/styles.css` 与 `index.html` 可从 `r1-baseline` 取回；
- 契约回退：`docs/contracts.md` 记录旧签名，可对照恢复；
- 发布回退：版本 `2.0.0.0` 失败时 `CHANGELOG.md` 记录并回退到 `1.0.0.0` 标签。

## 10. Effort Estimate

| 环节 | 预估（agent 工时） | 说明 |
|---|---|---|
| spec | 0.5 天 | 本文件 + 门禁 |
| autoplan | 0.5～1 天 | 四阶段串行；跨模型评审 `unavailable` |
| build M1 | 3～5 小时 | `node:sqlite` spike + 建库/迁移 + 认证/会话 + DB/auth 测试 |
| build M2 | 3～5 小时 | 订单事务/幂等 + API 路由 + CLI（dev/init/seed/user/product/orders/db check）+ API/CLI 测试 |
| build M3 | 2～4 小时 | 前端接入：api-client、登录/我的订单/查单、商品列表接入 |
| build M4 | 2～3 小时 | 管理端两面板（订单/商品）与状态 |
| build M5 | 4～6 小时 | Apple 视觉重写 + 14 张图与台账 + 治理/文档/证据 |
| review | 0.5 天 | 结构排雷 + 安全（`/cso` 视可用性） |
| qa | 0.5 天 | 真实 HTTP + Chromium 五断点截图（人工项 `UNVERIFIED`） |
| ship | 0.3 天 | 覆盖率审计 + 文档同步 + 版本 |
| retro | 0.2 天 | Git 量化复盘 |
| **合计** | **约 15～25 agent 工时** | 不含等待审批；里程碑各自可验收、可回退 |

## 11. Files Reference

**保留不动**：`assets/domain.mjs`（10 个纯函数 + `limits`）、`tests/domain.test.mjs`、`PRD-R2.md`。

**改造**：`index.html`、`assets/app.mjs`、`assets/controller.mjs`、`assets/styles.css`、`assets/boot-guard.js`、`serve.mjs`、`tests/controller.test.mjs`、`tests/app.test.mjs`、`tests/server.test.mjs`、`tests/static-scan.test.mjs`、`README.md`、`.gitignore`（加 `data/`）。

**新增**：`server/db.mjs`、`server/auth.mjs`、`server/products.mjs`、`server/orders.mjs`、`server/router.mjs`、`server/errors.mjs`、`cli.mjs`、`assets/api-client.mjs`、`assets/images/products/*.jpg`（14）、`tests/db.test.mjs`、`tests/auth.test.mjs`、`tests/api.test.mjs`、`tests/cli.test.mjs`、`tests/contracts.test.mjs`、`tests/docs.test.mjs`、`scripts/record-test-count.mjs`、`scripts/check-links.mjs`、`scripts/check-numbering.mjs`、`scripts/check-traceability.mjs`、`scripts/verify-evidence.mjs`、`docs/*`（见 5.11）、`evidence/*`。

**退役**：`assets/catalog.mjs`、`assets/order-store.mjs`（职责迁移，契约对照见 5.4）。

## 12. Out of Scope

PRD 第 7 节全部非目标，另加：会话过期/续期与清理、CSRF、登录限流/锁定、HTTPS/`Secure`、记住我、跨设备会话、审计日志、深色模式、国际化、多标签页实时同步、**分页与列表上限**、**R1 历史订单迁移（D-26）**、真实支付/物流/退款/税费/运费/折扣、部署/CI/CD/域名、第三方依赖与远程资源、图片处理后端（裁剪/压缩用静态文件，不做运行时处理）。

## 13. Decisions confirmed（2026-10-18 项目负责人确认，按此执行）

| # | 决策 | 推荐 | 备选 | 影响 |
|---|---|---|---|---|
| D-16 | 订单状态 | **不加状态机**，订单即完成记录 | 加 `status` 五态 | 加状态会扩大测试面与 UI，PRD 未要求 |
| D-17 | 深色模式 | **不做** | 做双主题 | PRD 未要求，验收面翻倍 |
| D-18 | 管理界面 | **单页两面板 + 内联编辑** | 独立管理页 | 独立页需路由，增加零依赖复杂度 |
| D-19 | 测试计数 | **脚本生成唯一文件** | 文档手写计数 | 手写必然再次漂移（G6 根因） |
| D-20 | 照片处理 | **静态 1:1 裁切，CSS `object-fit`** | 运行时缩放 | 运行时处理需图片库（违反零依赖） |

## 14. Related

- `PRD-R2.md` — R2 需求（本规格的输入；FR-7 版式方向经 D-08 变更）
- `R1-八环讲解记录.md`、`R1-义务覆盖率核查.md`、`R1-操作经验教训.md` — R1 证据与教训
- `通用AI_Coding课程与教材/HANDOFF.md` 第六节 — R2 计划与硬约束
- `01_通用AI_Coding课程配套示范应用程序设计规范（全知识点映射与八环埋点蓝本）.md` — 4+1 表契约的精神来源
- `DECISIONS.md` — autoplan 产出：四阶段发现、42 条义务 `OB-*` 的定义处、终门记录

## 15. autoplan 修订并入（v1.1，优先于前文冲突条款）

> 本节为 v1.1 新增。四阶段评审（CEO 6.5 / Design 7.0 / DX 5.7 / Eng 6.5，均 FAIL）接受的问题转为 42 条义务；本节把**会改变规格文字**的部分并入。**与 §1–§14 冲突时以本节为准**；施工依据是本节 + `DECISIONS.md` 的 OB 清单。

| # | 涉及条款 | v1.0 原状 | v1.1 修订 | 依据 |
|---|---|---|---|---|
| 1 | §10 | 4.5–5.5 天 | **15–25 agent 工时**，按 M1–M5 里程碑交付 | OB-CEO-01 |
| 2 | §6 | 40 条机制 AC | 增 **AC-41 用户旅程 / AC-42 demo 脚本 / AC-43 health+TTHW / AC-44 幂等 / AC-45 管理商品接口 / AC-46 登出失效 / AC-47 错误单源 / AC-48 CLI JSON+退出码** | OB-CEO-02 |
| 3 | §5.6、AC-31 | R1 访客查单保留 | **访客查单移除**（U2=A）；拆为「交互契约保留」与「权限行为变更（breaking）」 | OB-CEO-03 |
| 4 | §5.2 | 无健康检查、无管理商品列表 | 增 `GET /api/health`、`GET /api/admin/products`（含下架） | OB-DX-01、OB-ENG-02 |
| 5 | §5.1、§5.2 | 无幂等 | `orders` 增 `client_order_id`；唯一约束 `(user_id, client_order_id)`；重复请求返回原订单。**supersede D-30** | OB-DX-07 |
| 6 | §5.3 | 登出仅清 Cookie | 登出 **`DELETE FROM sessions`**；会话无过期（PRD 边界） | OB-CEO-09 |
| 7 | §5.5 | 三步启动、CLI 0/1/2 | `node cli.mjs dev` 一键启动；`db reset --yes` + 自动备份 + 持锁检测；`--password-stdin`；`product list/unlist/relist` 拆分；`orders show`、`db check`；全局 `--json`；退出码 0/1/2/3/4 | OB-DX-01..06、OB-CEO-13 |
| 8 | §5.2、§5.9 | 错误形态可能混用 | API 用 `{ok:false}`；静态层用 `problem+json`；`docs/error-catalog.md` 唯一真源，测试断言集合一致 | OB-DX-11 |
| 9 | §5.3 | 「校验 Origin」一句 | 精确矩阵：`Host ∈ {127.0.0.1:4174, localhost:4174}`；`Origin` 存在须精确同源；`Sec-Fetch-Site ∈ {same-origin, none}`；缺失头放行非浏览器客户端并记录风险 | OB-ENG-04 |
| 10 | §5.1 | `busy_timeout=5000` + 同步重试 | **单写者队列** + `busy_timeout` 250–500ms + 异步退避；文档化单进程假设 | OB-ENG-01 |
| 11 | §5.8 | Openverse 单点 | fallback：Openverse → Wikimedia Commons → 停止并上报；禁止 AI 图/插画冒充 | OB-CEO-05 |
| 12 | §5.11 | 5 个独立脚本 | 增 `scripts/verify.mjs` 单一验证入口，串联测试与全部机械检查 | OB-CEO-06 |
| 13 | §5.2 | 校验规则不全 | 单笔 `maxItems=10`；重复 `productId` 合并数量；非 JSON/缺失 Content-Type → 415；username 3–32、password 8–128 | OB-ENG-03、OB-CEO-10 |
| 14 | §5.2 | 列表无上限 | 列表默认上限 100 | OB-ENG-08 |
| 15 | §5.6 | 购物车未说明 | **仅内存、刷新清空**（与 R1 一致） | OB-ENG-09 |
| 16 | §5.9 | CSP 双写 | CSP 以 **HTTP 响应头为唯一来源**（`index.html` meta 仅兼容） | OB-ENG-06 |
| 17 | §5.7、§6 | 状态与视觉证据不足 | 商品卡六态；无障碍补 skip/键盘/焦点/错误汇总；视觉证据固定路径 + commit + 复核人 | OB-DES-02..06、OB-CEO-12/14 |
| 18 | §3 | D-01～D-32 | 增 **D-33～D-42**（见 `docs/decision-log.md`） | autoplan |
| 19 | §4 | — | 5 项 TODOS：取消/回补、审计、会话过期、分页、scrypt 升级 | `DECISIONS.md` |
| 20 | §13 | U1/U2 待定 | **U1=A（全量 + 里程碑）、U2=A（移除访客查单）**，2026-10-18 项目负责人确认 | 终门 |
