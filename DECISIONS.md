# FruitLab R2 `/autoplan` Decision Record

Run: `r2-20261018-0837`
Date: 2026-10-18
Ring: 2 / 7 (`/autoplan`)
Status: **FINAL APPROVAL GATE `gate_rev=1` — PENDING USER APPROVAL. NO BUILD STARTED.**

## Hard Constraints

- 评审输入：`SPEC.md` **v1.0**（559 行，SHA-256 `FF3BAAFCF99738344AE54AB2E487B677131CA884A052A53990E416DC13074B1B`），四阶段评审期间未被修改。
- 终门批准后按项目负责人指示形成 **SPEC v1.1**（599 行，SHA-256 `BE00459DEBF6EEE0DA7D3C379CC741AA931A4C79B76B1727F5109D0C3EE7EA3B`），把会改变规格文字的修订并入 §15；v1.0 由 git 历史保留。
- 四阶段按 CEO → Design → DX → Eng **串行**执行；每阶段只采纳一轮评审结论，**未把失败评审退回重审**。
- 每阶段的「外部声音」由本机 `claude` CLI 提供，实际模型 `deepseek-v4-flash`，**与本地同族，不构成跨模型对抗**；因此跨模型共识一律记 `N/A（覆盖缺失）`，不冒充跨模型结论。
- **环境偏差（如实记录）**：Design 与 Eng 的外部声音各尝试了两次——第一次分别返回偏题内容（CEO 视角）与卡住的元回复，未形成评审；第二次才得到可用评审。官方 `gstack-autoplan` 运行件（bun snapshot/plan-reality 工具链）在本宿主不可用，流程按技能文档手动执行。
- 本门禁批准的是「评审后的计划与义务清单」，**不表示 build、测试或人工检查已经通过**，也不启动 build。

## Phase Summary

| Phase | Result | Native findings | Outside voice | Consensus |
|---|---|---|---|---|
| CEO | **6.5/10, FAIL / issues_open** | 4 Critical, 6 High, 7 Medium, 3 Low | 同族（非跨模型），已记录 | N/A（覆盖缺失） |
| Design | **7.0/10, FAIL / issues_open** | 3 High, 5 Medium | 同族（首次偏题，重问一次） | N/A（覆盖缺失） |
| DX | **5.7/10, FAIL / issues_open** | 2 Critical, 6 High, 6 Medium, 2 Low | 同族（非跨模型） | N/A（覆盖缺失） |
| Eng | **6.5/10, FAIL / issues_open** | 3 High, 7 Medium, 6 Low | 同族（首次卡住，重问一次） | N/A（覆盖缺失） |

四阶段均为 FAIL / issues_open。**接受的修复不把 FAIL 转为 PASS**；本记录不代表任何一项已实现或已验收。

原始发现合计 **60 条**（CEO 20 + Design 8 + DX 16 + Eng 16）；去重合并后转为 **42 条义务**（见下方 Accepted Obligations）、**5 项 TODOS** 与若干显式风险接受。

## Phase 1: CEO（战略与范围）

Native result: **6.5/10, FAIL**。核心判断：工程底子扎实，但**范围与估算不匹配**，且 40 条 AC 全是机制型、缺用户结果型验收。

