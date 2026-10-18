# R2 决策台账（追加式）

> **规则**：本文件只追加、不重写。每条决策记录日期、编号、决策、备选项、理由、影响面、状态。
> 状态：`accepted`（项目负责人已确认）/ `recommended`（本规格推荐执行，若反对请提出）/ `superseded`（被后续决策取代）。
> 与 `DECISIONS.md` 的关系：本文件是**跨环节**的决策流水账；`DECISIONS.md` 是 autoplan 环的正式评审记录。

## 2026-10-18 · spec 环节

| 编号 | 决策 | 备选项 | 理由 | 影响面 | 状态 |
|---|---|---|---|---|---|
| D-01 | 持久化用 SQLite 单文件（`node:sqlite` 的 `DatabaseSync`） | JSON/NDJSON 文件存储 | 项目负责人要求「一个数据库实例」；零第三方依赖；本机实测 `node:sqlite` 无需标志位可用、文件库重开可读回 | 数据模型、CLI、测试、备份 | recommended |
| D-02 | 4+1 张表：`users`/`products`/`orders`/`order_items` + `sessions` | 单表 JSON 快照 | 对齐 `01_` 蓝本 4+1 精神；关系约束可被测试验证 | DB 层、API | recommended |
| D-03 | 服务端会话表 + `HttpOnly` Cookie（`SameSite=Lax`，无 `Secure`） | 前端 JWT、内存会话 | PRD 已定方案 A；服务端可即时失效；无 HTTPS 故不加 `Secure` | 认证、API 中间件 | recommended |
| D-04 | 口令用 `scrypt` + 随机盐 + `timingSafeEqual` | 明文（禁止）、PBKDF2 | 零依赖、内置；满足「不得明文」 | 认证、种子数据 | recommended |
| D-05 | R2 默认端口 **4174** | 4173（最初口误）、随机端口 | 与 R1 的 4173 并存；项目负责人 2026-10-18 更正为 4174 | 启动参数、README、测试 | accepted |
| D-06 | 开放注册，默认 `user`；`admin` 仅种子/CLI 创建 | 仅管理员建号 | PRD FR-2 明确「支持注册」 | 认证、UI | recommended |
| D-07 | 下单原子扣减库存；零库存售罄；下架隐藏 | 库存仅手工维护 | 否则「库存」与「售罄」语义不成立 | 下单事务、UI 售罄态 | recommended |
| D-08 | 视觉改为**苹果官网式高冷克制风**（变更 PRD FR-7 的亚马逊方向） | 亚马逊密集网格 | 项目负责人 2026-10-18 课堂观感要求；属方向变更，需在 SPEC/`DECISIONS.md` 双处留痕 | 前端结构、CSS、A11 口径 | accepted |
| D-09 | 商品照片用 **Openverse API**（CC0/CC BY）14 张，本地落盘 | Pexels/Unsplash/Pixabay 直连；Wikimedia Commons | 直连被 401/403 拦截；Openverse 返回授权元数据且回源可下载（实测 119 KB JPEG） | 资产、授权台账、页脚署名 | accepted |
| D-10 | `readOrders`/`appendOrder` 保留函数名、首参 `storage→db`，领域纯函数不动 | 全部重写存储层 | 保留 R1 接缝，证明分层有效；契约变更进对照表 | 服务端存储、测试 | recommended |
| D-11 | 义务编号 `OB-<阶段>-<序号>`，`BUILD.md` 同时引用 `AC` 与 `OB` | 沿用 R1 的 F/DF/DX/E | R1 编号不可复用，避免歧义；机械可核对 | 追溯表、各环报告 | recommended |
| D-12 | 降级分三档（不可降级/外部依赖可降级/可替代形态），降级三处留痕 | 不设降级 | 项目负责人授权酌情定；防止文档类义务再次掉队 | 验收口径 | accepted |
| D-13 | 文档落 `docs/`（决策台账、契约、API、错误目录、分支矩阵、词元、授权）+ `evidence/`（逐环证据、清单、唯一计数） | 只写 SUMMARY | 项目负责人要求「文档记录便于复盘」；复盘需要可核对形态而非叙述 | 全流程 | accepted |
| D-14 | 基线标签 `r1-baseline` 打在 `c1167e0` | 不打卡点 | 让「改了哪些」永远可 diff；支撑课堂对比与回退 | Git、回退 | accepted |
| D-15 | SPEC 覆盖写入 `SPEC.md`，R1 版本靠标签与 `r1-fruitlab` 保留 | 另写 `SPEC-R2.md` | 保持「每环一个产物文件」的约定；历史不丢 | 文档结构 | recommended |
| D-16 | 不引入订单状态机，订单即完成记录 | 加五态状态机 | PRD 未要求；避免范围膨胀 | 数据模型、UI、测试 | recommended |
| D-17 | 深色模式不做 | 双主题 | PRD 未要求；减少验收面 | 视觉、测试 | recommended |
| D-18 | 管理界面单页两面板（订单/商品）+ 内联编辑 | 独立管理页 | 零依赖、无路由 | 前端结构 | recommended |
| D-19 | 测试计数由 `scripts/record-test-count.mjs` 生成唯一文件 | 文档手写计数 | G6 根因就是手写漂移 | 文档、验收 | recommended |
| D-20 | 照片静态 1:1 裁切 + CSS `object-fit` | 运行时缩放 | 运行时图片处理需第三方库，违反零依赖 | 资产、CSS | recommended |

