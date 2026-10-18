# 干净运行记录（R3）

> 目的：用真实执行替代“证据包”承诺（G2 替代形态）。所有命令在 `D:\vibecoding\easyvibe\r3-fruitlab` 执行。

## 1. 测试（真实 Postgres）

```text
node scripts/pgctl.mjs up            # test postgres ready on 127.0.0.1:55432
node --test --test-concurrency=4     # 137 tests / 137 pass / 0 fail
node --test --test-concurrency=4     # 稳定性复跑 4 次，0 失败（见 ring-review.md）
node scripts/record-test-count.mjs   # evidence/test-count.txt（含 tree hash）
```

## 2. 静态/机械检查

```text
node scripts/check-links.mjs         # PASS（白名单与本地链接存在）
node scripts/check-numbering.mjs     # PASS（AC 70，OB 42）
node scripts/check-traceability.mjs  # PASS（AC/OB 均进入 BUILD.md）
node scripts/check-redaction.mjs     # HIGH 0 / MEDIUM 0
node scripts/check-docs-stale.mjs    # clean
node scripts/check-compose.mjs       # compose config OK
node scripts/verify-evidence.mjs     # 清单一致
```

## 3. 一键验证

```text
node scripts/verify.mjs --quick      # 6/6 PASS（无 Docker/PG）
node scripts/verify.mjs              # 9/9 PASS（preflight + 137 测试 + 全部机械检查 + compose）
```

## 4. 容器/浏览器（摘要）

- 三容器 healthy；api/web `id -u`=1000；重启/降卷持久化；备份→删→恢复；
- Chromium 经 4175 完成登录/加购/下单/我的订单；1440/834/390 断点与 390 紧凑购物袋；
- 详细证据见 `ring-build.md`、`ring-qa.md`、`container/`、`visual/`。

## 5. 未执行/不可用

- Docker Desktop 原生引擎（本机仅 WSL Docker）；
- 云平台部署（需账号，M5）；
- 跨模型复核（`unavailable`）；
- 读屏器/对比度仪器（`UNVERIFIED`）。
