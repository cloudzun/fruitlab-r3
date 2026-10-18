
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
| 21 | ENG-07 测试基础设施 | 每用例建库 + 默认并发 | 测试池 `max=2`；`node --test --test-concurrency=4`；启动清理残留 `fruitlab_test_*`；总时长预算 120s；`scripts/pgctl.mjs up\|status\|down`（readiness 轮询） | OB-R3-ENG-07、OB-R3-DX-05 |
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
| AC-118 | 测试基础设施：`pgctl.mjs up/status/down` 可复现；测试池 `max=2`；`--test-concurrency=4`；残留库清理；总时长 ≤120s | OB-R3-ENG-07、OB-R3-DX-05 |

### 16.3 被拒绝/降级的建议（留痕）

| 建议 | 来源 | 处置 | 理由 |
|---|---|---|---|
| 砍 CSRF（降级为严格 Origin） | CEO-05 | **拒绝** | PRD A12 明确要求 CSRF 在 R3 实现；不能为课时砍掉已定验收 |
| 砍 simple 两容器对照 | CEO-05 | **拒绝** | PRD §4.3 明确要求保留两容器简化模式作对照；实现成本低（一个 compose 文件） |
| 砍 N+1 硬门禁 | CEO-05 | **拒绝** | 是 R2 AC 的延续，且实现成本低（批量查询已在 R2 验证） |
| `compose.debug.yml` 必做 | — | **降级为可选** | 仅调试用，不影响 A3/A5/A10；有则记录，无则 README 说明 |
| 迁移脚本 checksum 只记不校验历史 | ENG-11 部分 | **部分采纳** | 记录 checksum；对已发布迁移的改动检测写入 verify，不阻塞启动 |
