# FruitLab R3 `/autoplan` Decision Record

Run: `r3-20261018-1100`
Date: 2026-10-18
Ring: 2 / 7 (`/autoplan`)
Status: **FINAL APPROVAL GATE `gate_rev=1` — APPROVED（代理自审；用户已授权执行代理自行完成全部选型与环审批）。build 尚未开始。**

## Hard Constraints

- 评审输入：`SPEC.md` v1.2（624 行，SHA-256 `81761E4E15E4C3622E657F6FD994F2C9C49F1EE5E10CEFFD63419E60E99C4462`）；v1.0/v1.1 冻结快照保留在 `evidence/codex/`，用于追溯。
- 四路外部声音由 **codex 独立子代理**提供（`opencode-go/deepseek-v4.1-flash`），与本地**同族，不构成跨模型**；跨模型共识记 `N/A（覆盖缺失）`，不冒充。
- 执行方式：CEO+ENG 一批、DES+DX 一批并行执行；每阶段只采纳一轮评审，**未把失败评审退回重审**。全部报告落 `evidence/autoplan-voices/r3-*.md`。
- 评审对象是冻结的 v1.0 快照（`de78e754...b53b`）；评审期间 `SPEC.md` 被本代理修订，因此各报告首行均注明对象哈希。v1.1 第二轮同族复核（`N-01..N-07`）作为补充输入。
- 原始发现合计 **42 条**（CEO 7 + DES 6 + DX 9 + ENG 13 + 第二轮 N 7）；去重合并后转为 **42 条义务**（见 Accepted Obligations）。
- 四阶段全部 FAIL（6.0 / 6.0 / 5.0 / 7.0）；**接受的修复不把 FAIL 转成 PASS**。本记录只批准「评审后的计划与义务清单」，**不表示任何实现、测试、容器或人工检查已通过**。

## Phase Summary

| Phase | Result | Native findings | Outside voice | Consensus |
|---|---|---|---|---|
| CEO | **6.0/10, FAIL / issues_open** | 1 Critical, 3 High, 3 Medium | codex 同族（非跨模型） | N/A（覆盖缺失） |
| Design | **6.0/10, FAIL / issues_open** | 3 High, 3 Medium | codex 同族（非跨模型） | N/A（覆盖缺失） |
| DX | **5.0/10, FAIL / issues_open** | 1 Critical, 3 High, 4 Medium, 1 Low | codex 同族（非跨模型） | N/A（覆盖缺失） |
| Eng | **7.0/10, FAIL / issues_open** | 2 High, 7 Medium, 4 Low | codex 同族（非跨模型） | N/A（覆盖缺失） |
| Spec v1.1 二轮 | **需修订** | 2 High, 4 Medium, 1 Low（N-01..N-07） | codex 同族（非跨模型） | N/A（覆盖缺失） |

## Phase 1: CEO（战略与范围）

Native result: **6.0/10, FAIL**。核心判断：方向正确（Postgres/L1L2/compose 对应三门课），但范围与工时不自洽、缺用户结果型验收、三版本叙事被“R2 内存库”破坏。

| ID | 严重度 | 发现 | 处置 | OB |
|---|---|---|---|---|
| CEO-01 | Critical | 20–30h 工时与 57 AC、96 测试迁移、3 容器不匹配；应按 35–45h 并给里程碑停止线 | **接受**：SPEC §10/§16 改 35–45h，M1–M3 各给上限与停止线 | OB-R3-CEO-01 |
| CEO-02 | High | AC 全是机制型，缺用户旅程/管理变更/DB down/备份恢复结果型验收 | **接受**：新增 AC-106..AC-109 | OB-R3-CEO-02 |
| CEO-03 | High | `start-all` 用 R2 内存库会抹掉“SQLite 文件持久化”这一幕 | **接受**：改仓库外临时 SQLite 文件，重启数据仍在；AC-111 | OB-R3-CEO-03 |
| CEO-04 | High | 缺“课程目标→课堂结果→AC/证据”矩阵与三幕 demo | **接受**：SPEC §4 矩阵 + `evidence/demo-script.md` 5–8 分钟；AC-110 | OB-R3-CEO-04 |
| CEO-05 | Medium | 建议砍 CSRF/simple/双备份/N+1 以省课时 | **部分拒绝**：CSRF/simple/N+1 是 PRD 硬约束，保留；`compose.debug.yml` 降为可选 | OB-R3-CEO-05 |
| CEO-06 | Medium | 课堂默认路径绑死 WSL/`/mnt/d`，换机器失效 | **接受**：`start-all` 探测原生 Docker/WSL；README 双预检 | OB-R3-CEO-06 |
| CEO-07 | Medium | 克隆保留大量 R2 旧口径（4174/--db/SQLite/零依赖），污染课堂 | **接受**：`scripts/check-docs-stale.mjs` + AC-114 | OB-R3-CEO-07 |

