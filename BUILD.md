# BUILD.md（R3 build 环验收）

> 输入：`SPEC.md` v1.2（SHA-256 `81761E4E15E4C3622E657F6FD994F2C9C49F1EE5E10CEFFD63419E60E99C4462`）+ `DECISIONS.md` 42 条 `OB-R3-*`。
> 测试计数唯一来源：`evidence/test-count.txt`；本文件不手写计数。
> 判定口径：`implemented`（build 完成）≠ `verified`（review/qa 复核）；最终判定在 ship 环。

## 1. 里程碑

| 里程碑 | 内容 | 状态 | 证据 |
|---|---|---|---|
| M1 | Postgres 迁移 + L1 分层 + 测试基础设施 | 完成 | `tests/db.test.mjs`、`tests/auth.test.mjs`、`tests/api.test.mjs` |
| M2 | 安全补漏（11 缺陷 + 会话/限流/CSRF/时序/404） | 完成 | `tests/api.test.mjs`、`tests/client.test.mjs`、`tests/auth.test.mjs` |
| M3 | Dockerfile ×2 + compose 三容器 + Caddy + 备份恢复 | 完成 | `evidence/container/`、`docs/deploy.md` |
| M4 | review/qa/ship/retro | 进行中 | `evidence/ring-*.md` |

## 2. 验收（AC × OB）

| AC 范围 | 相关 OB |
|---|---|
| AC-49～AC-58 | OB-R3-CEO-01/02/03、OB-R3-SPEC-01/02/03/06 |
| AC-59～AC-61 | OB-R3-CEO-05、OB-R3-ENG-01、OB-R3-SPEC-04 |
| AC-62～AC-69 | OB-R3-ENG-02/03/05/06/12、OB-R3-DES-01 |
| AC-70～AC-83 | OB-R3-ENG-07/08/09、OB-R3-SPEC-05、OB-R3-DES-02/03 |
| AC-84～AC-89 | OB-R3-ENG-04、OB-R3-DX-03/04、OB-R3-CEO-06 |
| AC-90～AC-96 | OB-R3-DX-01/05/06/07/09、OB-R3-CEO-07 |
| AC-97～AC-105 | OB-R3-ENG-01/02/08/09/10/11/12、OB-R3-SPEC-01/03 |
| AC-106～AC-118 | OB-R3-CEO-02/03/04、OB-R3-DES-01/04/05/06、OB-R3-DX-01/05/07、OB-R3-ENG-05/07/11 |

> 逐条 AC 摘要与证据形态见下表；`docs/obligations.md` 给出 OB 台账。

