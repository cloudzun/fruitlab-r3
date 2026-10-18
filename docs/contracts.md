# 契约冻结（R2）

> 目的：让"改了哪些契约、为什么"可核对（G3 / AC-11 / A7）。导出签名与失败形状在此冻结；`tests/contracts.test.mjs` 断言错误码集合与编号一致性。

## 1. 服务端模块导出

| 模块 | 导出 | 形状/说明 |
|---|---|---|
| `server/db.mjs` | `openDb(path?)` | `DatabaseSync`；`PRAGMA foreign_keys=ON`、`busy_timeout=300`、文件库尝试 WAL |
| | `migrate(db)` | 幂等建表；`PRAGMA user_version = 1` |
| | `seed(db, {hashPassword, demoPassword})` | 14 商品 + 3 账号；已存在则跳过 |
| | `isSeeded(db)` / `schemaVersion(db)` | `boolean` / `number` |
| | `enqueueWrite(fn)` / `inTransaction(db, fn)` | 单写者队列 / 事务包装（失败回滚） |
| `server/auth.mjs` | `hashPassword(pw, salt?)` | `scrypt$N$r$p$saltB64$hashB64` |
| | `verifyPassword(pw, stored)` | `boolean`（`timingSafeEqual`） |
| | `createSession(db, userId)` | 返回明文 token（库中存 sha256） |
| | `getSessionUser(db, token)` / `deleteSession(db, token)` | 用户对象或 `null` / 删除行数 |
| | `validateCredentials({username,password})` | `null` 或稳定 code |
| `server/products.mjs` | `listProducts(db, {includeUnlisted})` | `Product[]`，按 `sort_order, product_id` |
| | `getProduct(db, id)` / `updateProduct(db, id, patch)` | `Product` 或 `null` / `{ok, product}` 或 `{ok:false, code}` |
| `server/orders.mjs` | `normalizeItems(items)` | `{ok, items}` 或 `{ok:false, code}`；合并重复、上限 10 |
| | `createOrder(db, {userId, items, clientOrderId, now, suffixFactory})` | `{ok, status:'created'|'existing', order}` 或 `{ok:false, code}`；事务内扣库存 |
| | `listOrdersByUser(db, userId)` / `getOrderByNumber(db, number)` / `listAllOrders(db)` | `Order[]` / `Order|null` / `Order[]` |
| `server/router.mjs` | `createApiHandler({db, version, dbPath, port, startedAt})` | `(req,res)=>Promise<boolean>` |
| `serve.mjs` | `createStaticServer({port, db, dbPath})` | `{server, url, port}`；静态 + `/api` 路由 |
| | `PUBLIC_ALLOWLIST` / `MIME_TYPES` / `HOST` / `DEFAULT_PORT(4174)` | 静态白名单与常量 |

## 2. R1 行为对照（A7 / OB-CEO-03）

| R1 行为 | R2 状态 | 说明 |
|---|---|---|
| 顶层「查订单」入口 | **保留** | 仍在导航首层 |
| 查询后聚焦结果标题 | **保留** | 查询成功即聚焦 |
| 输入即清过期结果 | **保留** | |
| 数量 1/99 边界禁用 | **保留** | |
| 收据/结果失焦隐藏 | **保留** | 购物车变动与新结账都隐藏 |
| 错误按码给具体文案 | **保留** | 错误码映射到 `docs/error-catalog.md` |
| 结账中禁用、`save-unknown` 不自动重试 | **保留** | 引导到「我的订单」核对 |
| <720px 紧凑购物袋 | **保留** | |
| **访客凭订单号查单（无需登录）** | **移除（breaking）** | 按 U2=A；查单需登录且只能查自己的订单；README/CHANGELOG 记录 |
| 订单存 `localStorage` | **移除** | 改为服务端数据库 |
| 商品为纯文字卡 | **移除** | 改为照片卡（Apple 式版式） |
| 手写果摊招牌视觉（DV1） | **移除** | 改为 Apple 式高冷克制风（D-08） |

## 3. 三层命名映射（OB-DX-10）

| 概念 | DB 列 | HTTP JSON | CLI flag |
|---|---|---|---|
| 单价（分） | `unit_price_cents` | `unitPriceCents` | `--unit-price-cents`（`--cents` 兼容别名） |
| 库存 | `stock` | `stock` | `--stock`（`--units` 兼容别名） |
| 上下架 | `listed`（0/1） | `listed`（boolean） | `--listed 0|1`；子命令 `unlist`/`relist` |
| 订单号 | `order_number` | `orderNumber` | 位置参数 `<orderNumber>` |
| 幂等键 | `client_order_id` | `clientOrderId` | 由前端生成（CLI 不暴露） |

## 4. 领域层复用

`assets/domain.mjs` 的 10 个纯函数与 `limits` **签名与实现不变**；`tests/domain.test.mjs` 原样通过。服务端 `createOrder` 复用 `generateUniqueOrderNumber`（10 次预算）。

## 5. 数据源边界

- 商品真源：数据库；`assets/catalog.mjs` 退役；
- 订单真源：数据库；`assets/order-store.mjs` 退役；
- 前端不得直接读 `localStorage` 作为订单来源。
