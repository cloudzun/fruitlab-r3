# 证据 · spec 环（R2）

> **性质**：R2 第一环（spec）的实跑证据。**记录时点：Phase 4 草稿产出后、Phase 4.5 门禁前。**
> **规则**：命令与输出必须来自真实执行；未执行的步骤写「未执行」；不可用的能力写「不可用」。

## 1. 环境与输入

| 项 | 值 |
|---|---|
| 日期 | 2026-10-18 |
| 工作目录（R2） | `D:\vibecoding\easyvibe\r2-fruitlab` |
| R1 冻结目录 | `D:\vibecoding\easyvibe\r1-fruitlab`（本环未写入） |
| 基线 commit | `c1167e0`（标签 `r1-baseline`，本环创建） |
| 运行时 | `node --version` → `v22.20.0` |
| 输入 | `PRD-R2.md`、R1 八环产物、`R1-义务覆盖率核查.md`、`R1-八环讲解记录.md`、`R1-操作经验教训.md`、`HANDOFF.md` 第五节与第六节 |

## 2. 真实执行记录

### 2.1 基线测试

```powershell
cd D:\vibecoding\easyvibe\r2-fruitlab
node --test
```

原始输出（节选尾部）：

```text
1..62
# tests 62
# suites 0
# pass 61
# fail 0
# cancelled 0
# skipped 1
# todo 0
# duration_ms 417.1049
```

判定：R1 基线 **62 项（61 通过 / 1 平台跳过 / 0 失败）**。此数字仅作为 R1 基线，**不是 R2 的权威计数**；R2 权威计数由 `scripts/record-test-count.mjs` 在 build 环生成。

### 2.2 `node:sqlite` 可用性探测

```powershell
node -e "const s=require('node:sqlite'); console.log('require ok', Object.keys(s).join(','))"
```

```text
require ok DatabaseSync,StatementSync,constants,backup
```

文件库往返（ESM 脚本，临时目录）：

```text
reopened rows: [{"x":7}]
file bytes: 8192
[stderr] (node:...) ExperimentalWarning: SQLite is an experimental feature and might change at any time
```

判定：**无需标志位**即可使用；文件库写入→关闭→重开→读回成功。实验性警告如实记录，不隐藏。

### 2.3 图片源可用性探测

| 源 | 命令 | 结果 |
|---|---|---|
| Pexels | `HEAD https://www.pexels.com` | 403 |
| Unsplash | `HEAD https://unsplash.com` | 401 |
| Pixabay | `GET https://pixabay.com/api/?q=apple`（无 key） | 400 |
| Openverse API | `GET https://api.openverse.org/v1/images/?q=red%20apple&license=cc0,by&page_size=3` | 200，返回 `title/creator/license/url` |
| Openverse 回源下载 | 下载首条结果到临时文件 | 成功，`119314` 字节，magic `FF D8 FF E1`（JPEG） |
| Wikimedia Commons API | `GET https://commons.wikimedia.org/w/api.php?...` | 探测脚本解析失败（未取到 `imageinfo`），**本环未采用**，不记为可用 |

判定：选 Openverse 作为照片来源（D-09）。**注意：本环只探测了 1 张图，14 张的实际下载与授权核对属于 build 环工作，尚未执行。**

### 2.4 R1 契约取证（只读取证，未修改）

| 取证项 | 命令/位置 | 结果 |
|---|---|---|
| 白名单失效项 | `serve.mjs:10-31` 与磁盘比对 | `/BUILD-LOG.md`、`/evidence/clean-run.md`、`/evidence/index.md`、`/evidence/manual-checks/browser.md` 不存在 |
| CSP | `index.html:6-9`、`serve.mjs:42-52` | `connect-src 'none'`（R2 必须改为 `'self'`） |
| 存储接缝 | `assets/order-store.mjs:16,53` | `readOrders(storage)`、`appendOrder(storage, order)` |
| 领域层导出 | `assets/domain.mjs` | 10 个纯函数 + `limits`（`domain.mjs:269`） |
| 控制器导出 | `assets/controller.mjs` | `checkoutReducer`、`lookupReducer`、`runCheckout`、`performLookup`、`resolveUnknownCheckout` 等 12 个 |
| 商品目录 | `assets/catalog.mjs:1-75` | 10 种，无图片/库存/上下架字段 |
| G7 合并状态 | `git merge-base --is-ancestor release/r1-fruitlab-ring7 main`（R1 与 R2 两仓） | 退出码 `0`，均已是 `main` 祖先 → **G7 关闭** |
| 基线标签 | `git tag r1-baseline c1167e0` | 创建成功 |

### 2.5 本环实际写出的文件

| 文件 | 说明 |
|---|---|
| `SPEC.md` | R2 规格草稿（v1.0-draft，DRAFT 状态，覆盖 R1 版本；R1 版本由 `r1-baseline` 与 `r1-fruitlab` 保留） |
| `docs/decision-log.md` | 追加式决策台账，D-01～D-20 |
| `evidence/ring-spec.md` | 本文件 |
| git 标签 `r1-baseline` | 指向 `c1167e0` |

## 3. 门禁状态与结果

