# 干净拷贝运行记录（G2 替代形态）

> PRD 允许「生成证据包」**或**「用一次校验替代」（G2）。本文件记录后者：从干净目录运行本项目的真实验证。
> **状态：build 环进行中；用 `node scripts/verify.mjs` 的结果为准（见 [`test-count.txt`](test-count.txt)）。**

## 步骤

```powershell
git clone <本目录> fruitlab-clean
cd fruitlab-clean
node cli.mjs db init
node cli.mjs db seed
node scripts/verify.mjs
```

## 校验内容

| 项 | 方式 |
|---|---|
| 测试 | `node --test`（计数见 `evidence/test-count.txt`） |
| 链接与白名单 | `scripts/check-links.mjs` |
| 编号一致 | `scripts/check-numbering.mjs` |
| 义务追溯 | `scripts/check-traceability.mjs` |
| 证据哈希 | `scripts/verify-evidence.mjs` |
| 14 张图片与授权 | `evidence/assets-manifest.json` + `docs/assets-credits.md` |

## 记录

| 日期 | 执行者 | 结果 | 备注 |
|---|---|---|---|
| 2026-10-18 | build 环（本机） | 见 `scripts/verify.mjs` 输出 | 尚未做独立干净目录 clone 的二次运行，标 `UNVERIFIED` |
