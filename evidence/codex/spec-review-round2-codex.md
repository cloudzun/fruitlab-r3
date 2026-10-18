同族第二智能体，非跨模型；对象 SPEC-snapshot-v1.1.md（adc8f220b017d2257e20af4f58968c154421fa17b0c873cd93f4efcc463a65e5）

> 性质：只读、增量的静态规格复核。未运行测试、未启动容器、未运行 Postgres/Caddy/npm，未修改代码或配置；仅读取了本地文件与 Caddy 官方静态文档。已复算快照 SHA-256，与给定值一致。

## 结论

**仍需修订，暂不能把 v1.1 视为闭环。**

F-01..F-10 中 3 条为 `resolved`（F-01、F-02、F-05），7 条为 `partially`（F-03、F-04、F-06、F-07、F-08、F-09、F-10），没有完全 `unresolved` 的条目。但 F-03、F-04、F-06 仍有 High 级未闭环矛盾，不能仅凭“已采纳”或新增 AC 判定解决；F-07、F-09、F-10 的 AC 仍存在可测性缺口。

AC-49..AC-105 共 57 个编号，当前文本中连续且唯一，未发现缺号或重复号。新增/修订 AC 的主要问题不是编号本身，而是若按字面验收，`AC-57`、`AC-82`、`AC-91`、`AC-100`、`AC-103`、`AC-105` 之间存在互相冲突或无法机械判定的条件。

除 N-01..N-03 三个 High 外，本轮没有另立新的 High 来凑数；F-07/F-08/F-09/F-10 的残留仍按 Medium 记录。

## F-01..F-10 处置表

