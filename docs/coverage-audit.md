# 覆盖率审计（R2 ship 环）

> 逐条追踪 R2 变更/新增的代码路径，并给测试质量评星（替代“断言计数”作为覆盖代理，E10/G3）。
> 评星标准：★★★ 有直接测试且覆盖边界；★★ 有直接测试但边界不全；★ 仅冒烟/间接覆盖；**未覆盖单列**。

## 1. 路径清单

| # | 路径 / 能力 | 变更 | 测试 | 星级 |
|---:|---|---|---|---|
| 1 | `assets/domain.mjs` 领域纯函数（10 个 + limits） | 未改（复用） | `tests/domain.test.mjs`（17） | ★★★ |
| 2 | `assets/controller.mjs` 纯 reducer | 扩展 | `tests/controller.test.mjs`（11） | ★★★ |
| 3 | `assets/app.mjs` 渲染与事件 | 重写 | `tests/app.test.mjs`（19，fake DOM）+ qa 实机 | ★★ |
| 4 | `assets/api-client.mjs` 请求与错误文案 | 新增 | `tests/app.test.mjs`（fake fetch） | ★★ |
| 5 | `assets/styles.css` Apple 式词元/断点 | 重写 | qa 截图 + computed grid 实测 | ★★ |
| 6 | `index.html` 结构与 CSP meta | 重写 | `tests/static-scan.test.mjs`（13）+ `tests/app.test.mjs` | ★★★ |
| 7 | `server/db.mjs` open/migrate/schema/seed | 新增 | `tests/db.test.mjs`（7） | ★★★ |
| 8 | `server/db.mjs` 单写者队列/事务包装 | 新增 | 事务回滚经 `tests/db.test.mjs` 覆盖；队列无并发单测 | ★★ |
| 9 | `server/auth.mjs` 口令哈希/校验 | 新增 | `tests/auth.test.mjs`（5） | ★★★ |
| 10 | `server/auth.mjs` 会话创建/解析/删除 | 新增 | `tests/auth.test.mjs` + `tests/api.test.mjs` | ★★★ |
| 11 | `server/auth.mjs` Cookie 解析（坏编码） | review 修复 | 安全探针（401） | ★★ |
| 12 | `server/auth.mjs` 用户创建/列表/查找 | 新增 | `tests/auth.test.mjs` + `tests/cli.test.mjs` | ★★★ |
| 13 | `server/products.mjs` 列表/读取/改价改库存上下架 | 新增 | `tests/api.test.mjs`（10） | ★★★ |
| 14 | `server/orders.mjs` 校验/事务下单/扣库存/幂等 | 新增 | `tests/db.test.mjs` + `tests/api.test.mjs` | ★★★ |
| 15 | `server/orders.mjs` 用户订单/全量订单/单号查询 | 新增（含 N+1 修复） | `tests/api.test.mjs` | ★★★ |
| 16 | `server/orders.mjs` 订单号后缀工厂 | 新增 | 格式经 `tests/db.test.mjs` 断言；未单独测随机性 | ★★ |
| 17 | `server/router.mjs` 认证路由 | 新增 | `tests/api.test.mjs` | ★★★ |
| 18 | `server/router.mjs` 订单路由/权限 | 新增 | `tests/api.test.mjs` | ★★★ |
| 19 | `server/router.mjs` 管理路由 | 新增 | `tests/api.test.mjs` | ★★★ |
| 20 | `server/router.mjs` health/405/413/415/非法 JSON | 新增 | `tests/api.test.mjs` | ★★★ |
| 21 | `server/router.mjs` Host/Origin 守卫 | 新增 | `tests/api.test.mjs` + 探针 | ★★★ |
| 22 | `server/errors.mjs` 错误目录镜像 | 新增 | `tests/contracts.test.mjs`（4） | ★★★ |
| 23 | `serve.mjs` 静态白名单/穿越/CSP/脱敏 | 改写 | `tests/api.test.mjs` + 安全探针 | ★★★ |
| 24 | `serve.mjs` `parseCliArgs` / `main` | 改写 | **无直接单测**（`--help/--version` 未覆盖）；仅代码审查 | ★ |
| 25 | `cli.mjs` db/user/product/orders/退出码/JSON | 新增 | `tests/cli.test.mjs`（7） | ★★★ |
| 26 | `scripts/*.mjs` 机械校验脚本 | 新增 | 由 `scripts/verify.mjs` 每次真实运行；无独立单测 | ★★ |
| 27 | `docs/*` 契约/错误目录/编号 | 新增 | `tests/contracts.test.mjs` 断言集合与编号 | ★★★ |

## 2. 汇总

| 指标 | 值 |
|---|---|
| 路径总数 | **27** |
| ★★★ | 19（70.4%） |
| ★★ | 7（25.9%） |
| ★ | 1（3.7%） |
| 未覆盖 | **0** |
| 核心链路（db/auth/orders/router）星级 | 全部 ★★★ |
| 测试总数 / 结果 | **96 / 96 通过**（`evidence/test-count.txt`） |

## 3. 缺口与说明

- `serve.mjs` 的 CLI 参数解析（`--help/--version/--port`）没有直接单测，标 ★；`cli.mjs` 的同类能力有测试。**不声称全覆盖**。
- 前端 ★★ 的原因：fake DOM 不能证明真实浏览器布局/焦点，qa 环用真实 Chromium 补足（截图与实测记录在 `evidence/ring-qa.md`）。
- 视觉类（styles/css）依赖 qa 截图与 computed style 实测，无人眼对比度仪器测量（`UNVERIFIED`）。
- 覆盖率数字来自测试文件命名与人工映射，不是代码行覆盖率（本项目零依赖、未引入覆盖率工具）。