| ID | 严重度 | 发现 | 一轮处置 |
|---|---|---|---|
| F-01 | Critical | §10 估算 4.5–5.5 agent 工时，与 20+ 新文件、40 AC、14 图、5 门禁不匹配 | **接受**：重估 15–25 agent 工时；OB-CEO-01 |
| F-02 | Critical | 无里程碑切分，任一环节卡住全盘阻塞 | **接受**：M1 DB/auth → M2 API/CLI → M3 前端接入 → M4 管理端 → M5 视觉/资产/治理；OB-CEO-01 |
| F-03 | Critical | 40 条 AC 无用户结果型标准，无 demo 脚本 | **接受**：补 AC-41 用户旅程、AC-42 demo 脚本；OB-CEO-02 |
| F-04 | Critical | 治理成本（5 脚本 + manifest + 32 决策 + G1–G7）可能超过产品代码，且属自证 | **部分接受**：合并为 `scripts/verify.mjs` 单一入口；明确 G1/G2/G6 保留、G3/G4/G5/G7 合并或降级并写明理由；OB-CEO-06 |
| F-05 | High | R1 访客查单（无账号）与 R2 登录模型冲突；AC-31 可能无法满足 | **接受**：产出 R1 行为对照表，AC-31 拆为「交互契约保留」与「权限行为变更（访客查单移除，breaking）」；OB-CEO-03 |
| F-06 | High | Admin UI 未定义；AC-04/05/06 可能只能靠 CLI 满足 | **接受**：补 Admin 信息架构与状态；并新增 `GET /api/admin/products`；OB-CEO-04、OB-ENG-02 |
| F-07 | High | 14 张图是发布硬阻塞，无 fallback | **接受**：Openverse → Wikimedia Commons → 停止并上报，禁止 AI 图冒充；OB-CEO-05 |
| F-08 | High | 库存只减不增，无误下单回补 | **拒绝进 R2 范围，记入 TODOS**：PRD 未要求取消/退款；在 TODO 登记，不静默做 |
| F-09 | High | `node:sqlite` 未做能力 spike | **接受**：M1 前置 spike（建库/WAL/busy_timeout/事务回滚/并发写/测试输出污染）；OB-CEO-07 |
| F-10 | High | 并发不超卖缺真实并发测试 | **接受**：并发双 POST 用例；OB-CEO-08 |
| F-11 | Medium | 会话无 `expires_at`/清理 | **部分接受**：PRD 明确「无会话过期」，保留边界；但**登出必须删除服务端会话行**；OB-CEO-09 |
| F-12 | Medium | 注册/密码策略未定义 | **接受**：username 3–32 `[A-Za-z0-9_-]`、password 8–128；OB-CEO-10 |
| F-13 | Medium | Admin 变更无审计 | **记入 TODOS**（PRD 未要求） |
| F-14 | Medium | 结算时价格/下架/库存变化的 UX 未定义 | **接受**：三种提示状态；OB-CEO-11 |
| F-15 | Medium | 视觉验收不可复现（截图无路径/commit/复核人） | **接受**：截图路径、commit、时间、复核人；OB-CEO-12 |
| F-16 | Medium | `db init --force` 无刹车，serve 缺库行为未定义 | **接受**：自动备份 + `--yes` + 持锁检测 + 无库指引；OB-CEO-13 |
| F-17 | Medium | 无障碍覆盖不足（键盘/焦点/skip link/错误汇总） | **接受**：OB-CEO-14 |
| F-18 | Low | 403 vs 404 存在性泄露（D-32 已接受） | 保持，文档记录 |
| F-19 | Low | `evidence/test-count.txt` 每次测试都改 | 只在发布/验收时生成 |
| F-20 | Low | 列表无分页 | **部分接受**：加默认上限 100；OB-ENG-08 |

### `U1`：范围与工时的用户裁量

**需要用户拍板，非自动决定。**

推荐 **A**：保持 PRD 全量范围（不拆成 R2a/R2b），但按 M1–M5 里程碑顺序交付、每步可独立验收与回退；工时按 15–25 agent 工时重估。

| 选项 | 完整度 | 利 | 弊 |
|---|---:|---|---|
| A. 全量 + 里程碑 | 9/10 | 满足 PRD 与课堂「一次完整升级」叙事；每步可停可回退 | 总时长变长，需分阶段验收 |
| B. 拆 R2a/R2b 两次交付 | 10/10 | 最快拿到可演示闭环；风险最低 | 课堂要讲两次「交付」，R2 叙事被切碎；PRD 要求全量 |
| C. 砍视觉与治理保功能 | 7/10 | 工期最短 | 违反 A10/A11/A12 与「文档可复盘」要求 |

### `U2`：R1 访客查单的移除

**需要用户拍板。** R1 允许任何人凭订单号查单（无账号）；R2 要求登录且只能查自己的订单（PRD FR-3）。这是**有意的 breaking change**。
推荐 **A**：移除访客查单，保留「顶层查订单入口 + 结果聚焦」的交互契约；在 README 与 CHANGELOG 写明 breaking。

