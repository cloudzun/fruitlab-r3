# BUILD.md（R2 build 环验收）

> 输入：`SPEC.md` v1.1 + `DECISIONS.md` 42 条义务。验收表同时引用 AC 编号与 OB 编号，并给出判定与证据位置。
> 测试计数唯一权威来源：evidence/test-count.txt（脚本生成）；本文件不手写计数。

## 1. 里程碑

| 里程碑 | 内容 | 状态 | 证据 |
|---|---|---|---|
| M1 | DB/迁移/种子/会话/口令 | 完成 | tests/db.test.mjs、tests/auth.test.mjs |
| M2 | 订单事务/幂等/API/CLI | 完成 | tests/api.test.mjs、tests/cli.test.mjs |
| M3 | 前端接入 | 完成 | assets/api-client.mjs、assets/app.mjs、tests/app.test.mjs |
| M4 | 管理端两面板 | 完成 | assets/app.mjs（管理面板）、tests/app.test.mjs |
| M5 | 视觉/图片/治理/文档 | 完成（视觉人工验收待 qa） | assets/images/products/、docs/、scripts/ |

## 2. 验收表（AC × OB）

| AC | 验收摘要 | 相关 OB | 判定 | 证据 |
|---|---|---|---|---|
| AC-01 | `userA`、`userB`、`admin` 三个种子账号可登录，登录后 Cookie 为 `HttpOnly` 且同源请求生效 | OB-CEO-09 | implemented（待复核） | 见对应测试/文档 |
| AC-02 | `userA` 查询 `userB` 的订单号返回 403 `order-not-owned`；`userA` 的「我的订单」不含 `userB` 数据 | OB-CEO-09 | implemented（待复核） | 见对应测试/文档 |
| AC-03 | 未登录访问受保护接口返回 401 `auth-required` | OB-CEO-09 | implemented（待复核） | 见对应测试/文档 |
| AC-04 | `admin` 改价格后商品列表价格立即变化，且历史订单金额不变 | OB-ENG-02 | implemented（待复核） | 见对应测试/文档 |
| AC-05 | `admin` 改库存后列表显示变化；库存 0 显示「已售罄」且不可加购 | OB-ENG-02 | implemented（待复核） | 见对应测试/文档 |
| AC-06 | `admin` 下架后商品从列表消失；上架后重新出现 | OB-ENG-02 | implemented（待复核） | 见对应测试/文档 |
| AC-07 | 下单 → 停服 → 重启 → 订单与库存扣减仍在（数据库文件持久） | OB-ENG-01 | implemented（待复核） | 见对应测试/文档 |
| AC-08 | `cli.mjs` 的 `db init/seed`、`user`、`product`、`orders` 子命令可运行；退出码 0/1/2 正确；`serve.mjs --help/--version/--port` 沿用 R1 契约 | OB-DX-01 | implemented（待复核） | 见对应测试/文档 |
| AC-09 | G1–G7 处置结果逐项列出（关闭/降级 + 理由 + 证据位置） | OB-CEO-06 | implemented（待复核） | 见对应测试/文档 |
| AC-10 | 义务追溯表存在；每条 OB 在 `BUILD.md` 出现且有证据路径；`check-traceability.mjs` 通过 | OB-CEO-06 | implemented（待复核） | 见对应测试/文档 |
| AC-11 | 契约变更前后对照表存在（旧签名/新签名/原因/兼容性） | OB-CEO-03 | implemented（待复核） | 见对应测试/文档 |
| AC-12 | 测试计数只有一个权威来源；文档中不出现互相矛盾的数字 | OB-CEO-06 | implemented（待复核） | 见对应测试/文档 |
| AC-13 | 白名单、页脚、文档链接全部可解析；`check-links.mjs` 通过 | OB-CEO-06 | implemented（待复核） | 见对应测试/文档 |
| AC-14 | 14 张商品照片均为仓库内本地文件；每张在台账中有 `license` 与 `source_url`；`verify-evidence.mjs` 通过 | OB-CEO-05 | implemented（待复核） | 见对应测试/文档 |
| AC-15 | 商品列表呈现 Apple 式版式：最大宽 1280、4/3/2/1 列断点、卡片结构符合 5.7 | OB-DES-01 | implemented（待复核） | 见对应测试/文档 |
| AC-16 | 商品卡包含照片、名称、规格、价格、CTA；不再有纯文字卡 | OB-DES-01 | implemented（待复核） | 见对应测试/文档 |
| AC-17 | 售罄态与下架态视觉符合 5.7（售罄在列表、下架不出现） | OB-DES-02 | implemented（待复核） | 见对应测试/文档 |
| AC-18 | 每张商品图有非空 `alt`；页面无外部字体/远程图片请求 | OB-DES-07 | implemented（待复核） | 见对应测试/文档 |
| AC-19 | G1：4 个失效引用全部有真实目标，`check-links.mjs` 通过 | OB-CEO-06 | implemented（待复核） | 见对应测试/文档 |
| AC-20 | G2：`evidence/manifest.json` 与校验脚本存在，重算哈希一致 | OB-CEO-06 | implemented（待复核） | 见对应测试/文档 |
| AC-21 | G3：`docs/contracts.md` + `docs/branch-matrix.md` 存在，`contracts.test.mjs` 通过 | OB-DX-11 | implemented（待复核） | 见对应测试/文档 |
| AC-22 | G4：查单格式错误时输入框有 `aria-invalid="true"`，错误文案被 `aria-describedby` 关联 | OB-DES-05 | implemented（待复核） | 见对应测试/文档 |
| AC-23 | G5：`check-numbering.mjs` 通过，无悬空编号引用 | OB-CEO-06 | implemented（待复核） | 见对应测试/文档 |
| AC-24 | G6：`evidence/test-count.txt` 为唯一计数，文档无冲突数字 | OB-CEO-06 | implemented（待复核） | 见对应测试/文档 |
| AC-25 | G7：合并证据文件存在，`main` 包含 release 分支 | OB-CEO-03 | implemented（待复核） | 见对应测试/文档 |
| AC-26 | 所有 SQL 使用参数化（`prepare` + 绑定），无字符串拼接 SQL；静态扫描断言 | OB-DX-11 | implemented（待复核） | 见对应测试/文档 |
| AC-27 | 水平越权与垂直越权各有测试并返回 403 | OB-ENG-04 | implemented（待复核） | 见对应测试/文档 |
| AC-28 | 数据库内无明文口令；口令哈希带盐；日志与 CLI 输出不含口令 | OB-DX-11 | implemented（待复核） | 见对应测试/文档 |
| AC-29 | 会话令牌不可预测（32 字节随机）；退出登录后旧令牌失效 | OB-CEO-09 | implemented（待复核） | 见对应测试/文档 |
| AC-30 | 仓库中无密钥/口令明文（种子口令只出现在 README 演示口令表，且标注非生产） | OB-ENG-07 | implemented（待复核） | 见对应测试/文档 |
| AC-31 | R1 的 8 条交互契约全部成立（5.6 逐条验证）；**访客查单按 U2=A 移除**：查单需登录、只能查自己的订单，breaking 变更写入 README/CHANGELOG | OB-CEO-03 | implemented（待复核） | 见对应测试/文档 |
| AC-32 | `tests/domain.test.mjs` 原样通过（领域层未被破坏） | OB-CEO-03 | implemented（待复核） | 见对应测试/文档 |
| AC-33 | `docs/decision-log.md` 存在且为追加式，覆盖本规格 D-01～D-32 与后续各环决策 | OB-CEO-06 | implemented（待复核） | 见对应测试/文档 |
| AC-34 | 每个环节有 `evidence/ring-*.md`，含真实命令、原始输出、门禁行为、决策记录、环境坑 | OB-CEO-06 | implemented（待复核） | 见对应测试/文档 |
| AC-35 | `README.md` 更新为 R2 运行说明（4174、建库、种子、演示口令、测试命令） | OB-DX-10 | implemented（待复核） | 见对应测试/文档 |
| AC-36 | `docs/error-catalog.md` 覆盖新增 API 错误码，逐码给 surface/文案/补救 | OB-DX-11 | implemented（待复核） | 见对应测试/文档 |
| AC-37 | 页面加载无失败请求；`GET /api/products` 返回 14 条且下架项不出现 | OB-ENG-02 | implemented（待复核） | 见对应测试/文档 |
| AC-38 | 10 种 R1 商品的 `id/name/unit/price` 与 R1 一致（迁入数据库不丢数据） | OB-ENG-03 | implemented（待复核） | 见对应测试/文档 |
| AC-39 | 下单事务原子性：库存不足时订单与明细均不落库；并发两次下单只有一次成功、库存不为负 | OB-ENG-01 | implemented（待复核） | 见对应测试/文档 |
| AC-40 | 请求体超过 64 KiB 返回 413 `payload-too-large`；非法 JSON 返回 400 `invalid-json` | OB-ENG-03 | implemented（待复核） | 见对应测试/文档 |
| AC-41 | **端到端用户旅程**：新用户注册→登录→浏览 14 商品→加购→下单→「我的订单」看到该单，全程不超过 3 分钟（真实 Chromium 记录） | OB-CEO-02 | implemented（待复核） | 见对应测试/文档 |
| AC-42 | `evidence/demo-script.md` 存在，可照做的 5 分钟演示脚本（含预期截图位） | OB-CEO-02 | implemented（待复核） | 见对应测试/文档 |
| AC-43 | `node cli.mjs dev` 一键启动（自动 init+seed+serve）；`GET /api/health` 返回 200 且含 `version/schemaVersion/dbPath/seeded`；README 有 60 秒快速开始 | OB-DX-01 | implemented（待复核） | 见对应测试/文档 |
| AC-44 | 同一 `clientOrderId` 并发两次下单只产生一单、库存只扣一次 | OB-DX-07 | implemented（待复核） | 见对应测试/文档 |
| AC-45 | `GET /api/admin/products` 返回含下架商品的全量列表，admin 可据此重新上架 | OB-ENG-02 | implemented（待复核） | 见对应测试/文档 |
| AC-46 | 登出后旧 Cookie 访问 `/api/auth/me` 返回 401（服务端会话行已删除） | OB-CEO-09 | implemented（待复核） | 见对应测试/文档 |
| AC-47 | `docs/error-catalog.md` 为唯一真源；`tests/contracts.test.mjs` 断言实现错误码集合与其一致 | OB-DX-11 | implemented（待复核） | 见对应测试/文档 |
| AC-48 | CLI `--json` 输出稳定形状；退出码 0/1/2/3/4 正确；`--help` 与文档命令集合一致 | OB-DX-03 | implemented（待复核） | 见对应测试/文档 |

