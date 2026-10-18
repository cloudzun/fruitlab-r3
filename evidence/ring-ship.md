# 证据 · ship 环（R3，6/7 环）

> 结果：`3.0.0.0` 发布；文档同步；覆盖率审计 12/12 路由；`verify.mjs --full` 9/9 PASS；R1/R2 工作树为空。

## 1. 版本与发布

| 项 | 值 |
|---|---|
| `VERSION` | `3.0.0.0` |
| `package.json` version | `3.0.0`（合法 SemVer；映射见 AC-101） |
| api 镜像 | `fruitlab-r3:3.0.0.0`（`289a009e5d3a`，245 MB） |
| web 镜像 | `fruitlab-r3-web:3.0.0.0`（`8e2f3a21db7e`，102 MB） |
| 发布 tag | `v3.0.0.0`（本地；无 remote，推送 `requires-remote`） |

## 2. 文档同步

- `README.md`：R3 快速开始、三版本、测试/验证、安全边界；
- `CHANGELOG.md`：`[3.0.0.0]` Added/Changed/Removed/Fixed/Known Issues；
- `docs/`：architecture、deploy、backup-restore、contracts、api、cli、error-catalog、obligations、coverage-audit；
- `BUILD.md`：AC×OB 全表（70 AC / 42 OB），最终判定 `verified`；
- `review.md`、`qa-report.md`、`retro.md`、逐环 `evidence/ring-*.md`；
- `docs/decision-log.md`：D-47..D-108 全程留痕。

## 3. 门禁

```text
node scripts/verify.mjs
PASS preflight --full
PASS node --test --test-concurrency=4        # 137/137，真实 Postgres
PASS check-links / check-numbering / check-traceability
PASS check-redaction / check-docs-stale
PASS verify-evidence（90 个证据文件）
PASS check-compose
PASS: 9/9 项通过（full）
```

## 4. 版本隔离

```text
git -C ..\r1-fruitlab status --short   # 空
git -C ..\r2-fruitlab status --short   # 空
```

R1 `3087a05` / `1.0.0.0`、R2 `5f4dd87` / `2.0.0.0` 未改动；R3 独立目录、端口 4175、Postgres volume `fruitlab-r3-pgdata`、compose 项目 `fruitlab-r3`、镜像 `fruitlab-r3*`。

## 5. 量化

| 指标 | R2 | R3 |
|---|---:|---:|
| 测试 | 96 | **137** |
| 路由覆盖 | 10 | **12/12** |
| 运行时依赖 | 0 | 1（`pg`） |
| 容器 | 0 | 3（web/api/db） |
| R2 遗留缺陷 | 11 open | **11 closed** |
| review findings | — | 13 修 + cso 4 处置 |
| 提交（自 `r2-baseline`） | — | 8（spec/autoplan/build/review/qa/ship/retro 修复） |
| 变更规模 | — | 135 files，+14702/−2707 |

## 6. 未完成/降级

- 云平台部署：`requires-remote`（M5 选修）；
- 跨模型复核：`unavailable`；cso 离线 `partial`；
- 读屏器/对比度仪器/实体手机：`UNVERIFIED`；
- simple 模式首页 HTML：`UNVERIFIED`。

## 7. 诚实边界

本环只汇总真实执行结果；`verified` 指 review/qa 有测试或容器/浏览器证据，不等于生产级质量。发布 tag 为本地 tag，未推送远端。
