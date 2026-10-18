同族第二智能体，非跨模型；对象 commit 1a56eb0

# FruitLab R3 独立代码复核

## 结论

**需修**。不建议直接进入 qa。C-2、S-2 仍未真正关闭；另有路由错误映射、production seed 污染、备份恢复校验、CSRF 恢复路径和并发锁语义等问题。以下结论基于对源码与测试的静态阅读，不代表测试或运行结果。

## 11 缺陷关闭表

| 编号 | 判定 | 实现/测试证据与说明 |
|---|---|---|
| C-1 | 已关闭 | `db reset` 先执行 JSON Lines 备份，备份失败即中止；重建在单事务内完成。`tests/cli.test.mjs:117-137` 覆盖失败与成功路径。备份一致性另有新 finding。 |
| C-2 | **未关闭（部分实现）** | `enqueueWrite` 已移除，`withTransaction` 有 40001/40P01 重试，`errors.mjs` 也有 SQLSTATE 映射；但 `server/router.mjs:265-278` 在 `toAppError` 之前把任意字符串 `error.code` 当作应用错误，PG 的 40001/40P01/57014/55P03/53300 会返回 500 并泄露原始 SQLSTATE。未找到真实 SQLSTATE 注入测试。 |
| C-3 | 已关闭 | 动态订单/商品路由加入统一路由表，精确与动态路由均有 405 + `Allow`；`tests/api.test.mjs:139-155` 覆盖。 |
| C-4 | 已关闭 | `server/router.mjs:163-178` 先做 Content-Type、64 KiB 和 JSON 解析，再判断 405/认证；`tests/api.test.mjs:157-181` 覆盖 415/413/400 先于 401。 |
| C-5 | 已关闭 | `assets/api-client.mjs:102-140` 的超时 signal 同时覆盖 fetch、响应体读取和等待；`tests/client.test.mjs:23-34` 覆盖响应体卡住。 |
| C-6 | 已关闭 | `server/router.mjs:114-124` 捕获非法百分号编码并返回 `invalid-path`；`tests/api.test.mjs:236-240` 覆盖 `%zz` 返回 400。 |
| C-7 | 已关闭 | register/login/me 均使用 `{id,username,role}`；`tests/api.test.mjs:40-64`、`tests/auth.test.mjs:166-188` 有形状断言。 |
| S-1 | 已关闭 | `server/services/auth.mjs:91-104` 对缺失用户执行 dummy scrypt，存在用户也执行一次 verify；`tests/auth.test.mjs:83-108` 验证两条路径各一次 verify。 |
| S-2 | **部分关闭（不可判为关闭）** | `server/auth.mjs:183-211` 虽有账号/IP 两桶，但账号桶键实际为 `a:${username}:${ip}`，单账号换 IP 可绕过账号桶；成功登录的 `clear()` 又删除整个 IP 桶，持有有效账号即可重置 IP 失败计数。`tests/api.test.mjs:209-219`、`tests/auth.test.mjs:110-140` 只测同用户同 IP，未测“单账号多 IP”和“同 IP 遍历用户名”。 |
| S-3 | 已关闭 | schema 有 `expires_at`，会话查询在 SQL 中校验过期，登录轮换旧会话，启动 purge；`tests/auth.test.mjs:44-81`、`tests/api.test.mjs:222-233` 覆盖。 |
| S-4 | 已关闭 | 他人订单一律返回 `order-not-found` 404；`tests/api.test.mjs:94-111` 覆盖。 |

## 新 findings

### F-R3-01 High
- 位置：`server/router.mjs:265-278`、`server/errors.mjs:65-76`、`server/db.mjs:149-176`
- 问题：catch 分支只判断 `error.code` 是否为非空字符串，就直接调用 `statusFor(error.code)`。PG SQLSTATE 和 Node 网络错误都有字符串 `code`，因此 `40001`、`40P01`、`57014`、`55P03`、`53300`、`08006`、`ECONNREFUSED` 等不会进入 `toAppError()`：重试耗尽本应为 503，实际返回 500；响应还可能原样泄露 SQLSTATE。C-2 和 AC-65/AC-71/AC-103 因此未真正闭环。
- 建议：先识别已知应用错误码，未知错误统一经过 `toAppError()`；对外只暴露稳定错误码。补充 40001/40P01 耗尽、57014、55P03、53300 和连接类错误的真实注入测试。