| F 编号 | 严重度 | 状态 | v1.1 依据 | 判断与残留 |
|---|---|---|---|---|
| F-01 | High | **resolved** | §5.2:188-198；§5.3:231；AC-64、AC-97 | 已把 `23505` 放在事务边界处理：先 `ROLLBACK`，再在新事务回查/重试；下单顺序改为先插 `orders` 预留幂等键，再扣库存；AC-64 明确一个 201、一个 200 `existing`、同一订单、库存只扣一次，并覆盖库存为 0 的重放。核心事务问题已真正落到实现规则和验收。残留仅为 200 `existing` 的精确响应体尚未冻结，不影响 F-01 的主要正确性结论。 |
| F-02 | High | **resolved** | §5.3:228-238；AC-98 | 新增 `server/app.mjs` 组合根、`createServices` 与 `createXxxService(deps)` 工厂，router 只接收已构造 services；repository 方法也补齐了签名。AC-98 要求 contracts + layering 测试固定工厂和实例方法。残留是 `repos` 对象的具体属性映射仍主要靠 `docs/contracts.md`，但不再阻塞规格。 |
| F-03 | High | **partially** | §5.4:271；§5.8:344-347；AC-99 | `HOST=0.0.0.0`、`PUBLIC_URL`、Host 允许集合和 healthcheck Host 已补上，原始“只监听回环”问题已修复。但 Caddy 片段写 `header_up Host {http.request.host}`；Caddy 的 `{http.request.host}`/`{host}` 是 host 部分，保留原始 `host:port` 应使用 `{http.request.hostport}`/`{hostport}`。外部访问 `127.0.0.1:4175` 时 Host 可能被改成不带端口的 `127.0.0.1`，与 `publicOrigin.host` 的 `127.0.0.1:4175` 不匹配，反代请求或 AC-99 会失败。故 F-03 仍未真正闭环。 |
| F-04 | High | **partially** | §3 D-78；§5.8:347、349、351；AC-100 | 已增加 `POSTGRES_USER/DB/PASSWORD` 到 `.env.example`，备份脚本也改为读取变量；但 `docker-compose.yml` 又写死 `POSTGRES_USER=fruitlab`、`POSTGRES_DB=fruitlab`、`pg_isready -U fruitlab -d fruitlab`。若部署者按 `.env.example` 修改用户或库名，db 容器、healthcheck、API DSN、备份/恢复会使用不同身份。D-78 的“同源”要求与实现细节直接冲突，故不能标 resolved。 |
| F-05 | High | **resolved** | §3 D-72；AC-55、AC-101 | `VERSION=3.0.0.0` 与 npm package version `3.0.0` 已分离，并规定版本校验脚本机械检查映射。原先四段 npm 版本破坏 `npm ci` 的问题已解决。 |
| F-06 | High | **partially** | §5.5:303；AC-82、AC-102；对照 §3 D-67、§5.1:181、§5.6:323、AC-57:395 | §5.5 已加入独立 `ADMIN_PASSWORD`、长度/非默认检查、`COOKIE_SECURE=1`、production 不 seed `userA/userB`；但其他正文仍要求 production 提供 `DEMO_PASSWORD`，seed 段仍写 14 商品 + 3 账号，AC-57 仍无条件断言 3 账号。实现者无法同时满足“production 只建 admin”和“seed 14+3”，也无法确定 production 到底校验 `DEMO_PASSWORD` 还是 `ADMIN_PASSWORD`。这是 High 级未闭环。 |
| F-07 | High | **partially** | §5.2:185-190；D-76；AC-103 | 已加入 `connectionTimeoutMillis`、idle timeout、`pool.on("error")` 和连接类错误映射，原始“无限等连接/未处理 idle error”问题有实质修复。但 `createPool` 签名写的是 `connectionTimeoutMs`、`idleTimeoutMs`，正文写的是 pg 的 `connectionTimeoutMillis`、`idleTimeoutMillis`，未规定 wrapper 映射；更重要的是 AC-103 要求 PG 不可达时 health ≤5s，而 `statement_timeout` 默认 15s，且 health 要读 schema/seed 状态，没有 health 专用总时限。连接黑洞路径可能 5s，慢查询/锁等待路径不能保证 ≤5s。 |
| F-08 | Medium | **partially** | §5.5:299；D-71/D-82；AC-104 | 已改为 Caddy 覆盖 XFF，不再取最左段；Map 增加键长和容量限制，AC-104 覆盖伪造 XFF 与 `TRUST_PROXY=0/1`。但 decision-log 的 D-71 仍是旧“取最左段”口径，D-82 只在 decision-log 出现，spec §3 没有 D-82；§5.5 还把限流来源写成 `D-54/D-77`，而 D-77 是 Host 决策。另 compose 默认没有明确设置 `TRUST_PROXY=1` 或可信代理来源，L2 默认下限流 IP 可能退化为 Caddy 容器地址。 |
| F-09 | Medium | **partially** | AC-91；D-80 | AC-91 已从“96 项语义逐项保留”改为逐测试处置表（保留/等价迁移/预期变更/删除理由），方向正确。但 AC-91 又把预期变更限定为 D-32/D-53/D-55/D-57/D-58/D-64，遗漏了 D-47（数据库切换）、D-62（health 形状变化）、D-79（输入约束）以及 D-82（XFF）；例如 R2 的健康检查测试若断言 `dbPath`，在 D-62 下必然需要归类为预期变更。当前白名单不足以机械核对。 |
| F-10 | Medium | **partially** | §5.1:143、191；D-79；AC-105 | 已增加 `client_order_id` 的 8–128 长度 CHECK，并在 checkout 前置步骤写明重复 productId 合并、maxItems 10，AC-105 也覆盖了客户端约束。但 v1.1 没有恢复完整的请求体校验表，username 3–32、password 8–128、价格上限 9,999,999、库存上限 99,999 等值只以“继承 R2”表述；schema 只有价格/库存非负检查，没有对应上限，`users.username` 也没有长度 CHECK。AC-105 的“DB CHECK 同步”按字面无法通过。 |

## 新 findings

### N-01（High，F-04 残留）：DB 身份变量与 compose 固定值冲突