## 2026-10-18 · 评审后补强（spec 环 · Phase 4.5 阶段）

同族二次审阅给出 6.5/10（未过 7 分线），提出的问题成立，追加以下决策：

| 编号 | 决策 | 备选项 | 理由 | 影响面 | 状态 |
|---|---|---|---|---|---|
| D-21 | 会话令牌库中存 `sha256(token)` | 明文存令牌 | 降低库泄露风险，成本极低 | 认证、测试 | accepted |
| D-22 | 下单主单/明细/扣库存同一事务 + 有界重试与回滚 | 分步写入 | 防「订单已建、库存未扣」；并发正确性 | DB 层、测试 | accepted |
| D-23 | API 请求体 ≤ 64 KiB，超限 413 | 不限制 | 防内存放大 | 路由、测试 | accepted |
| D-24 | 视觉验收用真实 Chromium 三视口截图 + 人工确认 | 只用 fake DOM | fake DOM 证明不了布局与视觉 | qa 环、AC-15～18 | accepted |
| D-25 | `PRAGMA user_version` + 迁移函数 | 无版本位 | 实验 API 也要有迁移路径 | DB 层、CLI | accepted |
| D-26 | 不迁移 R1 `localStorage` 历史订单 | 做数据迁移 | PRD 未要求；不假装「平滑迁移」 | README、范围 | accepted |

## 2026-10-18 · 第二轮补强（spec 环 · 同族二次审阅后）

第二轮同族审阅仍 6.5/10，其中 5 条真缺口已修，2 条撞 PRD 边界按边界保留。追加：

| 编号 | 决策 | 备选项 | 理由 | 影响面 | 状态 |
|---|---|---|---|---|---|
| D-27 | 状态变更请求校验 `Origin`/`Sec-Fetch-Site` 同源 | 完全不校验 | 部分缓解，成本低；**不构成 CSRF 防护**，不写成「已做 CSRF」 | API 中间件 | accepted |
| D-28 | CLI 增加 `--db` 与 `FRUITLAB_DB`，与 serve 共用 | CLI 固定默认库 | 测试需临时库；避免与运行库互踩 | CLI、测试 | accepted |
| D-29 | 商品/订单确定性排序 + 事务内合计断言 | 依赖插入顺序 | 防列表顺序漂移、防主单与明细合计不一致 | DB 层、测试 | accepted |
| D-30 | **不做幂等键**；`save-unknown` 后不自动重试，引导「我的订单」核对 | 加 idempotency 表 | PRD 未要求；延续 R1 DX1「未知写入人工核对」，避免重复下单 | 前端、API | accepted |
| D-31 | 启动自检 Node/sqlite；接受 `DatabaseSync` 同步阻塞（单进程演示） | 异步驱动 | 零依赖现实；风险显式记录 | 服务端 | accepted |
| D-32 | 他人订单返回 `403`（不改为 404），接受「订单号存在性泄露」 | 统一 404 | 课堂需要可演示的水平越权拒绝；泄露代价显式记录 | 权限、文档 | accepted |

## 2026-10-18 · 确认记录

- 项目负责人确认 SPEC v1.0 草稿（含 D-01～D-26 与 §13 开放项），授权进入后续环节。
- 自本条起，上表中 `recommended` 条目视为 `accepted`；历史行不修改（本文件追加式）。
- 后续若推翻上述任何决策，**追加新条目**并注明 `superseded`，不删不改旧行。

## 2026-10-18 · autoplan 阶段（第 2/7 环）

四阶段（CEO / Design / DX / Eng）全部 FAIL，接受项转为义务 `OB-*`。本阶段新增/推翻：

