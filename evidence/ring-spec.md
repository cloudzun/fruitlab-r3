# 证据 · spec 环（R3，1/7 环）

> **性质**：真实执行记录。基线 `r3-fruitlab` HEAD `55f2cf0`（`r2-baseline` = `5f4dd87`）。
> **规则**：命令与输出来自真实执行；未执行的写“未执行”；不可用的写 `unavailable`。
> **结果**：`SPEC.md` v1.1 `APPROVED`；R1/R2 未改动。

## 1. 环境与输入

| 项 | 值 |
|---|---|
| 日期 | 2026-10-18 |
| 工作目录 | `D:\vibecoding\easyvibe\r3-fruitlab` |
| 基线 | HEAD `55f2cf0`；R1 `3087a05`、R2 `5f4dd87`，工作树均空 |
| 运行时 | Node `v22.20.0`；npm `10.9.3`；registry `https://registry.npmmirror.com` |
| Docker | Windows Docker Desktop 引擎未运行；WSL Docker `29.9.1` + Compose `v5.6.0` |
| 输入 | `PRD-R3.md`、`HANDOFF.md` 第七节、R2 `SPEC/DECISIONS/BUILD/review/qa-report/docs/*`、R2 补测报告、`evidence/toolchain-recon.md` |

## 2. 真实执行记录

### 2.1 基线测试（R3 当前快照，未改代码）

```powershell
cd D:\vibecoding\easyvibe\r3-fruitlab
node --test
```

原始输出尾部：

```text
1..96
# tests 96
# suites 0
# pass 96
# fail 0
# cancelled 0
# skipped 0
# todo 0
# duration_ms 2511.8211
```

判定：R3 起点仍是 R2 的 96 项全绿；该数字是**基线**，R3 权威计数由 `record-test-count.mjs` 在 build 环重新生成。原始输出保存在 `evidence/baseline-tests.txt`。

### 2.2 环境可行性 spike（Postgres）

```powershell
wsl -e docker run -d --rm --name fruitlab-r3-pg-spike -e POSTGRES_PASSWORD=postgres -e POSTGRES_DB=fruitlab -p 55432:5432 postgres:16-alpine
# Windows TcpClient 127.0.0.1:55432 -> TCP OPEN
# 容器内 pg_isready -> accepting connections
```

结论：Windows Node 可通过 `127.0.0.1:55432` 访问 WSL 发布的 Postgres；测试脚手架可行。镜像 `postgres:16-alpine`、`node:22-alpine`、`caddy:2-alpine` 均已在本地。

### 2.3 R2 代码取证

- `evidence/spec-forensics.md`：32 项 SQLite 耦合点（`file:line` → R3 替代 → 受影响测试）；96 项测试风险分级；11 个缺陷点的精确位置；证据链改进输入。
- 关键事实：`enqueueWrite` 无调用方；`db reset` 直接复制/删库；405 表不完整；认证先于体校验；api-client 定时器在响应头后清除；会话无 `expires_at`。

### 2.4 本环实际写出的文件

| 文件 | 说明 |
|---|---|
| `SPEC.md` | R3 规格 v1.0 → v1.1（并入语义审查 8 项 + codex 10 条 findings） |
| `docs/decision-log.md` | 追加 D-47～D-82（R3 spec 决策） |
| `evidence/spec-forensics.md` | 32 项耦合点与测试结构 |
| `evidence/spec-quality-gate.md` | 门禁记录（语义/脱敏/同族/跨模型） |
| `evidence/codex/*` | 冻结快照 v1.0/v1.1、codex 复核报告、处置台账、原始日志 |
| `evidence/autoplan-voices/r3-*-prompt.txt` | autoplan 四阶段外部声音的提示词（下一环用） |
| `evidence/baseline-tests.txt` | 基线 96 项原始输出 |
| `scripts/check-redaction.mjs` | 本地 fail-closed 脱敏扫描 |
| `evidence/ring-spec.md` | 本文件 |

## 3. 门禁状态与结果

| 门禁 | 状态 | 结果 |
|---|---|---|
| 语义内容审查（人工逐项） | **通过** | 8 项内部问题，全部已修（清单见 `spec-quality-gate.md`） |
| 脱敏扫描（本地 fail-closed） | **通过** | HIGH 0 / MEDIUM 0 / WARN 13（全部回环地址/版本号误报） |
| 同族第二智能体复核（codex） | **通过（经修订）** | v1.0 上 10 条 findings（6 High / 4 Medium），全部采纳并落 v1.1；第二轮增量复核见 `spec-review-round2-codex.md` |
| 跨模型质量门 | **`unavailable`** | 无第二模型家族/provider key；不换模型充数，不冒充跨模型 |
| 项目负责人确认 | **通过（授权代理自审）** | 用户明确授权代理自行完成选型与环审批 |
| 归档 | **本地完成** | 文档与证据同一提交；无 remote，推送/PR `requires-remote` |

## 4. 环境坑（供后续环节）

| # | 坑 | 规避 |
|---:|---|---|
| 1 | codex 复核期间 `SPEC.md` 被本代理继续修订，codex 检测到“非预期改动”后停下提问、不写报告 | 复核前**冻结快照 + SHA-256**，报告注明对象；不要边改边审 |
| 2 | PowerShell 把多行 prompt 拆成多个参数，codex 报 `unexpected argument` | 用 stdin：`Get-Content prompt.txt -Raw \| codex exec ... -` |
| 3 | codex 进程即使成功产出，PowerShell 侧可能报 exit 1 | 以**报告文件 + 原始日志**为准，不用 exit code 单独判定 |
| 4 | 本机 Windows Docker Desktop 未运行，`docker` 命令不可用 | 所有容器/测试命令走 `wsl -e docker ...`，证据写明形态 |
| 5 | `node:sqlite` 基线测试在 Windows 产生 ExperimentalWarning | 记录不隐藏；R3 换 `pg` 后该警告消失（build 环验证） |
| 6 | 本地无 `pg_dump`（Windows） | 备份 A14 走容器内 `pg_dump`（WSL docker exec）；CLI `db backup` 用 SQL 导出，两条路径不互相冒充 |

## 5. 诚实边界

1. 本环**没有**写产品代码、没有启动 R3 服务、没有构建镜像、没有跑真实 PG 测试（只有基线 96 项与 PG 端口 spike）。
2. codex 复核是**同族第二智能体静态复核**，不是跨模型、不是渗透测试；它未运行测试/容器。
3. 跨模型门禁 `unavailable`，没有用同族结果代替；没有用其它模型充数。
4. 门禁通过的是“规格与计划”，不代表 build/review/qa 的任何实现或测试已经通过。
5. 语义审查由执行代理完成（用户授权自审）；发现的 8 项都是真实修订，不含为凑数编造的问题。
