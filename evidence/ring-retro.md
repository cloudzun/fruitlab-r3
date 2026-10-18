# 证据 · retro 环（R3，7/7 环）

> 基于真实 Git 历史、`evidence/test-count.txt`、容器/浏览器证据。量化优先。

## 1. 量化数据

```text
git rev-list --count r2-baseline..HEAD        # 8（spec/autoplan/build/review/qa/ship/retro）
git diff --shortstat r2-baseline..HEAD        # 135 files changed, 14702 insertions(+), 2707 deletions(-)
evidence/test-count.txt                       # tests=137 pass=137 fail=0（连续 4 次稳定）
docker images                                 # fruitlab-r3:3.0.0.0 245MB, fruitlab-r3-web:3.0.0.0 102MB
```

| 指标 | R2 | R3 |
|---|---:|---:|
| 测试 | 96 | 137 |
| 路由 | 10 | 12/12 覆盖 |
| 依赖 | 0 | 1（`pg`） |
| 容器 | 0 | 3 |
| R2 缺陷 | 11 open | 11 closed |
| review findings | — | codex 13 + cso 4 |
| 义务 | 42 closed | 42 closed |

## 2. 返工日志

| 环 | 返工 | 原因 |
|---|---|---|
| spec | 第一轮 codex 复核因 SPEC 并发修改停下；改冻结快照 + SHA 后重跑 | 评审对象必须稳定 |
| build | Caddy Host 丢端口 → API 403；重建 web 镜像 | `{http.request.host}` 不含端口 |
| build | 测试发现误扫 `scripts/test-pg.mjs`；改名 `pgctl.mjs` | Node `--test` 命名规则 |
| build | 测试 runner 不退出；admin 连接未关闭 | 测试夹具资源泄漏 |
| review | 13 条 findings 全部修复；其中 4 High | codex 独立复核有效 |
| review | 偶发 flaky（1/3）；定位为测试清理误删并行库 | 测试隔离纪律 |
| qa | 390 视口 resize 最小 500；改用 emulate | 浏览器窗口约束 |

## 3. 经验教训

1. 评审前冻结快照（哈希写入报告首行），避免“边改边审”。
2. 测试清理只动自己的库；任何“全前缀清理”都是并行测试的炸弹。
3. PostgreSQL 事务错误后必须 ROLLBACK；23505 不能在同一事务里回查。
4. seed 模式要显式记录（app_meta），否则演示库会被当生产。
5. 备份恢复必须有白名单与校验，否则“成功恢复”可能是成功清库。
6. 反代保留 Host 用 `hostport`；`TRUST_PROXY` 只在可信反代后开启。
7. 证据文件路径受工具限制时，先落临时/附件路径再复制，不伪造截图。
8. 同族评审不是跨模型；如实标注 `unavailable`，不拿同族凑数。

## 4. 可复用资产

- `scripts/preflight.mjs`、`pgctl.mjs`、`verify.mjs --quick/--full`、`record-test-count.mjs`（含 tree hash）；
- `tests/helpers/pg.mjs`（每用例独立库 + 可操作错误）；
- `docs/architecture.md`、`deploy.md`、`backup-restore.md`、`coverage-audit.md`；
- `evidence/container/` 的容器验收脚本化命令；
- 三版本 `start-all.mjs`（R2 用仓库外临时 SQLite 文件）。

## 5. 未完成

- 跨模型复核 `unavailable`；cso `partial`；
- 读屏器/对比度仪器/实体手机 `UNVERIFIED`；
- simple 模式首页 HTML 未验证；
- 云平台部署 M5 选修（需账号）；tag 未推送（无 remote）。
