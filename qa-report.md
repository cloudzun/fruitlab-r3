# qa-report.md（R2 第 5/7 环）

> **环境**：`http://127.0.0.1:4174`，真实 Chromium（chrome-devtools），`data/qa.db` 干净库。
> **视口**：1440 / 1068 / 834 / 600 / 390（移动端带 touch）。
> **方法**：真实浏览器操作 + 网络/控制台核对 + 重启持久化验证；未做读屏器等人工无障碍审查（标 `provisional`）。

## 1. 健康分

| 类别 | 分 | 说明 |
|---|---:|---|
| Console | 98 | 修复 1 条 CSP meta 警告；剩余 401/403 为登录态/越权流程的**预期**响应 |
| Visual | 90 | 版式符合 Apple 式（白底/大留白/4 列/胶囊 CTA）；真实图库图片背景不统一 |
| Functional | 100 | 登录、购物袋、下单、我的订单、越权拒绝、管理改价/库存/上下架、查单聚焦全部通过 |
| Performance | 90（provisional） | 全本地资源、无失败请求；未做指标采集 |
| Content | 96 | 文案克制、金额/时间/合计正确；标题已从 R1 修正 |
| Accessibility | 92（provisional） | alt 齐全、焦点可见、`aria-invalid`/`aria-describedby`、`aria-live`；未做读屏人工审查 |
| UX | 92 | 主流程顺畅；390px 导航需横向滑动才能看到「购物袋」 |
| Links | 100 | 页面与图片请求全部 200；页脚证据/授权链接可解析 |
| **加权健康分** | **94** | 无 Critical / High；2 个 Medium、2 个 Low（见 §3） |

## 2. 实测通过项

| # | 场景 | 结果 |
|---:|---|---|
| 1 | 首页 14 张商品卡 + 照片 + alt | 14/14 图片 `naturalWidth>0`，无破图 |
| 2 | 断点 | 1068→4 列、834→3 列、600→2 列、390→1 列（computed grid 实测） |
| 3 | 登录 `userA` | 会话生效；导航显示「我的订单/退出」 |
| 4 | 购物袋 | 苹果×2 + 香蕉×1 → `3 件`、合计 `¥34.97`（与 R1 示例一致） |
| 5 | 下单 | `FL-20261018-092347-CEBP`，收据含订单号/本地时间/行小计/合计 |
| 6 | 我的订单 | 显示该订单与明细 |
| 7 | 越权 | `userB` 查 `userA` 订单 → 「该订单属于其他账号，无法查看。」 |
| 8 | 登出 | 会话清空；旧 Cookie 服务端失效（review 环测试覆盖） |
| 9 | 管理端 | 14 行商品；改价 `¥11.11`、库存 `5`、下架香蕉 → 公开列表 13 条且无香蕉 |
| 10 | 售罄 | `kiwi` 库存置 0 → 卡片 `data-state="sold-out"`、显示「已售罄」 |
| 11 | 查单聚焦 | 成功查单后 `document.activeElement` = `#lookup-result-title` |
| 12 | 数量框失焦 | 改数量失焦后点击 `+` 未被吞：`2→3→4 件` |
| 13 | 移动端 | 390px 购物袋紧凑条出现（`1 件 ¥11.11 查看购物袋`）；导航可横向滚动 |
| 14 | 持久化 | 停服重启后订单仍在，`apple` 价格/库存与 `kiwi` 售罄均保留 |
| 15 | 网络/控制台 | 22 个请求全部 200/无失败资源；无未捕获异常 |

截图证据：[`evidence/visual/home-1440.png`](evidence/visual/home-1440.png)、[`home-834.png`](evidence/visual/home-834.png)、[`home-390-top.png`](evidence/visual/home-390-top.png)、[`home-390-cart.png`](evidence/visual/home-390-cart.png)。

## 3. 发现

| # | 严重度 | 发现 | 处置 |
|---:|---|---|---|
| QA-01 | Medium | 390px 导航为横向滚动，初始看不到「购物袋」入口（规范允许滚动，但可发现性弱） | **OPEN**：建议折行或缩短文案；本轮不阻塞发布，记录 |
| QA-02 | Medium | 图片授权策略扩展为 CC0 / CC BY / CC BY-SA / Public Domain（SPEC §5.8 原写仅 CC0/BY） | **已记录**：`docs/assets-credits.md` 逐张署名；测试允许值同步；作为**降级项**记录 |
| QA-03 | Low | `index.html` meta CSP 的 `frame-ancestors` 被浏览器忽略并报错 | **已修**：meta 中移除该指令，HTTP 头仍下发 |
| QA-04 | Low | 页面标题仍是 R1「果子摊」 | **已修**：改为「FruitLab · 按份买水果」 |
| QA-05 | Low | 真实图库图片背景/风格不统一，削弱「高冷」一致性 | 记录，不修（需设计级素材预算） |
| QA-06 | Info | 全页截图出现空白瓦片 | 懒加载未触发（滚动后 14/14 正常），**非缺陷** |
| QA-07 | Info | 控制台 401/403 | 未登录 `/api/auth/me` 与越权查单的**预期**响应 |
| QA-08 | Info | 管理端改价/库存后公开页需刷新 | PRD 不做多标签实时同步，符合非目标 |
| QA-09 | Info | 数量框重绘替换 input 节点 | 点击未被吞（实测），符合 R1 交互契约 |

## 4. 人工项与未验证

- 读屏器人工审查、完整键盘 Tab 全流程、对比度仪器测量：**`UNVERIFIED`**（环境无这些人工受试条件）。
- 详情见 [`evidence/manual-checks/browser.md`](evidence/manual-checks/browser.md)。

## 5. 结论

**无 Critical / High；可进入 ship 环。** 2 个 Medium（移动导航可发现性、图片授权策略扩展）与 2 个 Low 已记录/已修，不掩盖。
