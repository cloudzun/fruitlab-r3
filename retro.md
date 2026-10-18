# retro.md（R3 第 7/7 环）

> 对象：R3 七环（spec → autoplan → build → review → qa → ship → retro）。
> 数据来源：git、`evidence/test-count.txt`、`evidence/`。量化优先于叙述。

## 1. 数字

| 项 | 值 |
|---|---|
| 版本 | `3.0.0.0` |
| 提交（自 `r2-baseline`） | 8（spec / autoplan / build / review / qa / ship / retro 修复） |
| 变更规模 | 135 files，+14702 / −2707 |
| 测试 | 96 → **137**（真实 Postgres；连续 4 次稳定性复跑 0 失败） |
| 路由覆盖 | 12/12 |
| 运行时依赖 | 0 → 1（`pg`） |
| 容器 | 3（web/api/db）；api 245 MB、web 102 MB |
| R2 遗留缺陷 | 11 open → **11 closed** |
| review findings | codex 13（4 High）全部修复；cso 4 Low 处置 |
| 义务 | 42/42（BUILD.md 引用，最终 `closed`） |
| 三版本 | R1 4173、R2 4174、R3 4175 并排；R1/R2 git status 空 |

## 2. 七环实际节奏

| 环 | 产出 | 返工点 |
|---|---|---|
| spec | SPEC v1.0→v1.1、32 项耦合点取证 | codex 10 findings 并入；跨模型 unavailable |
| autoplan | 4 路评审（全 FAIL）、42 OB、SPEC v1.2 | 42 findings 去重合并；CEO 工时重估 |
| build | Postgres/分层/CLI/容器/测试 | Caddy Host 丢端口、测试发现误扫脚本、admin 连接泄漏 |
| review | codex 13 findings + cso 4 | 错误映射、seed 隔离、restore 校验、CSRF bootstrap 等 13 项修复 |
| qa | Chromium 1440/834/390 + 容器证据 | 390 视口需 emulate（resize 最小 500）；截图路径受 MCP workspace 限制 |
| ship | 3.0.0.0、文档、verify 9/9 | simple 首页未验证（如实记录） |
| retro | 本文件 | — |

## 3. 做对了什么

1. **先冻结快照再让 codex 复核**：第一次复核因 SPEC 被并发修改而停下，改成“快照 + SHA”后两轮都可用；这是可复用规则。
2. **用真实 Postgres 测试**：并发不超卖、同幂等键、反向购物车、advisory lock、reset 回滚都测出来了；没有用 SQLite/mock 充数。
3. **review 环真找了独立智能体**：codex 抓出的 13 条里 4 High 是实打实的（错误映射、seed 污染、restore 清库、CSRF bootstrap 不可用），不是自证。
4. **容器证据链完整**：健康、非 root、restart、down/up、备份→删→恢复都实跑；simple 模式也起了对照。
5. **R1/R2 全程未改**：每环收尾检查 `git status`，最终仍为空。

## 4. 踩过的坑（可复用）

| # | 坑 | 教训 |
|---:|---|---|
| 1 | Node `--test` 把 `scripts/test-pg.mjs` 当测试文件 | 脚本命名避开 `test-*`/`*.test.*` |
| 2 | 测试里 `dropStaleTestDatabases()` 会删掉并行测试的库 → 偶发失败 | **测试清理必须只动自己的库**；不要“清理所有前缀” |
| 3 | Caddy `{http.request.host}` 丢端口 → API Host 403 | 反代保留 Host 用 `{http.request.hostport}` |
| 4 | PostgreSQL 23505 后事务 aborted，不能继续查 | 先 ROLLBACK，再新事务回查/重试 |
| 5 | `isSeeded` 只看非空，classroom 库可被当 production | 加 `app_meta.seed_mode`，production 拒绝污染库 |
| 6 | CLI restore 缺表被当空表 → 可“成功清库” | 固定表/列白名单 + schemaVersion + 行数校验 |
| 7 | health `Promise.race` 不取消底层查询 | 超时 `release(true)` 销毁连接 |
| 8 | PowerShell `$HOME`/`$home` 是只读变量 | 别用保留变量名；长文本走文件 |
| 9 | MCP 截图 `filePath` 受 workspace roots 限制 | 不传 filePath → 取 temp/attachment 路径再复制 |
| 10 | codex 多行 prompt 被 PowerShell 拆参数 | 用 stdin：`Get-Content prompt \| codex exec ... -` |

## 5. 没做到/不足

1. **跨模型门禁 unavailable**：只有 DeepSeek 家族；同族复核不能替代跨模型共识。
2. **cso partial**：离线无 scanner profiles；history/stride/data-classification 未评估。
3. **人工无障碍未做**：读屏器/对比度仪器/完整键盘流程 `UNVERIFIED`。
4. **simple 模式首页未验证**：只验证 health 与容器健康。
5. **云平台未部署**：M5 选修，需账号；本仓库无 remote，tag 只在本机。
6. **review 修复后未再跑一次 codex 复核**：以回归测试 + verify 作为修复证据，属“同族单轮 + 自测”，不是双轮独立复核。

## 6. 给下一轮（M5 / R4）的建议

1. 若做平台部署，先把 `PUBLIC_URL`/TLS/`COOKIE_SECURE`/`TRUST_PROXY` 四项做成部署 checklist，再动代码。
2. 若继续安全加固：把限流迁到共享存储（Redis/PG），补 CSRF token 轮换的端到端测试。
3. 若补无障碍：引入 axe 自动扫描 + 一次人工读屏，别再用“有 aria 属性”代替可用性。
4. 保持测试隔离纪律：任何“清理全部测试库”的工具都只能在独立测试环境手工运行。
5. 跨模型复核需要第二 provider key；没有就继续如实写 `unavailable`，不要拿同族凑数。