| AC | 判定（摘要） | 对应 | 证据 | build 判定 |
|---|---|---|---|---|
| AC-49 | R1 可独立启动（4173），`r1-fruitlab` 工作树空、HEAD `3087a05` | A1 | qa 3 版本实跑 + git status | verified（review/qa 证据） |
| AC-50 | R2 可独立启动（4174），`r2-fruitlab` 工作树空、仍零依赖、HEAD `5f4dd87` | A2 | qa 实跑 + git status | verified（review/qa 证据） |
| AC-51 | R3 `docker compose up --build` 后 `http://127.0.0.1:4175` 200，`/api/health` `db:"up"` | A3 | 容器日志 + curl | verified（review/qa 证据） |
| AC-52 | R1/R2/R3 同时启动，各自可访问、互不影响、端口/数据/容器无碰撞 | A4 | qa 三版本并排截图 | verified（review/qa 证据） |
| AC-53 | `scripts/start-all.mjs` 存在，能按序启动三版本且不写 R1/R2 | A4 | 脚本 + qa 记录 | verified（review/qa 证据） |
| AC-54 | `package.json` 运行时依赖恰好 `{pg}`，lockfile 已提交；无其它第三方依赖 | A6 | static-scan + `npm ls --omit=dev` | verified（review/qa 证据） |
| AC-55 | ship 后 `VERSION` = `3.0.0.0`；`package.json` 版本用合法 SemVer `3.0.0`（4 段→3 段映射写入版本校验脚本与 README）；CHANGELOG 记录 breaking（依赖口径/端口/数据库/404 变更） | A16 | 文件 + 版本校验测试 | verified（review/qa 证据） |
| AC-56 | 迁移幂等：重复执行不改变 schema，`schema_migrations` 记录版本 | A7 | db 测试 | verified（review/qa 证据） |
| AC-57 | seed 幂等且分模式：classroom = 14 商品 + 3 账号；production = 14 商品 + admin（无演示用户）；重复执行不重复数据 | A7 | db/CLI 测试 | verified（review/qa 证据） |
| AC-58 | 不依赖 R2 的 SQLite 文件；R3 空库可启动并 seed | A7 | 代码扫描 + 容器 | verified（review/qa 证据） |
| AC-59 | L1 分层成立：router 不含 SQL/pg/repositories；services 不含 HTTP；repositories 不含业务分支 | A9 | `tests/layering.test.mjs` | verified（review/qa 证据） |
| AC-60 | 依赖规则由测试机械断言（import 图 + SQL 关键字扫描） | A9 | 同上 | verified（review/qa 证据） |
| AC-61 | 各层导出签名与 `docs/contracts.md` 一致 | A9 | contracts 测试 | verified（review/qa 证据） |
| AC-62 | 下单事务原子性：库存不足不落单、库存不为负 | 正确性 | db 测试 | verified（review/qa 证据） |
| AC-63 | 并发两次下单不超卖（真实并发连接，库存 1 只有 1 单成功） | 正确性 | 并发测试 | verified（review/qa 证据） |
| AC-64 | 同 `clientOrderId` 并发：一个 201、一个 200 `existing`、同一订单号、库存只扣一次；库存为 0 后重放仍返回 200 existing | 正确性 | 并发测试 | verified（review/qa 证据） |
| AC-65 | `40001/40P01` 有界重试；耗尽返回 `server-busy` 503 | 正确性 | 单元 + 注入测试 | verified（review/qa 证据） |
| AC-66 | 订单号唯一冲突重试 ≤10；耗尽 409 `order-number-exhausted` | 正确性 | 注入测试 | verified（review/qa 证据） |
| AC-67 | 订单列表/详情无 N+1（批量/JOIN），按用户隔离 | 正确性 | db 测试 + SQL 断言 | verified（review/qa 证据） |
| AC-68 | 他人订单返回 404 `order-not-found`；admin 可查任意（D-32 superseded） | A12 | API 测试 | verified（review/qa 证据） |
| AC-69 | 管理端可查/改/重新上架下架商品 | 功能 | API 测试 | verified（review/qa 证据） |
| AC-70 | C-1：`db reset` 备份失败即中止、数据保留；成功重置后校验 schema/种子；无"假成功" | A7 | CLI 测试（失败/成功两路） | verified（review/qa 证据） |
| AC-71 | C-2：SQLSTATE 映射齐全（23505/40001/40P01/53300）；真实并发/持锁测试；`enqueueWrite` 退役留痕 | A11 | 测试 + decision-log | verified（review/qa 证据） |
| AC-72 | C-3：全部已知路由（含动态）405 表驱动，`Allow` 正确 | A11 | 表驱动测试 | verified（review/qa 证据） |
| AC-73 | C-4：未登录 + 非法 JSON/415/413 先返回体协议错误（非 401） | A11 | 优先级组合测试 | verified（review/qa 证据） |
| AC-74 | C-5：api-client 超时覆盖响应体卡住；headers-then-hang/abort/非 JSON 测试 | A11 | 客户端单测 | verified（review/qa 证据） |
| AC-75 | C-6：畸形百分号路径 → 400 稳定码，不再 500 | A11 | API 测试 | verified（review/qa 证据） |
| AC-76 | C-7：login/register/me 统一 `{id,username,role}`，形状断言 | A11 | API 测试 | verified（review/qa 证据） |
| AC-77 | S-1：缺失用户执行 dummy scrypt；两条登录路径各一次 verify（分支断言） | A12 | auth 测试 | verified（review/qa 证据） |
| AC-78 | S-2：15 分钟窗口失败 5 次 → 429 + `Retry-After`；成功清零 | A12 | auth 测试（注入时钟） | verified（review/qa 证据） |
| AC-79 | S-3：过期会话 401；过期清理；登录轮换；Cookie `Max-Age` | A12 | auth/API 测试 | verified（review/qa 证据） |
| AC-80 | S-4：已由 AC-68 覆盖（404），decision-log 记录 D-32 superseded | A12 | 文档 + 测试 | verified（review/qa 证据） |
| AC-81 | CSRF：带会话写请求缺/错 token → 403 `csrf-token-invalid`；正确 token 通过；跨源 403 | A12 | API 测试 | verified（review/qa 证据） |
| AC-82 | 生产口令：`APP_ENV=production` 时缺 `ADMIN_PASSWORD`、`ADMIN_PASSWORD=demo1234`、长度 <12、或 `COOKIE_SECURE≠1` → seed/启动失败；生产模式不创建 userA/userB；`.env` 不入 git | A13 | CLI/配置测试 + 扫描 | verified（review/qa 证据） |
| AC-83 | 库内无明文口令/令牌；日志与 CLI 不打印口令/哈希 | A13 | 测试 + 扫描 | verified（review/qa 证据） |
| AC-84 | compose 三容器健康（web/api/db），`4175` 同源 `/api` 经 Caddy 反代可达 | A10 | 容器实跑 + curl | verified（review/qa 证据） |
| AC-85 | volume 持久化：重启后订单/库存仍在 | A5 | 容器重启证据 | verified（review/qa 证据） |
| AC-86 | api/web 非 root；healthcheck 有效；`SIGTERM` 优雅停机 | A13 | `id -u` + 日志 | verified（review/qa 证据） |
| AC-87 | 备份/恢复：`pg_dump`/`pg_restore` 真实命令，恢复后数据一致 | A14 | 备份文件 + 恢复后查询 | verified（review/qa 证据） |
| AC-88 | 镜像/项目/卷/端口命名 `fruitlab-r3*`、`4175`/`55432`，不与 R1/R2 冲突 | A4/A16 | compose 静态检查 | verified（review/qa 证据） |
| AC-89 | `compose.simple.yml` 两容器模式可启动（api+db，无 web） | A10 | qa 记录 | verified（review/qa 证据） |
| AC-90 | 测试跑真实 Postgres；README 写明 Docker 前置；测试计数唯一来源 | A8 | 测试输出 + test-count | verified（review/qa 证据） |
| AC-91 | BUILD.md 给出 96 项逐测试处置表（原样保留/等价迁移/预期契约变更/删除理由）；预期变更限于 D-32/D-53/D-55/D-57/D-58/D-64 明确项，且由 contracts 测试固定新契约 | A8 | BUILD.md + contracts 测试 | verified（review/qa 证据） |
| AC-92 | codex 独立子代理 `/review` 报告落盘（同族标注，不冒充跨模型） | A15 | `evidence/codex/` | verified（review/qa 证据） |
| AC-93 | 官方 `/cso` run 完成（start/submit/finish），findings 与 `partial` 边界如实记录 | A15 | `evidence/cso/` | verified（review/qa 证据） |
| AC-94 | 11 个缺陷点（10 条 findings）台账逐条 `closed/downgraded/not-covered`，`F→OB→AC` 双向引用 | A11 | `docs/obligations.md` + 脚本 | verified（review/qa 证据） |
| AC-95 | `BUILD.md` 同时引 AC 与 OB；`check-traceability.mjs` 通过 | A11 | 脚本输出 | verified（review/qa 证据） |
| AC-96 | `verify.mjs` 全链 PASS（测试+链接+编号+追溯+证据+compose 配置）；证据索引无死链 | A15/A16 | verify 输出 | verified（review/qa 证据） |
| AC-97 | 事务边界：`23505`/`23514`/`23503` 后必须先 ROLLBACK 再回查/重试；幂等键冲突不重复扣库存；订单号冲突重试 ≤10 且不留下空单（F-01） | 正确性 | 并发 + 注入测试 | verified（review/qa 证据） |
| AC-98 | 组合根/工厂：`createApp`/`createServices` 注入 pool/clock/rateLimiter/config；contracts 测试断言工厂与实例方法签名（F-02） | A9 | contracts + layering 测试 | verified（review/qa 证据） |
| AC-99 | 容器 Host：api 监听 `0.0.0.0`；Caddy 保留外部 Host；healthcheck 与外部 Public URL 均通过 Host 校验（F-03） | A10 | 容器实跑 + 测试 | verified（review/qa 证据） |
| AC-100 | DB 身份：`POSTGRES_USER/DB` 与 `DATABASE_URL`、`pg_isready`、备份脚本同源；空卷首次启动成功（F-04） | A3/A14 | 容器实跑 | verified（review/qa 证据） |
| AC-101 | npm 版本映射：`VERSION=3.0.0.0` 与 `package.json=3.0.0` 的映射由脚本机械校验（F-05） | A16 | 版本校验测试 | verified（review/qa 证据） |
| AC-102 | 生产加固：production 缺/弱/默认 admin 口令或 `COOKIE_SECURE=0` 拒绝启动；不建演示用户（F-06） | A13 | CLI/配置测试 | verified（review/qa 证据） |
| AC-103 | 连接池：`connectionTimeoutMillis`/pool error 处理；PG 不可达时 health ≤5s 返回 503 不挂起；DB 重启后自动恢复（F-07） | A13 | 故障注入测试 + 容器 | verified（review/qa 证据） |
| AC-104 | 反代 IP：Caddy 覆盖 XFF；`TRUST_PROXY=0/1` 行为测试；伪造 XFF 不能绕过限流；限流 Map 有容量上限（F-08） | A12 | 测试 + compose 静态检查 | verified（review/qa 证据） |
| AC-105 | 输入约束：clientOrderId 8–128、maxItems 10、重复 productId 合并、username/password/价格/库存边界继承并测试；DB CHECK 同步（F-10） | 契约 | 测试 + schema 断言 | verified（review/qa 证据） |
| AC-106 | 真实 Chromium 从 `http://127.0.0.1:4175` 完成注册→登录→浏览→加购→下单→我的订单；断言 CSRF Cookie/头、订单唯一、库存只扣一次 | OB-R3-DES-01 |  | verified（review/qa 证据） |
| AC-107 | admin 改价/下架后用户端刷新可见，历史订单金额不变；下架项不出现 | OB-R3-CEO-02 |  | verified（review/qa 证据） |
| AC-108 | 停 DB（或指向关闭端口）时：`/api/health` 3s 内 503，页面显示可理解降级文案而非白屏 | OB-R3-CEO-02、OB-R3-SPEC-03 |  | verified（review/qa 证据） |
| AC-109 | 备份→毁库→恢复后：商品/账号/订单/库存一致；CLI JSON 往返与 `pg_dump/pg_restore` 至少各一条真实证据 | OB-R3-CEO-02、OB-R3-ENG-05/06 |  | verified（review/qa 证据） |
| AC-110 | `evidence/demo-script.md` 为 5–8 分钟三幕脚本（R1 localStorage / R2 文件库 / R3 PG+三层+容器），含预期输出与回退动作；SPEC §4 有课程目标矩阵 | OB-R3-CEO-04、OB-R3-DES-04 |  | verified（review/qa 证据） |
| AC-111 | `start-all.mjs` 用仓库外临时 SQLite 启动 R2；重启后 R2 订单仍在；不写 R1/R2 工作树 | OB-R3-CEO-03 |  | verified（review/qa 证据） |
| AC-112 | R2 UI 回归：390/834/1440 无横向滚动；键盘可完成浏览→加购→结账；查单焦点、`aria-invalid`、`aria-live`、错误文案保持 | OB-R3-DES-06 |  | verified（review/qa 证据） |
| AC-113 | clean-room quickstart 可复制执行：preflight 输出缺项与补救；`verify --quick` 与 `--full` 有明确前置与退出码 | OB-R3-DX-01、OB-R3-DX-07 |  | verified（review/qa 证据） |
| AC-114 | `scripts/check-docs-stale.mjs` 通过：R3 学员文档无未标注的 4174/`--db`/SQLite/“零依赖”旧口径 | OB-R3-CEO-07 |  | verified（review/qa 证据） |
| AC-115 | 启动失败输出 stage/尝试次数/SQLSTATE/requestId/脱敏目标/下一步命令；README 覆盖四类排障 | OB-R3-DES-05 |  | verified（review/qa 证据） |
| AC-116 | CSRF 客户端恢复：缺 token/403 各重试一次（同 clientOrderId），再失败给“刷新并允许 Cookie”文案；有测试 | OB-R3-DES-02、OB-R3-ENG-09 |  | verified（review/qa 证据） |
| AC-117 | 并发两次 `db migrate`：advisory lock 保证一次执行、另一次安全通过；checksum 被记录；改动已发布迁移会被发现 | OB-R3-ENG-11 |  | verified（review/qa 证据） |
| AC-118 | 测试基础设施：`pgctl.mjs up/status/down` 可复现；测试池 `max=2`；`--test-concurrency=4`；残留库清理；总时长 ≤120s | OB-R3-ENG-07、OB-R3-DX-05 |  | verified（review/qa 证据） |

