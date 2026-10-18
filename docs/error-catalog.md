# 错误目录（唯一真源）

> **本文件是错误码的唯一真源。** `server/errors.mjs` 是镜像；`tests/contracts.test.mjs` 断言两边的 code 集合一致。
> **两种响应形态**：API 层（`/api/*`）用 `{ "ok": false, "code", "message", "details"? }`；静态层用 `application/problem+json`（`{type,title,status,detail}`）。两者不混用。
> **判定优先级**：见 `SPEC.md` §5.2（413/400 invalid-json → 405 → 401 → 403 → 404 → 400 → 400 业务 → 409 → 500/503）。

| code | HTTP | surface | 触发条件 | 用户文案 | 恢复 |
|---|---:|---|---|---|---|
| `invalid-request` | 400 | API | 字段缺失/类型错/无可更新字段 | 请求参数不正确 | 修正参数后重试 |
| `invalid-json` | 400 | API | 请求体不是合法 JSON | 请求体不是合法 JSON | 发送合法 JSON |
| `invalid-quantity` | 400 | API | 数量不是 1–99 整数，或合并后超 99 | 数量必须是 1 到 99 的整数 | 调整数量 |
| `invalid-price` | 400 | API/CLI | 价格越界或非整数分 | 价格必须是 0 到 9999999 的整数（分） | 用整数分 |
| `invalid-stock` | 400 | API/CLI | 库存越界或非整数 | 库存必须是 0 到 99999 的整数 | 用整数 |
| `invalid-listed` | 400 | API | listed 不是 0/1/true/false | listed 只能是 0 或 1 | 传 0/1 |
| `invalid-username` | 400 | API/CLI | 用户名不满足 3–32 位 `[A-Za-z0-9_-]` | 用户名需为 3 到 32 位字母、数字、下划线或短横线 | 换用户名 |
| `invalid-password` | 400 | API/CLI | 口令长度不在 8–128 | 口令长度需为 8 到 128 位 | 换口令 |
| `auth-required` | 401 | API | 无会话或会话无效 | 请先登录 | 登录 |
| `auth-invalid-credentials` | 401 | API | 用户名不存在或口令错误（不区分） | 用户名或口令不正确 | 重试登录 |
| `auth-forbidden` | 403 | API | 角色不足（非 admin 调管理接口） | 没有权限执行该操作 | 用 admin |
| `order-not-owned` | 403 | API | 查他人订单（存在性泄露取舍见 D-32） | 该订单不属于当前用户 | 查自己的订单 |
| `cross-origin-blocked` | 403 | API | Origin/Sec-Fetch-Site 跨源 | 跨站请求被拒绝 | 同源调用 |
| `host-not-allowed` | 403 | API | Host 不在 `127.0.0.1:<port>` / `localhost:<port>` | 请求 Host 不被允许 | 用回环地址 |
| `product-not-found` | 404 | API | 商品不存在 | 商品不存在 | 刷新列表 |
| `order-not-found` | 404 | API/CLI | 订单不存在 | 订单不存在 | 核对订单号 |
| `not-found` | 404 | API/静态 | 路径不存在 | 请求的资源不存在 | 检查路径 |
| `allow` | 405 | API/静态 | 方法不允许（带 `Allow` 头） | 请求方法不被允许 | 换方法 |
| `auth-username-taken` | 409 | API/CLI | 注册重名 | 用户名已被占用 | 换用户名 |
| `insufficient-stock` | 409 | API | 下单量超过库存 | 库存不足 | 减少数量 |
| `product-unlisted` | 409 | API | 下单已下架商品 | 商品已下架 | 刷新列表 |
| `duplicate-order-number` | 409 | 内部 | 订单号唯一冲突（重试预算内应已避免） | 订单号重复 | 重试 |
| `order-number-exhausted` | 409 | API | 订单号重生成 10 次仍冲突 | 订单号生成失败，请稍后重试 | 稍后重试 |
| `payload-too-large` | 413 | API | 请求体超过 64 KiB | 请求体超过 64 KiB | 缩小请求 |
| `unsupported-media-type` | 415 | API | POST/PATCH 的 Content-Type 非 JSON | 请求体必须是 application/json | 改 Content-Type |
| `server-busy` | 503 | API | SQLite 忙且重试耗尽 | 数据库繁忙，请稍后重试 | 稍后重试 |
| `internal-error` | 500 | API/静态 | 未预期异常（脱敏，不回显堆栈） | 服务器内部错误 | 凭 `X-Request-Id` 排查 |

## CLI 退出码

| 退出码 | 含义 | 示例 |
|---:|---|---|
| 0 | 成功 | — |
| 1 | 业务失败 | `insufficient-stock`、`order-not-found`、`confirmation-required` |
| 2 | 用法/参数错误 | `invalid-argument` |
| 3 | 暂时性失败（可重试） | `db-locked`、`server-busy` |
| 4 | 内部错误 | `internal-error` |

## 静态层 problem+json

| 状态 | detail |
|---|---|
| 400 | `malformed request URL` |
| 404 | `path is not public` / `encoded path separators are not allowed` / `file not found` / `path escapes root` |
| 405 | `only GET and HEAD are supported`（带 `Allow: GET, HEAD`） |
| 500 | `file read failed`（脱敏） |
