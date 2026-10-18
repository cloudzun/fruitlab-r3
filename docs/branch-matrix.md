# 分支矩阵（命名结果码 × 测试）

> 目的：替代"断言数量"作为覆盖代理（E10 / G3）。每条命名分支必须能指出测试位置；review/qa 逐项核对。

## 领域层（`assets/domain.mjs`，R1 原样）

| 分支/结果 | 测试 |
|---|---|
| `parseQuantity` 合法/越界/非数字 | `tests/domain.test.mjs` |
| `lineTotalCents` / `subtotalCents` / `formatCny` | `tests/domain.test.mjs` |
| `normalizeOrderNumber` / `isOrderNumberFormat` | `tests/domain.test.mjs` |
| `createOrderNumber` 非法 Date 抛出 | `tests/domain.test.mjs` |
| `generateUniqueOrderNumber` 预算内/耗尽 | `tests/domain.test.mjs` |
| `validateOrder` 合法/缺字段/超限 | `tests/domain.test.mjs` |
| `parseOrdersRaw` 损坏行/空/重复 | `tests/domain.test.mjs` |
| `serializeOrder` 往返 | `tests/domain.test.mjs` |

## 服务端存储与事务

| 分支/结果 | 测试 |
|---|---|
| 建表/迁移幂等/`user_version=1` | `tests/db.test.mjs` |
| 种子 14 商品 + 3 账号、重复 seed 不重写 | `tests/db.test.mjs` |
| 用户名唯一 | `tests/db.test.mjs` |
| 下单成功扣库存 | `tests/db.test.mjs`、`tests/api.test.mjs` |
| `clientOrderId` 幂等（同键只一单） | `tests/db.test.mjs`、`tests/api.test.mjs` |
| 库存不足回滚（无订单/无明细/库存不变） | `tests/db.test.mjs` |
| 下架商品拒单 | `tests/db.test.mjs` |
| 订单归属隔离 | `tests/db.test.mjs`、`tests/api.test.mjs` |

## HTTP 与权限

| 分支/结果 | 测试 |
|---|---|
| `GET /api/health` 200 + 字段 | `tests/api.test.mjs` |
| `GET /api/products` 14 条、无下架 | `tests/api.test.mjs` |
| 登录成功/失败/未知用户同码 | `tests/api.test.mjs` |
| 登出后旧 Cookie 401 | `tests/api.test.mjs` |
| 未登录下单 401 | `tests/api.test.mjs` |
| 下单 201、幂等 200 | `tests/api.test.mjs` |
| 他人订单 403 `order-not-owned` | `tests/api.test.mjs` |
| admin 全量订单 / 非 admin 403 | `tests/api.test.mjs` |
| admin 商品全量/改价/改库存/下架 | `tests/api.test.mjs` |
| 405 + `Allow` | `tests/api.test.mjs` |
| 415 / 400 invalid-json / 413 | `tests/api.test.mjs` |
| 跨源 403 / 坏 Host 403 | `tests/api.test.mjs` |
| 静态 CSP 头 | `tests/api.test.mjs` |

## CLI

| 分支/结果 | 测试 |
|---|---|
| `--help` 0 / 未知参数 2 | `tests/cli.test.mjs` |
| `db init` / `db seed` / `db check` | `tests/cli.test.mjs` |
| `product list` / `set-price` | `tests/cli.test.mjs` |
| `user add --password-stdin` / `user list` | `tests/cli.test.mjs` |
| `db reset` 无 `--yes` 拒绝；有 `--yes` 备份并重建 | `tests/cli.test.mjs` |
| `orders list` 空库 | `tests/cli.test.mjs` |

## 前端（fake DOM / 静态扫描）

| 分支/结果 | 测试 |
|---|---|
| 登录态渲染 / 未登录引导 | `tests/app.test.mjs` |
| 购物袋行算式/合计/数量边界 | `tests/controller.test.mjs`、`tests/app.test.mjs` |
| 查单聚焦/清旧结果/`aria-invalid` | `tests/app.test.mjs` |
| 错误码文案映射 | `tests/app.test.mjs` |
| 商品卡六态（正常/加载/空/错误/售罄/下架） | `tests/app.test.mjs` |
| 无 `innerHTML` 等注入 sink、无远程资源/字体 | `tests/static-scan.test.mjs` |