### F-R3-02 High
- 位置：`server/app.mjs:43-60`、`server/db.mjs:139-147`、`server/seed.mjs:32-52`
- 问题：`isSeeded()` 只要 products 和 users 非空就返回 true，完全不区分 classroom/production 种子。已有 classroom 数据库切到 `APP_ENV=production` 时会跳过 `seedProductionAdmin`，保留 `userA/userB`，并保留 classroom `admin` 的 demo 口令；即使 admin 缺失或角色不对也不会修复。`tests/cli.test.mjs:153-167` 还使用已有 classroom 数据的库执行 production seed，只断言退出 0，没有断言演示用户被清除或 admin 口令正确。
- 建议：增加明确的 seed mode marker/表；production 启动时校验 admin 存在且演示用户不存在，或拒绝受过 classroom seed 污染的非空库。补充空库 production 与 classroom→production 迁移测试。

### F-R3-03 High
- 位置：`cli.mjs:125-157`
- 问题：JSON restore 只校验首行 `meta.type/app`。缺失的 table record 被 `tables.get(table) ?? []` 当作空表处理，因此截断或手工构造的备份可以在 `db restore --yes` 中成功清空 products/orders 等表并返回成功；同时 `Object.keys(row)` 的列名未做固定 schema 白名单，直接拼入 INSERT identifier，恶意或损坏备份可造成 SQL 语法错误或 identifier 注入风险。现有 CLI 测试只覆盖完整备份往返。
- 建议：恢复前要求固定表集合、schemaVersion 和每表列集合匹配；拒绝缺表/缺列/未知列；不要拼接来自文件的 identifier。增加截断备份、未知列、版本不匹配和空表备份测试。

### F-R3-04 High
- 位置：`server/router.mjs:201-207`、`server/router.mjs:216-234`、`assets/api-client.mjs:160-168`
- 问题：客户端缺少 CSRF cookie 时，`ensureCsrfToken()` 调用 `/api/health`；但 health 不设置 `fruitlab_csrf`，只有登录成功才设置。于是登录后 cookie 丢失、过期或服务端重发场景下，首次写请求得到 403，重试仍然没有 token，AC-116 的恢复路径实际不可用。`tests/client.test.mjs:77-95` 的 fake health 不返回 Set-Cookie，因此测试未暴露。
- 建议：让 `/api/health` 或其他安全 GET 在缺失时签发 CSRF cookie；增加真实 HTTP 测试：无 token → GET health 获得 cookie → 写请求成功，并确认 403 重试沿用同一 `clientOrderId`。

### F-R3-05 Medium
- 位置：`server/auth.mjs:183-211`、`server/services/auth.mjs:45-72`
- 问题：两桶限流的账号桶实际包含 IP，违反“单账号多 IP 也受账号桶限制”的验收口径；成功登录还会同时删除账号桶和 IP 桶，攻击者用自己的有效账号登录即可重置 IP 失败计数，继续遍历其他用户名。登录路径也未先按用户名规则校验/截断，超长用户名会进入 Map key 和 SQL 参数。
- 建议：账号桶只用规范化用户名，IP 桶单独计数；成功登录只清除该账号桶，IP 失败计数不要被任意账号成功登录重置；对登录用户名先应用长度/字符校验。补充单账号多 IP、同 IP 多用户名、成功登录后继续喷洒的三组测试。

### F-R3-06 Medium
- 位置：`server/services/orders.mjs:57-89`、`server/repositories/products.mjs:32-35`、`server/repositories/orders.mjs:118-128`
- 问题：`getForUpdate()` 名为加锁读取，但 SQL 没有 `FOR UPDATE`。下单在事务内读到 `listed=true` 和旧价格后，管理员可并发提交下架或改价；随后扣库存只检查 `stock >= quantity`，仍会创建已下架/按旧价快照的订单。当前并发测试只覆盖库存竞争和反向购物车，不覆盖 admin unlist/改价与 checkout 的竞争。
- 建议：商品读取使用 `SELECT ... FOR UPDATE`，并在扣库存 SQL 中同时校验 `listed=true`（或重新读取并在锁内校验）；补充 admin unlist/改价与 checkout 的并发测试。

### F-R3-07 Medium
- 位置：`serve.mjs:159-171`、`cli.mjs:192-205`、`server/router.mjs:43-53`
- 问题：通过 `serve.mjs --port` 或 `cli.mjs dev --port` 覆盖端口时只改 `config.port`，没有重建 `config.publicUrl/publicOrigin`；line 161 的 `if (!config.publicUrl.includes(":"))` 对正常 URL 永远为 false。服务在自定义端口监听后，Host 可能放行，但浏览器写请求带来的 `Origin: http://127.0.0.1:<新端口>` 不在 `originAllowed` 集合中，被误判为 `cross-origin-blocked`。测试夹具在启动后手动更新了 config，因此未覆盖该路径。
- 建议：当 `PUBLIC_URL` 未显式提供时，在端口/主机覆盖后重新构造 public origin；启动监听得到实际端口后也同步更新。增加自定义端口和端口 0 的真实 HTTP 写请求测试。