| 编号 | 决策 | 备选项 | 理由 | 影响面 | 状态 |
|---|---|---|---|---|---|
| D-33 | 下单幂等：客户端 `clientOrderId` + `(user_id, client_order_id)` 唯一约束，重复请求返回原订单 | 无幂等（原 D-30） | 防双击/重放/未知结果重试导致重复下单；**supersede D-30** | API、DB、测试 | accepted |
| D-34 | 新增 `GET /api/admin/products`（含下架商品） | 仅公开列表 | 下架后管理端无法再操作，AC-04/05/06 无法闭环 | API、管理 UI | accepted |
| D-35 | 登出 `DELETE` 服务端会话行；**不做**会话过期（PRD 边界） | 加 `expires_at` | FR-2 明确「无会话过期」；登出撤销是必要下限 | 认证、测试 | accepted |
| D-36 | 工时重估 15–25 agent 工时；按 M1–M5 里程碑交付 | 4.5–5.5 小时 | 原估算与交付面严重不符（CEO F-01/F-02） | 计划、验收 | accepted |
| D-37 | 错误目录唯一真源：API 用 `{ok:false}`，静态层用 `problem+json`，测试断言集合一致 | 两套并行 | 避免三处各写一套 | API、文档、测试 | accepted |
| D-38 | CLI 加 `--json`、5 档退出码（0/1/2/3/4）、`--password-stdin` | 仅人类可读、0/1/2 | agent/脚本必须能稳定消费 | CLI | accepted |
| D-39 | `node cli.mjs dev` 一键启动 + `GET /api/health` | 三步手工 | TTHW 与可观测性 | CLI、API、README | accepted |
| D-40 | 单写者队列 + `busy_timeout` 250–500ms + 异步退避 | 5s + 同步重试 | 防止同步 DB 阻塞整个 HTTP 服务 | DB、服务 | accepted |
| D-41 | 图片 fallback：Openverse → Wikimedia Commons → 停止并上报；禁止 AI 图冒充 | 无 fallback | 单点依赖会阻塞发布 | 资产、验收 | accepted |
| D-42 | 治理脚本合并为 `scripts/verify.mjs` 单一入口 | 5 个独立入口 | 降低自证成本、便于复现 | 证据、脚本 | accepted |

**待项目负责人裁量（autoplan 终门）**：U1 范围与工时（全量 + 里程碑 vs 拆 R2a/R2b）；U2 R1 访客查单移除（breaking）。

## 2026-10-18 · review 环 ASK 确认

项目负责人确认 review 环 7 项 ASK 均按推荐保留：①会话过期/续期不做（PRD FR-2）；②CSRF Token 不做（PRD）；③登录限流/锁定不做（PRD）；④他人订单 403 保留（D-32）；⑤管理审计进 TODOS；⑥分页进 TODOS；⑦图片尺寸降级如实记录。以上状态：accepted。
## 2026-10-18 · qa 环记录

| 编号 | 决策 | 说明 | 状态 |
|---|---|---|---|
| D-44 | 图片授权策略扩展为 CC0 / CC BY / CC BY-SA / Public Domain | 真实图库可用性所迫；逐张在 docs/assets-credits.md 记录作者与授权，CC BY/BY-SA 署名；作为对 SPEC §5.8「仅 CC0/BY」的**降级**记录 | accepted |
| D-45 | 页面标题由 R1「果子摊」改为「FruitLab · 按份买水果」 | 视觉方向变更后的文案一致性 | accepted |
## 2026-10-18 · QA-01 修复

| 编号 | 决策 | 说明 | 状态 |
|---|---|---|---|
| D-46 | ≤720px 导航折行，替代横向滚动 | 横向滚动虽符合 SPEC §5.7，但初始看不到购物袋；折行后全部入口可见，实测 scrollWidth==clientWidth。 | accepted |

## 2026-10-18 · R3 spec 环节（第 1/7 环）

> 用户已授权执行代理自行完成 R3 的全部选型与环审批。以下决策由 SPEC.md §3 落定，本表为追加式留痕。
> 编号续 R2（D-46 之后）；不修改 R2 的历史行。
> 对 R2 决策的推翻以 `superseded` 标注（D-30 已被 D-33 取代，D-32 由 D-57 取代）。

