# 义务台账（R3）

> 来源：`DECISIONS.md` 的 Accepted Obligations（42 条）。
> 判定词汇：`closed` / `downgraded`（附理由）/ `not-covered`（附理由）。build 填实现状态，最终判定在 ship 环。

| 编号 | 义务 | 完成判据 | build 实现状态 | 最终判定 |
|---|---|---|---|---|
| OB-R3-CEO-01 | 工时重估 35–45h；M1/M2/M3 各有上限与停止线 | SPEC §10/§16 + BUILD.md 里程碑表 | implemented（待 review/qa 复核） | 待定 |
| OB-R3-CEO-02 | 结果型 AC-106..109（旅程/管理变更/DB down/备份恢复） | AC 表 + qa 证据 | implemented（待 review/qa 复核） | 待定 |
| OB-R3-CEO-03 | R2 用仓库外临时 SQLite 文件启动，重启仍在 | `start-all.mjs` + AC-111 | implemented（待 review/qa 复核） | 待定 |
| OB-R3-CEO-04 | 课程目标矩阵 + 5–8 分钟三幕 demo 脚本 | SPEC §4.1 + `evidence/demo-script.md` | implemented（待 review/qa 复核） | 待定 |
| OB-R3-CEO-05 | 范围裁剪建议的拒绝/降级留痕 | SPEC §16.3 + DECISIONS | implemented（待 review/qa 复核） | 待定 |
| OB-R3-CEO-06 | `start-all` 探测原生 Docker/WSL；README 双预检 | 脚本 + README + qa | implemented（待 review/qa 复核） | 待定 |
| OB-R3-CEO-07 | `check-docs-stale.mjs`：R3 学员文档无旧口径 | 脚本 + AC-114 | implemented（待 review/qa 复核） | 待定 |
| OB-R3-DES-01 | 4175 经 Caddy 的真实 Chromium 购买闭环 | AC-106 + 截图/日志 | implemented（待 review/qa 复核） | 待定 |
| OB-R3-DES-02 | CSRF 客户端 `ensureCsrfToken` + 403 重试一次 + 文案 | 客户端测试 + AC-116 | implemented（待 review/qa 复核） | 待定 |
| OB-R3-DES-03 | 三个新错误码文案/恢复；health 503 统一信封 | error-catalog + 前端映射测试 | implemented（待 review/qa 复核） | 待定 |
| OB-R3-DES-04 | README 重写 + demo 三幕脚本 | README + AC-110 | implemented（待 review/qa 复核） | 待定 |
| OB-R3-DES-05 | 启动错误模板 + 四类排障 + web healthcheck | README + AC-115 | implemented（待 review/qa 复核） | 待定 |
| OB-R3-DES-06 | R2 UI 回归矩阵（三档/键盘/焦点/aria） | qa 记录 + AC-112 | implemented（待 review/qa 复核） | 待定 |
| OB-R3-DX-01 | clean-room quickstart + `preflight.mjs` | README + AC-113 | implemented（待 review/qa 复核） | 待定 |
| OB-R3-DX-02 | `VERSION`/包版本分离 + engines/packageManager | 版本校验测试 | implemented（待 review/qa 复核） | 待定 |
| OB-R3-DX-03 | CLI `db restore` + 容器 backups 卷 + 往返 | CLI 测试 + AC-109 | implemented（待 review/qa 复核） | 待定 |
| OB-R3-DX-04 | `HOST=0.0.0.0` + `PUBLIC_URL` 派生 + 三层探活 | compose + 容器测试 | implemented（待 review/qa 复核） | 待定 |
| OB-R3-DX-05 | `pgctl.mjs up/status/down` readiness/清理 | 脚本 + README + AC-118 | implemented（待 review/qa 复核） | 待定 |
| OB-R3-DX-06 | `docs/cli.md` 命令矩阵 + help 一致测试 | 文档 + 表驱动测试 | implemented（待 review/qa 复核） | 待定 |
| OB-R3-DX-07 | `verify --quick/--full` + preflight | 脚本输出 + AC-113 | implemented（待 review/qa 复核） | 待定 |
| OB-R3-DX-08 | 路径可移植 + PowerShell backup/restore 包装 | 脚本 + README | implemented（待 review/qa 复核） | 待定 |
| OB-R3-DX-09 | 镜像 digest 记录 + lockfile/registry 说明 | `docs/deploy.md` + evidence | implemented（待 review/qa 复核） | 待定 |
| OB-R3-ENG-01 | client 级 migrate/seed/reset + 同事务 + 三路失败测试 | db/CLI 测试 | implemented（待 review/qa 复核） | 待定 |
| OB-R3-ENG-02 | 商品排序后扣库存 + 反向购物车测试 | 并发测试 | implemented（待 review/qa 复核） | 待定 |
| OB-R3-ENG-03 | 异步 scrypt + 信号量/队列 + 限流前置 | auth 测试 + 延迟证据 | implemented（待 review/qa 复核） | 待定 |
| OB-R3-ENG-04 | Caddy `/healthz` + web healthcheck | compose + 容器证据 | implemented（待 review/qa 复核） | 待定 |
| OB-R3-ENG-05 | restore 停写/断连/单事务/校验/重启 | restore 脚本 + AC-109 | implemented（待 review/qa 复核） | 待定 |
| OB-R3-ENG-06 | CLI JSON 备份/恢复契约与 pg_dump 双轨 | CLI 测试 + deploy 文档 | implemented（待 review/qa 复核） | 待定 |
| OB-R3-ENG-07 | 测试池/并发/清理/预算 | helper + AC-118 | implemented（待 review/qa 复核） | 待定 |
| OB-R3-ENG-08 | 两桶限流 + 喷洒测试 | auth 测试 | implemented（待 review/qa 复核） | 待定 |
| OB-R3-ENG-09 | CSRF 轮换/Secure/登出清理 | auth/API 测试 | implemented（待 review/qa 复核） | 待定 |
| OB-R3-ENG-10 | int8 安全解析/ID 不暴露 | contracts + 测试 | implemented（待 review/qa 复核） | 待定 |
| OB-R3-ENG-11 | 迁移 advisory lock + checksum + 并发测试 | db 测试 | implemented（待 review/qa 复核） | 待定 |
| OB-R3-ENG-12 | 路径规范化 + `400 invalid-path` + 405 表 | API 表驱动测试 | implemented（待 review/qa 复核） | 待定 |
| OB-R3-ENG-13 | v1.2 快照重冻；build 只认 v1.2 哈希 | 快照 + DECISIONS 哈希 | implemented（待 review/qa 复核） | 待定 |
| OB-R3-SPEC-01 | compose/DSN/health/备份全变量化 | compose + 非默认值实测 | implemented（待 review/qa 复核） | 待定 |
| OB-R3-SPEC-02 | `seedClassroom`/`seedProductionAdmin` 拆分 | CLI/seed 测试 + AC-57/82 | implemented（待 review/qa 复核） | 待定 |
| OB-R3-SPEC-03 | health 3s 时限 + 池参数映射 | 故障注入测试 | implemented（待 review/qa 复核） | 待定 |
| OB-R3-SPEC-04 | AC-91 白名单补 D-47/62/79/82 | BUILD 逐测试处置表 | implemented（待 review/qa 复核） | 待定 |
| OB-R3-SPEC-05 | D-82 唯一 XFF 决策；compose TRUST_PROXY | SPEC/DECISIONS + 测试 | implemented（待 review/qa 复核） | 待定 |
| OB-R3-SPEC-06 | username/价格/库存上限 CHECK；password 只 service | schema 断言 + API 测试 | implemented（待 review/qa 复核） | 待定 |
| OB-R3-SPEC-07 | 状态 v1.2、D 范围、F-09→AC-91 | SPEC/decision-log | implemented（待 review/qa 复核） | 待定 |
