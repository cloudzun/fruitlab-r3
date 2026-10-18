# review.md（R2 第 4/7 环）

> **范围**：build 环提交 `66b4a93` 的实现（`server/*`、`serve.mjs`、`cli.mjs`、`assets/*`、`tests/*`）。
> **方法**：结构排雷 + 安全审计（人工逐项）；官方 `gstack-review` / `cso` 运行件本宿主不可用，按技能文档手动执行并如实记录。
> **输入基线**：`SPEC.md` v1.1、`DECISIONS.md` 42 条义务、`docs/contracts.md`、`docs/error-catalog.md`。

## 1. 结论

| 项 | 结果 |
|---|---|
| 结构缺陷 | 1 个真实问题（订单列表 N+1），已修 |
| 安全/健壮性缺陷 | 4 个可机械修复项，已修；1 个信息泄露（绝对路径），已修 |
| 需人决策（ASK） | 7 项，均属 PRD 明确边界或既有取舍，建议保留并记录 |
| 通过项 | 12 类（见 §4） |
| 测试 | **96 项全部通过**（见 `evidence/test-count.txt`）；`node scripts/verify.mjs` PASS 5/5 |

## 2. [AUTO-FIXED]（已直接修，机械型）

| # | 位置 | 问题 | 修复 | 证据 |
|---:|---|---|---|---|
| 1 | `server/orders.mjs` `listOrdersByUser` / `listAllOrders` | **N+1 查询**：每个订单单独查一次明细 | 新增 `itemsByOrderIds()`，用一条 `IN (...)` 批量取明细后分组；列表只查 2 条 SQL | 96 测试通过；`tests/db.test.mjs` 订单归属、`tests/api.test.mjs` 列表用例 |
| 2 | `server/orders.mjs` `createOrder` | 幂等竞态：两个并发同 `clientOrderId` 时唯一索引冲突会抛 500 | 捕获 `UNIQUE ... client_order_id`，重新查已有订单并返回 `status:"existing"`（库存已回滚） | `tests/db.test.mjs` 幂等用例 |
| 3 | `server/auth.mjs` `parseCookies` | 非法百分号编码 Cookie（如 `%`）会让 `decodeURIComponent` 抛错 → 500 | 单个配对 try/catch，坏 Cookie 忽略 | 安全探针：坏 Cookie → 401 而非 500 |
| 4 | `server/router.mjs` `/api/health` | 泄露绝对文件系统路径（`dbPath`） | `publicDbPath()`：工作区相对路径或仅文件名 | 探针：`dbPath=test.db`，非绝对路径 |
| 5 | `server/router.mjs` 登录 | 旧会话行在重新登录后仍有效/堆积 | 登录时删除当前 Cookie 对应的旧会话，再签发新会话 | 96 测试通过（登录/登出/权限用例） |
| 6 | `cli.mjs` | 未使用变量 `needsDb`（噪声） | 删除 | `node --check cli.mjs` 通过 |

## 3. [ASK]（需人决策，已按推荐保留）

| # | 项 | 现状 | 推荐 | 依据 |
|---:|---|---|---|---|
| 1 | 会话过期/续期 | 无 `expires_at`，Cookie 无 `Max-Age` | **保留**（PRD FR-2 明确不做） | 若加，需要清理策略与测试，范围扩大 |
| 2 | CSRF Token | 仅同源 `Origin`/`Sec-Fetch-Site` 部分校验 | **保留**（PRD 明确不做 CSRF） | 已在 README/DECISIONS 声明风险 |
| 3 | 登录失败限流/锁定 | 无限流 | **保留**（PRD 明确不做） | 本地回环演示 |
| 4 | 他人订单 403 泄露存在性 | `403 order-not-owned`（非 404） | **保留**（D-32 有意识取舍） | 课堂演示水平越权需要明确 403 |
| 5 | 管理操作审计 | 无 audit 表 | 记入 TODOS（T-02） | PRD 未要求 |
| 6 | 分页 | 列表默认上限 100，无分页 | 记入 TODOS（T-04） | 演示规模不触发 |
| 7 | 图片尺寸 | 12 张短边 < 800（§5.8 建议值） | 保留并如实记录（`docs/assets-credits.md`） | 已记录为降级项 |

## 4. 通过项（人工核对）

1. **SQL 注入面**：全部 `prepare` + 参数绑定；唯一字符串拼接是 `updateProduct` 的固定列名（非用户输入）；探针 `productId="' OR 1=1 --"` → 404 `product-not-found`。
2. **XSS**：前端无 `innerHTML/outerHTML/insertAdjacentHTML/document.write`（`tests/static-scan.test.mjs`）；内容用 `textContent`/`el()`。
3. **路径穿越**：静态层拒绝 `..`、编码分隔符、点文件、白名单外路径、symlink 逃逸；探针 `/assets/../server/db.mjs` → 404。
4. **越权**：水平（他人订单）与垂直（非 admin 调管理接口）均有测试并返回 403。
5. **口令**：`scrypt` + 随机盐 + `timingSafeEqual`；库内无明文；登录失败不区分用户不存在/口令错。
6. **会话**：32 字节随机令牌，库中只存 `sha256`；`HttpOnly; SameSite=Lax`；登出删除服务端会话。
7. **HTTP 边界**：405 带 `Allow`、415、413、非法 JSON、脱敏 500、`no-store`、`nosniff`、CSP（HTTP 头为唯一来源）。
8. **错误契约**：`docs/error-catalog.md` 与 `server/errors.mjs` 集合一致（`tests/contracts.test.mjs`）。
9. **依赖**：零第三方依赖、无远程资源/字体。
10. **事务**：下单主单/明细/扣库存同一事务；库存不足回滚（测试断言无订单、库存不变）。
11. **并发**：`busy_timeout` + 有界重试；单写者队列假设已文档化。
12. **CLI**：口令可走 `--password-stdin`、不打印口令/哈希；`db reset` 需 `--yes` 且自动备份。

## 5. 安全审计（`/cso` 替代流程）

- 官方 `/cso`（六类扫描器、Docker 隔离）本宿主不可用 → 状态 **`unavailable`**，**不冒充已跑**。
- 已做的人工审计范围：注入面、越权、路径穿越、XSS、Cookie/CSP、错误泄露、口令与会话、破坏性 CLI、信息泄露。
- 未做：跨模型对抗审计、容器化动态扫描、真实浏览器手工渗透、依赖漏洞扫描（无第三方依赖）。

## 6. 复核命令与结果

```text
node --test                     # 96 tests, 96 pass, 0 fail
node scripts/verify.mjs         # PASS 5/5
安全探针（.gstack/sec-probe.mjs）
  health.dbPath = test.db | absolute? false
  sqli productId status/code = 404 product-not-found
  traversal status/code = 404 not-found
  malformed cookie status/code = 401 auth-required
  headers csp=true nosniff=nosniff no-store=no-store
```

## 7. 诚实边界

- 本环**没有**真实浏览器交互、没有外部渗透测试、没有跨模型复核；结论基于源码阅读、静态扫描与本地测试。
- 两处 fake DOM 测试已在 build 环简化，**不能**替代真实浏览器验证；交 qa 环。
- ASK 项未获用户新指令前按 PRD 边界保留，**不代表**这些风险已消除。
