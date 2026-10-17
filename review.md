# FruitLab 第 5 环 Review

## 结论

Pre-Landing Review 已完成 ASK 裁决与收尾。

- Review 状态：`adjudicated`
- 裁决结果：D2、D3 已修复；D4 已修订规格；D1 降级为已知限制；D5 保持 `UNVERIFIED`
- Critical 缺陷：0
- 本轮 ASK 中待修复项：0
- 已知限制：1（D1，规格已排除）
- 未验证验收项：验收 21、22（D5）
- 发布建议：不能声明人工验收完成，也没有进入 qa

## 审查范围与方法

- 原始审查基线：`ce1ae2b`（`build: 完成第 4 环 build 收尾`）
- 原始 review 提交：`0f8c640`（`review: 完成第 5 环 review 收尾`）
- 收尾对象：`0f8c640` 之上的 D2、D3、D4 和 review 记录更新
- 规格文件：`SPEC.md`，按 D4 裁决由 18+ 修订为 22+
- 原始 `SPEC.md` SHA-256：`446886200d4fe3af37f83c65504d276c5a595d7ac9bee8c3d4a13ebd3a187b64`
- 修订后 `SPEC.md` SHA-256：`11a6fda6c790131e7fb04c5d98c7d635e58cfe91749e34aa7b5bae4c52eb960a`
- 代码范围：`index.html`、`serve.mjs`、`assets/`、`tests/`、`README.md`、`BUILD.md`、`DECISIONS.md`、`docs/error-catalog.md`
- 审查方式：读取完整 diff 和相关源码；复核 BUILD.md 自报问题；运行单元与集成测试；沿用上一轮本地 Chromium 探针结果并明确区分人工验收证据
- Review Army specialist 流因小 diff 跳过；外部 Claude Code 审查因模型配置不可用而没有形成有效覆盖

## ASK 裁决

| ID | 裁决 | 当前状态 | 处理 |
| --- | --- | --- | --- |
| D1 | 不修，记为已知限制 | `KNOWN_LIMITATION` | `SPEC.md` 的 Out of Scope 已排除多标签页实时同步或冲突合并 |
| D2 | 修复 | `FIXED` | 数量未实际变化时不再重绘购物车 |
| D3 | 修复 | `FIXED` | 结账失败按稳定错误码显示具体存储提示 |
| D4 | 修订规格 | `FIXED` | `SPEC.md` 的 Node.js 最低版本改为 22+，并记录修订原因与日期 |
| D5 | 不补人工记录 | `UNVERIFIED` | 无可用人工受试者，不编造 M1-M16 结果 |

### D1 [KNOWN LIMITATION] 跨标签页保存可能发生丢失更新

原始问题：`appendOrder()` 先读取当前 NDJSON，再拼接新订单，最后把完整文本写回。两个标签页可以在这段读改写之间交错，后写入的标签页可能覆盖先写入的订单。当前没有跨标签锁定，也没有 `storage` 事件冲突检测。

裁决：不修，记录为已知限制。

依据：`SPEC.md` 的 Out of Scope 已明确列出“多标签页实时同步或冲突合并”（审查时位于 L446，D4 修订后行号可能偏移）。该场景已在规格中排除，因此不把本轮实现视为违反已批准范围。

定级说明：本轮审查曾将 D1 定为 `CRITICAL`，这与规格排除条款存在冲突，定级偏高。现降级为“已知限制（规格已排除）”，不再作为本轮阻断修复项。

保留风险：两个标签页同时结账时仍可能静默丢失其中一单；本演示不承诺多标签页并发数据完整性。

### D2 [FIXED] 数量输入框失焦重绘可能吞掉紧接的按钮点击

问题描述：数量输入框同时监听 `change` 和 `blur`。用户编辑数量后直接点击同一行的“移除”或加减按钮时，输入框失焦会调用 `renderCart()` 替换购物车 DOM，原按钮在 `click` 之前可能已经被移除。

裁决：按推荐方案修复，仅在数量实际变化时重绘。

