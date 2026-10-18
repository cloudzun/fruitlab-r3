# codex 同族复核处置台账（spec 环）

> 复核者：codex 独立子代理（`opencode-go/deepseek-v4.1-flash`），**同族，不是跨模型**。
> 对象：`evidence/codex/SPEC-snapshot-v1.0.md`（SHA-256 `de78e754cab77d0dcc7b9084d9028a0b80941527daeb7ab2c9aa4c9e14c3b53b`）。
> 报告：`evidence/codex/spec-review-codex.md`（10 条 findings）。第二轮增量复核：`evidence/codex/spec-review-round2-codex.md`。
> 规则：每条 finding 只能 `accepted`（已改 SPEC）/ `partially`（部分改并说明剩余）/ `rejected`（附理由）。不伪造"已解决"。

| 编号 | 严重度 | 问题摘要 | 处置 | SPEC v1.1 落点 | 新增/更新 AC |
|---|---|---|---|---|---|
| F-01 | High | PostgreSQL `23505` 后事务 aborted，不能继续查；订单号冲突重试与幂等回查必须跨事务；库存扣减顺序可能重复扣 | **accepted** | §5.2「23505 事务边界」「checkout 事务顺序」；§5.3 repository 签名改为显式 orderNumber/扣库存/插行；D-74 | AC-64 改写、AC-97 |
| F-02 | High | service 导出签名无 pool/repos/clock/config，无法同时满足注入与冻结；缺组合根 | **accepted** | §5.3 增加 `server/app.mjs` + `createServices` + `createXxxService(deps)`；D-75 | AC-98 |
| F-03 | High | 容器内 api 默认只监听 127.0.0.1；Host 白名单/healthcheck/`PUBLIC_URL` 未定义 | **accepted** | §5.4 Host/Origin 派生规则；§5.8 `HOST=0.0.0.0`、Caddy 保留 Host、web healthcheck；D-77 | AC-99 |
| F-04 | High | 备份/DATABASE_URL/`pg_isready` 硬编码 `fruitlab`，`.env.example` 无 USER/DB，与官方镜像默认不符 | **accepted** | §5.8 同源变量；备份脚本从 `.env` 读取；D-78 | AC-100 |
| F-05 | High | npm 包版本 `3.0.0.0` 非合法 SemVer，破坏 `npm ci` | **accepted** | `VERSION=3.0.0.0` 与 `package.json=3.0.0` 分离映射；D-72 | AC-55 改写、AC-101 |
| F-06 | High | 生产模式只查 `DEMO_PASSWORD` 存在，`demo1234` 仍可进生产；三账号共用口令 | **accepted** | §5.5 生产加固：独立 `ADMIN_PASSWORD`、强度/非默认、`COOKIE_SECURE=1`、不 seed demo 用户；D-73 | AC-82 改写、AC-102 |
| F-07 | High | `pg.Pool` 无连接获取超时/`pool error` 监听，health/API 可挂起 | **accepted** | §5.2 `connectionTimeoutMillis`/`idleTimeoutMillis`/`pool.on("error")`；D-76 | AC-103 |
| F-08 | Medium | `X-Forwarded-For` 最左段可伪造；限流 Map 无上限 | **accepted** | Caddy 覆盖 XFF；`TRUST_PROXY` 内网信任；Map 键长/容量上限；D-71/D-82 | AC-104 |
| F-09 | Medium | AC-91「96 项语义逐项保留」与 403→404/CSRF/过期/优先级变更矛盾，不可机械核对 | **accepted** | AC-91 改为逐测试处置表 + 变更白名单；D-80 | AC-91 改写 |
| F-10 | Medium | R2 输入约束（clientOrderId 8–128、maxItems、重复合并等）未继承；DB 无对应 CHECK | **accepted** | §5.1 `client_order_id` CHECK；§5.4/§5.7 校验清单；D-79 | AC-105 |

## 未采纳/降级

- 无。10 条全部采纳或部分采纳（部分采纳的剩余项已在第二轮复核中单独核对）。
- 跨模型门禁仍 `unavailable`：本机只有 DeepSeek 家族（codex 配置 `opencode-go/deepseek-v4.1-flash`）；**不换模型充数、不把同族当跨模型**。

## 诚实边界

- 这是**同族第二智能体静态复核**，不是跨模型、不是渗透测试；它没有运行测试或容器（按任务约束）。
- 复核发现的正确性最终以 build/review/qa 环的真实执行证据为准，本台账不表示任何实现已通过。
