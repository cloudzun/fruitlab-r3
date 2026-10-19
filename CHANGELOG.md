# Changelog

FruitLab 的用户可见变更记录。

## [3.5.0.0] - 2026-10-19

> R3.5：不改业务模型，只做「可部署收口 + 发布流水线」。

### Added

- **学生零配置 demo**：`DEMO_ALLOW_ANY_HOST=1`（仅非 production 生效）+ `deploy/student/start-demo.sh`；Killercoda/ECS/Azure/ngrok 不需要设置 `PUBLIC_URL`。
- **public GitHub 仓库**：<https://github.com/cloudzun/fruitlab-r3>；代码 MIT、文档/证据 CC BY-NC-SA 4.0。
- **CI**：`.github/workflows/ci.yml`，Node 22 + Postgres 16 服务容器，140 项测试 + 机械校验。
- **镜像发布**：`.github/workflows/release.yml`，tag `v3.5.*` 构建并推送 Docker Hub + GHCR，记录 digest。
- **生产部署资产**：`deploy/vps/`（生产 compose、Caddyfile、备份/恢复/部署/回滚脚本、systemd timer）。
- **Azure VM 部署**：Ubuntu 24.04 + Docker + 宿主机 Caddy 自动 HTTPS；GitHub Actions SSH 部署。
- **文档**：`docs/ci-cd.md`、`docs/deploy-azure.md`、`PRD-R3.5.md`。

### Changed

- `VERSION` → `3.5.0.0`；`package.json` → `3.5.0`。
- 生产部署默认只发布 `127.0.0.1:4175`，由宿主机 Caddy 终止 TLS；api/db 不暴露端口。
- 部署前自动 `pg_dump` 备份；健康检查失败自动回滚上一版。

### Fixed

- 修复 `npm ci` 在 GitHub Actions 访问 npmmirror 504 的问题：lockfile 的 `resolved` 改为 `registry.npmjs.org`。
- 生产健康检查带 `Host: <PUBLIC_URL host>`，避免 API Host 白名单 403（首次部署实测）。
- Caddy 去掉 `email`（`example.com` 被 Let's Encrypt 判 invalidContact），证书签发成功。
- GitHub deploy 改为 `ssh-keyscan` 现场取 host key，避免 `VPS_KNOWN_HOSTS` 换行/CR 不匹配。
- 宿主 Caddy 只加 HSTS，避免与 web 容器安全头重复。

### Known Issues（如实记录）

- 单 VM，无高可用；部署窗口内短暂中断。
- Docker Hub token 未轮换（用户决定），仅存 GitHub Secret。
- 未做 PaaS、K8s、多架构镜像、CI 中的 `verify --full`（当前 CI 为 tests + `--quick`）。
- 人工无障碍/对比度/实体手机仍为 `UNVERIFIED`（沿用 R3 结论）。

## [3.0.0.0] - 2026-10-18

> R3：从单机 SQLite 应用升级为 **PostgreSQL 16 + L1 逻辑三层 + L2 三容器 + 可备份恢复** 的可部署形态；关闭 R2 补测的 11 个缺陷；三版本并排。

### Added

- **数据库**：PostgreSQL 16（`pg` 8.23.1），连接池、迁移（advisory lock + checksum）、事务、SQLSTATE 映射、`db reset` 备份保护。
- **分层**：`repositories/` + `services/` + `app.mjs` 组合根；router 只做协议；依赖规则由测试强制。
- **安全**：会话 `expires_at`/轮换、登录限流（账号+IP 两桶）、CSRF 双提交、缺失用户 dummy scrypt、他人订单 404、生产口令校验。
- **部署**：`Dockerfile`/`Dockerfile.web`、`docker-compose.yml`（web/api/db）、Caddy 反代、非 root、healthcheck、volume、`compose.simple.yml`（api+db）。
- **备份/恢复**：`scripts/backup.sh`/`restore.sh`（`pg_dump`/`pg_restore`，停写+单事务+校验）、CLI `db backup/restore`（JSON Lines）、`db reset` 先备份。
- **CLI/运维**：`--url`（替代 `--db`）、`db migrate`（替代 `db init`）、`preflight`、`pgctl`、`verify --quick/--full`、`start-all`。
- **文档/证据**：`docs/architecture.md`、`deploy.md`、`backup-restore.md`、`contracts.md`、`api.md`、`cli.md`、`error-catalog.md`、`obligations.md`；`evidence/container/`、`evidence/cso-r3/`、`evidence/codex/`、`evidence/visual/r3-*`。

### Changed

- 默认端口 `4174` → **`4175`**（compose web）；Postgres 宿主调试端口 `55432`。
- 运行时依赖：零依赖 → **恰好 `{pg}`**（R2 仍为零依赖，口径不混用）。
- `/api/health` 形状：`db`、`schemaVersion`、`uptimeSeconds`；DB down → 503。
- 登录/注册/me 统一 `{id, username, role}`。
- CLI 数据库参数与命令树按 Postgres 重定义。

### Removed（breaking）

- `node:sqlite`/`data/fruitlab.db`（R3 使用 Postgres；R2 原目录不动）。
- `--db <path>`、`db init`、`order-not-owned` 403（改为 404 `order-not-found`，D-32 superseded）。

### Fixed

- R2 补测 11 个缺陷点（C-1..C-7、S-1..S-4）逐条关闭；review 环新修 13 条 codex findings（错误映射、seed 隔离、restore 校验、CSRF bootstrap、限流桶、行锁、health 超时等）。

### Known Issues（如实记录）

