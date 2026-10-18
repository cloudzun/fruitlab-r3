# FruitLab R2 第二智能体代码复核

第二智能体复核；模型 deepseek 同族，不是跨模型。

## Preamble 状态

本次仅执行一次 Git Bash preamble，关键 STATUS：

- `SKILL_START_PROTO: 1`
- `BRANCH: main`
- `MODEL_OVERLAY: gpt-6-astra`
- `SESSION_KIND: interactive`
- `ACTIVATED: yes`
- `REPO_MODE: unknown`
- `UPGRADE_AVAILABLE 1.91.121.0 1.91.130.0`

因本次任务限定只读，未执行升级、测试、验证脚本、服务器或浏览器流程。

## 结论

未发现可直接确认的认证绕过、SQL 注入、静态路径穿越或 API 500 明文泄露。认证、会话哈希、订单归属校验、库存原子扣减和静态白名单的主体实现成立。

但当前不能判定为可 clean 落地。主要风险是：`db reset` 可能在数据库仍被占用或存在 WAL 时给出错误的成功结果；声称的单写者队列没有接入写路径，BUSY/并发合同缺少验证；若干 HTTP 405、校验优先级和客户端超时行为与冻结契约不一致。

## Findings

| 严重度 | 文件:行 | 问题 | 建议 |
|---|---|---|---|
| 高 | `cli.mjs:145` | `db reset` 直接复制主库文件，然后忽略所有 `unlinkSync` 失败并继续重建。数据库有未 checkpoint 的 WAL 时备份可能不完整；Windows 上数据库被服务占用时主库删除会失败，但命令仍可能输出“已重建”，形成假成功。测试只覆盖所有连接已关闭的顺序路径：`tests/cli.test.mjs:90`。 | 要求服务停止，或使用 SQLite 自身备份机制；删除失败必须显式失败；完成后重新打开并校验 schema、种子和用户表，不能静默继续。 |
| 中 | `server/db.mjs:157`、`server/orders.mjs:189` | `enqueueWrite` 只有定义，没有调用方；实际下单直接使用 `inTransaction`，其余写入也绕过队列。BUSY 只在建单路径按错误消息中包含大写 `BUSY` 处理，注册、登录建会话、商品更新等写入会落到通用 500。文档宣称“单写者队列 + BUSY 处理”，但 `tests/` 没有任何真实并发、持锁或 BUSY 用例；`tests/api.test.mjs:70` 和 `tests/db.test.mjs:37` 都只是顺序重复请求。 | 要么接入统一写执行器并按 SQLite errcode/code 映射 BUSY、执行有界重试；要么下调文档承诺。补真实并发 HTTP 下单、同幂等键并发、持锁写入和 BUSY 映射测试。 |
| 中 | `server/router.mjs:235` | 动态资源路由的 405 判定不完整。`PATCH /api/orders/{num}` 因方法既非 GET 的匹配分支、又满足“不是 GET/PATCH”排除条件，最终返回 404；`GET /api/admin/products/{id}` 同样返回 404，而不是带 `Allow` 的 405。当前只测了 `/api/auth/login` 的 405：`tests/api.test.mjs:188`。 | 用统一路由形状表在业务分派前先判定 method/Allow，并补所有已知资源路由的 405 表驱动测试。 |
| 中 | `server/router.mjs:168`、`server/router.mjs:206` | 认证检查发生在请求体读取之前。未登录 `POST /api/orders` 携带非法 JSON 或超限体时返回 401，而不是 SPEC §5.2 冻结优先级中的 400/413；非管理员 PATCH 也先返回 401/403。现有测试只测公开登录接口的非法体，以及未登录但合法体的下单请求。 | 明确安全取舍：若坚持先认证，应修改 SPEC 优先级并补测试；若遵守冻结契约，则先做内容类型/大小/JSON 校验再判会话和角色。 |
| 中 | `assets/api-client.mjs:105` | 超时定时器在 `fetch` 返回响应头后立即清除，之后才在 `api-client.mjs:118` 读取响应体。服务端若先发响应头再卡住响应体，客户端会永久等待，`timeout` 和 save-unknown 语义失效。`tests/` 没有 `createApiClient` 的超时、响应体读取失败或 invalid-response 单测。 | 将超时覆盖到响应体读取和 JSON 解析完成，或使用统一的 `AbortSignal.timeout` 生命周期；补 headers-then-hang、abort、无效 JSON 的客户端测试。 |
| 低 | `server/router.mjs:185`、`server/router.mjs:209` | 动态路径参数直接 `decodeURIComponent`。畸形百分号编码会抛 `URIError` 并落入通用 catch，返回 500 `internal-error` 且写错误日志，而不是 400/404。 | 抽安全解码函数，解码失败返回稳定 400 或 404；补 `%zz` 类路径测试。 |
| 低 | `server/auth.mjs:53`、`server/router.mjs:152` | 同一 `user` 形状不一致：登录/注册返回 `id`，`/api/auth/me` 通过 `getSessionUser` 返回 `userId`。当前前端不依赖该字段，但契约消费者容易误用。 | 统一为 `{ id, username, role }`，并补 `/auth/me` 形状断言。 |

