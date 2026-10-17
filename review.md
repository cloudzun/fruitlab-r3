# FruitLab 第 5 环 Review

## 结论

Pre-Landing Review: 5 issues (1 critical, 4 informational)

- Review 状态：`issues_found`
- 未决缺陷：5 项，均列在下方 ASK 清单中
- 已解决：3 项 AUTO-FIX
- 发布建议：当前不能声明验收完成，也不能进入可发布状态
- 本轮只完成 review 收尾，没有进入 qa

## 审查范围与方法

- 审查基线：`ce1ae2b` (`build: 完成第 4 环 build 收尾`)
- 审查对象：当前未提交工作区，即上述基线加上本轮 3 项 AUTO-FIX
- 规格文件：`SPEC.md` 只读，未修改
- `SPEC.md` SHA-256：`446886200d4fe3af37f83c65504d276c5a595d7ac9bee8c3d4a13ebd3a187b64`
- 代码范围：`index.html`、`serve.mjs`、`assets/`、`tests/`、`README.md`、`BUILD.md`、`DECISIONS.md`、`docs/error-catalog.md`
- 审查重点：结构排雷、安全边界、数据持久化、错误恢复、规格偏差、测试覆盖与已有证据
- 审查方式：读取完整 diff 和相关源码；复核 BUILD.md 的 5 个自报问题；运行单元与集成测试；使用本地 Chromium 做 review 探针；对照 SPEC 验收项和错误目录
- Review Army specialist 流因小 diff 跳过；本轮外部 Claude Code 审查因模型配置不可用而没有形成有效覆盖

## 未决问题（ASK）

### D1 [CRITICAL] 跨标签页保存会发生丢失更新

问题描述：`appendOrder()` 先读取当前 NDJSON，再拼接新订单，最后把完整文本写回。两个标签页可以在这段读改写之间交错：两者都读到旧值 P，分别写出 P+A 和 P+B，并且各自读回成功。后写入的标签页覆盖先写入的订单，两个页面都会报告保存成功。当前没有跨标签锁定，也没有 `storage` 事件冲突检测。

涉及文件与行号：

- `assets/order-store.mjs:54`：读取当前订单
- `assets/order-store.mjs:84`：基于旧快照构造完整写入值
- `assets/order-store.mjs:89`：直接覆盖整个存储键
- `assets/order-store.mjs:101`：只验证本次写入的读回结果，无法发现另一个页面随后覆盖

可选项：

- A) 用 Web Locks 串行化“读取、校验、追加、读回”这一段（推荐）
  - 利：保留多标签页使用方式，能直接消除同源并发覆盖。
  - 利：锁内仍可沿用现有 append-only 和读回校验逻辑。
  - 弊：需要增加并发回归测试，并为不支持 Web Locks 的环境准备降级策略。
  - Completeness: 9/10
- B) 限制同一时间只有一个标签页可以写入
  - 利：改动面较小，不必实现跨标签事务。
  - 利：可以把冲突变成明确提示，而不是静默覆盖。
  - 弊：会明显降低正常多标签页体验，标签页异常退出时还需要恢复机制。
  - Completeness: 7/10
- C) 接受当前风险，不修改
  - 利：不需要开发和测试成本。
  - 弊：仍可能在真实用户操作中静默丢失订单，属于数据完整性缺陷。
  - Completeness: 3/10

推荐项：A。`localStorage` 只能保证单次操作，不能保证读改写事务；优先用 Web Locks 保留现有使用方式，并补一个两个写入者交错的回归测试。

### D2 [INFORMATIONAL] 数量输入框失焦会重绘整行，可能吞掉紧接的按钮点击

问题描述：数量输入框同时监听 `change` 和 `blur`。用户编辑数量后直接点击同一行的“移除”或加减按钮时，按钮的 `mousedown` 先让输入框失焦，`blur` 提交数量并调用 `renderCart()` 替换整棵购物车 DOM。原按钮在 `click` 之前已经被移除，点击可能丢失。浏览器探针已实际观察到该行为。

涉及文件与行号：

- `assets/app.mjs:334`：创建提交回调
- `assets/app.mjs:335`：监听 `change`
- `assets/app.mjs:336`：监听 `blur`
- `assets/app.mjs:255`：提交后重绘购物车
- `assets/app.mjs:394`：`renderCart()` 重建所有购物车行

