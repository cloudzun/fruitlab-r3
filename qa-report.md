# FruitLab 第 6 环 QA 报告

## 结论

- 状态：`DONE_WITH_CONCERNS`
- 目标：`http://127.0.0.1:4173`，本地浏览器表面，Standard + Full
- 代码基线：`3400207`
- 核心闭环：实测通过
- Critical / High：0
- Medium：1
- Low：1
- 自动浏览器证据：19 个 checkpoint
- 人工 M1-M16：`UNVERIFIED`，没有真实人工签署
- P5 教学价值：`UNVERIFIED`
- Ship：未进入

GStack evidence materialize 的最终 verdict 为 `inconclusive (no evidence rows)`。这是 browser-only annotations 使用空 `evidence` 数组的制度性结果；本报告仍按已完成的真实 Chromium checkpoint 和原始输出记录覆盖范围，不把该 verdict 改写成通过。

## 环境与隔离

| 项目 | 实测值 |
| --- | --- |
| 日期 | 2026-10-17 |
| 分支 | `main` |
| Node.js | `22.20.0` |
| Bun | `1.3.9` |
| Chromium | HeadlessChrome `151.0.7922.34`，Windows x64 |
| 服务 | 本轮启动的 `node serve.mjs`，`127.0.0.1:4173` |
| 浏览器状态 | gstack 独立 headless profile；离线项另用本机已安装 Playwright 驱动的 Chromium |
| 存储隔离 | 仅重置 `fruitlab.orders.v1`；未触碰用户浏览器 profile 或其他站点数据 |
| 证据目录 | `.gstack/qa-reports/run-20261017T085755Z/` |

代理环境检查结果为空：没有 `HTTP_PROXY`、`HTTPS_PROXY`、`ALL_PROXY` 或其小写变量。本轮没有写入代理配置。

## 健康分

| 类别 | 分数 | 依据 |
| --- | ---: | --- |
| Console | 100 | 正常流程、异常流程和离线流程均无未处理异常 |
| Links | 85 | 1 个实际 404：`/evidence/index.md` |
| Visual | 100 | 1440px 双列、360px 单列，未发现横向溢出 |
| Functional | 100 | 浏览、加购、数量、移除、结账、刷新、查单和异常路径通过 |
| UX | 97 | 空/格式错误/未知订单时出现空白“查询结果”容器，Low |
| Performance | 100 | `dns/tcp/ssl/download 0ms`，`ttfb 1ms`，`domReady 24ms`，`load 26ms` |
| Content | 100 | 页面主文案和金额格式正确；缺失证据文件按同一根因计入 Links |
| Accessibility | 100 provisional | 自动语义、标签、live region、对比度抽样和键盘焦点通过；未做屏幕阅读器人工审查 |

加权结果：`98.1`，四舍五入为 **98**。Accessibility 是 provisional，不代表完整 WCAG 人工验收。

## Top 3

1. 补齐真实证据入口，或移除指向不存在文件的承诺。当前 `/evidence/index.md` 实测 404，M1-M16 仍为 `UNVERIFIED`。
2. 空、格式错误、未知订单不应显示只有“查询结果”标题的空面板。错误文案本身正确，这是 Low 级 UX 噪声。
3. 继续做完整键盘遍历和屏幕阅读器审查。本轮已证明首个 Tab 焦点可见，但没有真实读屏用户证据。

## Findings

### ISSUE-001: 证据索引入口返回 404，人工检查记录缺失

- Severity / category：Medium / Links, evidence completeness
- 预期来源：`SPEC.md` 验收 21、22
- 实际：浏览器页脚“证据索引”指向 `/evidence/index.md`，HTTP `404`
- 缺失文件：`evidence/index.md`、`evidence/manual-checks/browser.md`
- README 同时引用不存在的 `BUILD-LOG.md` 和 `evidence/clean-run.md`
- 复现：加载首页，执行 `browse links`，再对 `/evidence/index.md` 发 HEAD 请求
- 证据：`probe-018-links.txt`，下面是实际状态

```text
200 http://127.0.0.1:4173/#catalog
200 http://127.0.0.1:4173/#lookup
200 http://127.0.0.1:4173/#cart
200 http://127.0.0.1:4173/README.md
404 http://127.0.0.1:4173/evidence/index.md
```

- 判定：`UNVERIFIED`，deferred。没有真实人工受试者，不能用自动探针伪造 M1-M16 签署。
- 影响：演示的核心闭环可用，但“可追溯证据包”的公开入口断开。

### ISSUE-002: 非成功查单留下空白结果面板