| 门禁 | 状态 | 结果 |
|---|---|---|
| Phase 4 草稿确认（人） | **通过** | 2026-10-18 项目负责人确认 SPEC 草稿，授权继续 |
| Phase 4.5a 语义内容审查 | **通过（人工执行）** | 见 3.1；发现 2 处需修，已修 |
| Phase 4.5b 脱敏扫描（fail-closed） | **通过（本地等价扫描）** | 见 3.2；官方 gstack 扫描器不可用，如实记录并用本地正则扫描替代 |
| Phase 4.5c 跨模型质量门（0–10） | **`unavailable`** | 宿主 `claude` CLI 实际运行 `deepseek-v4-flash`（同族），`codex` 未安装；**无独立模型家族可用**，不换模型充数 |
| 同族二次审阅（补强，非门禁） | 已执行 2 轮 | 首轮 6.5/10（4 项真缺口）、次轮 6.5/10（5 项真缺口）；已修 5 项，残余风险见 3.4 |
| Phase 5 归档提交 | **通过（本地）** | 本地 git 提交；GitHub issue 归档 `requires-remote`（本仓无远端） |

### 3.1 Phase 4.5a 语义内容审查（人工）

按 gstack 检查项逐条过：

| 检查项 | 结果 |
|---|---|
| 命名个体与负面评价绑定 | 无。文中未对具体个人作负面判断 |
| 内容/指令混淆（正文里夹带「忽略上述」类指令） | 无 |
| 敏感信息（密钥、口令值、内网主机名） | 无实际口令值；只写「演示口令表」机制 |
| 内部矛盾 | **发现 2 处，已修**：① D-14～D-20 在 §3 与 §13 重复定义、编号冲突 → 统一为 D-01～D-26；② AC-33 仍写 D-01～D-20 → 改为 D-01～D-26 |
| 未决项关闭 | D-16～D-20（现编号）经项目负责人确认，状态更新为 accepted（追加记录，不改历史行） |

### 3.2 Phase 4.5b 脱敏扫描（本地等价实现）

命令：对 `SPEC.md`、`docs/decision-log.md`、`evidence/ring-spec.md` 扫描密钥前缀、私钥块、赋值式口令、邮箱、内网主机名、IPv4、手机号/身份证。

| 文件 | 结果 |
|---|---|
| `SPEC.md` | 仅命中 8 处 IPv4，全部是版本号 `1.0.0.0/2.0.0.0` 与回环地址 `127.0.0.1` → **误报，非敏感信息** |
| `docs/decision-log.md` | 无命中 |
| `evidence/ring-spec.md` | 无命中 |

判定：**通过**。官方 `gstack` 脱敏扫描器不可用（未安装 gstack 运行件），本记录不声称运行过官方扫描。

### 3.3 Phase 4.5c 跨模型质量门

| 探测 | 结果 |
|---|---|
| `claude --version` | `2.1.301 (Claude Code)`，可用 |
| 实际模型 | `deepseek-v4-flash` → **与本地同族，不构成跨模型对抗** |
| `codex` | 未安装 |
| `gh` | 已安装，但本仓无远端/未授权，issue 去重与归档不可用 |

判定：**`unavailable`**。理由：没有独立模型家族；不换模型充数（R1 同一原则）。为补强，用同族 `claude` 做两次**明确标注的二次审阅**（不是门禁）。

### 3.4 同族二次审阅与残余风险

| 轮次 | 评分 | 采纳并修复 | 未采纳（PRD 边界，显式保留） |
|---|---|---|---|
| 第 1 轮 | 6.5/10 | 事务原子性与重试、令牌哈希、请求体上限、schema 版本、视觉验收改实机截图、R1 数据迁移边界、OB 表时序说明 | 会话过期、登录限流、CSRF 完整防护（PRD 明确不做） |
| 第 2 轮 | 6.5/10 | CLI `--db`、确定性排序与合计断言、错误码优先级表、补 CHECK、`save-unknown` 不自动重试、Origin 校验部分缓解、五断点截图、AC 编号修正、回滚说明 | 幂等键（PRD 未要求，改「不自动重试+人工核对」）、403 存在性泄露（有意识取舍，D-32） |

**残余风险（显式记录，不隐藏）**：实验性 `node:sqlite` 与同步阻塞；无会话过期；无完整 CSRF；他人订单 403 会泄露订单号存在性；CLI/服务端共享进程内同步 DB，不支持高并发。以上均为演示级取舍，**不得在后续环写成「已具备生产级安全」**。

## 4. 环境踩坑（供后续环节参考）

| # | 坑 | 规避 |
|---|---|---|
| 1 | PowerShell 里 `.mjs` 用 `require` 报 `require is not defined in ES module scope` | 临时脚本改用 `import { DatabaseSync } from "node:sqlite"`，或存 `.cjs` |
| 2 | `write` 工具覆盖已存在文件前必须先 `read`（文件策略） | 覆盖 `SPEC.md` 前先读原文件；这是预期行为，不是错误 |
| 3 | `Invoke-WebRequest -Method Head` 对部分站点返回 403/401，不能据此判定站点不可用 | 对图片源同时记录 GET 探测结果；最终以「下载成功」为准 |
| 4 | 中文长文本经 PowerShell here-string 传递存在编码风险 | 长文本一律用文件写入工具，不经 shell 拼接 |

## 5. 诚实边界

1. 本环**没有**启动真实的 R2 服务器、**没有**下载 14 张正式图片、**没有**创建数据库文件——这些都属 build 环。本环只做可行性探测与规格冻结。
2. 本环**没有**在真实浏览器中验证任何视觉——Apple 风格的最后落地效果属 build 与 qa 环，人工浏览器验收将如实记 `UNVERIFIED`。
3. 本环**没有**运行 `/spec` 技能的官方脚本（`gstack-skill-start` 等）：当前宿主是 DeepSeek Harness，未安装 gstack 运行件，因此按技能文档手动执行流程；此偏差已记录，后续环节同理。
4. 本环的跨模型质量门**尚未尝试**；若 build 前仍不可用，将如实记 `unavailable`，并把本地语义审查结论保留，不冒充通过。
