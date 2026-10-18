# 证据 · review 环（R2 第 4/7 环）

> 结构排雷 + 安全审计的真实执行记录。官方 `gstack-review` / `cso` 运行件不可用，手动执行并如实记录。

## 1. 环境

| 项 | 值 |
|---|---|
| 日期 | 2026-10-18 |
| 审查对象 | build 环提交 `66b4a93` |
| 运行时 | Node.js `v22.20.0` |
| 工具 | `node --test`、`scripts/verify.mjs`、人工 grep 扫描、本地安全探针 |

## 2. 扫描记录

### 2.1 危险模式扫描

```powershell
Select-String -Path server\*.mjs,cli.mjs,serve.mjs,assets\*.mjs `
  -Pattern 'innerHTML|outerHTML|insertAdjacentHTML|document\.write|eval\(|new Function|child_process|execSync|spawnSync'
```

结果：**无命中**（`tests/` 之外的运行时代码没有注入 sink 与 shell 调用）。

### 2.2 SQL 拼接扫描

```powershell
Select-String -Path server\*.mjs -Pattern '`[^`]*\$\{[^}]*\}[^`]*`' | Where-Object { $_.Line -match 'SELECT|INSERT|UPDATE|DELETE|CREATE' }
```

结果：仅 `products.mjs:58` 的 `UPDATE products SET ${fields.join(", ")} ...`，列名来自固定分支（`unit_price_cents`/`stock`/`listed`），**无用户输入拼接**。

### 2.3 N+1 定位

`server/orders.mjs` 原实现对每个订单调用 `itemsForOrder()`。已改为 `itemsByOrderIds()` 批量查询（列表 2 条 SQL）。

## 3. 安全探针（真实输出）

脚本：`.gstack/sec-probe.mjs`（临时，gitignore），基于测试夹具启动真实 HTTP 服务。

```text
health.dbPath = test.db | absolute? false
sqli productId status/code = 404 product-not-found
traversal status/code = 404 not-found
malformed cookie status/code = 401 auth-required
headers csp=true nosniff=nosniff no-store=no-store
```

## 4. 修复后的复核

| 命令 | 结果 |
|---|---|
| `node --test` | 96 项，96 通过，0 失败 |
| `node scripts/verify.mjs` | PASS 5/5 |
| `node --check cli.mjs` | 通过 |

## 5. 修复清单（与 review.md §2 对应）

| # | 文件 | 变更 |
|---:|---|---|
| 1 | `server/orders.mjs` | 批量明细查询，消除 N+1 |
| 2 | `server/orders.mjs` | 幂等唯一冲突时返回已有订单 |
| 3 | `server/auth.mjs` | Cookie 解码容错 |
| 4 | `server/router.mjs` | health 不泄露绝对路径 |
| 5 | `server/router.mjs` | 登录时作废旧会话 |
| 6 | `cli.mjs` | 删除未使用变量 |

## 6. 不可用与未做

- 官方 `gstack-review`（含跨模型对抗）与 `/cso`（六类扫描器、Docker 隔离）：**不可用**，未运行。
- 真实浏览器人工渗透、容器动态扫描、依赖漏洞扫描（无第三方依赖）：未做。
- ASK 项（会话过期、CSRF、限流、403 泄露、审计、分页、图片尺寸）：按 PRD 边界与既有取舍保留，未擅自扩大范围。
