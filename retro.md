# retro.md（R2 第 7/7 环）

> **数据来源**：本仓库真实 Git 历史（`r1-baseline..HEAD`）、真实测试输出、真实证据文件。
> **窗口**：2026-10-18 08:26 → 09:27（+0800），8 个提交，单执行者（agent）。
> **不美化**：返工、降级与未验证项全部列出。

## 1. 一句话

> **7 环走完，2.0.0.0 可本地发布**：96 项测试全绿、健康分 94、42 条义务全部关闭；但图片资产与视觉一致性、移动端导航、PRD 边界安全项仍有债。

## 2. 提交与变更规模

| 指标 | 值 |
|---|---|
| 提交数（`r1-baseline..HEAD`） | **8** |
| 提交类型 | docs 3 / build 1 / review 1 / qa 1 / release 1 / merge 1 |
| 文件变更 | **92** |
| 新增 / 删除行 | **+10,396 / −5,412** |
| 来源 / 测试 / 文档行数（当前） | 3,701 / 2,475 / 3,205 |
| **Test Ratio**（测试行/来源行） | **0.669**（规格门槛 ≥0.20） |
| 测试数 | **96**（R1 为 62，+34，+54.8%） |
| 挂钟耗时 | 约 61 分钟（spec 08:26 → release 09:27） |

## 3. 提交节奏与类型

```text
docs: approve R2 spec
docs: autoplan R2 (four-phase review, obligations)
docs: approve autoplan gate + SPEC v1.1
build: implement R2 (DB/auth/API/CLI/frontend/visuals/assets)
review: structure minesweep + security audit (6 auto-fixes)
qa: real Chromium QA (5 breakpoints), health 94, image/licensing fixes
release: v2.0.0.0 (coverage audit, docs sync, release branch)
merge: release v2.0.0.0 into main
```

- **门禁型提交集中在环边界**：spec、autoplan（终门）、release 三次独立提交，符合「环边界停」。
- **单次 build 提交承载了主要实现**（约 8.1k 插入），build 环内按 M1–M5 里程碑推进但未逐里程碑提交——**这是可改进点**。

## 4. 热点文件（变更次数）

| 次数 | 文件 | 解读 |
|---:|---|---|
| 4 | `evidence/manifest.json` | 每次证据变更重算哈希（流程成本） |
| 4 | `evidence/index.md` | 逐环追加索引 |
| 3 | `DECISIONS.md` | autoplan、终门、编号修正 |
| 3 | `evidence/test-count.txt` | 唯一计数重生成 |
| 3 | `docs/decision-log.md` | 逐环决策追加 |
| 2 | `index.html` / `scripts/fetch-product-images.mjs` / `evidence/manual-checks/browser.md` / `SPEC.md` / `server/auth.mjs` / `server/orders.mjs` / `server/router.mjs` | 视觉与修复迭代 |

**结论**：热点集中在「证据与决策文档」而非代码，说明**流程成本主要花在可追溯性上**；代码热点是 review 环修复的 3 个服务端文件。

## 5. 质量门与返工

| 环节 | 真实结果 |
|---|---|
| spec | 4.5a 通过（修 2 处编号矛盾）；4.5b 本地扫描通过；4.5c 跨模型 **unavailable** |
| autoplan | 四阶段全 FAIL（CEO 6.5 / Design 7.0 / DX 5.7 / Eng 6.5）→ **42 条义务** |
| review | 6 项自动修复（N+1、幂等竞态、Cookie 容错、路径泄露、旧会话、lint） |
| qa | **健康分 94**；无 Critical/High；2 Medium/2 Low |
| ship | 覆盖率 27 条路径（19★★★/7★★/1★/0 未覆盖）；`verify` 5/5；`requires-remote` |

**返工事实（不隐藏）**：
- 商品图片重抓 **9 次**：樱花当车厘子、鸡尾酒当脐橙、月亮当脐橙、菠萝表皮特写、酒吧场景当蓝莓、水果摊当哈密瓜、市场挂果当榴莲；最终 5 张改用 Wikimedia Commons 精确文件。
- 2 处 fake DOM 测试因「重渲染后再派发事件」不可靠而简化（一次 163 秒内存异常），真实浏览器行为由 qa 补足。
- 图片授权策略被迫扩展（CC BY-SA / Public Domain），已记录为对 SPEC §5.8 的降级。

## 6. 义务与缺口

| 项 | 结果 |
|---|---|
| 42 条义务（`OB-*`） | **全部 closed**（`docs/obligations.md`，证据在 `BUILD.md`/各环报告） |
| G1–G7 | **全部关闭**（死链、证据包、契约、aria、编号、计数、发布分支） |
| 技术债 TODOS | 5 项（取消/退款回补、管理审计、会话过期/限流、分页、scrypt 升级） |
| Known Issues | 移动端导航可发现性、图片授权/尺寸降级、PRD 边界安全项、人工无障碍 `UNVERIFIED`、无远端 |

## 7. 学到的（详见 [`docs/learnings.md`](docs/learnings.md)）

1. 图片这类外部资产要**先做质量 spike**，不能按“下载成功”验收内容。
2. fake DOM 只适合交互状态；**视觉/焦点/布局必须真实浏览器**。
3. 官方工具不可用时要**如实写 unavailable**，手动流程同样能留证据。
4. PowerShell 双引号里的反引号会吃掉 Markdown；长文本一律走文件/Node。
5. 证据链要按顺序重建：跑测试 → 写计数 → 生成哈希清单 → 全量 verify，否则必红。
6. 范围上，**资产与治理文档约占 build 的 1/3 时间**，排期要显式给。

## 8. 与 R1 对比

| 指标 | R1 | R2 |
|---|---|---|
| 版本 | 1.0.0.0 | **2.0.0.0** |
| 测试 | 62（61 通过/1 跳过） | **96（96 通过）** |
| 运行形态 | 纯浏览器 + 静态托管 | **服务端 DB + 会话 + API + CLI** |
| 商品 | 10 种、纯文字卡 | **14 种、真实照片 + Apple 式版式** |
| 缺口 | 7 项未收敛 | **G1–G7 全关闭、42 义务全 closed** |
| 发布 | main 直发被门禁拦下 | **发布分支 + 合回 main** |

## 9. 诚实边界

- 挂钟 61 分钟是 agent 执行时间，**不能当作人力工期**。
- Test Ratio 是行数比，覆盖率是路径×质量的人工映射，**都不是行覆盖率**。
- 无远端：推送/PR/部署/金丝雀 `requires-remote`；无红先失败回归证明。
- 人工无障碍、对比度仪器、真实学员教学价值：`UNVERIFIED`。

## 10. 下一步（R3 候选）

1. 图片资产：统一白底/构图，或采购一套风格一致的可商用素材（当前是最大观感短板）。
2. 订单状态机 + 取消/回补（T-01），可用于演示状态机与补偿事务。
3. 会话过期/轮换与 CSRF（T-03），把安全边界从“声明”推进到“实现”。
4. 移动端导航折行/抽屉，关闭 QA-01。
5. 把 build 拆成逐里程碑提交，让 `/retro` 的节奏指标更有意义。
