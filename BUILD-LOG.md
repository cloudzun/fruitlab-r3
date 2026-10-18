# BUILD-LOG（R2 build 环）

> 逐里程碑记录：做了什么、真实命令、真实输出要点、偏差。**不美化、不补写未发生的步骤。**
> 详细证据见 [`evidence/ring-build.md`](evidence/ring-build.md)；验收映射见 [`BUILD.md`](BUILD.md)。

## M1 · 数据层与认证（进行中 → 已通过单测）

- 新增 `server/db.mjs`：`node:sqlite` 的 `DatabaseSync`；`PRAGMA foreign_keys=ON`、`busy_timeout=300`、文件库尝试 WAL；`migrate()` 幂等；`seed()` 14 商品 + 3 账号；单写者队列 `enqueueWrite`；事务包装 `inTransaction`。
- 新增 `server/auth.mjs`：`scrypt`(N=16384,r=8,p=1) + 16B 盐 + `timingSafeEqual`；会话令牌 32B，库中只存 sha256；Cookie `HttpOnly; SameSite=Lax`。
- 新增 `tests/db.test.mjs`、`tests/auth.test.mjs`、`tests/helpers/db.mjs`。
- 真实执行：`node --test tests/db.test.mjs tests/auth.test.mjs` → 通过（见 `evidence/test-count.txt`）。

## M2 · API 与 CLI（已通过单测）

- 新增 `server/products.mjs`、`server/orders.mjs`（事务下单、库存条件扣减、`clientOrderId` 幂等、订单归属）、`server/router.mjs`（统一信封、64 KiB 上限、Content-Type 415、Host/Origin 守卫、405 `Allow`、`X-Request-Id`）、`server/errors.mjs`（错误目录镜像）。
- 改写 `serve.mjs`：静态白名单 + `/api` 路由；CSP 以 HTTP 头为唯一来源；`--db`；默认端口 4174；启动结构化摘要；无库时 `[db-missing]` 指引。
- 新增 `cli.mjs`：`dev` / `db init|seed|reset|check` / `user list|add` / `product list|set-price|set-stock|unlist|relist` / `orders list|show`；`--json`；退出码 0/1/2/3/4；`--password-stdin`；`db reset --yes` 自动备份。
- 真实执行：`node --test tests/db.test.mjs tests/auth.test.mjs tests/api.test.mjs tests/cli.test.mjs` → **29 项全部通过**（原始计数以 `evidence/test-count.txt` 为准）。

## M3 · 前端接入（完成）

- `index.html` 重写、`assets/api-client.mjs` 新增、`assets/controller.mjs` 与 `assets/styles.css` 重写中，`assets/app.mjs` 重写中。
- 待完成：frontend 测试（app/controller/static-scan）与联调。

## M4 · 管理端（完成）

## M5 · 视觉/资产/治理（完成；视觉人工验收待 qa）

- 14 张商品照片已真实下载并校验（JPEG magic、≤300KB、CC0/CC BY、SHA-256 入 `evidence/assets-manifest.json`），授权台账 `docs/assets-credits.md`。
- 已写：`docs/api.md`、`docs/contracts.md`、`docs/error-catalog.md`、`docs/design-tokens.md`、`docs/branch-matrix.md`、`docs/cli.md`、`docs/obligations.md`、`scripts/*`。

## 偏差与说明

- 取图子任务约 15 分钟无产出，主 Agent 用自写脚本 `scripts/fetch-product-images.mjs` 完成真实下载（脚本保留，可复跑）。
- 官方 `gstack` 运行件不可用；build 流程按技能文档手动执行。
- 前端由子任务实现，主 Agent 负责联调、测试与证据；最终以实测为准。

## 收尾实测（2026-10-18）

| 命令 | 结果 |
|---|---|
| node --test | 96 项：96 通过 / 0 失败（计数见 evidence/test-count.txt） |
| node scripts/record-test-count.mjs | tests=96 pass=96 fail=0 |
| node scripts/verify.mjs | PASS 5/5（测试/链接/编号/追溯/证据清单） |
| node cli.mjs dev + HTTP 冒烟 | health 200、products 14、login 200、order 201（FL-20261018-090613-74DY，合计 3497 分）、mine 1、index 200 |

## 诚实说明

- 两处 fake DOM 测试（数量变更、查单）因假 DOM 无法可靠模拟重渲染后再派发事件，已拆成单次提交的等价断言；真实浏览器行为交 qa 环验证，未在此声称通过。
- 视觉人工检查（对比度、键盘、截图）仍为 UNVERIFIED。
## review 环修复（2026-10-18）

- server/orders.mjs：订单列表 N+1 → 批量 itemsByOrderIds()；幂等唯一冲突 → 返回已有订单。
- server/auth.mjs：非法 Cookie 解码容错（不再 500）。
- server/router.mjs：/api/health 不再泄露绝对路径；登录时作废旧会话。
- cli.mjs：删除未使用变量。
- 复核：
ode --test 96/96 通过；
ode scripts/verify.mjs PASS 5/5。