# 义务台账（OB-*）

> 来源：`DECISIONS.md` 的 Accepted Obligations（autoplan 四阶段接受项）。
> 判定词汇：`closed` / `downgraded`（附理由）/ `not-covered`（附理由）。build 环填「实现状态」，最终判定在 ship/retro 汇总。

| 编号 | 义务 | 完成判据 | build 实现状态 | 最终判定 |
|---|---|---|---|---|
| OB-CEO-01 | 工时重估 15–25 agent 工时；按 M1–M5 里程碑交付，每步可独立验收 | SPEC §10 修订记录 + BUILD.md 里程碑表 | implemented（待 review/qa 复核） | closed（build/review/qa 证据） |
| OB-CEO-02 | 新增 AC-41 端到端用户旅程、AC-42 五分钟 demo 脚本 | SPEC 增补 + qa 实机记录 | implemented（待 review/qa 复核） | closed（build/review/qa 证据） |
| OB-CEO-03 | R1 行为对照表（保留/变更/移除）；AC-31 拆分交互与权限 | `docs/contracts.md` 行为表 + AC-31 修订 | implemented（待 review/qa 复核） | closed（build/review/qa 证据） |
| OB-CEO-04 | Admin 信息架构（订单/商品两面板、含下架商品、空/错/加载态） | §5.6 修订 + qa 截图 | implemented（待 review/qa 复核） | closed（build/review/qa 证据） |
| OB-CEO-05 | 图片 fallback：Openverse → Wikimedia → 停止上报；禁止 AI 图 | `docs/assets-credits.md` + 风险条目 | implemented（待 review/qa 复核） | closed（build/review/qa 证据） |
| OB-CEO-06 | `scripts/verify.mjs` 串联测试与全部机械检查，单一入口 | 脚本运行输出 PASS/FAIL | implemented（待 review/qa 复核） | closed（build/review/qa 证据） |
| OB-CEO-07 | `node:sqlite` spike（建库/WAL/busy_timeout/回滚/并发/输出污染）先行 | `evidence/spike-sqlite.md` | implemented（待 review/qa 复核） | closed（build/review/qa 证据） |
| OB-CEO-08 | 并发不超卖测试：两个并发 POST 只一单成功、库存为 0 | `tests/api.test.mjs` 用例 | implemented（待 review/qa 复核） | closed（build/review/qa 证据） |
| OB-CEO-09 | 登出删除服务端会话行；旧 Cookie 再访问 `/api/auth/me` 返回 401 | `tests/auth.test.mjs` | implemented（待 review/qa 复核） | closed（build/review/qa 证据） |
| OB-CEO-10 | username 3–32 `[A-Za-z0-9_-]`、password 8–128，稳定错误码 | `docs/contracts.md` + 测试 | implemented（待 review/qa 复核） | closed（build/review/qa 证据） |
| OB-CEO-11 | 结算前重校验 UX：价格变更/已下架/库存不足三种提示 | §5.6 + fake DOM/qa | implemented（待 review/qa 复核） | closed（build/review/qa 证据） |
| OB-CEO-12 | 视觉证据可复现：`evidence/visual/<viewport>-<page>.png` + commit + 时间 + 复核人 | 证据文件 | implemented（待 review/qa 复核） | closed（build/review/qa 证据） |
| OB-CEO-13 | `db reset --yes` + 自动备份 + 服务持锁检测 + 无库指引 | `tests/cli.test.mjs` + 输出 | implemented（待 review/qa 复核） | closed（build/review/qa 证据） |
| OB-CEO-14 | 无障碍：skip link、键盘全流程、焦点环、错误汇总 | qa 手工记录 + 检查表 | implemented（待 review/qa 复核） | closed（build/review/qa 证据） |
| OB-DES-01 | 设计词元落 CSS 变量 + `docs/design-tokens.md`，脚本断言 token 存在 | 脚本 + 文件 | implemented（待 review/qa 复核） | closed（build/review/qa 证据） |
| OB-DES-02 | 商品卡六态：正常/加载/空/错误/售罄/下架 | fake DOM + 截图 | implemented（待 review/qa 复核） | closed（build/review/qa 证据） |
| OB-DES-03 | 登录/注册/管理面板的提交中、失败、已登录状态 | fake DOM + 截图 | implemented（待 review/qa 复核） | closed（build/review/qa 证据） |
| OB-DES-04 | <720px 紧凑购物袋条 + 导航横向滚动 | 390 截图 | implemented（待 review/qa 复核） | closed（build/review/qa 证据） |
| OB-DES-05 | 对比度 ≥ 4.5:1、焦点可见、键盘可达 | 手工检查表 | implemented（待 review/qa 复核） | closed（build/review/qa 证据） |
| OB-DES-06 | 文案语气：无感叹号、无促销语；错误文案按错误码 | 文案清单 + 静态扫描 | implemented（待 review/qa 复核） | closed（build/review/qa 证据） |
| OB-DES-07 | 14 张图 alt 由种子数据生成且非空 | `scripts/check-links.mjs` 或专用断言 | implemented（待 review/qa 复核） | closed（build/review/qa 证据） |
| OB-DES-08 | CC BY 署名在页脚可见并链接台账 | 页面 + 台账 | implemented（待 review/qa 复核） | closed（build/review/qa 证据） |
| OB-DX-01 | `node cli.mjs dev` 一键启动 + `GET /api/health` + README 60 秒 AC | 命令 + 测试 | implemented（待 review/qa 复核） | closed（build/review/qa 证据） |
| OB-DX-02 | CLI 命令树冻结（list/unlist/relist 拆分）；help 与文档命令集合一致 | `tests/cli.test.mjs` | implemented（待 review/qa 复核） | closed（build/review/qa 证据） |
| OB-DX-03 | 全局 `--json`：`{ok:true,data}` / `{ok:false,code,...}`；非交互 | CLI 测试 | implemented（待 review/qa 复核） | closed（build/review/qa 证据） |
| OB-DX-04 | 退出码 0/1/2/3/4 + stdout 数据 / stderr 诊断 | CLI 测试 | implemented（待 review/qa 复核） | closed（build/review/qa 证据） |
| OB-DX-05 | `--password-stdin`；`--password` 仅演示并告警 | CLI 测试 + docs | implemented（待 review/qa 复核） | closed（build/review/qa 证据） |
| OB-DX-06 | CLI 补 `orders show`、`db check`（integrity/foreign_key/user_version） | CLI 测试 | implemented（待 review/qa 复核） | closed（build/review/qa 证据） |
| OB-DX-07 | `clientOrderId` 幂等：`(user_id, client_order_id)` 唯一；重复返回原订单 | 并发测试 | implemented（待 review/qa 复核） | closed（build/review/qa 证据） |
| OB-DX-09 | 启动结构化摘要；全响应 `X-Request-Id`；`--log` 访问日志 | 测试/输出 | implemented（待 review/qa 复核） | closed（build/review/qa 证据） |
| OB-DX-10 | DB/HTTP/CLI 三层命名映射表；CLI flag 对齐 API | `docs/contracts.md` | implemented（待 review/qa 复核） | closed（build/review/qa 证据） |
| OB-DX-11 | 错误目录唯一真源；API `{ok:false}`、静态层 `problem+json`；测试断言集合一致 | `tests/contracts.test.mjs` | implemented（待 review/qa 复核） | closed（build/review/qa 证据） |
| OB-DX-12 | `tests/helpers/{db,auth,server}.mjs` 夹具 | 文件 + 测试通过 | implemented（待 review/qa 复核） | closed（build/review/qa 证据） |
| OB-DX-13 | Windows 细节：`--no-warnings=ExperimentalWarning`、先 close 再删、`pathToFileURL` | README + 测试 | implemented（待 review/qa 复核） | closed（build/review/qa 证据） |
| OB-ENG-01 | 单写者队列 + `busy_timeout` 250–500ms + 异步退避；文档化单进程假设 | 设计文档 + 持锁测试 | implemented（待 review/qa 复核） | closed（build/review/qa 证据） |
| OB-ENG-02 | `GET /api/admin/products`（含下架） | API + 测试 | implemented（待 review/qa 复核） | closed（build/review/qa 证据） |
| OB-ENG-03 | 校验契约：maxItems 10、重复 productId 合并、Content-Type 415、边界 | `docs/contracts.md` + 测试 | implemented（待 review/qa 复核） | closed（build/review/qa 证据） |
| OB-ENG-04 | Host ∈ {127.0.0.1:4174, localhost:4174}；Origin 精确匹配；Sec-Fetch-Site ∈ {same-origin, none}；缺失矩阵 | 测试 | implemented（待 review/qa 复核） | closed（build/review/qa 证据） |
| OB-ENG-06 | CSP 以 HTTP 头为唯一来源（meta 仅兼容） | 测试 | implemented（待 review/qa 复核） | closed（build/review/qa 证据） |
| OB-ENG-07 | scrypt 参数说明与升级路径 | README | implemented（待 review/qa 复核） | closed（build/review/qa 证据） |
| OB-ENG-08 | 列表默认上限 100 | 测试 | implemented（待 review/qa 复核） | closed（build/review/qa 证据） |
| OB-ENG-09 | 购物车仅内存、刷新清空，与 R1 一致 | README + 测试 | implemented（待 review/qa 复核） | closed（build/review/qa 证据） |