- Severity / category：Low / UX
- 预期：空输入、格式错误或未找到时只显示规定消息
- 实际：消息正确，但同时显示 `#lookup-result`，内容只有标题“查询结果”
- 复现输入：空字符串、`not-an-order`、`FL-20990101-010101-ZZZZ`
- 证据：checkpoint 009 和 `probe-009-output.txt`
- 判定：deferred。Standard fix tier 不修 Low。

## 验收标准

| # | 结果 | 实测依据 |
| ---: | --- | --- |
| 1 | PASS | `node serve.mjs` 启动成功；根路径 HTTP 200，`Cache-Control: no-store` |
| 2 | PASS | 10 张卡片、10 个加购按钮，名称顺序与目录一致 |
| 3 | PASS | `node --test` 退出 0；60 项，59 通过，1 跳过 |
| 4 | PASS | 刷新后购物车 0 件，已存订单仍可查 |
| 5 | PASS | 1、99 成功；0、负数、小数、文本、空值恢复；100 钳制为 99 |
| 6 | PASS | 1 时减号禁用，99 时加号禁用；移除逐行减到 0 |
| 7 | PASS | 空购物车显示规定文案，结账按钮 disabled |
| 8 | PASS | `¥34.97`、`¥218.90`、`¥1491.92` 均由页面实际计算 |
| 9 | PASS | 两次实机订单号均匹配固定格式 |
| 10 | PASS | Node 测试证明最多 10 次候选并返回失败 |
| 11 | PASS | 成功路径只有追加和读回后显示收据；存储为一行 NDJSON |
| 12 | PASS | 配额异常和读取安全异常均不显示成功，购物车保留 |
| 13 | PASS | 收据含订单号、时间、商品快照、行小计、合计、复制按钮 |
| 14 | PASS | 刷新后以小写且带首尾空格的订单号查回 |
| 15 | PASS | 空输入和未知订单文案正确 |
| 16 | PASS | 非法行提示跳过 1 条，有效订单仍可查，原始行保留 |
| 17 | PASS | 重复订单号不返回任一候选，存储未改写 |
| 18 | PASS | 损坏行注入后旧原始字符串仍是新值前缀；查单未改写 |
| 19 | PASS | `getItem` 抛错时仍可加购、改数量和移除 |
| 20 | PASS | README 只给出 `node serve.mjs` 启动路径，并包含重置说明 |
| 21 | UNVERIFIED | `evidence/index.md` 不存在 |
| 22 | UNVERIFIED | `evidence/manual-checks/browser.md` 不存在，无人工 M1-M16 |
| 23 | PARTIAL | 360/1440 布局和控制台通过；键盘与语义抽样通过；完整键盘流程、屏幕阅读器未验证 |
| 24 | PASS | 无远端资源、服务端订单 API、账号、数据库或第三方运行时资源 |

## 实测覆盖

| 表面 | 实测结果 |
| --- | --- |
| 初始加载 | 10 种水果，`booted=true`，无 console error |
| 全部加购 | 10 件，合计 `¥218.90` |
| 数量边界 | 1 和 99 正确；0、负数、小数、文本、空值按规范恢复；100 钳制 |
| 移除 | 10 行逐行清空，显示 `购物车为空`，结账禁用 |
| 核心闭环 | 苹果 2 + 香蕉 1，合计 `¥34.97`，订单成功保存 |
| 刷新与查单 | 购物车清空，订单保留，大小写和首尾空格归一化 |
| 查单错误 | 空、格式错误、未知订单文案正确 |
| 损坏 NDJSON | 跳过 1 条，有效订单仍可查，原始非法行保留 |
| 重复订单号 | 查询拒绝返回候选，存储未改写 |
| 配额失败 | 显示空间已满恢复文案，购物车保留，无成功收据 |
| 存储读取失败 | 浏览、加购、数量、移除继续可用，查单和结账报存储不可用 |
| 离线 | Chromium `setOffline(true)` 后完成加购、结账、查单；零请求、零外部资源 |
| 响应式 | 1440px 两列，360px 单列；两者 `scrollWidth == clientWidth` |
| 移动购物车 | 360px 加购后固定栏出现，位置在视口底部 |
| 无障碍抽样 | `lang=zh-CN`；landmark、标题层级、label、live region、焦点样式存在 |
| 对比度抽样 | 6 个样本均高于 4.5:1，最低实测 7.4:1 |
| 性能 | 本地加载 26ms；无 DNS/TCP/SSL 成本 |

## Console 与异常

- 初始加载、全部加购、结账、查单、损坏数据、重复数据、配额失败、读取失败和离线流程均未出现未处理异常。
- 程序化向 `type=number` 写入 `abc` 时，Chromium 产生一条 warning：值无法解析。这是输入控件自身的警告，不是页面异常，也未进入错误计数。