位置：`SPEC-snapshot-v1.1.md` §3 D-78、§5.8:347、349、351，AC-100；`docs/decision-log.md` D-78。

问题：D-78 和 AC-100 要求 `POSTGRES_USER`/`POSTGRES_DB` 与 `DATABASE_URL`、`pg_isready`、备份参数同源，但 compose 细节固定使用 `fruitlab` 用户/库和固定 `pg_isready` 参数。实际部署若使用非默认值，会出现 db 容器初始化身份与 API DSN/backup 脚本身份分离；空卷首次启动、healthcheck 或恢复测试会失败。这不是单纯文档笔误，因为当前文本同时支持两套互斥配置。

建议：二选一并删除另一套假设。若坚持变量化，db 的 `environment`、healthcheck、API 的 `DATABASE_URL`、备份/恢复脚本全部使用 `${POSTGRES_USER:?}`/`${POSTGRES_DB:?}`；若坚持固定 `fruitlab`，则删除 `.env.example` 中的可变身份并在 AC-100 中明确不可配置。用非默认用户/库跑一次空卷初始化、health 和 backup/restore 往返。

### N-02（High，F-06 残留）：production 与 classroom 的 seed/口令规则冲突

位置：§3 D-67:75、§5.1:181、§5.6:323；与 D-73:81、§5.5:303、AC-82、AC-102；另见 AC-57:395。

问题：当前同时存在三套不一致规则：

1. D-67/§5.1/§5.6：production 要求 `DEMO_PASSWORD`，缺它 seed/dev 退出。
2. D-73/§5.5/AC-82：production 要求 `ADMIN_PASSWORD`，不 seed `userA/userB`，`DEMO_PASSWORD` 只用于 development/classroom。
3. AC-57：seed 幂等固定为 14 商品 + 3 账号，未区分 production 与 classroom。

按字面实现时，production 的启动校验和 seed 结果无法同时满足这些条款。这是会直接影响部署安全和验收的 High 级内部矛盾。

建议：将 D-67 标记为 superseded，或明确改写为“development/classroom 校验 DEMO_PASSWORD；production 校验 ADMIN_PASSWORD”；把 seed 拆成 `seedClassroom` 与 `seedProductionAdmin` 两个可测分支；AC-57 分别给出两种模式的商品/账号计数，AC-82/AC-102 只断言 production 分支。

### N-03（High，F-03 残留）：Caddy 的 Host 占位符可能丢掉端口

位置：§5.4:271、§5.8:346-347、AC-99。

问题：规格要求 Caddy 保留外部 Host，但给出的 `header_up Host {http.request.host}` 使用的是 host-only 占位符。Caddy `reverse_proxy` 文档为保留原始 Host 给出的写法是 `header_up Host {hostport}`；`{host}` 与 `{hostport}` 在概念上是不同的（后者包含端口）。当浏览器访问 `127.0.0.1:4175` 时，API 收到的可能是没有端口的 `127.0.0.1`，而允许集合由 `PUBLIC_URL` 派生为 `127.0.0.1:4175`。这不是 healthcheck 自身的局部问题：它会使 Caddy→API 的主链路返回 `403 host-not-allowed`，并使 AC-99 的“Caddy 保留外部 Host”验收失败。

旁证：Caddy 官方 `reverse_proxy` 文档在说明“opt out of upstream Host rewriting”时使用 `header_up Host {hostport}` 来恢复原始 Host；本报告只做静态文本核对，未启动 Caddy 实测。

建议：把 Caddy 配置改为 `header_up Host {http.request.hostport}`（或经验证的 `{hostport}` 等价写法），并在 AC-99 中同时断言外部 `127.0.0.1:4175` 和 API 内部 `127.0.0.1:3000` 的 Host；不要使用 host-only 占位符。

### N-04（Medium，F-07 残留）：health 的 5 秒上限没有实现路径

位置：§5.2:185-186、190，AC-103。