## Phase 2: Design（部署/演示体验，不重审视觉方向）

Native result: **6.0/10, FAIL**。R3 明确沿用 R2 Apple 版式，不再开视觉评审；问题在部署体验与回归门禁。

| ID | 严重度 | 发现 | 处置 | OB |
|---|---|---|---|---|
| R3-DES-01 | High | 无经 Caddy/4175 的真实购买闭环，CSRF 跨三层失效仍可能全绿 | **接受**：AC-106 真实 Chromium E2E | OB-R3-DES-01 |
| R3-DES-02 | Medium | CSRF 失败无可恢复路径（仅 health bootstrap） | **接受**：`ensureCsrfToken()` + 403 重试一次 + 具体文案；AC-116 | OB-R3-DES-02 |
| R3-DES-03 | Medium | 新错误码无中文文案/恢复；health 503 不统一信封 | **接受**：error-catalog 补三码；health 503 统一 `{ok:false,...}` | OB-R3-DES-03 |
| R3-DES-04 | High | README 仍写“spec 未开始”，demo-script 仍是 R2 4174 | **接受**：README 重写 + demo 三幕；AC-110 | OB-R3-DES-04 |
| R3-DES-05 | High | 启动失败不可诊断；web 无 healthcheck；HOST/PUBLIC_URL 未锁 | **接受**：启动错误模板 + 四类排障 + web `/healthz`；AC-115 | OB-R3-DES-05 |
| R3-DES-06 | Medium | R2 移动端/键盘/焦点/aria 回归无门禁 | **接受**：R2 UI 回归矩阵 + AC-112 | OB-R3-DES-06 |

## Phase 2.5: DX（开发者体验）

Native result: **5.0/10, FAIL**。核心判断：没有“干净 checkout → 可运行”的路径，备份恢复与前置检查不闭环。

| ID | 严重度 | 发现 | 处置 | OB |
|---|---|---|---|---|
| DX-01 | Critical | 缺 clean-room quickstart（`.env`、引擎预检、预期 health） | **接受**：`scripts/preflight.mjs` + README 60 秒 + AC-113 | OB-R3-DX-01 |
| DX-02 | High | 包版本 4 段非法 SemVer | **接受**：`VERSION=3.0.0.0` / 包 `3.0.0`；engines/packageManager；AC-55/101 | OB-R3-DX-02 |
| DX-03 | High | 备份/恢复不闭环（无 restore、容器 backups 不持久、硬编码身份） | **接受**：CLI `db restore --in --yes`；compose 挂 `./backups`；pg_dump 为生产路径 | OB-R3-DX-03 |
| DX-04 | High | `HOST/PUBLIC_URL` 未冻结，Caddy/healthcheck 可能不可达 | **接受**：`HOST=0.0.0.0` + Public URL 派生；AC-99 | OB-R3-DX-04 |
| DX-05 | Medium | 测试 PG 无 readiness/清理/双引擎写法 | **接受**：`scripts/pgctl.mjs up/status/down`；AC-118 | OB-R3-DX-05 |
| DX-06 | Medium | CLI 伪语法、无完整命令矩阵/JSON 信封 | **接受**：`docs/cli.md` 矩阵 + help/文档/解析器一致性测试 | OB-R3-DX-06 |
| DX-07 | Medium | `verify` 无 preflight/分层模式 | **接受**：`verify --quick/--full` + preflight 输出；AC-113 | OB-R3-DX-07 |
| DX-08 | Medium | 路径硬编码、无 PowerShell 包装 | **接受**：相对路径 + `wslpath` + `backup.ps1/restore.ps1` | OB-R3-DX-08 |
| DX-09 | Low | 版本/镜像可漂移、npm registry 未说明 | **接受**：engines/packageManager、镜像 digest、lockfile 说明 | OB-R3-DX-09 |