| 选项 | 完整度 | 利 | 弊 |
|---|---:|---|---|
| A. 移除访客查单 | 9/10 | 符合 FR-3 权限模型；实现简单 | R1 行为变更，需在课堂解释 |
| B. 保留访客查单（凭订单号可查） | 6/10 | 保住 R1 行为 | 泄露他人订单；违反 FR-3 |
| C. 访客可查但脱敏（只显示金额与状态） | 7/10 | 折中 | 仍需额外契约与测试，范围变大 |

## Phase 2: Design（视觉与交互）

Native result: **7.0/10, FAIL / issues_open**。方向可落地（Apple 式词元已具体化），问题集中在**状态覆盖**与**管理端信息架构**。

| ID | 严重度 | 发现 | 一轮处置 |
|---|---|---|---|
| DF-01 | High | Admin 界面只有一句「单页两面板」，缺订单/商品面板的信息架构、空态、错误态 | **接受**：OB-CEO-04、OB-DES-03 |
| DF-02 | High | 商品卡仅定义正常态；加载、空、错误、售罄、下架五态未逐一给视觉规则 | **接受**：六态齐全；OB-DES-02 |
| DF-03 | High | 视觉验收依赖人工，缺可复现证据与复核人 | **接受**：OB-CEO-12 |
| DF-04 | Medium | 无障碍只覆盖 alt/对比度/aria-invalid，缺 skip link、键盘全流程、焦点顺序、错误汇总 | **接受**：OB-CEO-14、OB-DES-05 |
| DF-05 | Medium | 移动端导航与购物袋细节不足（横向滚动、<720px 紧凑条） | **接受**：OB-DES-04 |
| DF-06 | Medium | 文案语气无验收口径（易回到促销腔） | **接受**：OB-DES-06 |
| DF-07 | Medium | CC BY 署名未规定可见位置 | **接受**：页脚署名链接台账；OB-DES-08 |
| DF-08 | Medium | 登录/注册表单状态（提交中、失败、已登录）未定义 | **接受**：OB-DES-03 |

无新增品味决策：视觉方向 `DV1` 已由项目负责人于 2026-10-18 定为 Apple 式高冷风（D-08），本环不再另立。

## Phase 2.5: DX（开发者体验）

Native result: **5.7/10, FAIL / issues_open**。核心判断：项目由 agent 实现与验证，但 CLI/API 尚不足以被机器可靠使用。

| ID | 严重度 | 发现 | 一轮处置 |
|---|---|---|---|
| DX-01 | Critical | 无一条命令从零到可用（init+seed+serve 三步），无 health，`data/` 创建未定义 | **接受**：`node cli.mjs dev` + `GET /api/health` + README 60 秒 AC；OB-DX-01 |
| DX-02 | Critical | CLI 语法有硬伤：`product list|unlist --id` 不可解析 | **接受**：拆分为 `product list` / `product unlist --id` / `product relist --id`；help 与文档一致测试；OB-DX-02 |
| DX-03 | High | CLI 无 `--json`，无法被脚本/agent 稳定消费 | **接受**：全局 `--json` 契约；OB-DX-03 |
| DX-04 | High | 退出码只有 0/1/2，未映射业务/暂时性/内部错误，stdout/stderr 分工缺失 | **接受**：5 档退出码 + 分工；OB-DX-04 |
| DX-05 | High | `--password <p>` 进 shell history/进程列表/agent 日志 | **接受**：`--password-stdin`；OB-DX-05 |
| DX-06 | High | CLI 缺 `orders show`、`db check`，排障只能开库 | **接受**：补两条；OB-DX-06 |
| DX-07 | High | `save-unknown` 在 DB 架构下无落点，重试可能重复下单 | **接受**：`clientOrderId` + `(user_id, client_order_id)` 唯一约束，重复请求返回原订单；**supersede D-30**；OB-DX-07 |
| DX-08 | High | `db init --force` 破坏性无刹车 | **接受**（与 F-16 合并）：OB-CEO-13 |
| DX-09 | Medium | 运行时不可观测（无 health/启动摘要/requestId） | **接受**：OB-DX-09 |
| DX-10 | Medium | DB/HTTP/CLI 三层命名不一致（`--cents` vs `unitPriceCents`） | **接受**：三层映射表 + CLI flag 对齐；OB-DX-10 |
| DX-11 | Medium | 错误响应形态可能自相矛盾（`{ok:false}` 与 `problem+json` 混用） | **接受**：API 用 `{ok:false}`，静态层用 `problem+json`；目录唯一真源；OB-DX-11 |
| DX-12 | Medium | 缺失 `Origin`/`Sec-Fetch-Site` 时行为未定义（curl/测试会被误杀或误放） | **接受**：明确矩阵；OB-ENG-04 |
| DX-13 | Medium | 缺统一 `verify` 入口 | **接受**：OB-CEO-06 |
| DX-14 | Medium | R1 测试迁移与共享夹具未规划 | **接受**：`tests/helpers/`；OB-DX-12 |
| DX-15 | Low | Windows 细节（ExperimentalWarning、WAL 下删目录 EBUSY、路径引用） | **接受**：OB-DX-13 |
| DX-16 | Low | 预算会优先砍掉 DX 面 | 已在里程碑中前置 M2 的 DX 项 |