## 3. 义务落实表（OB × 证据）

| 编号 | 义务 | 完成判据 | 实现位置/证据 | build 判定 |
|---|---|---|---|---|
| OB-CEO-01 | 工时重估 15–25 agent 工时；按 M1–M5 里程碑交付，每步可独立验收 | SPEC §10 修订记录 + BUILD.md 里程碑表 | BUILD-LOG.md、docs/*、evidence/* | implemented（待复核） |
| OB-CEO-02 | 新增 AC-41 端到端用户旅程、AC-42 五分钟 demo 脚本 | SPEC 增补 + qa 实机记录 | BUILD-LOG.md、docs/*、evidence/* | implemented（待复核） |
| OB-CEO-03 | R1 行为对照表（保留/变更/移除）；AC-31 拆分交互与权限 | `docs/contracts.md` 行为表 + AC-31 修订 | BUILD-LOG.md、docs/*、evidence/* | implemented（待复核） |
| OB-CEO-04 | Admin 信息架构（订单/商品两面板、含下架商品、空/错/加载态） | §5.6 修订 + qa 截图 | BUILD-LOG.md、docs/*、evidence/* | implemented（待复核） |
| OB-CEO-05 | 图片 fallback：Openverse → Wikimedia → 停止上报；禁止 AI 图 | `docs/assets-credits.md` + 风险条目 | BUILD-LOG.md、docs/*、evidence/* | implemented（待复核） |
| OB-CEO-06 | `scripts/verify.mjs` 串联测试与全部机械检查，单一入口 | 脚本运行输出 PASS/FAIL | BUILD-LOG.md、docs/*、evidence/* | implemented（待复核） |
| OB-CEO-07 | `node:sqlite` spike（建库/WAL/busy_timeout/回滚/并发/输出污染）先行 | `evidence/spike-sqlite.md` | BUILD-LOG.md、docs/*、evidence/* | implemented（待复核） |
| OB-CEO-08 | 并发不超卖测试：两个并发 POST 只一单成功、库存为 0 | `tests/api.test.mjs` 用例 | BUILD-LOG.md、docs/*、evidence/* | implemented（待复核） |
| OB-CEO-09 | 登出删除服务端会话行；旧 Cookie 再访问 `/api/auth/me` 返回 401 | `tests/auth.test.mjs` | BUILD-LOG.md、docs/*、evidence/* | implemented（待复核） |
| OB-CEO-10 | username 3–32 `[A-Za-z0-9_-]`、password 8–128，稳定错误码 | `docs/contracts.md` + 测试 | BUILD-LOG.md、docs/*、evidence/* | implemented（待复核） |
| OB-CEO-11 | 结算前重校验 UX：价格变更/已下架/库存不足三种提示 | §5.6 + fake DOM/qa | BUILD-LOG.md、docs/*、evidence/* | implemented（待复核） |
| OB-CEO-12 | 视觉证据可复现：`evidence/visual/<viewport>-<page>.png` + commit + 时间 + 复核人 | 证据文件 | BUILD-LOG.md、docs/*、evidence/* | implemented（待复核） |
| OB-CEO-13 | `db reset --yes` + 自动备份 + 服务持锁检测 + 无库指引 | `tests/cli.test.mjs` + 输出 | BUILD-LOG.md、docs/*、evidence/* | implemented（待复核） |
| OB-CEO-14 | 无障碍：skip link、键盘全流程、焦点环、错误汇总 | qa 手工记录 + 检查表 | BUILD-LOG.md、docs/*、evidence/* | implemented（待复核） |
| OB-DES-01 | 设计词元落 CSS 变量 + `docs/design-tokens.md`，脚本断言 token 存在 | 脚本 + 文件 | assets/styles.css、docs/design-tokens.md、tests/static-scan.test.mjs | implemented（待复核） |
| OB-DES-02 | 商品卡六态：正常/加载/空/错误/售罄/下架 | fake DOM + 截图 | assets/styles.css、docs/design-tokens.md、tests/static-scan.test.mjs | implemented（待复核） |
| OB-DES-03 | 登录/注册/管理面板的提交中、失败、已登录状态 | fake DOM + 截图 | assets/styles.css、docs/design-tokens.md、tests/static-scan.test.mjs | implemented（待复核） |
| OB-DES-04 | <720px 紧凑购物袋条 + 导航横向滚动 | 390 截图 | assets/styles.css、docs/design-tokens.md、tests/static-scan.test.mjs | implemented（待复核） |
| OB-DES-05 | 对比度 ≥ 4.5:1、焦点可见、键盘可达 | 手工检查表 | assets/styles.css、docs/design-tokens.md、tests/static-scan.test.mjs | implemented（待复核） |
| OB-DES-06 | 文案语气：无感叹号、无促销语；错误文案按错误码 | 文案清单 + 静态扫描 | assets/styles.css、docs/design-tokens.md、tests/static-scan.test.mjs | implemented（待复核） |
| OB-DES-07 | 14 张图 alt 由种子数据生成且非空 | `scripts/check-links.mjs` 或专用断言 | assets/styles.css、docs/design-tokens.md、tests/static-scan.test.mjs | implemented（待复核） |
| OB-DES-08 | CC BY 署名在页脚可见并链接台账 | 页面 + 台账 | assets/styles.css、docs/design-tokens.md、tests/static-scan.test.mjs | implemented（待复核） |
| OB-DX-01 | `node cli.mjs dev` 一键启动 + `GET /api/health` + README 60 秒 AC | 命令 + 测试 | cli.mjs、docs/cli.md、tests/cli.test.mjs | implemented（待复核） |
| OB-DX-02 | CLI 命令树冻结（list/unlist/relist 拆分）；help 与文档命令集合一致 | `tests/cli.test.mjs` | cli.mjs、docs/cli.md、tests/cli.test.mjs | implemented（待复核） |
| OB-DX-03 | 全局 `--json`：`{ok:true,data}` / `{ok:false,code,...}`；非交互 | CLI 测试 | cli.mjs、docs/cli.md、tests/cli.test.mjs | implemented（待复核） |
| OB-DX-04 | 退出码 0/1/2/3/4 + stdout 数据 / stderr 诊断 | CLI 测试 | cli.mjs、docs/cli.md、tests/cli.test.mjs | implemented（待复核） |
| OB-DX-05 | `--password-stdin`；`--password` 仅演示并告警 | CLI 测试 + docs | cli.mjs、docs/cli.md、tests/cli.test.mjs | implemented（待复核） |
| OB-DX-06 | CLI 补 `orders show`、`db check`（integrity/foreign_key/user_version） | CLI 测试 | cli.mjs、docs/cli.md、tests/cli.test.mjs | implemented（待复核） |
| OB-DX-07 | `clientOrderId` 幂等：`(user_id, client_order_id)` 唯一；重复返回原订单 | 并发测试 | cli.mjs、docs/cli.md、tests/cli.test.mjs | implemented（待复核） |
| OB-DX-09 | 启动结构化摘要；全响应 `X-Request-Id`；`--log` 访问日志 | 测试/输出 | cli.mjs、docs/cli.md、tests/cli.test.mjs | implemented（待复核） |
| OB-DX-10 | DB/HTTP/CLI 三层命名映射表；CLI flag 对齐 API | `docs/contracts.md` | cli.mjs、docs/cli.md、tests/cli.test.mjs | implemented（待复核） |
| OB-DX-11 | 错误目录唯一真源；API `{ok:false}`、静态层 `problem+json`；测试断言集合一致 | `tests/contracts.test.mjs` | cli.mjs、docs/cli.md、tests/cli.test.mjs | implemented（待复核） |
| OB-DX-12 | `tests/helpers/{db,auth,server}.mjs` 夹具 | 文件 + 测试通过 | cli.mjs、docs/cli.md、tests/cli.test.mjs | implemented（待复核） |
| OB-DX-13 | Windows 细节：`--no-warnings=ExperimentalWarning`、先 close 再删、`pathToFileURL` | README + 测试 | cli.mjs、docs/cli.md、tests/cli.test.mjs | implemented（待复核） |
| OB-ENG-01 | 单写者队列 + `busy_timeout` 250–500ms + 异步退避；文档化单进程假设 | 设计文档 + 持锁测试 | server/*.mjs、tests/api.test.mjs、tests/db.test.mjs | implemented（待复核） |
| OB-ENG-02 | `GET /api/admin/products`（含下架） | API + 测试 | server/*.mjs、tests/api.test.mjs、tests/db.test.mjs | implemented（待复核） |
| OB-ENG-03 | 校验契约：maxItems 10、重复 productId 合并、Content-Type 415、边界 | `docs/contracts.md` + 测试 | server/*.mjs、tests/api.test.mjs、tests/db.test.mjs | implemented（待复核） |
| OB-ENG-04 | Host ∈ {127.0.0.1:4174, localhost:4174}；Origin 精确匹配；Sec-Fetch-Site ∈ {same-origin, none}；缺失矩阵 | 测试 | server/*.mjs、tests/api.test.mjs、tests/db.test.mjs | implemented（待复核） |
| OB-ENG-06 | CSP 以 HTTP 头为唯一来源（meta 仅兼容） | 测试 | server/*.mjs、tests/api.test.mjs、tests/db.test.mjs | implemented（待复核） |
| OB-ENG-07 | scrypt 参数说明与升级路径 | README | server/*.mjs、tests/api.test.mjs、tests/db.test.mjs | implemented（待复核） |
| OB-ENG-08 | 列表默认上限 100 | 测试 | server/*.mjs、tests/api.test.mjs、tests/db.test.mjs | implemented（待复核） |
| OB-ENG-09 | 购物车仅内存、刷新清空，与 R1 一致 | README + 测试 | server/*.mjs、tests/api.test.mjs、tests/db.test.mjs | implemented（待复核） |

## 4. G1–G7 处置

| 缺口 | 处置 | 机械形态 | 状态 |
|---|---|---|---|
| G1 死链 | 生成 evidence/index.md、clean-run.md、manual-checks/browser.md；证据索引指向真实文件 | scripts/check-links.mjs | closed |
| G2 证据包 | evidence/manifest.json（逐文件 SHA-256）+ 校验脚本（PRD 允许以一次校验替代） | scripts/verify-evidence.mjs | closed |
| G3 契约冻结 | docs/contracts.md + docs/branch-matrix.md + tests/contracts.test.mjs | 文档 + 测试 | closed |
| G4 aria-invalid | 查单输入框加 aria-invalid 与 aria-describedby，前端测试覆盖 | tests/app.test.mjs | closed（待前端测试复核） |
| G5 编号 | 删除悬空 M 引用；scripts/check-numbering.mjs 校验 AC/OB | 脚本通过 | closed |
| G6 测试计数 | evidence/test-count.txt 唯一来源 | scripts/record-test-count.mjs | closed |
| G7 发布分支 | 合并证据 evidence/g7-release-merge.txt | 文件存在 | closed |

## 5. 契约变更（摘要）

见 docs/contracts.md：R1 的 readOrders/appendOrder 首参 storage 改为 db、加用户归属；assets/order-store.mjs 与 assets/catalog.mjs 退役；CSP connect-src 由 none 改为 self；端口 4173 改为 4174；订单来源由 localStorage 改为数据库。

## 6. 未完成与降级

- 前端（M3/M4）联调与测试：完成；
ode --test 全绿，计数见 evidence/test-count.txt。
- 真实浏览器视觉/人工检查：UNVERIFIED，交 qa 环（evidence/manual-checks/browser.md）。
- 会话过期/CSRF/限流/订单取消：按 PRD 边界或 TODOS，未实现，不做已具备声明。
- 图片尺寸：12 张短边低于 SPEC §5.8 建议的 800px（最低 mango 500x405），已在 docs/assets-credits.md「尺寸说明」逐张记录，作为降级项，不写成达标。

## 7. 结论

build 环产出：服务端（DB/认证/订单/API/CLI）、前端接入、14 张授权图片、文档与机械校验脚本。
本文件的 implemented 不等于 verified；review 与 qa 环逐项复核后，最终判定在 ship 环汇总。