# 证据 · qa 环（R2 第 5/7 环）

> 真实 Chromium（chrome-devtools）实机探索。截图见 `evidence/visual/`。

## 1. 环境

| 项 | 值 |
|---|---|
| 日期 | 2026-10-18 |
| 服务 | `node cli.mjs --db data/qa.db dev` → `http://127.0.0.1:4174` |
| 浏览器 | Chromium（chrome-devtools MCP） |
| 视口 | 1440×900 / 1068×900 / 834×900 / 600×900 / 390×844（mobile,touch） |
| 数据库 | `data/qa.db`（种子 14 商品 + 3 账号） |

## 2. 操作与原始结果

### 2.1 首页与响应式

- 首页 14 张卡；滚动后 `document.images` 14/14 `naturalWidth>0`，无破图。
- 断点实测（`getComputedStyle(#catalog).gridTemplateColumns`）：
  - 1068px → `221.25px ×4`（4 列）
  - 834px → 3 列（截图 `home-834.png`）
  - 600px → `256.5px ×2`（2 列）
  - 390px → 1 列（截图 `home-390-top.png`）
- 390px：`nav.scrollWidth (357) > clientWidth (242)`，可横向滚动；购物袋入口初始在视口外（QA-01）。

### 2.2 主流程（1440px）

| 操作 | 结果 |
|---|---|
| 登录 userA | `session-user = userA` |
| 苹果×2 + 香蕉×1 | `3 件`、`合计 ¥34.97` |
| 结账 | `FL-20261018-092347-CEBP`；收据含订单号、本地时间、行小计、合计 |
| 我的订单 | 显示该订单与明细 |
| 登出 → userB → 查 userA 订单 | 消息「该订单属于其他账号，无法查看。」 |
| userA 查自己订单（小写+空格） | 「订单已找到。」；`activeElement = lookup-result-title` |

### 2.3 管理端

| 操作 | 结果 |
|---|---|
| admin 登录 → 管理面板 | 商品 14 行、订单面板可见 |
| 红富士改价 1111 分、库存 5 | 保存成功；公开接口 `unitPriceCents=1111`、`stock=5` |
| 香蕉下架 | `data-state=已下架`；公开列表 13 条、无香蕉 |
| kiwi 库存 0 | 刷新后卡片 `data-state=sold-out`、显示「已售罄」 |
| 管理订单 | 显示 `FL-20261018-092347-CEBP`、账号 `userA` |

### 2.4 移动端（390px）

- 加购后 `#mobile-cart-bar` 可见：`1 件 ¥11.11 查看购物袋`（截图 `home-390-cart.png`）。
- 导航 `overflow-x:auto`，`scrollWidth>clientWidth`。

### 2.5 持久化（重启）

```
服务停止 → 重新 node cli.mjs --db data/qa.db dev → 重新登录
orders after restart: 1 FL-20261018-092347-CEBP
kiwi soldOut: true stock: 0
apple price: 1111 stock: 5
```

### 2.6 网络与控制台

- 22 个请求全部 200（样式/脚本/14 张图/API）；无失败资源。
- 控制台：CSP meta `frame-ancestors` 警告（已修）、登录态 401、越权 403（预期）。

## 3. 发现与处置

| # | 严重度 | 发现 | 处置 |
|---:|---|---|---|
| QA-01 | Medium | 390px 导航需横滑才能看到购物袋 | OPEN（记录，不阻塞） |
| QA-02 | Medium | 图片授权扩展 CC0/CC BY/CC BY-SA/PD | 已记录（credits/测试同步） |
| QA-03 | Low | meta CSP `frame-ancestors` 被忽略 | 已修（移除 meta 指令） |
| QA-04 | Low | 标题仍为 R1「果子摊」 | 已修（FruitLab · 按份买水果） |
| QA-05 | Low | 图片背景风格不统一 | 记录 |
| QA-06..09 | Info | 懒加载截图假象、预期 401/403、需刷新、input 重绘 | 已解释 |

## 4. 截图

| 文件 | 内容 |
|---|---|
| `evidence/visual/home-1440.png` | 桌面首屏（4 列） |
| `evidence/visual/home-834.png` | 834px（3 列） |
| `evidence/visual/home-390-top.png` | 390px 首屏 |
| `evidence/visual/home-390-cart.png` | 390px 加购后（紧凑购物袋条） |

## 5. 诚实边界

- 人工无障碍（读屏器、完整键盘路径、对比度仪器）未做，`UNVERIFIED`。
- 性能未采集指标，标 `provisional`。
- 截图来自 chrome-devtools 附件，已复制入 `evidence/visual/`。
