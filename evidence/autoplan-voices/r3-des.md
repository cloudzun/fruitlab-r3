同族第二智能体，非跨模型；对象 SPEC-snapshot-v1.0.md（de78e754cab77d0dcc7b9084d9028a0b80941527daeb7ab2c9aa4c9e14c3b53b）

**结论**

FAIL，6/10。快照哈希已核验一致。R3 的后端、容器和安全契约总体可执行，但 Design 视角仍缺三类门禁：4175 上经 Caddy 的真实购买闭环、CSRF 失败后的可恢复体验、以及 R2 移动端/无障碍/演示叙事的回归验收。当前 AC 可以在首页打不开购物流程或教师无法在 5 分钟内讲清部署形态时仍全部通过。

**Findings**

| 编号 | 严重度 | 位置 | 问题 | 建议 |
|---|---|---|---|---|
| R3-DES-01 | High | `SPEC-snapshot-v1.0.md:319-329, 370, 400, 403` | AC-51/84 只验证 4175 首页和 `/api/health` 可达，AC-81 只做 API 级 CSRF；没有 AC 要求经 Caddy 在 4175 用真实浏览器完成“首页→注册/登录→加购→下单→我的订单”。CSRF 横跨 `api-client`、Cookie、Caddy 反代三层，任一层出错都可能使核心购买闭环失效而全部 AC 仍为绿。 | 新增真实 Chromium 端到端 AC：从 4175 首页走完整下单闭环，断言 CSRF Cookie/请求头、订单成功文案、订单可见且刷新/重试不重复扣库存；证据落 `evidence/visual/` 或 `evidence/e2e/`。 |
| R3-DES-02 | Medium | `SPEC-snapshot-v1.0.md:235, 263, 281, 423` | CSRF 恢复只定义“Cookie 缺失时 GET `/api/health` 后重试一次”；未定义收到 `403 csrf-token-invalid`、Cookie 被禁用、同名 Cookie 冲突或并发首次写入时如何处理。把 health 当 token bootstrap 还会让取 token 依赖数据库状态，失败后没有可执行恢复路径。 | 在 `api-client` 定义统一 `ensureCsrfToken()`；对缺失或 `csrf-token-invalid` 各重试一次，重试沿用同一 `clientOrderId`；仍失败时显示“刷新页面并允许本站 Cookie”的具体文案。补测 Cookie 缺失、403、并发首次写入和服务重启场景。 |
| R3-DES-03 | Medium | `SPEC-snapshot-v1.0.md:70, 228, 275, 281-282, 400-402` | health/error 契约不闭合：统一失败体要求 `{ok:false,code,message,details?}`，但 DB down 的 503 示例只有 `{code:"db-unavailable",db:"down"}`；新增的 `csrf-token-invalid`、`auth-rate-limited`、`db-unavailable` 也没有规定中文用户文案、恢复动作和前端映射测试。用户可能看到技术码或泛化的“内部错误”。 | 在 `docs/error-catalog.md` 为三个新码补齐 surface、中文文案、恢复动作；health 503 使用统一信封。明确 CSRF 可刷新重试、限流需等待、DB 未就绪需查看健康状态/容器日志，并增加前端文案映射测试。 |
| R3-DES-04 | High | `SPEC-snapshot-v1.0.md:349-356, 409, 464-469`；`README.md:1-55`；`evidence/demo-script.md:1-24` | 快照没有把 README/演示脚本更新列入 R3 AC。当前 README 仍写“spec 未开始、R3 不能起”，demo-script 仍是 R2 的 4174 脚本，未覆盖 4175、三容器拓扑、health、Caddy 反代和故障降级。教师无法按交付物在 5 分钟内讲清“可部署形态”。 | 新增 AC：README 提供 60 秒启动卡与“R2→R3 变了什么”；demo-script 改为 5 分钟脚本，依次讲三版本对比、web/api/db 拓扑、4175 health、一次下单、重启持久化和一个失败排查场景。脚本必须使用本机真实可执行的 Docker Desktop/WSL 命令。 |
| R3-DES-05 | High | `SPEC-snapshot-v1.0.md:175, 325-334, 344-346, 403-409`；`docs/decision-log.md:D-77` | 容器/启动失败的可诊断性不足：启动失败只说“可操作错误”，未定义失败阶段、脱敏 DSN、最后 SQLSTATE、重试次数和下一步命令；AC-84 要求“三容器健康”但 `Dockerfile.web` 未定义 healthcheck；拓扑也未在快照中锁定 `HOST=0.0.0.0`/`PUBLIC_URL`，而 D-77 已确认需要；Windows 上 AC-51 的通用 `docker compose` 与本机只能走 WSL 的现实不一致。 | 定义启动错误模板（stage、尝试次数、SQLSTATE、requestId、脱敏连接目标、下一步命令）；README 增加 Docker 引擎未启动、4175 占用、DB 认证失败、Host/反代 403 四类排障。补齐 web healthcheck，明确 `HOST=0.0.0.0` 与 `PUBLIC_URL`，并让 AC-51 采用真实可执行命令。 |
| R3-DES-06 | Medium | `SPEC-snapshot-v1.0.md:417-426`；`../r2-fruitlab/SPEC.md:302-310, 343-344` | 移动端与无障碍回归没有验收门：R3 只保留 fake DOM 测试并写了“Chromium 五断点截图”，未规定键盘完整流程、焦点落点、`aria-live`/`aria-invalid`、移动端紧凑购物袋、无横向滚动、错误态文案等通过标准。截图不足以证明 R2 的可访问性和移动购买流程未回归。 | 增加 R2 UI 回归矩阵：390/834/1440 三档无横向滚动、导航与购物袋可达、键盘完成浏览→加购→结账、查单结果聚焦、错误关联 `aria-describedby`、状态区播报与具体错误文案。保留 R2 Apple 版式和词元，不重开视觉方向评审。 |

**未评估项**

- 未运行 4175 首页到下单的真实浏览器流程，也未注入 CSRF 失败、Cookie 禁用或并发首次写入场景。
- 未启动或停止任何容器，未验证 `docker compose ps/logs`、healthcheck 转换、Caddy 反代失败和启动重试日志。
- 未执行读屏器、对比度仪器、完整键盘路径或真实移动设备检查；仅审了规范中的验收覆盖。
- 未重审 Apple 版式、配色、排版或视觉风格；按任务边界只审 R3 引入的部署、流程、文案、可观测性和回归验收。
