# 证据 · `/cso` 官方补测（R2，2026-10-18）

> 目标：把 R2 阶段记为 `unavailable` 的官方 `/cso` 真正跑一次，并留下可核对产物。
> **结论**：launcher 在 WSL 重建成功，官方 run 完成、4 条 findings 被 helper 接收；completeness **partial**（有明确未评估域），不称“全量通过”。

## 1. 环境与构建

| 项 | 实测 |
|---|---|
| WSL | Ubuntu（`chengzh`，docker 组，Docker `29.9.1`） |
| bun | 本机原无；`curl -fsSL https://bun.sh/install \| bash` 安装 **1.4.3** |
| gstack 源码 | `/mnt/c/Users/cheng/gstack`（Windows `~/gstack`，版本 `1.91.121.0`） |
| 构建 | `./scripts/build-cso.sh`（`export PATH=$HOME/.bun/bin:$PATH`）→ **exit 0** |
| 产物 | `bin/gstack-cso-launcher`（799 KB）、`gstack-cso-core`（91 MB）、`gstack-cso-watchdog` |
| launcher | `gstack-cso 3.0.0 (helper ABI 3)` |
| doctor | `static-snapshot: ready`、`local-docker-isolation: ready` |

## 2. Run 记录

| run | 结果 |
|---|---|
| `1792288076631-bed124ba0b97ace4` | 首次：schema 校验连续失败（`exclusions`/`gaps` 非数组、helper-owned 域不可提交），**finish 为 partial、无 findings**（记录为失败尝试） |
| **`1792288145456-eef57b00cf6a29bb`** | 修正 submission 后 **submit 成功：4 findings**；finish → `finished / partial`；报告 17,063 字节 |

命令（WSL）：

```bash
cd /mnt/c/Users/cheng/gstack/bin
./gstack-cso-launcher start --repo /mnt/d/vibecoding/easyvibe/r2-fruitlab --code --offline --budget 600
./gstack-cso-launcher inspect  <run>
./gstack-cso-launcher read     <run> server/router.mjs
./gstack-cso-launcher submit   <run> /mnt/c/Users/cheng/AppData/Local/Temp/cso-submission.json
./gstack-cso-launcher finish   <run>
```

## 3. helper 接收的 findings（4 条）

| 严重度 | 标题 | 位置 | 处置建议 |
|---|---|---|---|
| Medium | 登录时序侧信道可枚举用户名 | `server/router.mjs:145` | 缺失用户也跑一次 dummy scrypt，恒时比较 |
| Medium | 无登录限流/锁定 | `server/router.mjs:140` | 限流 + 退避；PRD 边界，R3 处理 |
| Medium | 会话永不过期（除登出不可撤销） | `server/db.mjs:91` | 加 `expires_at`、校验与清理 |
| Low | 他人订单 403 泄露订单号存在性 | `server/router.mjs:189` | 可选改 404；D-32 已记录为教学取舍 |

报告：[`cso-report.md`](cso/cso-report.md)；机读：[`cso/report.json`](cso/report.json)；提交体：[`cso/submission.json`](cso/submission.json)。

## 4. 未评估/缺口（报告原文）

- `history-inputs`：**not assessed**（离线 run，未遍历 Git 历史；另 `bounded Git metadata` 读取失败）。
- `stride`、`data-classification`：**not assessed**。
- `snapshot-inputs`：**partial**（14 张商品图与截图作为二进制被 withheld；`CLAUDE.md` 作为执行配置 excluded；部分文档做了 secret span redaction）。
- scanner profiles：离线不可用（`--offline`），因此没有 gitleaks/osv/semgrep 等扫描器结果。
- 所有 finding 的 `reproduction` / `repair` 均为 `not_attempted`，`closure: open` —— **这是静态评估，不是运行时验证**。

## 5. 诚实边界

- 「官方 launcher 跑通」= 快照、脱敏、findings 提交、报告落盘都真实发生；**不等于**全量安全通过。
- findings 由本 agent 做静态分析后提交，模型与 R2 实现同族；不是跨模型结论。
- 首次 run 的 schema 失败如实保留为失败尝试，未删除记录。
- 这些 finding 的修复属于 R3 范围（时序枚举可先修；限流/过期是 PRD 明确边界）。
