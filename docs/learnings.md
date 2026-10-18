# 经验库（R2 `/learn` 替代记录）

> 官方 `gstack-learn` 运行件在本宿主不可用，本文件是**手动落库**的等价记录。
> 只收「能省 5 分钟以上」的工程经验；一次性的偶发错误不在此列。

| # | 类型 | 经验 | 证据/来源 |
|---:|---|---|---|
| L1 | 外部资产 | 图库搜索的标题匹配 ≠ 内容正确：Openverse 会把「Cherry blossoms」「Moon or Navel Orange」「Blueberry pie」当结果。必须**标题排除词 + 人工看图 + 失败重抓**；精选取图改用 Wikimedia Commons 分类/文件页（含准确授权元数据）。 | build/qa 环：9 次重抓；`scripts/fetch-product-images.mjs` 的 REJECT 表 |
| L2 | 测试策略 | fake DOM 不能可靠模拟「重渲染后再派发事件」；这类测试会挂死或假绿。交互状态用 fake DOM，**视觉/焦点/布局用真实 Chromium**，否则证据不可信。 | build 环 163 秒内存异常；qa 环真实浏览器 |
| L3 | 工具不可用 | 官方技能运行件缺失时，**如实写 `unavailable`** 并手动执行同等流程；把偏差写进证据，比换模型/换工具冒充更可信。 | autoplan/review 环证据 |
| L4 | Windows/编码 | PowerShell 双引号字符串中的反引号是转义符，会把 Markdown 的 `` ` `` 吃掉（`node`→`ode`）；长中文文本一律写文件或用 Node 脚本，不用 shell 拼接。 | BUILD-LOG 生成时踩到并修复 |
| L5 | 证据链 | 证据目录的重建顺序固定：`node --test` → `record-test-count` → `verify-evidence --write` → `verify`；顺序错会因哈希/旧计数必红。 | review/qa/ship 环多次重跑 |
| L6 | 文件策略 | `write` 覆盖已存在文件前必须先用 `read` 读过；批量生成文档用 `edit`/脚本更稳。 | spec 环首次覆盖 SPEC.md 被拒 |
| L7 | 范围/排期 | 真实照片、授权台账、视觉词元、证据哈希这类「非功能但必做」的工件约占 build 的 1/3 时间；排期必须显式给，否则会挤压实现与测试。 | R2 build M5 与 qa 返工 |
| L8 | 安全 | 本地演示也要过一遍「信息泄露」清单：健康检查返回绝对路径、错误日志含 SQL、Cookie 解析抛 500，都是真实抓到并修掉的。 | review 环 6 项 AUTO-FIXED |

## 复用方式

- 新项目开工前扫一遍 L1/L2/L7；
- 每轮结束把新经验追加到此表（不覆盖旧条目）；
- 与 `docs/decision-log.md` 的区别：决策记「选了什么」，经验记「下次怎么更快/更稳」。