问题：`connectionTimeoutMillis` 只约束从池中获取连接，不能约束已取得连接后的慢查询；`statement_timeout` 默认 15s。health 还要检查 schema/seed，且没有规定 health 专用 query timeout 或整体 deadline，因此“PG 不可达时 health ≤5s”只能覆盖连接拒绝/池耗尽，不能覆盖连接已建立但查询卡住、锁等待或数据库半可用的情况。`createPool` 的 `connectionTimeoutMs` 与 pg 的 `connectionTimeoutMillis` 也未给出映射，直接透传会重新引入无限等待。

建议：为 health 冻结一个独立的 `healthTimeoutMs`（或单一 `SELECT` + 总 `Promise.race`），在 `createPool` 中明确 `connectionTimeoutMs -> connectionTimeoutMillis` 的映射；AC-103 分别测连接拒绝、池耗尽、慢查询/持锁和 DB 重启。

### N-05（Medium，F-09 残留）：AC-91 的变更白名单仍不完整

位置：AC-91:429；相关 D-47、D-62、D-79、D-82；对照 R2 健康检查契约（`../r2-fruitlab/SPEC.md` AC-43：含 `dbPath`）。

问题：AC-91 只列六个允许变更的决策。数据库切换会造成 DB/CLI 测试迁移；D-62 会把 health 的 `dbPath` 改为 `db`/`uptimeSeconds`；D-79 会改变输入边界测试；D-82 会影响 IP 相关测试。若 BUILD.md 严格按当前白名单核对，合法的预期变更会被判为越界，AC-91 仍不可机械通过。

建议：将 D-47/D-62/D-79/D-82 加入“预期契约变更”白名单，或在 AC-91 中明确“等价迁移”覆盖 D-47、定义 health/输入/IP 测试的具体迁移规则，并在 BUILD.md 为每个 R2 测试填写唯一处置。

### N-06（Medium，F-08 残留）：XFF 决策源与 compose 开关不一致

位置：`docs/decision-log.md` D-71/D-82；`SPEC-snapshot-v1.1.md` §5.5:299、§5.8:347、AC-104。

问题：decision-log 的 D-71 仍是“取 XFF 最左段”，D-82 才改为 Caddy 覆盖；spec §3 使用 D-71 的新行为但没有 D-82，§5.5 又引用 D-77（Host 决策）。此外 compose 文本没有把 `TRUST_PROXY=1` 和可信来源（CIDR/网络名）列为明确环境配置，默认 L2 下 API 可能使用 Caddy 容器 IP，限流键会失真。安全结论因此依赖未冻结的实现解释。

建议：在 spec §3 将 D-82 定为唯一 XFF 决策，D-71 标 superseded，§5.5 引用 D-82；compose 明确 `TRUST_PROXY=1`、可信来源及 simple 模式 `TRUST_PROXY=0`；AC-104 同时断言真实客户端 IP、伪造 XFF 和直连模式。

### N-07（Medium，F-10 残留）：AC-105 的 DB CHECK 目标超过 schema

位置：§5.1:118-147，D-79，AC-105。

问题：AC-105 要求 username/password/价格/库存边界与 DB CHECK 同步，但 schema 只有 `unit_price_cents >= 0`、`stock >= 0` 和 `client_order_id` 长度 CHECK；username 长度、价格上限、库存上限均未定义；password 只存 hash，不能以明文密码 CHECK 表达。当前只能验证部分约束，不能验证 AC-105 全文。

建议：在 §5.4 恢复完整校验表并明确哪些约束属于 API/service、哪些属于 DB；DB 增加 `username` 长度、价格上限、库存上限 CHECK（或明确这些只由 service 验证），AC-105 分别列出可执行的 schema 断言与 API 断言，避免“DB CHECK 同步”成为不可测总句。

### N-08（Low，文档/追溯）：状态、D 编号和 F→AC 映射仍有陈旧内容

位置：§状态行 3、§4:103、§13:508；decision-log D-82。