## Phase 3: Eng（工程可实施性）

Native result: **7.0/10, FAIL**。核心判断：方向可实施，但 reset 事务组合、锁顺序、scrypt 阻塞、恢复流程与测试连接预算有真实缺口。

| ID | 严重度 | 发现 | 处置 | OB |
|---|---|---|---|---|
| E-01 | High | 冻结 v1.0 未并入 D-72..D-82，实现者会读到互斥口径 | **接受**：v1.2 全量并入并重冻快照；build 只认 v1.2 | OB-R3-ENG-13 |
| E-02 | High | `migrate(pool)` 自开事务，`db reset` 无法同事务 drop/migrate/seed；缺 client 级 seed | **接受**：`migrate(client)`/`seed(client,{mode})`/`resetDatabase(client,deps)`；同一事务；三路失败测试 | OB-R3-ENG-01 |
| E-03 | Medium | 按请求顺序扣库存，反向购物车会死锁 | **接受**：事务前按 productId 排序；反向购物车测试 | OB-R3-ENG-02 |
| E-04 | Medium | `scryptSync` 阻塞事件循环，可被多键并发拖慢 | **接受**：异步 `crypto.scrypt` + 信号量 4 + 队列上限 100；限流前置 | OB-R3-ENG-03 |
| E-05 | Medium | web 无 healthcheck | **接受**：Caddy `/healthz` + compose healthcheck | OB-R3-ENG-04 |
| E-06 | Medium | 恢复未停写、未 single-transaction | **接受**：停 api → 断连 → `pg_restore --single-transaction --exit-on-error` → 校验 → 启 api | OB-R3-ENG-05 |
| E-07 | Medium | CLI JSON 备份无 restore，无法往返 | **接受**：`db restore` + 往返测试；容器 backups 卷 | OB-R3-ENG-06 |
| E-08 | Medium | 每用例建库 + 默认并发会撞 `max_connections`/耗时 | **接受**：测试池 max=2、`--test-concurrency=4`、清理残留、120s 预算 | OB-R3-ENG-07 |
| E-09 | Medium | 仅 username+IP，可被账号喷洒 | **接受**：两桶（账号 5/15min、IP 50/15min） | OB-R3-ENG-08 |
| E-10 | Low | CSRF token 不轮换、Secure 未跟随 | **接受**：登录/轮换重发 token、Secure 跟随、登出清两 Cookie | OB-R3-ENG-09 |
| E-11 | Low | 全局 int8→Number 有精度风险 | **接受**：显式安全解析，ID 不暴露 | OB-R3-ENG-10 |
| E-12 | Low | 迁移无 advisory lock/checksum | **接受**：`pg_advisory_xact_lock` + checksum + 并发测试 | OB-R3-ENG-11 |
| E-13 | Low | 405/尾斜杠/编码路径无规范化 | **接受**：规范化规则 + `400 invalid-path` + 表驱动 | OB-R3-ENG-12 |

## 补充：v1.1 二轮同族复核（N-01..N-07）

| ID | 严重度 | 发现 | 处置 | OB |
|---|---|---|---|---|
| N-01 | High | DB 身份变量与 compose 写死值冲突 | **接受**：全变量化；非默认值实测 | OB-R3-SPEC-01 |
| N-02 | High | production/classroom 的 seed 与口令规则三套互斥 | **接受**：`seedClassroom` vs `seedProductionAdmin`；D-67 superseded | OB-R3-SPEC-02 |
| N-03 | Medium | health ≤5s 无实现路径 | **接受**：`healthTimeoutMs=3000` + Promise.race；池参数映射 | OB-R3-SPEC-03 |
| N-04 | Medium | AC-91 白名单缺 D-47/62/79/82 | **接受**：补齐并逐测试处置 | OB-R3-SPEC-04 |
| N-05 | Medium | XFF 决策源冲突（D-71 旧口径） | **接受**：D-71 superseded by D-82；compose TRUST_PROXY=1 | OB-R3-SPEC-05 |
| N-06 | Medium | AC-105 DB CHECK 超出 schema | **接受**：username/价格/库存上限 CHECK；password 只 service | OB-R3-SPEC-06 |
| N-07 | Low | 状态/D 范围/F-09 映射陈旧 | **接受**：头 v1.2、D-47..D-108、F-09→AC-91 | OB-R3-SPEC-07 |