## Phase 3: Eng（工程可实施性）

Native result: **6.5/10, FAIL / issues_open**。核心判断：架构方向正确，但**同步 SQLite 的阻塞**与**契约单源**是最大工程风险。

| ID | 严重度 | 发现 | 一轮处置 |
|---|---|---|---|
| E-01 | High | 同步 `DatabaseSync` + 5s `busy_timeout` + 同步重试会阻塞整个 HTTP 服务（含静态资源） | **接受**：单写者队列 + `busy_timeout` 250–500ms + 异步退避；OB-ENG-01 |
| E-02 | High | 缺 `GET /api/admin/products`，商品下架后管理端无法再操作 | **接受**：OB-ENG-02 |
| E-03 | High | 下单无幂等键，重复提交重复下单/扣库存 | **接受**（与 DX-07 合并）：OB-DX-07 |
| E-04 | Medium | 会话生命周期（无过期/清理/登出撤销未明确） | **部分接受**：登出删除；过期按 PRD 边界不做；OB-CEO-09 |
| E-05 | Medium | 错误码多处不一致（`invalid-listed`、`product-unlisted`、`order-number-exhausted` vs `duplicate-order-number`） | **接受**：目录唯一真源；OB-DX-11 |
| E-06 | Medium | 请求校验契约不完整（`maxItems`、重复 productId、Content-Type、用户名/密码边界） | **接受**：OB-ENG-03 |
| E-07 | Medium | Origin/Sec-Fetch-Site 规则不精确，且未校验 `Host` | **接受**：OB-ENG-04 |
| E-08 | Medium | 40 AC + 门禁 + 自证与估算不匹配 | **部分接受**：里程碑 + verify 入口；自证风险在 evidence 诚实边界中声明 |
| E-09 | Medium | CSP 在 meta 与响应头双写会漂移，`frame-ancestors` 在 meta 无效 | **接受**：HTTP 头为唯一来源；OB-ENG-06 |
| E-10 | Medium | scrypt `N=16384` 偏低，无升级路径说明 | **接受**：README 说明 + 升级路径；OB-ENG-07 |
| E-11 | Low | CLI 密码明文（已由 DX-05 覆盖） | 合并 |
| E-12 | Low | 登录无限流 | **记入风险接受**（PRD 边界） |
| E-13 | Low | 列表无分页 | **部分接受**：默认上限 100；OB-ENG-08 |
| E-14 | Low | 购物车是否跨刷新保留未定义 | **接受**：仅内存，与 R1 一致；OB-ENG-09 |
| E-15 | Low | 管理操作无审计 | **TODOS** |
| E-16 | Low | CC BY 署名位置（设计已覆盖） | 合并 |

## Accepted Obligations（进入 build 的义务清单）

义务编号 `OB-<阶段>-<序号>`；判定只能 `closed` / `downgraded`（附理由）/ `not-covered`（附理由）。每条都必须落到 `BUILD.md` 验收表与 `docs/obligations.md`。