可选项：

- A) 仅当数量实际变化时才重绘；未变化时保留现有 DOM（推荐）
  - 利：消除 `blur` 导致的按钮目标替换，点击和键盘焦点都更稳定。
  - 利：能顺带减少无意义重绘，改动范围仍局限在购物车渲染。
  - 弊：需要把原地更新和整行重绘的边界写清楚，并补浏览器交互测试。
  - Completeness: 8/10
- B) 把重绘延迟到当前点击结束后，再恢复焦点
  - 利：改动看起来较小，可以保留现有提交流程。
  - 利：能覆盖一部分“失焦后立即点击”的场景。
  - 弊：依赖事件时序和焦点恢复，后续加按钮或改控件时容易再次退化。
  - Completeness: 6/10
- C) 接受当前行为，不修改
  - 利：不需要改代码。
  - 弊：用户仍可能点不到移除或加减按钮，键盘和辅助技术用户也受影响。
  - Completeness: 3/10

推荐项：A。修复根因，不要在事件时序上打补丁。

### D3 [INFORMATIONAL] 结账保存失败时没有展示错误目录承诺的具体存储提示

问题描述：错误目录对配额、存储权限和读取失败给出了具体用户提示，但结账路径只显示通用的 `订单未保存，请重试`。`refreshStorageNotice()` 在结账后重新读取存储；如果 `setItem` 因配额或权限失败，而 `getItem` 仍能读取旧数据，页面无法得知刚才的写入错误，也就不会显示错误目录承诺的提示。

涉及文件与行号：

- `assets/app.mjs:445`：结账状态文案映射
- `assets/app.mjs:451`：`not-written` 统一显示通用重试文案
- `assets/app.mjs:769`：结账后只通过重新读取刷新存储提示
- `assets/app.mjs:799`：`refreshStorageNotice()` 只反映读取状态
- `docs/error-catalog.md:59` 到 `docs/error-catalog.md:109`：文档承诺 `storage-unavailable`、`storage-security-blocked`、`storage-quota-exceeded` 等提示

可选项：

- A) 保存失败后按稳定错误码展示对应提示（推荐）
  - 利：与错误目录和 DECISIONS 中 DX4 的意图一致。
  - 利：用户能区分配额不足、权限阻止和普通写入失败。
  - 弊：需要增加结账错误到提示区域的映射及相应测试。
  - Completeness: 8/10
- B) 保留通用结账提示，同时把错误目录改成只承诺通用恢复文案
  - 利：代码改动较少，SPEC 的最低文案要求仍可满足。
  - 利：可以避免维护多套用户可见恢复文案。
  - 弊：会丢失已经设计并记录的具体恢复指引。
  - Completeness: 6/10
- C) 接受当前差异，不修改
  - 利：不需要改代码或文档。
  - 弊：实现与错误目录继续不一致，用户仍不知道配额或权限问题该怎样处理。
  - Completeness: 3/10

推荐项：A。先修实现，使文档中的恢复路径真实可达。

### D4 [INFORMATIONAL] Node.js 最低版本与规格冲突

问题描述：`SPEC.md` 多处要求 Node.js 18+，但 `serve.mjs` 明确拒绝低于 22 的版本，README 和错误目录也写成 22+。仅把版本检查降到 18 还不够，因为 `tests/server.test.mjs` 和 `tests/static-scan.test.mjs` 使用了 Node.js 20.11 才提供的 `import.meta.dirname`。

涉及文件与行号：

- `SPEC.md:67`、`SPEC.md:261`、`SPEC.md:283`：要求 Node.js 18+
- `serve.mjs:237` 到 `serve.mjs:240`：最低版本判定为 22
- `serve.mjs:318` 到 `serve.mjs:320`：低于 22 时直接退出
- `README.md:7`：文档写 Node.js 22+
- `docs/error-catalog.md:379` 到 `docs/error-catalog.md:381`：错误目录写 Node.js 22+
- `DECISIONS.md:40`、`DECISIONS.md:110`：计划评审曾接受 Node.js 22+
- `tests/server.test.mjs:16`、`tests/static-scan.test.mjs:6`：使用 `import.meta.dirname`

可选项：