## Checkpoints

以下 19 个 checkpoint 均在本轮真实浏览器探测后落盘。

- [checkpoint 001](.gstack/qa-reports/run-20261017T085755Z/exploration-001.json) - 初始加载、10 个商品、空购物车
- [checkpoint 002](.gstack/qa-reports/run-20261017T085755Z/exploration-002.json) - 10 个商品全部加购
- [checkpoint 003](.gstack/qa-reports/run-20261017T085755Z/exploration-003.json) - 数量 1、99 和边界按钮
- [checkpoint 004](.gstack/qa-reports/run-20261017T085755Z/exploration-004.json) - 非法数量输入矩阵
- [checkpoint 005](.gstack/qa-reports/run-20261017T085755Z/exploration-005.json) - 100 钳制为 99
- [checkpoint 006](.gstack/qa-reports/run-20261017T085755Z/exploration-006.json) - 移除全部商品与空购物车
- [checkpoint 007](.gstack/qa-reports/run-20261017T085755Z/exploration-007.json) - 核心结账闭环与收据
- [checkpoint 008](.gstack/qa-reports/run-20261017T085755Z/exploration-008.json) - 刷新、持久化和归一化查单
- [checkpoint 009](.gstack/qa-reports/run-20261017T085755Z/exploration-009.json) - 空、格式错误、未知订单
- [checkpoint 010](.gstack/qa-reports/run-20261017T085755Z/exploration-010.json) - 损坏 NDJSON
- [checkpoint 011](.gstack/qa-reports/run-20261017T085755Z/exploration-011.json) - 重复订单号
- [checkpoint 012](.gstack/qa-reports/run-20261017T085755Z/exploration-012.json) - 配额写失败
- [checkpoint 013](.gstack/qa-reports/run-20261017T085755Z/exploration-013.json) - 存储读取失败
- [checkpoint 014](.gstack/qa-reports/run-20261017T085755Z/exploration-014.json) - 1440px 响应式
- [checkpoint 015](.gstack/qa-reports/run-20261017T085755Z/exploration-015.json) - 360px 响应式和移动购物车
- [checkpoint 016](.gstack/qa-reports/run-20261017T085755Z/exploration-016.json) - 无障碍语义、对比度和键盘焦点
- [checkpoint 017](.gstack/qa-reports/run-20261017T085755Z/exploration-017.json) - 本地加载性能
- [checkpoint 018](.gstack/qa-reports/run-20261017T085755Z/exploration-018.json) - 页面链接
- [checkpoint 019](.gstack/qa-reports/run-20261017T085755Z/exploration-019.json) - Chromium 离线闭环

截图位于 `.gstack/qa-reports/run-20261017T085755Z/screenshots/`：

- `initial.jpg`
- `cart-all-ten.jpg`
- `success.jpg`
- `lookup-found.jpg`
- `corrupt-storage.jpg`
- `duplicate-storage.jpg`
- `quota-failure.jpg`
- `responsive-1440.jpg`
- `responsive-360.jpg`
- `focus-skip-link.jpg`

## 命令与退出状态

| 命令 | 退出状态 | 结果 |
| --- | ---: | --- |
| `curl.exe --noproxy "*" -sS -I http://127.0.0.1:4173/` | 0 | HTTP 200，`no-store`，CSP 存在 |
| `node --test` | 0 | 60 项，59 pass，0 fail，1 skip |
| gstack `browse` checkpoint 探测 | 0 | 除一次报告格式修正外，所有探测 sentinel 正常 |
| Playwright 离线探测 | 0 | 无 console error、pageerror 或网络请求 |
| `gstack-qa-evidence materialize` | 0 | verdict `inconclusive (no evidence rows)` |

Node 测试唯一跳过项：Windows 当前 profile 不允许创建 symlink，symlink 逃逸测试按设计 skip。

## 证据完整性

- `annotations.json` 的 `limits` 已记录人工证据和读屏审查缺口。
- checkpoint 016 中 `mapShadow` 是落盘时的转录笔误，原始值在 `probe-016-focus.txt` 中为 `boxShadow: "none"`。未回写已发布 checkpoint。
- `browse` 的整页截图和 DOM 指标是本次运行时的快照，不替代人工 M1-M16 签署。
- 人工受试者、屏幕阅读器、真实低端设备和生产网络下的体验均未验证。

## 清理

- 本轮 QA 未修改 `SPEC.md` 或产品源码。
- QA 报告、探针脚本、截图和 checkpoint 均保留在仓库。
- 本轮启动的 `node serve.mjs` 在报告完成后停止。
- 未进入 ship，未提交代码，未声明 ship readiness。