## 通过项

- SQL 注入：认证查询、商品更新、订单查询和写入均使用参数绑定；动态占位符由数据库结果数量生成，动态字段名来自固定白名单。
- 静态路径穿越：公开路径白名单、编码分隔符拒绝、`..` 和隐藏段拒绝、`realpath` 根目录包含校验均存在；图片路径另有严格正则。
- 认证与会话：scrypt 加盐哈希、随机 32 字节会话令牌、库中仅存 sha256、登录轮换旧 Cookie、登出删除服务端会话行、归属校验和 admin 角色校验均已实现。
- 订单事务：主单、明细和库存扣减位于同一事务；扣减条件 `stock >= ?` 保持原子性；`(user_id, client_order_id)` 唯一索引与冲突回查路径存在。
- 错误泄露：API 未预期异常对客户端只返回 `internal-error` 并附 `X-Request-Id`；静态 500 使用固定文案；健康检查把工作目录外数据库路径压缩为 basename。
- HTTP 基础防护：Host 白名单、状态变更 Origin/Sec-Fetch-Site 校验、JSON 体 64 KiB 流式上限、API `no-store`、CSP、nosniff、DENY framing 均存在。
- 前端注入面：运行时代码未使用 `innerHTML`/`outerHTML` 等 sink，API 错误文案映射存在，静态扫描覆盖了主要网络调用边界。

## 测试覆盖判断

已覆盖：

- `tests/auth.test.mjs`：哈希、校验、会话解析/删除、令牌哈希存储、重名顺序拒绝。
- `tests/api.test.mjs`：登录/登出、订单隔离、admin 权限、库存扣减、顺序幂等、输入错误、Host/Origin、CSP。
- `tests/db.test.mjs`：迁移、种子、唯一约束、事务回滚、顺序幂等。
- `tests/cli.test.mjs`：init/seed、用户添加、价格更新、db check、顺序 reset 和备份文件存在。

明显缺口：

- 没有真实并发或持锁测试，不能支撑 AC-39、AC-44 和 OB-ENG-01 的完成声明。
- 没有 BUSY 到 503/退出码 3 的运行时测试。
- 只有登录路由验证了 API 405；动态订单和商品资源路由未覆盖。
- 没有未认证非法体/超限体的优先级测试。
- 没有 `api-client` 的超时、网络错误、响应体卡死、非 JSON 响应测试。
- 没有静态路径穿越、编码分隔符、畸形百分号编码和静态 405 的端到端测试。

## 不可用项

- 未运行 `node --test`、`scripts/verify.mjs` 或 verify-evidence，因此不提供测试通过结论。
- 未启动服务器、未跑浏览器、未做动态并发复现；所有并发和错误映射判断均来自静态代码路径。
- 没有跨模型复核信号；本报告仅代表第二智能体的同族复核。
- 未执行 gstack 升级流程，未修改任何产品代码或配置。

## 诚实边界

- 本报告是只读静态审查，不是渗透测试，也没有证明上述问题已在真实运行环境触发。
- 项目文档已显式接受“无会话过期、无完整 CSRF、无登录限流、无 HTTPS/Secure Cookie、无审计日志、403 订单存在性泄露、演示账号默认口令”等边界；这些不作为新 finding，但也不能据此宣称生产级安全。
- `node:sqlite` 的 BUSY 错误字符串是否需要匹配 `BUSY` 仍应通过运行时测试确认；本报告确认的是实现依赖消息字符串且测试未覆盖该路径。
- 未审查 `D:\vibecoding\easyvibe\r1-fruitlab`，未读取或修改其内容。

