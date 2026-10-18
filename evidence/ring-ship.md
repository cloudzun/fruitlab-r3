# 证据 · ship 环（R2 第 6/7 环）

> 发布工程师流程：覆盖率审计、文档同步、版本与 CHANGELOG、发布分支门禁、远端可用性核查。
> **不伪造推送/PR/部署**；无远端就写 `requires-remote`。

## 1. 环境与分支

| 项 | 值 |
|---|---|
| 日期 | 2026-10-18 |
| 起始分支 | `main` @ `2eb7f27`（qa 环提交） |
| 发布分支 | `release/r2-fruitlab-ring6`（**不直接在 main 发版**） |
| 版本 | `VERSION` = `2.0.0.0` |
| 远端 | `git remote -v` 为空 → **`requires-remote`** |

## 2. 覆盖率审计

- 产出：[`docs/coverage-audit.md`](../docs/coverage-audit.md)
- 结果：**27 条变更/新增路径；★★★ 19、★★ 7、★ 1、未覆盖 0**；核心链路（db/auth/orders/router）全部 ★★★。
- 已知缺口：`serve.mjs parseCliArgs/main` 无直接单测（★），如实列出。

## 3. 文档同步

| 文档 | 动作 |
|---|---|
| `README.md` | R2 运行说明（4174、`node cli.mjs dev`、演示口令、breaking、安全边界、图片授权） |
| `SPEC.md` | v1.1（并入 autoplan 修订，§15 优先） |
| `DECISIONS.md` | 四阶段评审、42 条义务、终门 `APPROVED`、U1=A/U2=A |
| `CHANGELOG.md` | 新增 `[2.0.0.0]` 段（Added/Changed/Removed/Fixed/Known Issues） |
| `VERSION` | `1.0.0.0` → `2.0.0.0` |
| `docs/*` | API、契约、错误目录、设计词元、分支矩阵、义务台账、CLI、决策流水、覆盖率审计 |
| `evidence/*` | 逐环证据、测试计数、证据哈希清单、截图、图片授权清单 |

## 4. 发布前验证（真实输出）

```text
node --test                 # 96 项，96 通过，0 失败
node scripts/verify.mjs     # PASS 5/5（测试/链接/编号/追溯/证据清单）
```

（测试计数唯一权威：`evidence/test-count.txt`。）

## 5. 发布分支门禁

- 技能要求：**不得从基线 `main` 直接发版**。本轮从 `main` 创建 `release/r2-fruitlab-ring6`，在发布分支上提交版本与 CHANGELOG。
- 发布提交完成后合并回 `main`（`--no-ff`），使 main 包含发布产物；分支保留，可回退。
- `r1-fruitlab` 目录**未被触碰**（`git -C r1 status` 干净）。

## 6. 不可用项（requires-remote）

| 项 | 状态 | 原因 |
|---|---|---|
| 推送分支 | `requires-remote` | `git remote -v` 为空 |
| 创建 PR | `requires-remote` | 无远端/无托管平台 |
| 远端部署 / 金丝雀 / 性能基线 | `requires-remote` | 无部署目标 |
| 回归证明（红先失败） | `not-run` | 无独立基线环境；本地测试为绿，不声称做过 red-first |

## 7. 诚实边界

- 本环只做「本地发布准备与门禁」，**没有**对外发布、没有远程制品。
- 覆盖率是「路径 × 测试质量」的人工映射，不是代码行覆盖率。
- QA 的 Medium（390px 导航可发现性）与图片授权/尺寸降级仍在 `CHANGELOG.md` 的 Known Issues 中，不隐藏。
