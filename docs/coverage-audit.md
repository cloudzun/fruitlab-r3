# 覆盖率审计（R3 ship 环）

> 方法：逐条追踪 R3 新增/变更路径，按“有真实测试 + 有失败路径 + 有证据”评星；测试计数唯一来源 `evidence/test-count.txt`。
> 评星：★★★ = 正常+失败/边界均有测试；★★ = 主路径有测试、失败路径部分；★ = 仅间接覆盖。

## 1. 路由与状态码（12/12 覆盖）

| 路径 | 正常 | 失败/边界 | 星 |
|---|---|---|---|
| `GET /api/health` | 200 db up | 503 db down（连接拒绝/超时销毁） | ★★★ |
| `GET /api/products` | 200 14 条 | 下架过滤（catalog 测试） | ★★★ |
| `POST /api/auth/register` | 201 | 409 重名、400 用户名/口令 | ★★★ |
| `POST /api/auth/login` | 200 + Cookie | 401、429、时序分支 | ★★★ |
| `POST /api/auth/logout` | 204 | 无会话 204、CSRF 缺失 403 | ★★★ |
| `GET /api/auth/me` | 200 | 401、过期会话 | ★★★ |
| `POST /api/orders` | 201 | 409 库存/下架、400 校验、幂等 200、并发 | ★★★ |
| `GET /api/orders/mine` | 200 | 401 | ★★★ |
| `GET /api/orders/{num}` | 200 | 404 他人/不存在、400 编码 | ★★★ |
| `GET /api/admin/orders` | 200 | 401/403 | ★★★ |
| `GET /api/admin/products` | 200 含下架 | 401/403 | ★★★ |
| `PATCH /api/admin/products/{id}` | 200 | 400 价格/库存/listed、404、403、CSRF | ★★★ |

## 2. 横切能力

| 能力 | 覆盖 | 星 |
|---|---|---|
| 405 表（精确+动态） | 5 类路由表驱动 | ★★★ |
| 判定优先级（415/413/400→405→401→CSRF→403→404） | API 测试 + CSRF | ★★★ |
| CSRF（双提交 + bootstrap + 403 重试） | 服务端 + 客户端 | ★★★ |
| 会话过期/轮换/登出 | auth + API | ★★★ |
| 限流（账号+IP 两桶、多 IP、成功不清 IP） | auth + review-fixes | ★★★ |
| 时序（dummy scrypt 分支） | auth（注入 gate 计数） | ★★★ |
| 越权（404 存在性隐藏） | API | ★★★ |
| 并发（库存 1、同幂等键、反向购物车） | db 测试 | ★★★ |
| SQLSTATE 映射（23505/40001/40P01/57014/55P03/53300） | errors + review-fixes + CLI | ★★★ |
| 迁移（幂等、checksum、advisory lock、reset 回滚） | db + CLI | ★★★ |
| 连接池（超时、health 销毁连接） | review-fixes | ★★★ |
| 静态层（白名单、穿越、编码、405、problem+json） | 继承 R2 + 链接测试 | ★★★ |
| CLI（退出码 0/1/2/3/4、backup/restore、生产口令） | cli + review-fixes | ★★★ |
| 容器（三容器/非 root/healthcheck/持久化/备份恢复） | 容器实跑证据 | ★★★（手工） |
| 分层依赖规则 | layering 测试 | ★★★ |
| 文档/编号/追溯/证据哈希 | verify 机械检查 | ★★★ |

## 3. 未覆盖/降级

| 项 | 状态 | 说明 |
|---|---|---|
| 跨模型复核 | `unavailable` | 无第二模型家族；同族 codex 替代并标注 |
| cso 全量扫描器 | `partial` | 离线无 gitleaks/osv/semgrep/trivy profiles |
| 读屏器/对比度仪器 | `UNVERIFIED` | 无人工受试条件 |
| simple 模式首页 HTML | `UNVERIFIED` | 仅验证 health/容器 |
| Docker Desktop 原生引擎 | `UNVERIFIED` | 本机仅 WSL Docker |
| 云平台部署 | `requires-remote` | M5 选修 |

## 4. 结论

12/12 路由、16 类横切能力均有真实测试或容器证据；无 ★ 未覆盖项；降级项均如实记录。测试计数见 `evidence/test-count.txt`（137 项，真实 Postgres）。