## 3. 义务落实（OB × 证据）

| 编号 | 义务 | 完成判据 | 实现/证据 | build 判定 |
|---|---|---|---|---|
| OB-R3-CEO-01 | 工时重估 35–45h；M1/M2/M3 各有上限与停止线 | SPEC §10/§16 + BUILD.md 里程碑表 | 见 `docs/obligations.md` 与各环证据 | verified（review/qa 证据） |
| OB-R3-CEO-02 | 结果型 AC-106..109（旅程/管理变更/DB down/备份恢复） | AC 表 + qa 证据 | 见 `docs/obligations.md` 与各环证据 | verified（review/qa 证据） |
| OB-R3-CEO-03 | R2 用仓库外临时 SQLite 文件启动，重启仍在 | `start-all.mjs` + AC-111 | 见 `docs/obligations.md` 与各环证据 | verified（review/qa 证据） |
| OB-R3-CEO-04 | 课程目标矩阵 + 5–8 分钟三幕 demo 脚本 | SPEC §4.1 + `evidence/demo-script.md` | 见 `docs/obligations.md` 与各环证据 | verified（review/qa 证据） |
| OB-R3-CEO-05 | 范围裁剪建议的拒绝/降级留痕 | SPEC §16.3 + DECISIONS | 见 `docs/obligations.md` 与各环证据 | verified（review/qa 证据） |
| OB-R3-CEO-06 | `start-all` 探测原生 Docker/WSL；README 双预检 | 脚本 + README + qa | 见 `docs/obligations.md` 与各环证据 | verified（review/qa 证据） |
| OB-R3-CEO-07 | `check-docs-stale.mjs`：R3 学员文档无旧口径 | 脚本 + AC-114 | 见 `docs/obligations.md` 与各环证据 | verified（review/qa 证据） |
| OB-R3-DES-01 | 4175 经 Caddy 的真实 Chromium 购买闭环 | AC-106 + 截图/日志 | 见 `docs/obligations.md` 与各环证据 | verified（review/qa 证据） |
| OB-R3-DES-02 | CSRF 客户端 `ensureCsrfToken` + 403 重试一次 + 文案 | 客户端测试 + AC-116 | 见 `docs/obligations.md` 与各环证据 | verified（review/qa 证据） |
| OB-R3-DES-03 | 三个新错误码文案/恢复；health 503 统一信封 | error-catalog + 前端映射测试 | 见 `docs/obligations.md` 与各环证据 | verified（review/qa 证据） |
| OB-R3-DES-04 | README 重写 + demo 三幕脚本 | README + AC-110 | 见 `docs/obligations.md` 与各环证据 | verified（review/qa 证据） |
| OB-R3-DES-05 | 启动错误模板 + 四类排障 + web healthcheck | README + AC-115 | 见 `docs/obligations.md` 与各环证据 | verified（review/qa 证据） |
| OB-R3-DES-06 | R2 UI 回归矩阵（三档/键盘/焦点/aria） | qa 记录 + AC-112 | 见 `docs/obligations.md` 与各环证据 | verified（review/qa 证据） |
| OB-R3-DX-01 | clean-room quickstart + `preflight.mjs` | README + AC-113 | 见 `docs/obligations.md` 与各环证据 | verified（review/qa 证据） |
| OB-R3-DX-02 | `VERSION`/包版本分离 + engines/packageManager | 版本校验测试 | 见 `docs/obligations.md` 与各环证据 | verified（review/qa 证据） |
| OB-R3-DX-03 | CLI `db restore` + 容器 backups 卷 + 往返 | CLI 测试 + AC-109 | 见 `docs/obligations.md` 与各环证据 | verified（review/qa 证据） |
| OB-R3-DX-04 | `HOST=0.0.0.0` + `PUBLIC_URL` 派生 + 三层探活 | compose + 容器测试 | 见 `docs/obligations.md` 与各环证据 | verified（review/qa 证据） |
| OB-R3-DX-05 | `pgctl.mjs up/status/down` readiness/清理 | 脚本 + README + AC-118 | 见 `docs/obligations.md` 与各环证据 | verified（review/qa 证据） |
| OB-R3-DX-06 | `docs/cli.md` 命令矩阵 + help 一致测试 | 文档 + 表驱动测试 | 见 `docs/obligations.md` 与各环证据 | verified（review/qa 证据） |
| OB-R3-DX-07 | `verify --quick/--full` + preflight | 脚本输出 + AC-113 | 见 `docs/obligations.md` 与各环证据 | verified（review/qa 证据） |
| OB-R3-DX-08 | 路径可移植 + PowerShell backup/restore 包装 | 脚本 + README | 见 `docs/obligations.md` 与各环证据 | verified（review/qa 证据） |
| OB-R3-DX-09 | 镜像 digest 记录 + lockfile/registry 说明 | `docs/deploy.md` + evidence | 见 `docs/obligations.md` 与各环证据 | verified（review/qa 证据） |
| OB-R3-ENG-01 | client 级 migrate/seed/reset + 同事务 + 三路失败测试 | db/CLI 测试 | 见 `docs/obligations.md` 与各环证据 | verified（review/qa 证据） |
| OB-R3-ENG-02 | 商品排序后扣库存 + 反向购物车测试 | 并发测试 | 见 `docs/obligations.md` 与各环证据 | verified（review/qa 证据） |
| OB-R3-ENG-03 | 异步 scrypt + 信号量/队列 + 限流前置 | auth 测试 + 延迟证据 | 见 `docs/obligations.md` 与各环证据 | verified（review/qa 证据） |
| OB-R3-ENG-04 | Caddy `/healthz` + web healthcheck | compose + 容器证据 | 见 `docs/obligations.md` 与各环证据 | verified（review/qa 证据） |
| OB-R3-ENG-05 | restore 停写/断连/单事务/校验/重启 | restore 脚本 + AC-109 | 见 `docs/obligations.md` 与各环证据 | verified（review/qa 证据） |
| OB-R3-ENG-06 | CLI JSON 备份/恢复契约与 pg_dump 双轨 | CLI 测试 + deploy 文档 | 见 `docs/obligations.md` 与各环证据 | verified（review/qa 证据） |
| OB-R3-ENG-07 | 测试池/并发/清理/预算 | helper + AC-118 | 见 `docs/obligations.md` 与各环证据 | verified（review/qa 证据） |
| OB-R3-ENG-08 | 两桶限流 + 喷洒测试 | auth 测试 | 见 `docs/obligations.md` 与各环证据 | verified（review/qa 证据） |
| OB-R3-ENG-09 | CSRF 轮换/Secure/登出清理 | auth/API 测试 | 见 `docs/obligations.md` 与各环证据 | verified（review/qa 证据） |
| OB-R3-ENG-10 | int8 安全解析/ID 不暴露 | contracts + 测试 | 见 `docs/obligations.md` 与各环证据 | verified（review/qa 证据） |
| OB-R3-ENG-11 | 迁移 advisory lock + checksum + 并发测试 | db 测试 | 见 `docs/obligations.md` 与各环证据 | verified（review/qa 证据） |
| OB-R3-ENG-12 | 路径规范化 + `400 invalid-path` + 405 表 | API 表驱动测试 | 见 `docs/obligations.md` 与各环证据 | verified（review/qa 证据） |
| OB-R3-ENG-13 | v1.2 快照重冻；build 只认 v1.2 哈希 | 快照 + DECISIONS 哈希 | 见 `docs/obligations.md` 与各环证据 | verified（review/qa 证据） |
| OB-R3-SPEC-01 | compose/DSN/health/备份全变量化 | compose + 非默认值实测 | 见 `docs/obligations.md` 与各环证据 | verified（review/qa 证据） |
| OB-R3-SPEC-02 | `seedClassroom`/`seedProductionAdmin` 拆分 | CLI/seed 测试 + AC-57/82 | 见 `docs/obligations.md` 与各环证据 | verified（review/qa 证据） |
| OB-R3-SPEC-03 | health 3s 时限 + 池参数映射 | 故障注入测试 | 见 `docs/obligations.md` 与各环证据 | verified（review/qa 证据） |
| OB-R3-SPEC-04 | AC-91 白名单补 D-47/62/79/82 | BUILD 逐测试处置表 | 见 `docs/obligations.md` 与各环证据 | verified（review/qa 证据） |
| OB-R3-SPEC-05 | D-82 唯一 XFF 决策；compose TRUST_PROXY | SPEC/DECISIONS + 测试 | 见 `docs/obligations.md` 与各环证据 | verified（review/qa 证据） |
| OB-R3-SPEC-06 | username/价格/库存上限 CHECK；password 只 service | schema 断言 + API 测试 | 见 `docs/obligations.md` 与各环证据 | verified（review/qa 证据） |
| OB-R3-SPEC-07 | 状态 v1.2、D 范围、F-09→AC-91 | SPEC/decision-log | 见 `docs/obligations.md` 与各环证据 | verified（review/qa 证据） |

