# qa-report.md（R3 第 5/7 环）

> **环境**：`http://127.0.0.1:4175`（Caddy → api → Postgres 三容器），真实 Chromium（chrome-devtools MCP）；容器 `fruitlab-r3-*` 全部 healthy。
> **视口**：1440×900、834×1112、390×844（mobile/touch 模拟）。
> **方法**：真实浏览器操作 + 网络/控制台核对 + 断点计算样式断言；容器/持久化/备份恢复证据见 `evidence/container/`。

## 1. 健康分

| 类别 | 分 | 说明 |
|---|---:|---|
| Console | 99 | 仅 1 条预期 401（匿名 `/api/auth/me`）；无未捕获异常 |
| Visual | 90 | R2 Apple 式版式保持；真实图库照片风格差异（R2 既有问题，未重制） |
| Functional | 100 | 登录→加购→下单→我的订单全通过；CSRF 跨 Caddy 生效 |
| Performance | 90（provisional） | 全本地资源、无失败请求；未做指标采集 |
| Content | 96 | 金额/时间/合计正确；文案克制 |
| Accessibility | 92（provisional） | alt 齐全、焦点可见、`aria-live`、`aria-invalid`；未做读屏器/对比度仪器审查 |
| UX | 96 | 主流程顺畅；390px 紧凑购物袋可见 |
| Links | 100 | 页面/图片/页脚证据链接全部 200 |
| **加权健康分** | **95** | 无 Critical / High；2 项 `UNVERIFIED`（读屏器、对比度仪器） |

## 2. 实测通过项

| # | 场景 | 结果 |
|---:|---|---|
| 1 | 首页 14 张商品卡 + 12 张图 `naturalWidth>0` + alt | 通过（14/14 图片加载，alt 非空） |
| 2 | 断点：1440→4 列、834→3 列、390→1 列（computed grid） | 通过 |
| 3 | 390px 无横向滚动（scrollWidth == clientWidth） | 通过 |
| 4 | 390px 紧凑购物袋条「1 件 ¥12.99 查看购物袋」 | 通过（`.mobile-cart-link` 可见） |
| 5 | 登录 `userA`（经 Caddy/4175） | 通过；导航显示「我的订单/退出」 |
| 6 | 加购：香蕉×1 → 购物袋 1 件、合计 ¥8.99 | 通过 |
| 7 | 下单：`FL-20261018-040437-PDFD`，收据含订单号/时间/行小计/合计 | 通过 |
| 8 | 我的订单：2 笔（含此前容器测试订单 `FL-20261018-033123-JCSP`） | 通过 |
| 9 | CSRF：登录 Cookie + 写请求头跨 Caddy 生效 | 通过（无 403） |
| 10 | 控制台/网络：27 请求，除匿名 me 401 外全部 200/201 | 通过 |
| 11 | 容器：db/api/web 三容器 healthy；api/web `id -u`=1000 | 通过（`evidence/container/`） |
| 12 | 重启持久化：`restart api db` 后订单仍在 | 通过 |
| 13 | `down`/`up`（保留卷）后订单仍在 | 通过 |
| 14 | 备份 → 删订单 → 恢复：订单回来（200），products=14/users=3 | 通过 |
| 15 | 两容器 simple 模式：api/db healthy、`/api/health` up | 通过（首页 HTML 未验证，见 §4） |

截图证据：`evidence/visual/r3-home-1440.jpg`、`r3-home-834.jpg`、`r3-home-390.jpg`、`r3-cart-390.png`、`r3-receipt-1440.jpg`。

## 3. 发现

| # | 严重度 | 发现 | 处置 |
|---:|---|---|---|
| QA-01 | Info | 匿名 `/api/auth/me` 返回 401，浏览器控制台记一条错误 | 预期行为（未登录探测），不修 |
| QA-02 | Info | 商品照片风格/背景不统一 | R2 既有素材问题，R3 不重制；记录 |
| QA-03 | Low | simple 两容器模式只验证了 health 与容器健康，未验证首页 HTML | 记为未验证；默认三容器首页已验证 |
| QA-04 | Info | 我的订单里出现容器测试订单（`...JCSP`） | 预期（同一 Postgres volume，证明持久化） |

**无 Critical / High。**

## 4. 人工项与未验证（UNVERIFIED）

- 读屏器人工审查、完整键盘 Tab 全流程、对比度仪器测量：`UNVERIFIED`（环境无人工受试条件）。
- simple 两容器模式的首页 HTML：`UNVERIFIED`（只验证了 `/api/health` 与容器健康）。
- DB down 的 live 浏览器白屏/降级未实测：由 `/api/health` 503（`tests/review-fixes.test.mjs`）与商品加载错误态（`tests/app.test.mjs`）分别覆盖，不写成“已实机验证”。
- 未在 Docker Desktop 原生引擎复测；容器证据来自 WSL Docker。
- 未做性能指标采集（performance 分为 provisional）。

## 5. 结论

R3 在 4175 经 Caddy 的真实浏览器中完成注册/登录/加购/下单/我的订单闭环，CSRF 与三容器拓扑生效；断点与移动端无横向滚动；持久化与备份恢复有真实容器证据。**无 Critical / High**；两项人工无障碍检查为 `UNVERIFIED`，不写成“通过”。
