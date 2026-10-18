# 证据 · autoplan 环（R3，2/7 环）

> **性质**：真实执行记录。评审对象为冻结的 `SPEC.md` v1.0 快照（`de78e754...b53b`）；评审后并入 v1.2。
> **结果**：四阶段均 FAIL，42 条发现 → 42 条 `OB-R3-*`；终门自审通过。build 尚未开始。

## 1. 输入与冻结

| 项 | 值 |
|---|---|
| SPEC v1.0 快照 | `evidence/codex/SPEC-snapshot-v1.0.md`，SHA-256 `de78e754cab77d0dcc7b9084d9028a0b80941527daeb7ab2c9aa4c9e14c3b53b` |
| SPEC v1.1 快照 | `evidence/codex/SPEC-snapshot-v1.1.md`，SHA-256 `adc8f220b017d2257e20af4f58968c154421fa17b0c873cd93f4efcc463a65e5` |
| SPEC v1.2（生效） | `SPEC.md`，624 行，SHA-256 `81761e4e15e4c3622e657f6fd994f2c9c49f1ee5e10ceffd63419e60e99c4462` |
| 外部声音 | codex 子代理（`opencode-go/deepseek-v4.1-flash`）——**同族，不是跨模型** |
| 执行方式 | CEO+ENG 一批，DES+DX 一批（并行）；每阶段一轮，不退回重审 |
| 报告 | `evidence/autoplan-voices/r3-ceo.md`、`r3-des.md`、`r3-dx.md`、`r3-eng.md` |
| 补充输入 | `evidence/codex/spec-review-round2-codex.md`（N-01..N-07） |

## 2. 四阶段结果

| 阶段 | 评分 | 发现数 | 关键结论 |
|---|---:|---:|---|
| CEO | 6.0 / FAIL | 7 | 工时 20–30h 偏低；缺结果型 AC/demo；R2 内存库抹掉 SQLite 持久化教学对照 |
| Design | 6.0 / FAIL | 6 | 缺 4175 经 Caddy 的真实购买闭环；CSRF 无恢复；新错误码无文案；README/demo 仍旧；web 无 healthcheck；R2 UI 回归无门禁 |
| DX | 5.0 / FAIL | 9 | 缺 clean-room quickstart；包版本非法 SemVer；备份恢复不闭环；HOST/PUBLIC_URL 未冻结；测试 PG 无 lifecycle；CLI 无矩阵；verify 无 preflight；路径不可移植；镜像可漂移 |
| Eng | 7.0 / FAIL | 13 | v1.0 未并入已接受决策；migrate/seed/reset 事务组合；锁顺序；同步 scrypt 阻塞；web healthcheck；restore 未停写；备份无 restore；测试连接预算；限流可喷洒；CSRF 不轮换；int8 精度；迁移无锁；路径未规范化 |
| Spec v1.1 二轮 | 需修订 | 7 | DB 身份冲突（N-01 High）、production/classroom seed 冲突（N-02 High）等 |

## 3. 处置与义务

- 42 条发现逐条处置见 `DECISIONS.md`（每阶段 findings 表 + Accepted Obligations 42 条）。
- 接受/部分接受/拒绝：**接受 41 条**；`CEO-05` 部分拒绝（CSRF/simple/N+1 为 PRD 硬约束，`compose.debug.yml` 降为可选）；无静默忽略。
- SPEC v1.2 新增 §4.1 课程目标矩阵、§16 autoplan 修订并入（36 项关键修订）、AC-106..AC-118；`VERSION`/包版本、seed 模式、DB 身份、health 时限、迁移事务、锁顺序、异步 scrypt、restore 流程、备份契约、两桶限流、CSRF 轮换、int8、advisory lock、路径规范化全部落到条款。
- 终门：`gate_rev=1`、`APPROVED`（用户授权执行代理自审）；`build_started=no`。

## 4. 真实命令与原始输出

codex 调用（stdin 形式，避免 PowerShell 多行参数被拆）：

```powershell
$codex = "C:\Users\cheng\AppData\Local\OpenAI\Codex\bin\9614f1d9b40d9c4f\codex.exe"
Get-Content evidence/autoplan-voices/r3-ceo-prompt.txt -Raw | & $codex exec -c model="opencode-go/deepseek-v4.1-flash" -c model_reasoning_effort="medium" --sandbox danger-full-access -C "D:\vibecoding\easyvibe\r3-fruitlab" -
```

- 每份报告首行均由 codex 自行标注“同族第二智能体，非跨模型”与对象 SHA-256。
- 原始日志：`evidence/autoplan-voices/r3-<phase>.log`（大文件，保留未删）。
- 环境坑：PowerShell 多行 prompt 会被拆成多个参数（`unexpected argument`），改用 stdin `-`；codex 成功产出时 PowerShell 侧仍可能 exit 1，以报告文件为准。

## 5. 门禁与诚实边界

| 项 | 状态 |
|---|---|
| 四阶段评审 | **完成（4/4 FAIL）**，未把 FAIL 转 PASS |
| 终门 | **APPROVED（代理自审，用户授权）** |
| 跨模型共识 | **N/A（覆盖缺失）**——只有 DeepSeek 同族，不冒充 |
| build 启动 | **未启动**（本环结束时） |

1. 四份报告是**同族第二智能体静态评审**，未运行测试/容器/浏览器；不证明任何运行时行为。
2. 评分是评审者主观判断，不代表产品价值；FAIL 是“计划需修订”，不是“方向错误”。
3. 42 条义务的最终判定在 build/review/qa/ship 环完成，本环不预判通过。
4. 用户已授权代理自行完成环审批；该授权不降低证据标准，“未测”仍写 `UNVERIFIED`。
