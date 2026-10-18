# FruitLab R3 · 工作区（Postgres 化 + 三层架构 + 可部署）

> **当前状态：PRD 已完成，spec 未开始。目录内代码仍是 R2 `2.0.0.0` 的快照，尚未 Postgres 化。**
> **基线**：从 R2 `5f4dd87` 克隆；R3 内标签 `r2-baseline`（另有继承的 `r1-baseline`）。
> **PRD**：[`PRD-R3.md`](PRD-R3.md)（commit `9042c10`），替代 R3 的 office-hours。
> **目标版本**：`3.0.0.0`；**7 环**：spec → autoplan → build → review → qa → ship → retro。

---

## 1. 三个版本与课堂展示

| 版本 | 目录 | 端口 | 状态 | 启动 |
|---|---|---|---|---|
| **R1**（升级前） | `..\r1-fruitlab` | `4173` | **永久冻结** | `node serve.mjs` |
| **R2**（升级后） | `..\r2-fruitlab` | `4174` | **已冻结**（`5f4dd87`） | `node cli.mjs dev` |
| **R3**（本轮） | 本目录 | `4175` | PRD 完成，未开发 | `docker compose up --build`（M3 后可用） |

**R3 的开发不得影响 R1/R2**：

- R1 一行不改；R2 自 R3 起冻结；R3 只写本目录；
- 端口/数据/容器名严格区分：R3 用 `4175`、Postgres 宿主 `55432`、compose 项目 `fruitlab-r3`、卷 `fruitlab-r3-pgdata`、镜像 `fruitlab-r3:3.0.0.0`；
- 验收会检查 `git -C ..\r1-fruitlab status` 与 `git -C ..\r2-fruitlab status` 为空。

```powershell
# 课堂：三个版本可同时启动（当前 R3 还不能起，M3 后可用）
cd ..\r1-fruitlab; node serve.mjs
cd ..\r2-fruitlab; node cli.mjs dev
cd ..\r3-fruitlab; docker compose up --build
```

> R3 计划提供 `scripts/start-all.mjs`：一次启动三版本，`Ctrl+C` 全停，不修改 R1/R2。

---

## 2. R3 要做什么（详见 PRD）

| # | 目标 | 关键点 |
|---|---|---|
| 1 | **Postgres 化** | PostgreSQL 16；仅 `pg` 一个运行时依赖（R2 仍零依赖） |
| 2 | **应用分层** | L1：router → services → repositories → Postgres + 依赖规则测试；L2：web(Caddy) + api(Node) + db(Postgres) 三容器 |
| 3 | **可部署交付** | Dockerfile + docker compose；非 root、healthcheck、volume 持久化、备份/恢复；先本地容器，云平台为 M5 选修 |
| 4 | **补 R2 漏洞** | codex 6 条 + 官方 cso 4 条 findings；并放开会话过期/限流/CSRF/时序枚举 |
| 5 | **补测复跑** | 完成后重跑 codex `/review` + 官方 `/cso`，findings 关闭/降级 |
| 6 | **版本隔离** | R1/R2 冻结、R3 独立、三版本可并排演示 |

**明确不做**：完整微服务（auth/orders 各自服务+库）、Vercel/Cloudflare 运行时改写、云平台部署（等账号）、CI/CD、水平扩展、R1/R2 修改。

---

## 3. 目录现状

| 路径 | 说明 |
|---|---|
| `PRD-R3.md` | **先读这个**：R3 的需求、隔离约束、验收、里程碑 |
| `SPEC.md` / `DECISIONS.md` / `BUILD.md` / `review.md` / `qa-report.md` / `CHANGELOG.md` / `retro.md` | 继承自 R2，**R2 的历史产物**；R3 各环开始后会更新/新增 |
| `server/`、`assets/`、`serve.mjs`、`cli.mjs`、`tests/` | 继承自 R2 的实现；Postgres/分层改造尚未开始 |
| `docs/`、`evidence/` | R2 的文档与证据（含补测：`evidence/ring-review-codex.md`、`evidence/cso/`） |
| `data/` | R2 的运行期 SQLite 库（gitignore）；R3 将改为 Postgres volume |
| `.gstack/` | 运行期日志（gitignore） |

> ⚠️ 当前 `node cli.mjs dev` 仍会按 R2 的 SQLite 方式运行；这是克隆快照，不是 R3 成品。
> 现在**没有 `package.json`**，也没有 Dockerfile/compose——它们将随 R3 build 产生。

---

## 4. 硬约束（违反即破坏课堂现场）

1. **R1 永久冻结、R2 自 R3 起冻结**；不把 R3 的 `package.json`/`pg`/Dockerfile/Postgres 数据写回 R2。
2. 端口固定：R1 `4173` / R2 `4174` / R3 `4175`；Postgres 宿主 `55432`。
3. R3 的容器名/卷/镜像统一前缀 `fruitlab-r3`，不得与任何其他版本共享数据卷。
4. 依赖口径：R2 = 零依赖；R3 = 仅 `pg`；不要把 R3 的口径写进 R1/R2 文档。
5. 证据链顺序：`node --test` → `record-test-count` → `verify-evidence --write` → `verify.mjs`。
6. 每环边界停下汇报，得到明确许可才进入下一环。

---

## 5. 怎么继续（给下一个会话）

1. 读 [`PRD-R3.md`](PRD-R3.md) 与 [`HANDOFF.md`](../通用AI_Coding课程与教材/HANDOFF.md) 第七节；
2. 从 **spec** 开始：先读 R2 代码取证（SQLite 耦合点、测试结构、findings 位置），产出 R3 的 `SPEC.md`（Postgres schema/迁移、分层接口、compose 拓扑、验收编号、义务追溯）；
3. spec 门禁（语义/脱敏/跨模型）后归档，**停在环边界汇报**；
4. 之后 autoplan → build（M1 Postgres/分层 → M2 安全 → M3 容器）→ review → qa → ship → retro。

**环境前置**：Node 22；Docker（R3 测试需要 Postgres 容器，本机 WSL Docker 已可用）；`postgres:16-alpine` 已拉取。

---

## 6. 相关记录

| 内容 | 位置 |
|---|---|
| R3 PRD | [`PRD-R3.md`](PRD-R3.md) |
| 总交接（当前权威状态） | `../通用AI_Coding课程与教材/HANDOFF.md` 第七节 |
| R2 讲课稿 / 义务核查 / 产物快照 | `C:\Users\cheng\OneDrive - CloudZun Studio\Project\2026 年度项目\20261008 浙江移动AICoding\reference-app\reports\R2-八环讲解记录.md`、`R2-义务与缺口核查.md`、`reports/r2-fruitlab/` |
| R2 补测（codex / cso） | `evidence/ring-review-codex.md`、`evidence/ring-review-cso.md`、`evidence/cso/`（继承自 R2） |
| R2 安全/评审原始记录 | `review.md`、`qa-report.md`、`evidence/ring-*.md` |

---

## 7. 变更记录

| 日期 | 变更 |
|---|---|
| 2026-10-18 | 从 R2 `5f4dd87` 克隆建立 R3 工作区；新增 `PRD-R3.md`（commit `9042c10`）；README 改写为 R3 状态说明 |