## 4. R2 96 项测试处置（AC-91 / OB-R3-SPEC-04）

| R2 文件 | 原项数 | 处置 | 说明 |
|---|---:|---|---|
| `domain.test.mjs` | 17 | 原样保留 | 仅新增 `PRODUCT_SEED` 别名导入，断言不变 |
| `controller.test.mjs` | 11 | 原样保留 | 无 DOM reducer，未改 |
| `app.test.mjs` | 19 | 等价迁移 | fake DOM 保留；越权文案从 403 `order-not-owned` 改为 404 `order-not-found`（D-57） |
| `assets.test.mjs` | 3 | 原样保留 | 图片/台账断言不变 |
| `static-scan.test.mjs` | 13 | 预期契约变更 | “无 package.json”改为“运行时依赖恰好 {pg}”（D-48/D-64）；CSP/视觉断言保留 |
| `contracts.test.mjs` | 4 | 预期契约变更 | AC 续号（AC-49..118）、OB 改为 `OB-R3-*`、错误码集合更新 |
| `auth.test.mjs` | 5 | 等价迁移 + 扩充 | 改为真实 PG；新增会话过期/轮换/限流/dummy scrypt 分支 |
| `db.test.mjs` | 7 | 等价迁移 + 扩充 | 改为真实 PG；新增迁移 checksum、advisory lock、并发、锁顺序、reset 回滚 |
| `cli.test.mjs` | 7 | 等价迁移 + 扩充 | 改为 `DATABASE_URL`；新增 backup/restore、reset 失败、生产口令、checksum |
| `api.test.mjs` | 10 | 等价迁移 + 扩充 | 改为真实服务器+PG；新增 405 表、优先级、CSRF、限流、404、health down |

**预期变更白名单**：D-32（403→404）、D-47（换库）、D-53（会话过期）、D-55（CSRF）、D-57（404）、D-58（优先级）、D-62（health 形状）、D-64（依赖口径）、D-79（输入约束）、D-82（XFF）。除这些之外，其余 R2 断言应保持等价。

## 5. 未完成 / 降级

- 跨模型复核：`unavailable`（同族 codex；不冒充）。
- cso 官方 run：`partial`（离线无 scanner profiles/history-inputs），见 review 环。
- 读屏器/对比度仪器人工审查：`UNVERIFIED`，qa 环记录。
- 云平台部署：`requires-remote`（M5 选修）。

## 6. 结论

build 环产出：Postgres schema/迁移、repositories/services/router、CLI（含 backup/restore）、真实 PG 测试、Dockerfile ×2、compose 三容器、Caddy、备份恢复脚本、docs/ 与证据。
本文件的 implemented 不等于 verified；review/qa 环逐项复核后，最终判定在 ship 环汇总。