### F-R3-08 Medium
- 位置：`server/router.mjs:43-53`、`Caddyfile:12-16`、`docker-compose.yml:26-32`
- 问题：默认 `PUBLIC_URL` 是 `http://127.0.0.1:4175`，允许集合加入了 `127.0.0.1:4175`，但没有加入 `localhost:4175`；simple 模式和 Caddy 都会保留浏览器的外部 Host。使用文档允许的 `http://localhost:4175` 访问 API 会得到 403 `host-not-allowed`。当前 Host 测试只测了拒绝 `evil.example`，没有测两个回环别名和端口映射。
- 建议：从外部端口同时生成 `127.0.0.1:<port>` 与 `localhost:<port>`，并覆盖 simple/web 两种拓扑；增加 localhost 与 127.0.0.1 的 4175/3000 组合测试。

### F-R3-09 Medium
- 位置：`server/router.mjs:188-189`、`server/router.mjs:236-238`
- 问题：`needsAuth` 的豁免列表不含 `/api/auth/logout`，因此无会话或过期会话调用 logout 返回 401；但 SPEC §5.4 将 logout 定义为“会话（可选）”，无会话也应返回 204 并清理 Cookie。当前测试只覆盖有会话且带 CSRF 的 logout。
- 建议：logout 不要求有效会话；无会话时仍清理两个 Cookie，有会话时执行 CSRF 校验；补充无会话、过期会话和错误 token 的 logout 测试。

### F-R3-10 Medium
- 位置：`cli.mjs:387-394`
- 问题：CLI 只把 080*/57P01/53300 和部分 Node 错误映射为暂时性失败；40001/40P01/57014/55P03 最终落入 `internal-error` 并退出 4。`withTransaction` 重试耗尽、数据库锁超时或 `statement_timeout` 都会违反错误目录中的暂时性失败/退出码 3 契约。
- 建议：复用 `server/errors.mjs` 的 `toAppError()`/`sqlStateOf()` 统一映射 CLI 错误，并补 40001/40P01/57014/55P03 的退出码测试。

### F-R3-11 Medium
- 位置：`scripts/restore.sh:24-28`
- 问题：脚本注释宣称恢复后要校验 schema、种子和行数，但实际只执行两条 `SELECT` 打印计数，不比较 schemaVersion，也不对商品/用户最小数量做失败判断，然后直接 `docker compose start api`。恢复一个其他应用的合法 dump 或不完整的 dump 仍可能以 0 退出并启动 API。
- 建议：恢复后使用 `db check`/SQL 校验 schemaVersion 和关键表、行数；不符合预期时以非零退出码终止并保持 API 停止，同时输出明确诊断。

### F-R3-12 Medium
- 位置：`server/services/health.mjs:6-45`、`server/db.mjs:42-59`
- 问题：health 的 `Promise.race` 超时只让 HTTP 返回 503，不取消底层 `schemaVersion()`/`isSeeded()` 查询。默认 `statement_timeout` 为 15s，而 health 超时为 3s；数据库卡住时，每 5 秒一次 healthcheck 可能持续留下长查询，最终耗尽最大 10 个连接。现有 health 测试只验证连接拒绝的快速失败，没有慢查询/池耗尽注入。
- 建议：health 使用专用短 `statement_timeout` 或可取消查询；超时后主动取消/释放连接，并增加慢查询、池耗尽和恢复测试。

### F-R3-13 Medium
- 位置：`.env.example:19-20`、`config.mjs:57-64`
- 问题：示例值 `ADMIN_PASSWORD=change-me-admin-password` 长度合格、不等于 `demo1234`，因此会被 production 校验接受。用户复制 `.env.example` 后只改 `APP_ENV`/`COOKIE_SECURE` 时，生产 admin 会使用公开示例口令；对应 `POSTGRES_PASSWORD=change-me-postgres` 也有同类风险。
- 建议：production 明确拒绝示例占位口令，或要求通过显式 secret 注入且不在示例中提供可用默认值；补充占位口令拒绝测试和部署文档断言。

## 未评估项

- 未运行 `node --test`、任何数据库集成测试或故障注入测试；上述测试缺口仅来自静态阅读。
- 未启动 Docker、WSL compose、Caddy、Postgres，也未实测非 root 用户、healthcheck、端口映射、Host 校验或环境变量插值。
- 未运行浏览器，未验证真实 CSRF Cookie/Origin 行为、页面写请求和 qa 用户旅程。
- 未执行 backup/restore 脚本或 CLI restore；未实测截断备份、特殊字符口令、并发备份和恢复失败现场。
- 未执行任何 git 操作，未独立核实 HEAD 或工作树；对象 commit 以用户提供的 `1a56eb0` 为准。