- A) 保留 Node.js 22+，正式修订规格并记录这是已接受的产品决定
  - 利：现有代码、测试、README 和错误目录已经一致。
  - 利：可以避免为旧运行时增加未经验证的兼容工作。
  - 弊：修改了当前只读规格所承诺的最低版本，需要规格所有者明确批准。
  - Completeness: 8/10
- B) 恢复到规格承诺的 Node.js 18+（推荐）
  - 利：直接消除规格与实现的偏差，不需要修改 `SPEC.md`。
  - 利：能覆盖规格明确要求的 18+ 环境。
  - 弊：需要改版本检查、README、错误目录、测试根路径写法，并在 Node 18 上真实运行验证。
  - Completeness: 7/10
- C) 保留冲突，仅记录为已知未决项
  - 利：本轮不需要改代码。
  - 弊：验收项继续失败，用户按规格安装 Node 18 后仍无法启动。
  - Completeness: 3/10

推荐项：B。当前任务的约束是 `SPEC.md` 只读，因此优先让实现回归规格；如果规格所有者明确接受 22+，再改选 A 并正式修订规格。

### D5 [INFORMATIONAL] 验收 21、22 失败，缺少要求的人工浏览器证据

问题描述：`evidence/index.md` 和 `evidence/manual-checks/browser.md` 不存在，README 和页面仍链接这些路径，`serve.mjs` 仍把它们列入允许访问清单，但请求会返回 404。M1-M16 没有符合 SPEC 要求的人工 Chromium 记录，因此验收项 21、22 不能通过。

涉及文件与行号：

- `SPEC.md:305` 到 `SPEC.md:324`：M1-M16 的必查内容
- `SPEC.md:365` 到 `SPEC.md:366`：验收项 21、22
- `README.md:83`、`README.md:93`：README 链接缺失的证据文件
- `index.html:129`：页面链接缺失的 `evidence/index.md`
- `serve.mjs:27`、`serve.mjs:29`：允许清单仍包含这些不存在的路径
- `BUILD.md:55`：build 阶段已经自报这两个验收项未通过

可选项：

- A) 补齐真实证据文件并完成 M1-M16 记录（推荐）
  - 利：直接恢复验收项 21、22，README 和页面入口不再失效。
  - 利：能把自动化探针与规格要求的人工结果明确区分。
  - 弊：需要在全新 profile 中逐项执行并如实记录，不能用本轮探针代替。
  - Completeness: 10/10
- B) 保持阻断，不补证据
  - 利：不伪造任何未执行的人工结果。
  - 利：报告会如实反映当前不能验收。
  - 弊：项目仍不能完成第 5 环后的验收，也不能进入发布流程。
  - Completeness: 5/10
- C) 申请正式豁免并修改验收范围
  - 利：可以让后续流程有明确的书面依据。
  - 利：避免留下“文件缺失但默认放行”的隐性规则。
  - 弊：需要规格所有者批准，且会偏离当前已经批准的验收标准。
  - Completeness: 4/10

推荐项：A。证据缺失是当前最明确的验收阻断项，补齐真实记录比修改标准更直接。

## AUTO-FIX 修复清单

### 1. 动态数量控件补充稳定的 `id` 和 `name`

- 文件：`assets/app.mjs:316`、`assets/app.mjs:320`
- 问题：DevTools 报告动态数量输入框没有稳定 `id` 或 `name`
- 修复：添加 `id="quantity-${fruitId}"` 和 `name="quantity-${fruitId}"`
- 回归：`tests/static-scan.test.mjs:60` 检查源码中的两个属性
- 验证：本地 Chromium 探针确认 10 个加购行都生成了对应 `id` 和 `name`

### 2. 拒绝空白的 `--port` 参数

- 文件：`serve.mjs:252`、`serve.mjs:266`
- 问题：`--port=`、`--port ""` 或空白字符串会被 `Number("")` 解析为 0，绕过“缺少值”的错误
- 修复：对 `--port` 和 `--port=` 的值先做 `trim()` 空值检查
- 回归：`tests/server.test.mjs:195`、`tests/server.test.mjs:196`
- 验证：`parseCliArgs(["--port="])` 和 `parseCliArgs(["--port", " "])` 均返回 `invalid`

