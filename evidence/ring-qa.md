# 证据 · qa 环（R3，5/7 环）

> 环境：`http://127.0.0.1:4175`（Caddy → api → Postgres 三容器，全部 healthy）；真实 Chromium（chrome-devtools MCP）。
> 视口：1440×900、834×1112、390×844（mobile/touch 模拟）。

## 1. 真实执行记录

```text
docker compose ps
  fruitlab-r3-db-1   Up (healthy)
  fruitlab-r3-api-1  Up (healthy)
  fruitlab-r3-web-1  Up (healthy)
```

浏览器（Chromium via MCP）：

- 首页：14 张商品卡；`img.naturalWidth > 0` = 14/14；alt 非空；
- computed grid：1440→4 列、834→3 列、390→1 列；
- 390：`document.documentElement.scrollWidth == clientWidth`（390），无横向滚动；
- 390 加购后 `.mobile-cart-link` 可见：「1 件 ¥12.99 查看购物袋」；
- 登录 `userA/demo1234` → 加购香蕉 → 结账 → 收据 `FL-20261018-040437-PDFD`；「我的订单」2 笔（含此前容器测试单）；
- 控制台：仅 1 条预期 401（匿名 `/api/auth/me`）；
- 网络：27 个请求，除匿名 me 401 外全部 200/201；图片 14/14 200。

截图：

| 文件 | 说明 |
|---|---|
| `evidence/visual/r3-home-1440.jpg` | 1440 全页（4 列） |
| `evidence/visual/r3-home-834.jpg` | 834 全页（3 列） |
| `evidence/visual/r3-home-390.jpg` | 390 全页（1 列） |
| `evidence/visual/r3-cart-390.png` | 390 视口 + 紧凑购物袋条 |
| `evidence/visual/r3-receipt-1440.jpg` | 下单收据 + 我的订单 |

## 2. 容器/持久化/备份恢复（与 ring-build 互补）

- `docker compose restart api db` → 重新登录 → 订单 200；
- `docker compose down`（保留卷）+ `up -d` → 订单 200；
- `scripts/backup.sh` → 删订单 → `scripts/restore.sh` → 订单 200、products=14/users=3；
- simple 两容器：api/db healthy、`/api/health` up；**首页 HTML 未验证**。

## 3. 未验证（UNVERIFIED）

- 读屏器人工审查、完整键盘 Tab 全流程、对比度仪器测量；
- simple 模式首页 HTML；
- Docker Desktop 原生引擎复测（本机仅 WSL Docker）；
- 性能指标采集（performance 分为 provisional）。

## 4. 诚实边界

1. 截图来自真实 Chromium，不是 fake DOM；但 390/834 使用 MCP 模拟视口，不是实体手机。
2. 无 Critical/High；两项人工无障碍检查为 `UNVERIFIED`，不得写成“通过”。
3. qa 不重新判断 review 的代码结论；review 修复后的代码已重新构建镜像并复测。
