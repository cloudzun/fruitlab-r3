同族第二智能体，非跨模型；对象 SPEC-snapshot-v1.0.md（de78e754cab77d0dcc7b9084d9028a0b80941527daeb7ab2c9aa4c9e14c3b53b）

## 结论

**FAIL，7/10。** SHA-256 与指定值一致。总体方向可实施，schema、L1 分层、真实 Postgres 测试和容器拓扑都已落到具体契约；但冻结快照尚未并入已接受的 D-72～D-82，且 `db reset` 的事务组合、死锁规避、密码校验阻塞、恢复流程和测试连接预算仍有工程缺口。按本快照直接 build 会让实现者面对互相冲突的“权威口径”，因此不能判 PASS。

本报告以冻结 v1.0 为对象，不重复拆解 D-72～D-82 已明确采纳的单项修复；它们尚未并入对象这一事实本身列为 E-01。

## Findings

| 编号 | 严重度 | 位置 | 问题 | 建议 |
|---|---|---|---|---|
| E-01 | High | `SPEC-snapshot-v1.0.md:7`、`:181`、`:280`、`:374`；`docs/decision-log.md:131`、`:133`、`:135`、`:136`、`:141` | 冻结对象与已接受决策不一致：对象仍写 4 段包版本、先扣库存后插单式的 `23505` 处理、无连接池连接超时、旧 Host/XFF 规则；D-72、D-74、D-76、D-77、D-82 已分别修正。若实现者只读冻结快照，`npm ci` 会因非法 SemVer 失败，唯一冲突后可能在 aborted 事务内回查得到 `25P02`，连接池耗尽和反代 Host 也可能挂起或 403。 | 先把 D-72～D-82 全量并入 v1.1，重新冻结并更新 SHA；AC-55、AC-63、AC-64、AC-71、AC-84 必须引用合并后的单一文本后才能开工。 |
| E-02 | High | `SPEC-snapshot-v1.0.md:173`、`:176`、`:302`；D-59 于 `docs/decision-log.md:118` | `migrate(pool)` 自己开始并提交事务，而 `db reset` 要求在同一事务内执行 drop、migrate、seed。现有导出只提供 pool 级 `migrate` 和 `withTransaction`，没有 client 级 migrate/seed，也没有 reset 组合根；直接嵌套会另取连接，可能死锁或留下半重置状态。`server/db.mjs` 的冻结导出还漏了 `seed`，CLI 的 `db seed` 和启动按需 seed 无对应契约。 | 定义 `migrate(client)`、`seed(client)` 或 `resetDatabase(client, deps)`，明确 reset 全程同一 client、同一事务；成功前不提交，失败统一 ROLLBACK，并补“迁移中途失败”“seed 失败”“备份成功但重建失败”三路测试。 |
| E-03 | Medium | `SPEC-snapshot-v1.0.md:176`；D-74 于 `docs/decision-log.md:133` | 即使改成先插 orders 再扣库存，扣减仍按请求中的商品顺序执行。两个购物车以相反商品顺序并发下单会形成行锁环，触发 `40P01`；3 次重试耗尽后返回 503，库存虽安全但可用性不稳定。 | 在事务前按 `productId` 规范排序，或用单条按固定顺序的 `UPDATE ... FROM` 扣减；补“相反顺序两购物车”“多商品锁等待”测试。 |
| E-04 | Medium | `SPEC-snapshot-v1.0.md:280`、`:282` | 时序枚举方案仍以现有同步 `scryptSync` 为默认实现风险。一次 scrypt 会阻塞 Node 事件循环，攻击者可用大量不同 username+IP 键绕过单键限流并同时拖慢 health、登录和其他 API；“两条路径各一次 verify”只解决分支时序，不解决并发阻塞。 | 明确改为异步 `crypto.scrypt`（或 worker），设置全局并发上限和排队上限；限流应在启动 scrypt 前执行；补并发登录下 health 与普通 API 的延迟测试。 |
| E-05 | Medium | `SPEC-snapshot-v1.0.md:325`、`:328`、`:403`、`:405` | 只描述了 api 和 db 的 healthcheck，`Dockerfile.web` 没有 healthcheck；但 AC-84、AC-86 要求三容器健康、web healthcheck 有效。Caddy 容器即使静态文件或反代配置坏了，也可能继续被当成 running。 | 给 Caddy 增加轻量 `/healthz` 或根路径检查，使用镜像内可用的客户端并定义 `interval`、`timeout`、`retries`、`start_period`；同时把 web 纳入 compose health 证据。 |
| E-06 | Medium | `SPEC-snapshot-v1.0.md:332`；AC-87 于 `:406` | `pg_restore --clean --if-exists` 既未要求先停 api，也未使用 `--single-transaction --exit-on-error`。API 仍持有连接或写入时，`--clean` 可能等待锁、部分删除对象或在中途失败；AC-87 的“恢复后数据一致”无法稳定实现。 | 固化维护流程：停 api、断开残留连接、`pg_restore --single-transaction --exit-on-error`、校验 schema/种子/行数后再启动 api；必须验证失败时数据库仍在可诊断状态。 |
| E-07 | Medium | `SPEC-snapshot-v1.0.md:302`、`:313`、`:422` | CLI 的 JSON Lines 备份没有对应 restore/import 命令，但测试计划写了 `db backup` 往返。`db reset` 可以使用该备份，运维人员却无法从同一格式恢复；备份格式是否包含全部约束、序列和 NULL 语义也未定义。 | 补 `db restore <file>`，或把 CLI 备份明确降级为 reset 保险并取消“往返”表述；若保留往返测试，必须导出到全新数据库后逐表、逐约束、逐序列校验。 |
| E-08 | Medium | `SPEC-snapshot-v1.0.md:310`、`:311`；D-60 于 `docs/decision-log.md:119` | 每个测试用例独立 `CREATE DATABASE`，同时允许 `node --test` 文件级并行；测试 helper 未规定 Pool 上限。若沿用 pg 默认 `max=10`，多文件并行可能超过 Postgres 默认 `max_connections=100`，表现为 53300、重试和随机失败；每库重复 scrypt seed 还会放大总耗时。 | 测试 Pool 固定 `max=1..2`，显式设置 `--test-concurrency` 或提高测试 PG 的 `max_connections`；按文件复用数据库、按用例事务回滚可作为替代；启动时清理残留 `fruitlab_test_*` 并设总时长预算。 |
| E-09 | Medium | `SPEC-snapshot-v1.0.md:280`；D-54 于 `:61` | 限流键只有 `username+IP`。同一 IP 可对无限多个用户名各尝试 5 次，构成账号喷洒；D-82 的 Map 容量上限只防内存增长，不限制这种横向尝试。 | 增加每 IP 全局限流和每账号限流两个桶，必要时指数退避；测试“同 IP 遍历 100 个 username”与“单账号多 IP”两种路径。 |
| E-10 | Low | `SPEC-snapshot-v1.0.md:281`；D-68 于 `:76` | CSRF Cookie 只写 `SameSite=Lax`，没有说明 `COOKIE_SECURE=1` 时是否加 `Secure`；CSRF token 只在缺失时补发，登录成功不轮换。认证边界变化后继续使用旧 token，属于不必要的 token fixation 风险。 | 会话与 CSRF Cookie 共用 Secure 开关；登录成功和会话轮换时重新生成 CSRF token，登出清两个 Cookie；补 Set-Cookie 属性断言。 |
| E-11 | Low | `SPEC-snapshot-v1.0.md:162` | 计划把驱动侧 `int8` 全局解析为 `Number`。金额当前确实有界，但 `order_id`、计数和未来聚合值没有同样的上界；超过 2^53 后会静默丢精度。 | 仅对已证明安全金额列做显式 cast/parser；ID 保持 string，或解析后检查 `Number.isSafeInteger` 并抛错；在 contracts 中写明可安全转换的列。 |
| E-12 | Low | `SPEC-snapshot-v1.0.md:95`、`:302`；D-59 于 `:118` | 迁移载入器没有 advisory lock 或已应用迁移 checksum。启动进程与人工 `cli db migrate` 并发时可能同时判断版本缺失并争写 `schema_migrations`；已发布迁移被改动也无法机械发现。 | 迁移事务前取 `pg_advisory_lock`，记录 name/checksum；并发 migrate 测试必须断言只有一个执行、另一个安全等待并通过。 |
| E-13 | Low | `SPEC-snapshot-v1.0.md:245`、`:251`、`:394` | 405 形状表只列了路径模式，没有定义尾斜杠、编码斜杠和动态段的规范化；AC-75 只写“400 稳定码”，未指定是 `invalid-request` 还是 `not-found`。实现者容易在 400/404/405 之间漂移。 | 先规范化路径再做路由匹配，明确 `%zz`、`%2F`、尾斜杠和空动态段的精确状态码与 `Allow`；纳入表驱动测试。 |

## 未评估项

- 未运行测试、Postgres、Docker/Compose、Caddy、备份恢复或浏览器流程；本报告不证明任何运行时行为已通过。
- 未实测锁等待、死锁重试、连接池耗尽、scrypt 延迟、测试并行连接数或容器启动时间。
- 未验证 WSL 路径、端口发布、Caddy 非 root 权限、`pg_dump`/`pg_restore` 在该机器上的最终可用性。
- 未评估当前 Git 工作树中尚未冻结的 SPEC 修订；除冻结快照与已接受决策外，不把其它文件变化作为结论依据。
