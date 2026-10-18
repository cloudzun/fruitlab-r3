# 证据 · retro 环（R2 第 7/7 环）

> 基于真实 Git 历史与真实测试输出；命令与原始结果如下。

## 1. 数据窗口

| 项 | 值 |
|---|---|
| 范围 | `r1-baseline..HEAD`（R1 冻结基线 → R2 发布） |
| 首个提交 | `5432b35` 2026-10-18 08:26:38 +0800（spec） |
| 末个提交 | `c844789` 2026-10-18 09:27:21 +0800（merge release） |
| 提交数 | 8 |

## 2. 真实命令与结果

```text
$ git log --format="%h|%s" r1-baseline..HEAD
8 条（docs 3 / build 1 / review 1 / qa 1 / release 1 / merge 1）

$ git diff --numstat r1-baseline..HEAD
insertions=10396 deletions=5412 files=92

$ git log --name-only --format="" r1-baseline..HEAD | group
4 evidence/manifest.json
4 evidence/index.md
3 DECISIONS.md
3 evidence/test-count.txt
3 docs/decision-log.md
2 index.html / scripts/fetch-product-images.mjs / evidence/manual-checks/browser.md
2 SPEC.md / server/auth.mjs / server/orders.mjs / server/router.mjs

$ 行数（当前）
source=3701 test=2475 docs=3205
test_ratio = 2475 / 3701 = 0.669

$ node --test
96 项，96 通过，0 失败（见 evidence/test-count.txt）

$ node scripts/verify.mjs
PASS 5/5
```

## 3. 指标汇总

| 指标 | 值 |
|---|---|
| Test Ratio（测试行/来源行） | 0.669（门槛 ≥0.20） |
| 测试数 | 96（R1 62，+34） |
| 义务关闭 | 42 / 42 |
| G1–G7 | 7 / 7 关闭 |
| QA 健康分 | 94（无 Critical/High） |
| 覆盖率审计 | 27 路径：19★★★ / 7★★ / 1★ / 0 未覆盖 |
| 技术债 | 5 项 TODOS + 5 项 Known Issues |

## 4. 返工与降级（真实记录）

- 商品图片重抓 9 次（樱花/鸡尾酒/月亮/菠萝表皮/酒吧场景/水果摊/市场挂果等错误内容）；5 张最终改用 Wikimedia Commons。
- 图片授权扩展为 CC0 / CC BY / CC BY-SA / Public Domain（对 SPEC §5.8 的降级）。
- 2 处 fake DOM 测试简化（重渲染后再派发事件不可靠）。
- 12 张图片短边低于 800px（已逐张记录）。

## 5. `/learn` 记录

- 官方 `gstack-learn` 不可用；经验手动落库到 [`docs/learnings.md`](../docs/learnings.md)（8 条，真实踩坑）。
- 不编造 “Prior learning applied” 触发记录。

## 6. 诚实边界

- 挂钟约 61 分钟为 agent 执行时间，不等于人力工期。
- Test Ratio 是行数比；覆盖率审计是「路径 × 测试质量」人工映射，不是行覆盖率。
- 无远端：`requires-remote`；无红先失败回归证明。
- 人工无障碍、对比度仪器、真实学员教学价值：`UNVERIFIED`。
