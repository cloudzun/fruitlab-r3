# 人工浏览器检查清单（R3）

> **状态**：qa 环用真实 Chromium（chrome-devtools MCP）完成可自动判定项；**读屏器、完整键盘 Tab 流程、对比度仪器**仍 `UNVERIFIED`。

## 自动/半自动检查（已执行）

| 项 | 结果 |
|---|---|
| 14 张商品图加载（naturalWidth>0）与 alt | 通过 |
| 断点 computed grid：1440→4 / 834→3 / 390→1 | 通过 |
| 390 无横向滚动（scrollWidth==clientWidth） | 通过 |
| 390 紧凑购物袋条（加购后） | 通过 |
| 登录/加购/下单/我的订单（经 Caddy 4175） | 通过 |
| 控制台错误 | 仅匿名 `/api/auth/me` 401（预期） |
| 网络失败请求 | 无（图片/静态/API 均 200/201，除预期 401） |
| 收据金额/时间/合计 | 通过 |
| 我的订单刷新与历史订单 | 通过 |

## 人工项（UNVERIFIED）

| 项 | 原因 |
|---|---|
| 读屏器审查（NVDA/VoiceOver） | 环境无受试条件 |
| 完整键盘 Tab 全流程 | 未做人工逐键记录（有 `:focus-visible` 与 skip link） |
| 对比度仪器测量 | 未测（设计词元声称 ≥4.5:1） |
| 实体手机 390/834 | 使用 MCP 模拟视口，非实体设备 |

## 诚实边界

- 以上“通过”均来自本次真实浏览器操作与截图；`UNVERIFIED` 不得写成“通过”。
- 截图：`evidence/visual/r3-home-1440.jpg`、`r3-home-834.jpg`、`r3-home-390.jpg`、`r3-cart-390.png`、`r3-receipt-1440.jpg`。