## Accepted Obligations（进入 build 的义务清单，42 条）

> 判定只允许 `closed` / `downgraded`（附理由）/ `not-covered`（附理由）。每条必须落到 `BUILD.md` 验收表与 `docs/obligations.md`。

| 编号 | 义务 | 完成判据（机械可查） |
|---|---|---|
| OB-R3-CEO-01 | 工时重估 35–45h；M1/M2/M3 各有上限与停止线 | SPEC §10/§16 + BUILD.md 里程碑表 |
| OB-R3-CEO-02 | 结果型 AC-106..109（旅程/管理变更/DB down/备份恢复） | AC 表 + qa 证据 |
| OB-R3-CEO-03 | R2 用仓库外临时 SQLite 文件启动，重启仍在 | `start-all.mjs` + AC-111 |
| OB-R3-CEO-04 | 课程目标矩阵 + 5–8 分钟三幕 demo 脚本 | SPEC §4.1 + `evidence/demo-script.md` |
| OB-R3-CEO-05 | 范围裁剪建议的拒绝/降级留痕 | SPEC §16.3 + DECISIONS |
| OB-R3-CEO-06 | `start-all` 探测原生 Docker/WSL；README 双预检 | 脚本 + README + qa |
| OB-R3-CEO-07 | `check-docs-stale.mjs`：R3 学员文档无旧口径 | 脚本 + AC-114 |
| OB-R3-DES-01 | 4175 经 Caddy 的真实 Chromium 购买闭环 | AC-106 + 截图/日志 |
| OB-R3-DES-02 | CSRF 客户端 `ensureCsrfToken` + 403 重试一次 + 文案 | 客户端测试 + AC-116 |
| OB-R3-DES-03 | 三个新错误码文案/恢复；health 503 统一信封 | error-catalog + 前端映射测试 |
| OB-R3-DES-04 | README 重写 + demo 三幕脚本 | README + AC-110 |
| OB-R3-DES-05 | 启动错误模板 + 四类排障 + web healthcheck | README + AC-115 |
| OB-R3-DES-06 | R2 UI 回归矩阵（三档/键盘/焦点/aria） | qa 记录 + AC-112 |
| OB-R3-DX-01 | clean-room quickstart + `preflight.mjs` | README + AC-113 |
| OB-R3-DX-02 | `VERSION`/包版本分离 + engines/packageManager | 版本校验测试 |
| OB-R3-DX-03 | CLI `db restore` + 容器 backups 卷 + 往返 | CLI 测试 + AC-109 |
| OB-R3-DX-04 | `HOST=0.0.0.0` + `PUBLIC_URL` 派生 + 三层探活 | compose + 容器测试 |
| OB-R3-DX-05 | `pgctl.mjs up/status/down` readiness/清理 | 脚本 + README + AC-118 |
| OB-R3-DX-06 | `docs/cli.md` 命令矩阵 + help 一致测试 | 文档 + 表驱动测试 |
| OB-R3-DX-07 | `verify --quick/--full` + preflight | 脚本输出 + AC-113 |
| OB-R3-DX-08 | 路径可移植 + PowerShell backup/restore 包装 | 脚本 + README |
| OB-R3-DX-09 | 镜像 digest 记录 + lockfile/registry 说明 | `docs/deploy.md` + evidence |
| OB-R3-ENG-01 | client 级 migrate/seed/reset + 同事务 + 三路失败测试 | db/CLI 测试 |
| OB-R3-ENG-02 | 商品排序后扣库存 + 反向购物车测试 | 并发测试 |
| OB-R3-ENG-03 | 异步 scrypt + 信号量/队列 + 限流前置 | auth 测试 + 延迟证据 |
| OB-R3-ENG-04 | Caddy `/healthz` + web healthcheck | compose + 容器证据 |
| OB-R3-ENG-05 | restore 停写/断连/单事务/校验/重启 | restore 脚本 + AC-109 |
| OB-R3-ENG-06 | CLI JSON 备份/恢复契约与 pg_dump 双轨 | CLI 测试 + deploy 文档 |
| OB-R3-ENG-07 | 测试池/并发/清理/预算 | helper + AC-118 |
| OB-R3-ENG-08 | 两桶限流 + 喷洒测试 | auth 测试 |
| OB-R3-ENG-09 | CSRF 轮换/Secure/登出清理 | auth/API 测试 |
| OB-R3-ENG-10 | int8 安全解析/ID 不暴露 | contracts + 测试 |
| OB-R3-ENG-11 | 迁移 advisory lock + checksum + 并发测试 | db 测试 |
| OB-R3-ENG-12 | 路径规范化 + `400 invalid-path` + 405 表 | API 表驱动测试 |
| OB-R3-ENG-13 | v1.2 快照重冻；build 只认 v1.2 哈希 | 快照 + DECISIONS 哈希 |
| OB-R3-SPEC-01 | compose/DSN/health/备份全变量化 | compose + 非默认值实测 |
| OB-R3-SPEC-02 | `seedClassroom`/`seedProductionAdmin` 拆分 | CLI/seed 测试 + AC-57/82 |
| OB-R3-SPEC-03 | health 3s 时限 + 池参数映射 | 故障注入测试 |
| OB-R3-SPEC-04 | AC-91 白名单补 D-47/62/79/82 | BUILD 逐测试处置表 |
| OB-R3-SPEC-05 | D-82 唯一 XFF 决策；compose TRUST_PROXY | SPEC/DECISIONS + 测试 |
| OB-R3-SPEC-06 | username/价格/库存上限 CHECK；password 只 service | schema 断言 + API 测试 |
| OB-R3-SPEC-07 | 状态 v1.2、D 范围、F-09→AC-91 | SPEC/decision-log |