问题：文件头仍写 `DRAFT v1.0`，文末又写 `APPROVED v1.1`；§13 仍只写 `D-47～D-70`，没有覆盖 D-71..D-82；§4 把 F-01..F-10 映射为 AC-97..AC-105，但 F-09 实际落在 AC-91，范围内没有 F-09 的单独 AC。编号本身连续，问题是追溯口径不一致。

建议：统一状态为 v1.1；更新 Related/Decision 范围；把 F-09 → AC-91 单独列出，或在映射说明中明确 AC-97..105 只覆盖 F-01..F-08/F-10。

## 重点检查结论

### 事务顺序与错误映射

F-01 的核心事务顺序已自洽：`withTransaction` 只自动重试 `40001/40P01`，`23505` 由 service 在事务外回查/重试，且插入订单预留键发生在库存扣减之前。未发现 v1.1 在该狭窄范围内新增的 High。

仍需注意两点非 High 残留：

- 200 `existing` 的响应体（是否带 `existing:true`、订单对象形状）尚未冻结；AC-64 目前更像状态语义断言。
- 事务内商品价格快照/商品读取的时点没有明确写成“同一事务内读取”；若实现为事务外读价，价格并发更新时可能需要另行定义一致性口径。本轮不把此点升级为 finding，因为它不是 F-01 的 23505 事务边界问题，且现有 R2 语义未明确要求。

### Host 规则与 healthcheck

F-03 的 `HOST=0.0.0.0` 修复仍然有效，但新的 Host 占位符问题使它未闭环（N-03，High）。此外：

- §5.4 只写 `127.0.0.1:<PORT>`/`localhost:<PORT>`，应明确同时允许 API 的 `3000` 与外部 Caddy 的 `4175`，避免实现只允许其中一个。
- `web` 容器的 healthcheck 访问 `127.0.0.1:8080/` 只证明 Caddy 静态响应；API 自身 healthcheck 和 AC-84 的 Caddy→API 请求才是反代成功的证据，二者应在证据表分开记录。

### 生产模式与 classroom 默认

这是本轮最明确的新 High（N-02），同时伴随 F-04 的 High（N-01）和 F-03 的 Caddy Host High（N-03）。三者都意味着 v1.1 的“已采纳”不能直接转成 build 契约；应先修规格再实施。

### AC 编号与验收可测性

- AC 编号：AC-49..AC-105 连续、唯一（57 项）。
- 但 AC-57/AC-82 的 production/classroom 计数冲突（N-02）、AC-91 的白名单遗漏（N-05）、AC-103 的 health 时限（N-04）、AC-105 的 DB CHECK 不可执行（N-07）都会阻塞“机械验收”。
- 本轮未发现编号重复；问题主要是同一 AC 集合内的语义冲突。

### 连接池与 health

F-07 的池获取超时和 idle error 处理方向正确，但 AC-103 仍不能仅由 `connectionTimeoutMillis` + 默认 `statement_timeout=15s` 保证 ≤5s。连接池参数命名必须冻结为 pg 可直接识别的 `connectionTimeoutMillis`/`idleTimeoutMillis`，或明确规定 wrapper 映射；health 需要独立总 deadline。详见 N-04。

## 未评估项

- 未运行任何测试、容器、Postgres、Caddy 或 npm 进程；本报告不验证运行时行为、实际 SQLSTATE、Docker healthcheck 或 Caddy 占位符语义。Caddy 占位符仅按官方静态文档核对。
- 未重新发散评审上一轮的 F-11..F-19；其中 F-12 的 health body/统一信封冲突、F-19 的决策范围/编号问题仍可能影响后续 build，但本轮只把它们作为健康与追溯的边界提及，不计入新的 High。
- 未核对尚未生成的 `BUILD.md` 实际 96 项逐测试处置表、真实 `docs/contracts.md`、R3 代码或测试文件；AC-91/98 等只能按当前规格文本判断可测性。
- 未执行跨模型评审；本报告仍是同族第二智能体静态复核，不代表跨模型质量门通过。