- 跨模型复核 `unavailable`（同族 codex；不冒充）；官方 cso 离线 `partial`（scanner profiles/history-inputs 不可用）。
- 读屏器人工审查/对比度仪器测量 `UNVERIFIED`；simple 模式首页 HTML 未验证。
- 限流为单实例内存实现（重启清零）；本地 compose 不做 TLS（生产需外部反代 + `COOKIE_SECURE=1`）。
- 云平台部署为 M5 选修（需账号）；本仓库无 remote。

## [2.0.0.0] - 2026-10-18

> R2：从单机演示升级为带服务端数据库、账号、权限、管理员与命令行的系统；视觉重塑为 Apple 式高冷克制版式；新增义务追溯与机械校验。

### Added

- **持久化**：服务端 SQLite（Node 内置 `node:sqlite`）单文件数据库；商品、订单、用户、会话落库；停服重启后数据仍在。
- **用户与身份**：注册/登录、服务端会话 + `HttpOnly; SameSite=Lax` Cookie、`scrypt` + 随机盐口令哈希、令牌库中只存 `sha256`；预置 `userA` / `userB` / `admin`。
- **权限**：用户只能查自己的订单；管理员可查全部；水平与垂直越权均返回 403 并有测试。
- **管理员**：改价格、改库存、上架/下架；新增 `GET /api/admin/products`（含下架商品）。
- **命令行**：`node cli.mjs dev` 一键启动；`db init/seed/reset/check`、`user`、`product`、`orders`；`--json`、`--password-stdin`、退出码 0/1/2/3/4。
- **商品**：从 10 种扩到 14 种（新增车厘子、贵妃芒、猕猴桃、草莓），14 张本地真实照片 + 授权台账。
- **视觉**：Apple 式高冷克制版式（白底大留白、4/3/2/1 断点、胶囊 CTA、系统字体），废弃 R1 手写果摊招牌。
- **下单改进**：`clientOrderId` 幂等、库存原子扣减、事务回滚；`GET /api/health` 与启动结构化摘要。
- **流程机制**：`OB-B*` 义务台账、`AC×OB` 双向追溯、唯一测试计数、`scripts/verify.mjs` 单一验证入口、证据哈希清单。

### Changed

- 默认端口 `4173` → `4174`（与冻结的 R1 并存）。
- 订单权威来源从浏览器 `localStorage` 改为服务端数据库；`assets/order-store.mjs` 与 `assets/catalog.mjs` 退役。
- `CSP connect-src` 从 `'none'` 改为 `'self'`（前端需调用同源 API）；CSP 以 HTTP 头为唯一来源。
- 页面标题与文案从「果子摊」改为「FruitLab · 按份买水果」。

### Removed（breaking）

- **访客凭订单号查单**：R2 需登录且只能查自己的订单（PRD FR-3）；R1 的历史 `localStorage` 订单**不迁移**。

### Fixed

- 移动端（≤720px）导航改为折行，全部入口（含「购物袋」）可见，关闭 QA-01。
- 订单列表 N+1 查询 → 批量明细查询。
- 幂等唯一冲突竞态不再 500，返回已有订单。
- 非法百分号 Cookie 不再触发 500。
- `/api/health` 不再泄露绝对文件系统路径。
- 重新登录会作废旧会话，避免会话行堆积。

### Known Issues（如实记录）

- 图片授权为 CC0 / CC BY / CC BY-SA / Public Domain（SPEC §5.8 原写仅 CC0/BY），已逐张署名并记录为降级项；12 张短边低于建议的 800px。
- 会话过期、CSRF Token、登录限流按 PRD 边界**未实现**；他人订单返回 403 会泄露订单号存在性（D-32 取舍）。
- 读屏器人工审查、完整键盘 Tab 全流程、对比度仪器测量为 `UNVERIFIED`。
- 本仓库无 Git 远端：推送、PR、远端部署与金丝雀不可用（`requires-remote`）。

## [1.0.0.0] - 2026-10-17

### Added

- 提供无第三方依赖的本地水果商城，包含 10 种固定商品、内存购物车、整数分金额计算、响应式布局、键盘焦点样式和纯本地资源。
- 提供结账、完整收据和刷新后查单；订单以 NDJSON 追加保存在当前浏览器。
- 提供仅监听回环地址的静态服务器，包含公开文件允许列表、安全响应头、`--help`、`--port`、`--version` 和可操作的错误响应。
- 提供覆盖 UI、存储、HTTP 和领域错误的稳定错误目录，写明用户提示、重试策略和恢复路径。

### Fixed

- D2：数量没有实际变化时不再重绘购物车，避免输入框失焦后紧接的“移除”或加减按钮点击被吞掉。
- D3：结账写入失败时按稳定错误码显示存储安全、配额、读取和写入失败的具体恢复提示，不再统一显示通用重试文案。
- Node.js 最低版本在规格、运行时代码和文档中统一为 22+。

### Known Issues

- `GET /evidence/index.md` 当前返回 404，因为证据索引文件不存在；README 和页面中的相关证据入口仍需后续对齐。
- ISSUE-002 仍存在：空输入、格式错误或未知订单会显示正确提示，但结果区域仍保留只有“查询结果”标题的空白面板。
- 人工 Chromium 检查 M1-M16 仍为 `UNVERIFIED`；没有人工测试者，也没有已签署的 `evidence/manual-checks/browser.md` 记录。
- P5 教学价值仍为 `UNVERIFIED`，没有学习者观察记录。
- 多标签页同时结账仍可能因后写覆盖前写而丢失订单；规格已排除多标签页冲突合并。
- 本仓库没有配置 Git 远端，因此本轮无法推送分支、创建 PR 或执行远端部署。
