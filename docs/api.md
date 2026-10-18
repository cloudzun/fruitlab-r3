# API 契约（R2）

> 唯一真源：`SPEC.md` §5.2 + `docs/error-catalog.md`。本文件给实现者与前端用的形状摘要。
> 所有 `/api/*` 响应为 JSON；成功 `{ "ok": true, ... }`；失败 `{ "ok": false, "code", "message", "details"? }`。
> 认证：`fruitlab_session` Cookie（`HttpOnly; SameSite=Lax`），同源 `fetch` 需 `credentials: "same-origin"`。

## 端点

| 方法 | 路径 | 权限 | 请求体 | 成功 |
|---|---|---|---|---|
| GET | `/api/health` | 公开 | — | `{ok, version, schemaVersion, dbPath, port, seeded, uptimeSeconds}` |
| GET | `/api/products` | 公开 | — | `{ok, products: Product[]}`（只含 `listed=1`） |
| POST | `/api/auth/register` | 公开 | `{username,password}` | 201 `{ok, user}` |
| POST | `/api/auth/login` | 公开 | `{username,password}` | 200 `{ok, user}` + `Set-Cookie` |
| POST | `/api/auth/logout` | 会话 | — | 204（删除服务端会话 + 清 Cookie） |
| GET | `/api/auth/me` | 公开 | — | 200 `{ok, user}` 或 401 |
| POST | `/api/orders` | 登录 | `{items:[{productId,quantity}], clientOrderId}` | 201 新建 / 200 幂等命中 `{ok, order}` |
| GET | `/api/orders/mine` | 登录 | — | `{ok, orders: Order[]}`（≤100，倒序） |
| GET | `/api/orders/{orderNumber}` | 登录 | — | `{ok, order}`；他人 403 `order-not-owned` |
| GET | `/api/admin/orders` | admin | — | `{ok, orders: Order[]}`（含 `username`、`itemCount`） |
| GET | `/api/admin/products` | admin | — | `{ok, products: Product[]}`（含下架） |
| PATCH | `/api/admin/products/{id}` | admin | `{unitPriceCents?, stock?, listed?}` | `{ok, product}` |

## 形状

```json
// Product
{ "id": "fuji-apple", "name": "红富士苹果", "unit": "500g", "unitPriceCents": 1299,
  "stock": 120, "listed": true, "soldOut": false,
  "image": "assets/images/products/fuji-apple.jpg", "alt": "红富士苹果 500g",
  "description": "脆甜多汁，果香清亮", "sortOrder": 1 }

// Order
{ "orderNumber": "FL-20261018-081500-A7K2", "userId": "U...", "createdAt": "2026-10-18T08:15:00.000Z",
  "subtotalCents": 2598,
  "items": [ { "productId": "fuji-apple", "name": "红富士苹果", "unit": "500g",
               "quantity": 2, "unitPriceCents": 1299, "subtotalCents": 2598 } ] }
```

## 请求约束

- `Content-Type: application/json`（POST/PATCH），否则 415；
- 请求体 ≤ 65536 字节，否则 413；
- 单笔订单最多 10 种商品；同一 `productId` 重复出现会合并数量，合并后数量仍须 1–99；
- `clientOrderId` 8–128 字符，用于下单幂等；
- 状态变更请求若带 `Origin` 必须与 `Host` 同源；`Sec-Fetch-Site` 只允许 `same-origin` / `none`；缺失头按非浏览器客户端放行（风险见 `DECISIONS.md` D-27/OB-ENG-04）。

## 示例（curl，本机）

```bash
curl -i -c cookies.txt -H "Content-Type: application/json" \
  -d '{"username":"userA","password":"demo1234"}' http://127.0.0.1:4174/api/auth/login

curl -b cookies.txt -H "Content-Type: application/json" \
  -d '{"items":[{"productId":"fuji-apple","quantity":2}],"clientOrderId":"demo-0001"}' \
  http://127.0.0.1:4174/api/orders
```