### 3. 删除 EOF 多余空行

- 文件：`assets/controller.mjs`
- 问题：文件末尾有多余空行
- 修复：删除行尾空行
- 验证：`git diff --check` 无输出

## BUILD.md 自报问题复核

| BUILD 项 | 复核结果 | 说明 |
| --- | --- | --- |
| 1. 缺少 `evidence/index.md` 和 `evidence/manual-checks/browser.md` | 属实 | 验收 21、22 失败，见 D5 |
| 2. README 引用不存在的 `BUILD-LOG.md` 和 `evidence/clean-run.md` | 属实 | `README.md:75`、`README.md:91` 仍会形成失效入口 |
| 3. Node.js 18+ 规格与 22+ 实现冲突 | 属实且影响更大 | 除版本检查外，测试还依赖 Node.js 20.11+ 的 `import.meta.dirname`，见 D4 |
| 4. 动态数量输入框缺少 `id` 或 `name` | 属实 | 已 AUTO-FIX，见上方修复清单 |
| 5. P5 教学价值仍为 `UNVERIFIED` | 属实 | 没有 `evidence/learner-checks/post-build.md`，不能宣称已验证 |

## 未发现问题的方面

除上述未决项外，本轮未发现以下方面的新缺陷：

- 未发现 SQL 注入、命令注入或 LLM 信任边界问题，项目没有对应执行面
- 未发现路径穿越、私有文件暴露、symlink 逃逸或 MIME 绕过
- 未发现 `innerHTML`、`outerHTML`、`insertAdjacentHTML`、`document.write` 等 HTML 注入 sink
- 未发现远程资源、外部网络 API 或运行时依赖
- 未发现 GET/HEAD、405、404、`problem+json` 和 `Cache-Control: no-store` 的契约回归
- 未发现订单 NDJSON 逐行容错、重复订单号拒绝、写入读回校验或配额失败不显示成功的回归
- 未发现数量边界、金额溢出、订单号格式和订单快照校验的明显回归

## 验证结果

- `node --test`：57 项，56 通过，0 失败，1 跳过
- 跳过项：Windows 当前 profile 不允许创建 symlink，symlink 逃逸测试按设计 skip
- `git diff --check`：通过，无空白错误
- 本地 Chromium：10 种水果加购、360px 无横向滚动、动态数量控件 `id`/`name` 可见
- 本地 Chromium：注入 `Storage.prototype.setItem` 配额异常后，不显示成功收据，购物车保留
- 本地 Chromium：数量输入框失焦重绘会吞掉紧接的移除按钮点击，见 D2
- 本地 HTTP：缺失的 evidence 入口返回 404
- Node.js 当前实测运行时：22.20.0

## Exploratory QA and Verification Results

本轮 review 使用了本地 Chromium 探针和回环 HTTP 检查，但没有启动 `/qa`，也没有把自动化探针写成人工验收证据。

- 通过：桌面与 360px 布局基础检查
- 通过：10 种水果加购基础流程
- 通过：配额失败时不显示成功且购物车保留
- 通过：本地页面无未处理控制台异常
- 观察到：数量输入框失焦后立即点击移除按钮可能丢失点击
- 未覆盖：全新 profile 下的 M1-M16 人工逐项记录
- 未覆盖：真实 Node.js 18 运行验证
- 未覆盖：双标签页竞态的动态复现，D1 来自源码路径分析

## Gate edits

Gate edits: none detected (5 listed, 0 read; patterns: RH-1,RH-3,RH-4,RH-12,RH-13,RH-14,RH-15,RH-16; unlisted idioms: none)

## 诚实边界

- 本报告基于上一轮已完成的核心审查和本轮收尾核对，没有重新开展一轮完整审查
- 没有有效的外部模型 review，Claude Code 因 `unrecognized_model` 和超时未返回结果
- 没有真实用户的 M1-M16 人工 Chromium 记录，因此不能把自动化探针当成验收 22
- 没有在 Node.js 18 上运行，不能承诺 D4 的 B 方案无需额外适配
- 没有执行双标签页竞态复现，D1 是由读改写路径直接推导出的高风险缺陷
- 没有执行完整的无障碍、视觉设计或性能审查
- 没有运行 qa、ship 或 retro，也没有声明这些环节通过