| 编号 | 义务 | 完成判据（机械可查） |
|---|---|---|
| OB-CEO-01 | 工时重估 15–25 agent 工时；按 M1–M5 里程碑交付，每步可独立验收 | SPEC §10 修订记录 + BUILD.md 里程碑表 |
| OB-CEO-02 | 新增 AC-41 端到端用户旅程、AC-42 五分钟 demo 脚本 | SPEC 增补 + qa 实机记录 |
| OB-CEO-03 | R1 行为对照表（保留/变更/移除）；AC-31 拆分交互与权限 | `docs/contracts.md` 行为表 + AC-31 修订 |
| OB-CEO-04 | Admin 信息架构（订单/商品两面板、含下架商品、空/错/加载态） | §5.6 修订 + qa 截图 |
| OB-CEO-05 | 图片 fallback：Openverse → Wikimedia → 停止上报；禁止 AI 图 | `docs/assets-credits.md` + 风险条目 |
| OB-CEO-06 | `scripts/verify.mjs` 串联测试与全部机械检查，单一入口 | 脚本运行输出 PASS/FAIL |
| OB-CEO-07 | `node:sqlite` spike（建库/WAL/busy_timeout/回滚/并发/输出污染）先行 | `evidence/spike-sqlite.md` |
| OB-CEO-08 | 并发不超卖测试：两个并发 POST 只一单成功、库存为 0 | `tests/api.test.mjs` 用例 |
| OB-CEO-09 | 登出删除服务端会话行；旧 Cookie 再访问 `/api/auth/me` 返回 401 | `tests/auth.test.mjs` |
| OB-CEO-10 | username 3–32 `[A-Za-z0-9_-]`、password 8–128，稳定错误码 | `docs/contracts.md` + 测试 |
| OB-CEO-11 | 结算前重校验 UX：价格变更/已下架/库存不足三种提示 | §5.6 + fake DOM/qa |
| OB-CEO-12 | 视觉证据可复现：`evidence/visual/<viewport>-<page>.png` + commit + 时间 + 复核人 | 证据文件 |
| OB-CEO-13 | `db reset --yes` + 自动备份 + 服务持锁检测 + 无库指引 | `tests/cli.test.mjs` + 输出 |
| OB-CEO-14 | 无障碍：skip link、键盘全流程、焦点环、错误汇总 | qa 手工记录 + 检查表 |
| OB-DES-01 | 设计词元落 CSS 变量 + `docs/design-tokens.md`，脚本断言 token 存在 | 脚本 + 文件 |
| OB-DES-02 | 商品卡六态：正常/加载/空/错误/售罄/下架 | fake DOM + 截图 |
| OB-DES-03 | 登录/注册/管理面板的提交中、失败、已登录状态 | fake DOM + 截图 |
| OB-DES-04 | <720px 紧凑购物袋条 + 导航横向滚动 | 390 截图 |
| OB-DES-05 | 对比度 ≥ 4.5:1、焦点可见、键盘可达 | 手工检查表 |
| OB-DES-06 | 文案语气：无感叹号、无促销语；错误文案按错误码 | 文案清单 + 静态扫描 |
| OB-DES-07 | 14 张图 alt 由种子数据生成且非空 | `scripts/check-links.mjs` 或专用断言 |
| OB-DES-08 | CC BY 署名在页脚可见并链接台账 | 页面 + 台账 |
| OB-DX-01 | `node cli.mjs dev` 一键启动 + `GET /api/health` + README 60 秒 AC | 命令 + 测试 |
| OB-DX-02 | CLI 命令树冻结（list/unlist/relist 拆分）；help 与文档命令集合一致 | `tests/cli.test.mjs` |
| OB-DX-03 | 全局 `--json`：`{ok:true,data}` / `{ok:false,code,...}`；非交互 | CLI 测试 |
| OB-DX-04 | 退出码 0/1/2/3/4 + stdout 数据 / stderr 诊断 | CLI 测试 |
| OB-DX-05 | `--password-stdin`；`--password` 仅演示并告警 | CLI 测试 + docs |
| OB-DX-06 | CLI 补 `orders show`、`db check`（integrity/foreign_key/user_version） | CLI 测试 |
| OB-DX-07 | `clientOrderId` 幂等：`(user_id, client_order_id)` 唯一；重复返回原订单 | 并发测试 |
| OB-DX-09 | 启动结构化摘要；全响应 `X-Request-Id`；`--log` 访问日志 | 测试/输出 |
| OB-DX-10 | DB/HTTP/CLI 三层命名映射表；CLI flag 对齐 API | `docs/contracts.md` |
| OB-DX-11 | 错误目录唯一真源；API `{ok:false}`、静态层 `problem+json`；测试断言集合一致 | `tests/contracts.test.mjs` |
| OB-DX-12 | `tests/helpers/{db,auth,server}.mjs` 夹具 | 文件 + 测试通过 |
| OB-DX-13 | Windows 细节：`--no-warnings=ExperimentalWarning`、先 close 再删、`pathToFileURL` | README + 测试 |
| OB-ENG-01 | 单写者队列 + `busy_timeout` 250–500ms + 异步退避；文档化单进程假设 | 设计文档 + 持锁测试 |
| OB-ENG-02 | `GET /api/admin/products`（含下架） | API + 测试 |
| OB-ENG-03 | 校验契约：maxItems 10、重复 productId 合并、Content-Type 415、边界 | `docs/contracts.md` + 测试 |
| OB-ENG-04 | Host ∈ {127.0.0.1:4174, localhost:4174}；Origin 精确匹配；Sec-Fetch-Site ∈ {same-origin, none}；缺失矩阵 | 测试 |
| OB-ENG-06 | CSP 以 HTTP 头为唯一来源（meta 仅兼容） | 测试 |
| OB-ENG-07 | scrypt 参数说明与升级路径 | README |
| OB-ENG-08 | 列表默认上限 100 | 测试 |
| OB-ENG-09 | 购物车仅内存、刷新清空，与 R1 一致 | README + 测试 |