实现：

- `assets/controller.mjs` 新增 `parseQuantityUpdate()`，在解析结果中给出 `changed`，由实际数量比较决定是否重绘。
- `assets/app.mjs` 在数量未变化时只原地规范化输入值和错误状态，不调用 `renderCart()`。
- 数量实际变化时才更新购物车并重绘。

回归测试：

- `tests/controller.test.mjs` 覆盖相同数量、前导零、实际变化、超上限钳制和非法输入，确认只有实际数量变化时 `changed === true`。
- 本轮没有重新执行浏览器点击探针，因此不把自动化单元测试表述为人工交互复验。

### D3 [FIXED] 结账失败未展示存储错误的具体提示

问题描述：错误目录对配额、存储权限和读取失败给出了具体用户提示，但结账路径只显示通用的 `订单未保存，请重试`。

裁决：按推荐方案修复，按稳定错误码映射具体提示。

实现：

- `assets/controller.mjs` 新增 `checkoutNotWrittenMessage()`。
- `assets/app.mjs` 的 `not-written` 状态改为按 `checkoutState.code` 选择提示。
- `storage-unavailable`、`storage-security-blocked`、`storage-quota-exceeded`、`storage-read-failed`、`storage-write-failed` 均有对应恢复文案。
- 未知错误码仍回退到通用 `订单未保存，请重试`。
- `docs/error-catalog.md` 已同步结账路径实际展示的文案。

回归测试：

- `tests/controller.test.mjs` 覆盖五类存储错误码的具体文案和未知错误码回退。

### D4 [FIXED] Node.js 最低版本已修订为 22+

原问题：`SPEC.md` 多处要求 Node.js 18+，但 `serve.mjs` 明确拒绝低于 22 的版本，README、错误目录和测试基线也与 22+ 一致。

裁决：保留 Node.js 22+ 实现，修订规格。

实现：

- `SPEC.md` 文件布局中的服务器要求改为 Node.js 22+。
- Static Server 要求改为只使用 Node.js 22+ 内置模块。
- README 前置条件改为 Node.js 22+。
- `SPEC.md` 顶部加入 2026-10-17 修订记录，注明原因：项目基线为 Node.js 22，`serve.mjs` 有意拒绝更低版本，现有实现与测试按该基线验证。

结果：本轮发现的规格与实现版本漂移已消除。

### D5 [UNVERIFIED] 缺少人工 Chromium 的 M1-M16 记录

原始问题：`evidence/index.md` 和 `evidence/manual-checks/browser.md` 不存在，README 和页面仍链接这些路径，M1-M16 没有符合规格要求的人工 Chromium 记录。

裁决：记为 `UNVERIFIED`，不补造人工记录。

原因：没有可用的人工受试者执行并签署 M1-M16 检查。本轮没有把自动化探针、源码检查或单元测试冒充为人工验收结果，也没有编造日期、环境、操作过程或通过状态。

当前影响：验收项 21、22 仍为 `UNVERIFIED`。缺失证据入口和不存在的证据文件仍是公开的文档缺口，不能据此声明人工验收完成。

## AUTO-FIX 修复清单

### 1. 动态数量控件补充稳定的 `id` 和 `name`

- 文件：`assets/app.mjs`
- 修复：添加 `id="quantity-${fruitId}"` 和 `name="quantity-${fruitId}"`
- 回归：`tests/static-scan.test.mjs` 检查源码中的两个属性

### 2. 拒绝空白的 `--port` 参数

- 文件：`serve.mjs`
- 修复：对 `--port` 和 `--port=` 的值先做 `trim()` 空值检查
- 回归：`tests/server.test.mjs` 覆盖 `--port=` 和 `--port " "`

### 3. 删除 EOF 多余空行

- 文件：`assets/controller.mjs`
- 修复：删除文件末尾多余空行
- 验证：`git diff --check` 无输出

## BUILD.md 自报问题复核

