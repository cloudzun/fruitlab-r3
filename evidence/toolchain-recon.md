# 工具链勘察：codex / gstack / cso（2026-10-18）

> 目的：纠正「codex 未安装 / cso 完全没跑过」的错误结论，记录真实可用的路径与缺口，供补测与 R3 使用。
> 全部为实测命令结果。

## 1. codex 是安装好的（不在 PATH）

| 项 | 实测 |
|---|---|
| 可执行文件 | `C:\Users\cheng\AppData\Local\OpenAI\Codex\bin\9614f1d9b40d9c4f\codex.exe` |
| 版本 | `codex-cli 0.162.0-alpha.17.2` |
| 配置 | `~/.codex/config.toml`：`model=opencode-go/deepseek-v4.1-flash`、local `base_url=http://127.0.0.1:3425/...`、`model_reasoning_effort=max` |
| 认证 | `~/.codex/auth.json` 存在 |
| 最小调用 | `codex exec -c model=... -c model_reasoning_effort=medium --sandbox danger-full-access -C <repo> "只回复：OK"` → **exit 0，输出 `OK`** |
| R1/R2 调用方式 | `.gstack/run-*.sh` 用**绝对路径**调 `codex.exe exec -c model="opencode-go/deepseek-v4.1-flash" --sandbox danger-full-access -C <sandbox> "$PROMPT"` |

**结论**：codex 可用，只是不在 PATH；`Get-Command codex` 查不到不代表未安装。

## 2. gstack 运行时是活的

| 项 | 实测 |
|---|---|
| 安装 | codex host, global, `1.91.121.0`，`~/.codex/skills`（source `~/gstack`） |
| 运行时 | Git Bash 下 `gstack-skill-start --skill review` → `SKILL_START_PROTO: 1`、`BRANCH: main` |
| bun | `C:\Users\cheng\.bun\bin\bun.exe`，版本 `1.3.9` |
| Git Bash | `C:\Program Files\Git\bin\bash.exe` 存在 |
| codex 执行能力 | 让 codex 用 Git Bash 跑 gstack preamble → **成功返回 `SKILL_START_PROTO: 1` 等原始输出** |

**结论**：codex 作为子 agent 跑 gstack skill 的链路（codex → Git Bash → gstack）**可用**，与 R1 相同。

## 3. `/cso` 的真实状态

| 项 | 实测 |
|---|---|
| cso skill | `~/.codex/skills/gstack-cso/SKILL.md` 存在 |
| cso launcher | **不存在**：`~/.codex/skills/gstack/bin` 无 `gstack-cso-*`；`~/gstack/bin` 也无；无 `.gstack-cso-build-result` |
| 构建脚本 | `~/gstack/scripts/build-cso.sh`（Linux/macOS）与 `build-cso-windows.ps1`（Windows）存在 |
| Windows 构建前置 | `pwsh` 7 **缺失**、VS2022/MSVC **未找到** → Windows 构建不可行 |
| WSL 构建前置 | Ubuntu：`cc/gcc` 有、Docker `29.9.1` 有、`bun` **缺失**；`~/gstack` 通过 `/mnt/c` 可见 |
| R1 的 cso 记录 | `ring5-cso安全审计-实跑记录.md`：WSL 里 launcher **能启动**，但返回 `status=not_assessed`（“launcher 是协调器、不是扫描器”）；随后**手工植入并复现 IDOR**、修复 200→403；HANDOFF 仍列「`/cso` 完整流程未跑完」 |

**结论**：
- 「cso 测试跑通过」在**机制勘察**意义上成立（launcher 启动 + 手工 IDOR 复现），但**不是**官方完整 cso（launcher 自动评估）通过。
- 当前 Windows 侧无 launcher；要跑官方 cso，需要**在 WSL 重建 launcher**（先装 bun，再 `build-cso.sh`），或安装 pwsh7+MSVC 走 Windows 构建。
- 即使 launcher 可用，`not_assessed` 的含义是「评估未提交」——**发现仍由 agent 做，launcher 负责执行/持久化/证据标签**。

## 4. gstack 对 codex 的识别

`./setup --status` 显示：`Codex: not installed (codex_reviews=enabled; outside reviews in /review, /ship, /autoplan and /codex need it)`。
原因同样是 codex 不在 PATH；把 `...\OpenAI\Codex\bin\<hash>` 加入 PATH 后，gstack 的「外部 Codex 声音」才能工作（模型仍为同族 deepseek-v4.1-flash）。

## 5. 补测可行路径（待用户选择）

| 方案 | 内容 | 前置 | 产出 |
|---|---|---|---|
| A | codex 子 agent 跑 `/review`（或 cso 风格静态审计，只读、只写报告） | codex + gstack 已就绪；路径加 PATH | 第二智能体复核报告（同族，标明） |
| B | WSL 重建 cso launcher，跑官方 `/cso` 静态评估 + 提交结论 | WSL 装 bun → `build-cso.sh` → 按 SKILL 流程 start/read/submit/finish | 官方 cso 记录（含 `not_assessed`/findings） |
| C | 真·跨模型 | 另配 provider key（OpenAI/Anthropic 等） | 跨模型共识，补 4.5c |
