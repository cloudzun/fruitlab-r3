# 证据索引（R3）

> 本目录只放可核对的东西：真实命令、原始输出、哈希、截图、容器日志。**没有发生的门禁不写成发生过。**
> 唯一测试计数：`evidence/test-count.txt`（脚本生成；含 git tree hash）。

## 1. 逐环

| 环 | 证据 |
|---|---|
| spec（1/7） | `ring-spec.md`、`spec-forensics.md`、`spec-quality-gate.md`、`codex/spec-review-codex.md`、`codex/spec-review-round2-codex.md`、`codex/spec-review-disposition.md` |
| autoplan（2/7） | `ring-autoplan.md`、`autoplan-voices/r3-ceo.md`、`r3-des.md`、`r3-dx.md`、`r3-eng.md` |
| build（3/7） | `ring-build.md`、`container/`、`baseline-tests.txt` |
| review（4/7） | `ring-review.md`、`codex/review-codex.md`、`cso-r3/` |
| qa（5/7） | `ring-qa.md`、`visual/r3-*.jpg`、`visual/r3-cart-390.png`、`container/` |
| ship（6/7） | `ring-ship.md`、`test-count.txt`、`manifest.json`、`coverage-audit.md` |
| retro（7/7） | `ring-retro.md` |

## 2. 关键证据

| 内容 | 文件 |
|---|---|
| 测试计数（137 项，真实 PG） | `test-count.txt` |
| 证据哈希清单 | `manifest.json`（`node scripts/verify-evidence.mjs`） |
| 三容器健康/非 root | `container/`（health、after-restart-order、backup-restore.log、simple-mode.log） |
| 备份/恢复 | `container/backup-restore.log`、`container/after-restore-order.json` |
| 浏览器（1440/834/390/收据） | `visual/r3-home-1440.jpg`、`r3-home-834.jpg`、`r3-home-390.jpg`、`r3-cart-390.png`、`r3-receipt-1440.jpg` |
| codex 同族复核（spec/review） | `codex/spec-review-codex.md`、`codex/review-codex.md` |
| 官方 cso | `cso-r3/report.md`、`report.json`、`submission.json`、`start.json`、`inspect.json` |

## 3. 诚实边界

- 跨模型复核 `unavailable`；cso `partial`；人工无障碍项 `UNVERIFIED`。
- `evidence/*.log` 为原始过程日志（未删改），可能包含中间推理/工具输出；报告以结论文件为准。
- 大文件（日志/截图）已入 `manifest.json` 哈希清单；不存在的证据不列。