| BUILD 项 | 复核结果 | 当前说明 |
| --- | --- | --- |
| 1. 缺少 `evidence/index.md` 和 `evidence/manual-checks/browser.md` | 属实 | D5 记录为 `UNVERIFIED` |
| 2. README 引用不存在的 `BUILD-LOG.md` 和 `evidence/clean-run.md` | 属实 | 仍是公开文档入口缺口，本轮裁决未要求补造证据 |
| 3. Node.js 18+ 规格与 22+ 实现冲突 | 已处理 | D4 已将规格修订为 Node.js 22+ |
| 4. 动态数量输入框缺少 `id` 或 `name` | 已处理 | AUTO-FIX 已修复并有静态回归测试 |
| 5. P5 教学价值仍为 `UNVERIFIED` | 属实 | 没有 `evidence/learner-checks/post-build.md`，不能宣称已验证 |

## 未发现问题的方面

除上述事项外，本轮未发现以下方面的新缺陷：

- 未发现 SQL 注入、命令注入或 LLM 信任边界问题，项目没有对应执行面
- 未发现路径穿越、私有文件暴露、symlink 逃逸或 MIME 绕过
- 未发现 `innerHTML`、`outerHTML`、`insertAdjacentHTML`、`document.write` 等 HTML 注入 sink
- 未发现远程资源、外部网络 API 或运行时依赖
- 未发现 GET/HEAD、405、404、`problem+json` 和 `Cache-Control: no-store` 的契约回归
- 未发现订单 NDJSON 逐行容错、重复订单号拒绝、写入读回校验或配额失败不显示成功的回归
- 未发现数量边界、金额溢出、订单号格式和订单快照校验的明显回归

## 验证结果

- `node --test`：60 项，59 通过，0 失败，1 跳过
- 跳过项：Windows 当前 profile 不允许创建 symlink，symlink 逃逸测试按设计 skip
- `git diff --check`：通过，无空白错误
- D2 回归：`parseQuantityUpdate` 测试确认只有实际数量变化才标记重绘，静态扫描确认未变化分支提前返回
- D3 回归：五类存储错误码均映射到具体结账提示，静态扫描确认 `not-written` 路径按错误码取文案
- Node.js 当前实测运行时：22.20.0
- 本轮收尾没有进入 qa，也没有重新执行人工 Chromium 检查

## Exploratory QA and Verification Results

上一轮 review 使用了本地 Chromium 探针和回环 HTTP 检查，但没有启动 `/qa`，也没有把自动化探针写成人工验收证据。

- 通过：桌面与 360px 布局基础检查
- 通过：10 种水果加购基础流程
- 通过：配额失败时不显示成功且购物车保留
- 通过：本地页面无未处理控制台异常
- 上一轮观察到：数量输入框失焦后立即点击移除按钮可能丢失点击；本轮已按 D2 裁决修改源码并补纯函数回归测试
- 未覆盖：全新 profile 下的 M1-M16 人工逐项记录，状态为 `UNVERIFIED`
- 未覆盖：双标签页竞态的主动复现；D1 来自读改写路径分析，并按规格排除条款记为已知限制

## Gate edits

Gate edits: none detected (5 listed, 0 read; patterns: RH-1,RH-3,RH-4,RH-12,RH-13,RH-14,RH-15,RH-16; unlisted idioms: none)

## 诚实边界

- 本报告基于上一轮已完成的核心审查和本轮裁决收尾，没有重新开展一轮完整审查
- 没有有效的外部模型 review，Claude Code 因 `unrecognized_model` 和超时未返回结果
- 没有真实人工受试者的 M1-M16 Chromium 记录，因此 D5 保持 `UNVERIFIED`
- D1 没有执行双标签页竞态复现，且按 `SPEC.md` 的 Out of Scope 条款不作为本轮修复项
- D2 已补源码和纯函数测试，但没有重新执行浏览器点击探针
- 没有执行完整的无障碍、视觉设计或性能审查
- 没有运行 qa、ship 或 retro，也没有声明这些环节通过