## Deferred / TODOS（不默认全做）

| # | 项 | 理由 |
|---|---|---|
| T-01 | 订单取消/退款与库存回补 | PRD 未要求，涉及状态机与补偿 |
| T-02 | 管理操作审计表 | PRD 未要求 |
| T-04 | 分页（超默认上限） | 演示规模不触发 |
| T-05 | scrypt 参数升级（N=32768+） | 演示级；README 留升级路径 |
| T-06 | 云平台部署（Fly/VPS/Neon） | M5 选修，需账号 |

## Phase 4: Final Approval Gate

```text
gate_rev=1
status=APPROVED (2026-10-18, 用户授权执行代理自审)
spec=v1.2 sha256=81761E4E15E4C3622E657F6FD994F2C9C49F1EE5E10CEFFD63419E60E99C4462
phases=4 of 4 FAIL (6.0/6.0/5.0/7.0) -> 接受修复不转 PASS
findings=42 -> obligations=42
cross_model=N/A (同族 codex；无第二模型家族)
build_started=no (本记录定稿时)
```

本门禁批准「评审后的计划与义务清单」；**不表示 build、测试、容器或人工检查已经通过**。

## What Already Exists（复用，不重做）

R1/R2 的领域纯函数、控制器、静态安全边界、错误目录、视觉词元、14 张图与授权台账、证据诚实规则；R3 只做数据/分层/部署/安全补漏。

## NOT in Scope（本轮不做）

PRD §6 全部非目标；完整微服务/L3/L4、云平台部署、Vercel/CF 改写、CI/CD、水平扩展、多租户、支付/物流/退款、审计日志、密码找回/改密、深色模式、分页、R1/R2 任何修改。

## Implementation Tasks（P 级）

- [ ] **P1** `package.json`（pg 8.23.1）+ migrations + `db.mjs`（pool/migrate/seed/reset/advisory lock）
- [ ] **P1** repositories（users/sessions/products/orders）+ services（auth/catalog/orders/health）+ `app.mjs` 组合根
- [ ] **P1** router（405 表/优先级/CSRF/Host/安全 decode）+ serve.mjs（HOST/PUBLIC_URL/graceful）
- [ ] **P1** 真实 PG 测试基础设施 + 96 项迁移 + 新增并发/安全/优先级/限流/CSRF/过期
- [ ] **P1** CLI（dev/db migrate|seed|check|backup|restore|reset/user/product/orders + 退出码/JSON）
- [ ] **P1** Dockerfile ×2 + compose 三容器 + Caddy + 非 root/healthcheck/volume/backups
- [ ] **P1** 备份/恢复脚本（pg_dump/pg_restore + CLI JSON 往返）
- [ ] **P2** README/demo-script/architecture/deploy/backup-restore/error-catalog/contracts
- [ ] **P2** 文档口径扫描、quickstart/preflight、verify 分层
- [ ] **P3** 证据（ring-build、容器、codex、cso、qa、visual）与 manifest