| 编号 | 决策 | 备选项 | 理由 | 影响面 | 状态 |
|---|---|---|---|---|---|
| D-47 | PostgreSQL 16（`postgres:16-alpine`）+ `pg.Pool` + `DATABASE_URL` | 保持 `node:sqlite`；MySQL | PRD 已定；WSL 端口实证可达；连接池/事务/SQLSTATE 是分层与部署前提 | DB、API、CLI、测试、容器 | accepted |
| D-48 | 运行时依赖恰好 `{pg}`（`8.23.1`），提交 lockfile | 继续零依赖；ORM（Prisma/Drizzle） | PRD 已定；ORM 会引入大量依赖与黑盒；`pg` 足够 | package/CI/文档 | accepted |
| D-49 | 不迁移 R2 SQLite 数据；空库 + 迁移 + seed | 写迁移脚本搬数据 | PRD 已定；演示数据可重建，迁移会制造"假平滑" | DB、README | accepted |
| D-50 | 用户名 `text UNIQUE` 大小写敏感，不引入 `citext` | `citext`；lower 索引 | 保持 R2 行为；避免扩展安装依赖 | schema、登录 | accepted |
| D-51 | L1 分层 router→services→repositories，依赖规则由测试断言 | 保持 R2 单体模块 | PRD 目标 2；依赖规则可机械核对 | 服务端结构、测试 | accepted |
| D-52 | 默认 L2 三容器（web/api/db），另留 simple 两容器对照 | 只做两容器；只做 Dockerfile | PRD §4.3；三容器是"物理三层"的课堂证据 | compose、验收 | accepted |
| D-53 | 会话 `expires_at` + TTL 86400s + Max-Age + 登录轮换 + 清理 | 永不失效（R2） | 关闭 cso S-3；可部署形态的最低要求 | auth/schema/API | accepted |
| D-54 | 登录限流：内存计数，username+IP，5 次/15 分钟 → 锁 15 分钟，429 | DB 计数；无（R2） | 关闭 cso S-2；单实例下最简且可测 | auth/API/文档 | accepted |
| D-55 | CSRF 双提交 Cookie + `X-CSRF-Token`，叠加 Origin 校验 | 仅 Origin；完整同步 Token 表 | 关闭"无 CSRF"；双提交无需服务端存储，边界清晰 | auth/API/前端 | accepted |
| D-56 | 缺失用户执行 dummy scrypt，两条路径各一次 verify | 仅延迟；不处理 | 关闭 cso S-1；只声称"降低到不可测量" | auth/测试 | accepted |
| D-57 | 他人订单 404（**supersede D-32**） | 保留 403 | R3 面向可部署形态，消除订单号存在性泄露；课堂演示改为"资源不存在" | API/前端/文档/测试 | accepted |
| D-58 | 实现冻结优先级：Host→Origin→体协议→405→401→CSRF→角色→404→400→409→5xx | 认证优先（R2 实现） | 关闭 codex C-4；契约优先，体上限 64 KiB 使风险有界 | router/测试/文档 | accepted |
| D-59 | `db reset` 先 SQL 导出备份，失败即中止；事务重建 + 校验 | 文件复制（R2，已证假成功） | 关闭 codex C-1（High） | CLI/测试 | accepted |
| D-60 | 测试跑真实 PG；每用例独立数据库；连不上 fail fast | SQLite 临时库；共享 schema | PRD 目标 4；隔离最彻底 | 测试基础设施 | accepted |
| D-61 | 白名单抽 `server/allowlist.mjs`；web 用 `build-public.mjs` 生成 `public/` | 各写一份；直接挂载仓库 | 防白名单漂移；web 不暴露服务端代码 | 静态层/容器 | accepted |
| D-62 | `/api/health` 含 `db:"up|down"`，down 时 503 | 仅进程存活 | 供 compose healthcheck 与 A3/A5 | API/compose | accepted |
| D-63 | 编号：AC-49 起、D-47 起、`OB-R3-<PHASE>-NN`、`F-R3-NN` | 重新从 01 编号 | 避免与 R2 冻结编号歧义 | 全流程文档 | accepted |
| D-64 | static-scan 改为"运行时依赖恰好 `{pg}`" | 保留"无 package.json" | 与 D-48 一致，机械可查 | 测试/文档 | accepted |
| D-65 | 命名隔离：项目/镜像/卷/端口按 PRD §2.2 | 复用 R2 名称 | 三版本并排不碰撞 | compose/验收 | accepted |
| D-66 | `cli db backup` = SQL 导出；`scripts/backup.sh` = `pg_dump` | 只做一种 | 跨平台可测 vs 生产标准工具，双轨且互不冒充 | CLI/容器/文档 | accepted |
| D-67 | `APP_ENV=production` 强制 `DEMO_PASSWORD`/`POSTGRES_PASSWORD` | 保留默认口令 | 关闭"默认口令上公网"风险 | 配置/seed/compose | accepted |
| D-68 | Cookie `Max-Age` + `COOKIE_SECURE` 开关 | 恒无 Secure | 本地无 TLS，公网必须开 | auth/部署 | accepted |
| D-69 | review 用 codex 子代理；cso 用官方 launcher 真跑；跨模型记 unavailable | 自审；跳过 cso | 用户明确要求；同族不冒充跨模型 | review 环/证据 | accepted |
| D-70 | `start-all.mjs` 用 R2 内存库启动，停 R3 用 compose down | 直接跑 R2 默认库 | 不写 R2 目录，满足隔离 | 课堂脚本 | accepted |
| D-71 | 反代场景下客户端 IP 取 `X-Forwarded-For` 最左段，仅在 `TRUST_PROXY=1` 时启用 | 永远取 socket 地址；永远信任 XFF | L2 下 api 看到的是 Caddy 容器 IP，限流键会失真；只信任已知反代、直连时关闭 | auth/限流/compose | accepted |
| D-72 | 版本口径分离：`VERSION` 保持 `3.0.0.0`，`package.json` 用合法 SemVer `3.0.0` | 包版本也写 4 段；改 VERSION 为 3 段 | npm 包版本必须是合法 SemVer，4 段会破坏 `npm ci`/元数据；课程口径仍要 4 段 | 版本、AC-55、Docker build | accepted |
| D-73 | 生产模式加固：`ADMIN_PASSWORD` 独立（≥12、非默认）、`COOKIE_SECURE=1`、不 seed `userA/userB` | 只要求 `DEMO_PASSWORD` 非空 | codex F-06：仅"存在"不能阻止 `demo1234` 进生产；演示用户不应公开 | 配置/seed/compose/AC-82 | accepted |
| D-74 | 下单事务先插 orders 预留幂等键，再扣库存；`23505` 先 ROLLBACK 再回查/重试 | 沿用 R2「先扣库存再插单、catch 后查」 | PostgreSQL 中 23505 会使事务 aborted，继续查询得 25P02；顺序错误会重复扣库存（F-01） | orders/db/测试/AC-64/97 | accepted |
| D-75 | 组合根 `server/app.mjs`（建池→迁移→seed→构造 services）+ `createXxxService(deps)` 工厂 | router 直接建 service；service 内 import pool | 依赖注入才能同时满足"可注入"与"签名冻结"（F-02） | 分层/契约/测试 | accepted |
| D-76 | 连接池加 `connectionTimeoutMillis`/`idleTimeoutMillis`/`pool.on("error")`，故障映射 `db-unavailable` | 只用 `max` + `statement_timeout` | pg.Pool 默认无限等连接，health/API 会挂起而非 503（F-07） | db/health/容器 | accepted |
| D-77 | `PUBLIC_URL` 派生 Host 白名单 + 容器内 `HOST=0.0.0.0` + Caddy 保留 Host | 只允许外部 Host；容器默认 127.0.0.1 | api 容器默认回环会导致 Caddy 不可达、healthcheck 403（F-03） | 配置/compose/AC-99 | accepted |
| D-78 | `POSTGRES_USER`/`POSTGRES_DB`/`POSTGRES_PASSWORD` 同源生成 DSN、`pg_isready`、备份参数 | 硬编码 `fruitlab` 用户/库 | 官方镜像默认 postgres 用户/库，硬编码会 role/database 不存在（F-04） | compose/备份/AC-100 | accepted |
| D-79 | 输入约束继承并加 DB `CHECK`：`clientOrderId` 8–128、maxItems 10、重复 productId 合并、username/password/价格/库存边界 | 只依赖 service 校验 | DB 层空 `client_order_id` 仍合法；边界丢失会造成不一致（F-10） | schema/API/测试/AC-105 | accepted |
| D-80 | BUILD.md 提供 96 项逐测试处置表（保留/等价迁移/预期变更/删除理由），变更仅限已定决策 | 笼统写"语义保留" | 403→404、CSRF、过期、URL 优先级、换库必然改断言，笼统口径不可机械核对（F-09） | BUILD/测试/AC-91 | accepted |
| D-81 | codex 同族复核 10 条 F-01..F-10 全部处置（采纳/部分采纳并改 SPEC v1.1）；跨模型仍 `unavailable` | 只跑同族就宣称门禁通过 | 同族不是跨模型；10 条中 4 High 必须落到 AC | 门禁/SPEC/证据 | accepted |
| D-82 | 修订 D-71：不再取 XFF 最左段；改为 **Caddy 覆盖** `X-Forwarded-For` 为 `{remote_host}`，api 仅在 `TRUST_PROXY=1` 且来源为 compose 内网时信任 | 保留最左段信任 | 最左段可被客户端伪造，限流可绕过（codex F-08） | 限流/反代/测试 | accepted |