## Deferred to TODOS

| # | 项 | 理由 |
|---|---|---|
| T-01 | 订单取消/退款与库存回补 | PRD 未要求；涉及状态机与补偿，留待 R3 |
| T-02 | 管理操作审计表 | PRD 未要求；可用日志替代 |
| T-03 | 会话过期/续期与登录限流 | PRD FR-2 明确不做；风险已在 DECISIONS 记录 |
| T-04 | 分页（超出默认上限后） | 演示规模不触发 |
| T-05 | scrypt 参数升级（`N=32768+`） | 演示级；README 留升级路径 |

## Decision Audit Trail

| # | Phase | Decision | Classification | Principle | Rationale | Rejected |
|---|---|---|---|---|---|---|
| 1 | CEO | 保持全量范围，按 M1–M5 里程碑 | 用户挑战 U1（待批） | P2 爆炸半径内 | 全量是 PRD 要求；里程碑降低阻塞 | 拆 R2a/R2b（待用户裁量） |
| 2 | CEO | 补 Outcome AC 与 demo 脚本 | 机械型 | P1 完整度 | 机制全绿不等于可用 | 只保留机制 AC |
| 3 | CEO | 治理脚本合并为 verify 入口 | 机械型 | P5 最简 | 降低自证成本 | 保留 5 个入口 |
| 4 | CEO | 图片 fallback 到 Wikimedia，失败即停 | 机械型 | P6 前提 | 单点依赖不可接受 | 用占位图冒充 |
| 5 | CEO | 库存取消/回补进 TODOS | 范围 | P3 爆炸半径外 | PRD 未要求 | 本轮实现 |
| 6 | Design | 商品卡六态、Admin 三态 | 机械型 | P1 完整度 | 状态缺失会在 QA 返工 | 只做正常态 |
| 7 | Design | 视觉证据固定路径与复核人 | 机械型 | P1 完整度 | 人工验收也要可追溯 | 口头确认 |
| 8 | DX | `node cli.mjs dev` + `/api/health` | 机械型 | P1 完整度 | TTHW 是可用性前提 | 三步手工启动 |
| 9 | DX | 退出码 5 档 + stdout/stderr 分工 | 机械型 | P1 完整度 | 脚本必须能分支 | 只用 0/1/2 |
| 10 | DX | `clientOrderId` 幂等（supersede D-30） | 机械型 | P6 前提 | 防重复下单 | 不做幂等 |
| 11 | Eng | 单写者队列 + 低 busy_timeout | 机械型 | P6 前提 | 避免同步 DB 卡死服务 | 保持 5s + 同步重试 |
| 12 | Eng | 错误目录唯一真源 | 机械型 | P4 去重 | 三处各写一套会漂移 | 代码内散落常量 |
| 13 | Eng | CSP 以 HTTP 头为唯一来源 | 机械型 | P4 去重 | meta 与头双写必漂移 | 保留双写 |

