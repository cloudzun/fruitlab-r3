# Spec Quality Gate Record（R3）

Date: 2026-10-18
Ring: 1/7（spec）
Status: **PASS（同族复核通过；跨模型 `unavailable`）**
Spec: `SPEC.md` v1.1（`APPROVED v1.1`）
Spec SHA-256（v1.0 冻结快照）: `de78e754cab77d0dcc7b9084d9028a0b80941527daeb7ab2c9aa4c9e14c3b53b`
Spec SHA-256（v1.1 冻结快照）: `adc8f220b017d2257e20af4f58968c154421fa17b0c873cd93f4efcc463a65e5`

## Pre-Gate Checks

- Semantic review: **通过（人工逐项）**，发现 8 项，全部已修订（见下表）。
- Redaction scan: **通过（本地 fail-closed 等价扫描）**
  - 命令：`node scripts/check-redaction.mjs`
  - 结果：`HIGH 0 / MEDIUM 0 / WARN 13`；13 个 WARN 全部是 `127.0.0.1` 与 `x.y.z.0` 版本号误报，无真实密钥/口令/邮箱。
  - 官方 gstack 脱敏扫描器未安装运行件，**本记录不声称运行过官方扫描器**。
- Final `SPEC.md` re-scan: v1.1 快照哈希 `adc8f220...`；语义审查后无未记录改动（v1.2 仅由 autoplan 门禁按流程生成）。
- Repository visibility: `unknown`（本仓库无 remote，符合 R2/R3 的“本地交付”边界）。

### 语义审查发现与处置

| # | 问题 | 处置 |
|---:|---|---|
| 1 | 计数口径写成“12 项安全/健壮性问题（11 个缺陷点）”，实为 10 条 findings / 11 缺陷点 | 已改为“10 条 findings（11 个缺陷点）”，§4/AC-94 同步 |
| 2 | 登录成功后未下发 CSRF cookie，首次写请求可能 403 | §5.4/§5.5 明确登录成功补发 |
| 3 | 反代后 `remoteAddress` 是容器 IP，限流键失真 | 引入 `TRUST_PROXY` + XFF（后被 codex F-08 进一步改为 Caddy 覆盖） |
| 4 | 非 root api 写 `/app/backups` 不可写 | Dockerfile 预建并 chown |
| 5 | AC-91“96 项语义保留”与换库/404/CSRF/过期冲突 | 限定为“除明确变更项外”，后被 codex F-09 改为逐测试处置表 |
| 6 | 本机 Docker Desktop 未运行，AC-51 的 `docker compose` 需经 WSL | §5.8 写明执行现实与两种命令形态 |
| 7 | 优先级表中“限流”与“凭证失败”顺序含糊 | 明确 11 限流 → 12 凭证失败 |
| 8 | `repositories.orders.createInTx` 模糊了“仓库不做事务”规则 | 改为 `create(client,...)`，事务由 service 控制 |

## Quality Gate Result

### 1. 同族第二智能体复核（codex）

- 复核者：codex 独立子代理，模型 `opencode-go/deepseek-v4.1-flash`（**同族，不是跨模型**）。
- 对象：`evidence/codex/SPEC-snapshot-v1.0.md`（SHA-256 已复核一致）。
- 报告：`evidence/codex/spec-review-codex.md`，**10 条 findings**（F-01..F-10：6 High / 4 Medium）。
- 处置：`evidence/codex/spec-review-disposition.md`，10 条全部 `accepted`/`partially`，并入 SPEC v1.1；新增 AC-97..AC-105。
- 第二轮增量复核：`evidence/codex/spec-review-round2-codex.md`（见 §2）。
- 环境坑（如实记录）：第一次复核期间 `SPEC.md` 正在被修订，codex 按“检测到未预期改动”规则停下提问、未写报告；改为**冻结快照 + SHA-256** 后重跑成功。两次 PowerShell 多行参数传递失败（codex 把换行拆成额外参数），改用 stdin（`codex exec ... -`）成功。

### 2. 第二轮增量复核

> 结果见 `evidence/codex/spec-review-round2-codex.md`；若仍存在 High，spec 环继续修订并再复核，未解决不进入 autoplan。

### 3. 跨模型质量门

**`unavailable`**。理由：

- 本机只有 DeepSeek 家族可用：codex 配置 `opencode-go/deepseek-v4.1-flash`，R2 记录的同族 `claude` 实际模型也是 `deepseek-v4-flash`；没有第二个模型家族/provider key。
- 不换模型充数，不把同族复核写成“跨模型通过”。
- 同族复核结论单独标注为“第二智能体复核”，仅作补充覆盖。

### 4. 项目负责人确认

用户 2026-10-18 明确授权执行代理**自行完成全部选型与环审批**；本环以“代理自审 + 真实产物/门禁记录”替代逐环人工确认，并在最终交付中如实说明。

## Disposition

- `SPEC.md` v1.1 状态 `APPROVED v1.1`；v1.0/v1.1 快照保留在 `evidence/codex/`。
- 进入 autoplan（第 2/7 环）；autoplan 终门按流程可再修订 SPEC（v1.2），届时重新记录哈希。
- 本门禁通过的是“规格与计划”，**不表示 build、测试、容器或人工检查已通过**。
