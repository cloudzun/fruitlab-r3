# 证据 · build 环（R2 第 3/7 环）

> **状态：完成**（M1–M5 全部完成；视觉人工验收交 qa 环）。
> 规则：真实命令与原始输出；未完成写「未完成」；不伪造测试结果。

## 1. 环境

| 项 | 值 |
|---|---|
| 日期 | 2026-10-18 |
| 运行时 | Node.js `v22.20.0` |
| 数据库 | SQLite 单文件 `data/fruitlab.db`（`node:sqlite`，实测无需标志位） |
| 端口 | 默认 `127.0.0.1:4174` |
| 输入 | `SPEC.md` v1.1（SHA-256 `BE00459D…`）、`DECISIONS.md` 42 条义务 |

## 2. 里程碑

| 里程碑 | 内容 | 状态 | 证据 |
|---|---|---|---|
| M1 | DB/迁移/种子/会话/口令 | 完成 | `tests/db.test.mjs`、`tests/auth.test.mjs` |
| M2 | 订单事务/幂等/API/CLI | 完成 | `tests/api.test.mjs`、`tests/cli.test.mjs` |
| M3 | 前端接入 | 完成 | `assets/api-client.mjs`、`assets/app.mjs`、`tests/app.test.mjs` |
| M4 | 管理端两面板 | 完成 | `assets/app.mjs`（管理面板） |
| M5 | 视觉/图片/治理/文档 | 完成（视觉人工验收待 qa） | `assets/images/products/`、`docs/`、`scripts/` |

## 3. 真实执行记录

| 命令 | 结果 |
|---|---|
| `node --test` | **96 项：96 通过 / 0 失败**（权威计数见 `evidence/test-count.txt`） |
| `node scripts/record-test-count.mjs` | `tests=96 pass=96 fail=0` |
| `node scripts/verify.mjs` | **PASS 5/5**（测试 / 链接 / 编号 / 追溯 / 证据清单） |
| `node cli.mjs dev` + HTTP 冒烟 | health 200；products 14；login 200；order 201（`FL-20261018-090613-74DY`，合计 3497 分）；mine 1；index 200 |

HTTP 冒烟原始输出（Node fetch）：

```text
health 200 2.0.0.0 true
products 200 14
login 200 userA fruitlab_session=9fcdcc...
order 201 FL-20261018-090613-74DY 3497 2
mine 200 1
index 200 11046
```

## 4. 商品照片（14/14，真实来源）

- 全部经 `scripts/fetch-product-images.mjs` 从 Openverse（CC0 / CC BY）真实下载，JPEG magic 校验、≤300 KiB、SHA-256 入 `evidence/assets-manifest.json`，授权台账 `docs/assets-credits.md`。
- **重抓记录（内容缺陷修复）**：
  - `cherry`：首图为「Cherry blossoms（樱花）」→ 重抓为真实甜樱桃（Flickr 178541872）。
  - `golden-pineapple`：首图为「菠萝表皮特写」→ 重抓为白底整果（Flickr 51942745849，CC BY，dejankrsmanovic）。
  - `fuji-apple`、`banana`：首图分别为「听诊器+果盘」「果园整串香蕉」→ 已重抓为可用商品图。
- **尺寸降级（如实记录）**：12 张短边低于 SPEC §5.8 建议的 800px（最低 `mango` 500×405），已在 `docs/assets-credits.md` 的「尺寸说明」逐张列出，**不写成达标**。

## 5. 偏离与说明

1. **R1 旧测试移除**：`tests/order-store.test.mjs`（测已退役的 localStorage 实现）与 `tests/server.test.mjs`（测 R1 服务器形状）已删除，由 `tests/db|api|cli.test.mjs` 替代；记录在此，不静默。
2. **`tests/domain.test.mjs` 夹具变更**：原导入 `assets/catalog.mjs`（已退役），改为导入 `server/db.mjs` 的 `PRODUCT_SEED`；断言从 10 种改为 14 种。`assets/domain.mjs` 本身未改。
3. **两处 fake DOM 测试简化**：数量变更与查单测试原依赖「重渲染后再派发事件」，假 DOM 无法可靠模拟（一次 163 秒内存异常）；已拆成单次提交的等价断言。真实浏览器行为交 qa 环，**未在此声称通过**。
4. **取图流程**：外部子任务约 15 分钟无产出，主 Agent 用 `scripts/fetch-product-images.mjs` 完成下载；后续按子任务反馈重抓了 4 张内容不合格的图。
5. **官方 gstack 运行件不可用**：按技能文档手动执行。

## 6. 诚实边界

- 前端行为只在最小 fake DOM 中验证；真实浏览器（焦点、布局、对比度）未测，`evidence/manual-checks/browser.md` 全部 `UNVERIFIED`。
- 图片尺寸降级已记录；不声称 14 张全部达到 §5.8 建议值。
- 会话过期/CSRF/限流/订单取消未实现（PRD 边界或 TODOS），不声称具备。
- `node:sqlite` 为实验特性；同步 API 阻塞事件循环，本版接受该限制。