## Cross-Phase Themes

1. **范围 vs 治理成本**：四个阶段都指向「40 AC + 5 门禁 + 自证」对小 demo 过重；处置是里程碑化 + verify 单一入口 + 保留最关键三门禁。
2. **管理端闭环缺失**：Design 与 Eng 同时发现「下架商品无法在 UI 重新操作」，根因是缺 `GET /api/admin/products`。
3. **契约单源**：错误码、订单响应形状、三层命名三处各自为政；处置是目录 + contracts 单源 + 测试断言。
4. **失败路径不可恢复**：`save-unknown`、`--force`、`SQLITE_BUSY` 三条都没有恢复命令；处置是幂等键、备份、`db check`。
5. **PRD 边界项**（会话过期、限流、CSRF、审计）被反复提出；处置是显式风险接受，不冒充已实现。

## Review Scores

| Phase | Native | Outside | Consensus |
|---|---:|---|---|
| CEO | 6.5/10 | 同族（非跨模型） | N/A |
| Design | 7.0/10 | 同族（首次偏题） | N/A |
| DX | 5.7/10 | 同族 | N/A |
| Eng | 6.5/10 | 同族（首次卡住） | N/A |

## Phase 4: Final Approval Gate

```text
gate_rev=1
status=APPROVED (2026-10-18, project owner: U1=A, U2=A)
decisions_auto=11
user_challenges=2 -> U1=A (全量 + M1–M5 里程碑), U2=A (移除访客查单)
taste_decisions=0 (DV1 已由项目负责人于 2026-10-18 决定)
fail_phases=4 of 4
build_started=no (本记录定稿时)
```

本门禁已于 2026-10-18 获项目负责人批准（**U1=A、U2=A**）。批准后按指示先生成 **SPEC v1.1** 并入修订，再进入 build。门禁只表示「评审后的计划与义务清单被接受」，**不表示任何实现、测试或人工检查已经通过**。

## What Already Exists（复用，不重做）

R1 的领域纯函数（`domain.mjs`）、无 DOM 控制器（`controller.mjs`）、静态服务安全边界（`serve.mjs` 白名单/405/CSP/脱敏 500）、错误目录（`docs/error-catalog.md`）、测试风格（`node:test` + fake DOM）、证据诚实规则。

## NOT in Scope（本轮不做）

PRD 第 7 节全部非目标；会话过期/CSRF/限流（PRD 边界）；订单取消/回补（TODOS）；分页（默认上限之外）；深色模式；多标签页同步；部署/CI。

## Implementation Tasks（聚合，P 级）

- [ ] **P1** `server/db.mjs`：建库、迁移（user_version）、单写者队列、`busy_timeout`（OB-ENG-01/OB-CEO-07）
- [ ] **P1** `server/auth.mjs`：scrypt、会话哈希、登出删除、注册校验（OB-CEO-09/10）
- [ ] **P1** `server/orders.mjs`：事务下单、库存扣减、`clientOrderId` 幂等（OB-DX-07/OB-CEO-08）
- [ ] **P1** `server/router.mjs` + 错误目录单源（OB-DX-11/OB-ENG-04）
- [ ] **P1** `cli.mjs`：dev/init/seed/user/product/orders/db check + `--json` + 退出码（OB-DX-01..06）
- [ ] **P1** `scripts/verify.mjs` + `tests/helpers/`（OB-CEO-06/OB-DX-12）
- [ ] **P1** frontend：API 客户端、登录/我的订单/管理两面板、商品六态（OB-CEO-04/OB-DES-02/03）
- [ ] **P1** 14 张图片 + 台账 + fallback（OB-CEO-05/OB-DES-07/08）
- [ ] **P1** 视觉重写（Apple 词元、断点、无障碍）（OB-DES-01..06/OB-CEO-14）
- [ ] **P2** 可观测性（health/requestId/启动摘要）（OB-DX-09）
- [ ] **P2** 并发与持锁测试、`db check`（OB-CEO-08/OB-DX-06/OB-ENG-01）
- [ ] **P2** R1 行为对照表与 AC-31 改写（OB-CEO-03）
- [ ] **P3** 文档同步与证据（OB-CEO-12/OB-DX-10/OB-DX-13）
