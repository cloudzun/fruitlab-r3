# 证据索引（R2）

> 本目录只放可核对的东西：真实命令、原始输出、哈希、截图。**没有发生的门禁不写成发生过。**
> 本文件由 `scripts/check-links.mjs` 校验链接；证据文件哈希见 [`manifest.json`](manifest.json)。

## 逐环证据

| 环节 | 文件 | 说明 |
|---|---|---|
| spec | [`ring-spec.md`](ring-spec.md) | 基线取证、门禁结果、环境踩坑 |
| autoplan | [`ring-autoplan.md`](ring-autoplan.md) | 四阶段评审、原始输出、偏差与残余风险 |
| autoplan 原始声音 | [`autoplan-voices/`](autoplan-voices/) | CEO / Design / DX / Eng 的原始输出 |
| build | [`ring-build.md`](ring-build.md) | 里程碑、测试、集成、未完成项 |
| review | [`ring-review.md`](ring-review.md) | 结构排雷、安全审计、6 项自动修复 |
| review 补测 | [`ring-review-codex.md`](ring-review-codex.md) | codex 第二智能体复核（同族） |
| cso 补测 | [`ring-review-cso.md`](ring-review-cso.md) | WSL 重建 launcher、官方 run、4 findings |
| qa | [`ring-qa.md`](ring-qa.md) | 真实 Chromium 五断点、健康分 94、截图 |
| ship | [`ring-ship.md`](ring-ship.md) | 覆盖率审计、文档同步、版本 2.0.0.0、`requires-remote` |
| retro | [`ring-retro.md`](ring-retro.md) | Git 量化复盘、返工记录、学到的 |

## 资产与计数

| 文件 | 说明 |
|---|---|
| [`test-count.txt`](test-count.txt) | **测试计数唯一权威来源**（脚本生成） |
| [`assets-manifest.json`](assets-manifest.json) | 14 张商品照片的 SHA-256、作者、授权、来源 |
| [`manifest.json`](manifest.json) | 本目录逐文件 SHA-256（`scripts/verify-evidence.mjs` 生成/校验） |
| [`clean-run.md`](clean-run.md) | 干净拷贝运行与哈希校验记录 |
| [`manual-checks/browser.md`](manual-checks/browser.md) | 人工浏览器检查清单（未做即 `UNVERIFIED`） |
| [`demo-script.md`](demo-script.md) | 五分钟课堂演示脚本（AC-42） |
| [`g7-release-merge.txt`](g7-release-merge.txt) | R1 发布分支合并证据（G7） |
| [`learner-checks/pre-spec.md`](learner-checks/pre-spec.md) | R1 遗留：无真实学员观察 `UNVERIFIED` |
| [`spec-quality-gate.md`](spec-quality-gate.md) | R1 遗留：跨模型门禁 `unavailable` 原始记录 |

## 使用

```powershell
node scripts/verify-evidence.mjs        # 校验清单与磁盘一致
node scripts/verify.mjs                 # 全量机械校验
```
