# API 契约（R3）

> 统一前缀 `/api`；成功 `{ok:true,...}`；失败 `{ok:false,code,message,details?}`；所有响应带 `X-Request-Id`、`Cache-Control: no-store`。
> 错误码唯一真源：`docs/error-catalog.md`；判定优先级见 `SPEC.md` §5.4。

## 1. 认证

### POST /api/auth/register
请求：`{"username":"userA","password":"demo1234"}` → `201 {"ok":true,"user":{"id":"U...","username":"userA","role":"user"}}`
失败：400 `invalid-username`/`invalid-password`；409 `auth-username-taken`。

### POST /api/auth/login
请求：`{"username":"userA","password":"demo1234"}` → `200 {"ok":true,"user":{...}}`
`Set-Cookie: fruitlab_session=...; HttpOnly; SameSite=Lax; Max-Age=...` + `fruitlab_csrf=...`（JS 可读）。
失败：401 `auth-invalid-credentials`；429 `auth-rate-limited`（带 `Retry-After`）。

### POST /api/auth/logout
无请求体；有会话时需 CSRF 头。→ `204`，清两个 Cookie。

### GET /api/auth/me
→ `200 {"ok":true,"user":{"id","username","role"}}` 或 `401 auth-required`。

## 2. 商品

### GET /api/products
→ `200 {"ok":true,"products":[{id,name,unit,unitPriceCents,stock,soldOut,image,alt,description,sortOrder}]}`（只含上架）。

### GET /api/admin/products（admin）
→ 含下架商品的全量列表。

### PATCH /api/admin/products/{id}（admin + CSRF）
请求：`{"unitPriceCents"?:int,"stock"?:int,"listed"?:boolean}` → `200 {"ok":true,"product":{...}}`
失败：400 `invalid-price`/`invalid-stock`/`invalid-listed`；404 `product-not-found`。

## 3. 订单

### POST /api/orders（登录 + CSRF）
请求：`{"items":[{"productId":"banana","quantity":2}],"clientOrderId":"8-128-chars"}`
→ `201 {"ok":true,"order":{orderNumber,userId,createdAt,subtotalCents,items:[...]}}`；同一 `clientOrderId` 重放 → `200` 同一订单。
失败：400 `invalid-quantity`/`invalid-request`；404 `product-not-found`；409 `product-unlisted`/`insufficient-stock`/`order-number-exhausted`。

### GET /api/orders/mine（登录）
→ `200 {"ok":true,"orders":[...]}`（创建时间倒序）。

### GET /api/orders/{orderNumber}（登录）
自己的订单 200；**他人订单与不存在都返回 404 `order-not-found`**；admin 可查任意。

### GET /api/admin/orders（admin）
→ 全部订单（含 username/itemCount 摘要）。

## 4. 健康

### GET /api/health
→ `200 {"ok":true,"db":"up","schemaVersion":1,"version":"3.0.0.0","seeded":true,"uptimeSeconds":n}`
DB 不可达/超时 → `503 {"ok":false,"code":"db-unavailable","db":"down","message":...}`（≤ `healthTimeoutMs`，默认 3s）。

## 5. 写请求的 CSRF 流程

1. 页面先发安全请求（`GET /api/health` / `/api/products` / `/api/auth/me`）→ 服务端下发 `fruitlab_csrf`；
2. 写请求带 `X-CSRF-Token: <cookie 值>`；
3. 缺失/不符 → `403 csrf-token-invalid`；前端 `api-client` 自动补 token 并重试一次；
4. 登录/注册无会话，不要求 token，仅受 Origin/Host 保护。

## 6. 示例（curl）

```bash
curl -s http://127.0.0.1:4175/api/health
curl -s -c cookies.txt -H 'Content-Type: application/json' \
  -d '{"username":"userA","password":"demo1234"}' http://127.0.0.1:4175/api/auth/login
CSRF=$(awk '$6=="fruitlab_csrf" {print $7}' cookies.txt)
curl -s -b cookies.txt -H "X-CSRF-Token: $CSRF" -H 'Content-Type: application/json' \
  -d '{"items":[{"productId":"banana","quantity":1}],"clientOrderId":"curl-order-0001"}' \
  http://127.0.0.1:4175/api/orders
```
