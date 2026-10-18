# FruitLab R2 · 教学演示应用（升级后）

> **R1（升级前）** 在 `D:\vibecoding\easyvibe\r1-fruitlab`，**已冻结，不得改动**。
> 本目录是 **R2（升级后）**：服务端数据库、用户与会话、权限、管理员、命令行、14 种商品、Apple 式商品版式。
> 课堂用途：R1/R2 **同时启动并排对比**（R1 默认 `4173`，R2 默认 `4174`）。

## 快速开始（60 秒）

前置：Node.js 22+（本项目在 `v22.20.0` 实测）。

```powershell
node cli.mjs dev
```

`dev` 会自动建库、写入种子（14 商品 + 3 个演示账号）并启动服务。访问 **http://127.0.0.1:4174**。

停止：在启动它的终端按 `Ctrl+C`。

> 数据库文件在 `data/fruitlab.db`（已 gitignore，可随时用 `node cli.mjs db reset --yes` 重建）。
> `data/` 只在首次 `dev` / `db init` 时创建。

## 演示账号（仅演示，非生产）

| 账号 | 口令 | 角色 |
|---|---|---|
| `userA` | `demo1234` | user |
| `userB` | `demo1234` | user |
| `admin` | `demo1234` | admin |

口令以 `scrypt` + 随机盐哈希存储；上面的明文只用于课堂演示。生产环境不应存在此表。

## 能演示什么

1. **浏览到下单**：14 种水果（照片卡）、加入购物袋、结账；库存实时扣减。
2. **身份与权限**：登录后「我的订单」；`userA` 看不到 `userB` 的订单；`admin` 可查全部。
3. **管理员**：改价格、改库存、上架/下架（面板在导航「管理」）。
4. **查订单**：顶层入口，登录后按订单号查自己的订单；失焦重绘不吞点击、焦点落在结果标题。
5. **持久化**：重启服务，订单与库存仍在。
6. **命令行**：`node cli.mjs --help`；`db init/seed/reset/check`、`user`、`product`、`orders`。

## 测试

```powershell
node --test
```

测试只使用 Node 内置 `node:test`、临时 SQLite 库、最小 fake DOM 与 `127.0.0.1` 回环 HTTP；不启动真实浏览器、不访问外网、不安装依赖。
**测试计数的唯一权威来源是 [`evidence/test-count.txt`](evidence/test-count.txt)**（由 `node scripts/record-test-count.mjs` 生成），其它文档不手写计数。

一键验证（测试 + 链接 + 编号 + 追溯 + 证据清单）：

```powershell
node scripts/verify.mjs
```

## 从 R1 升级时变了什么（breaking）

- **订单不再存在浏览器** `localStorage`：改为服务端数据库；**R1 的历史订单不迁移**（R2 从空订单开始）。
- **访客查单移除**：R1 任何人凭订单号可查；R2 需登录且只能查自己的订单（权限模型要求）。
- **商品从 10 种扩到 14 种**；商品数据真源从 `assets/catalog.mjs` 移到数据库。
- **视觉方向**：废弃 R1 的「手写果摊招牌」，改为 Apple 式高冷克制版式 + 本地真实照片。
- 默认端口 `4173` → `4174`（与 R1 并存）。

完整契约对照见 [`docs/contracts.md`](docs/contracts.md)；决策流水见 [`docs/decision-log.md`](docs/decision-log.md)。

## 目录

| 路径 | 说明 |
|---|---|
| `serve.mjs` | HTTP 服务：静态托管 + `/api` 路由（CSP 由 HTTP 头下发） |
| `cli.mjs` | 运维/管理员命令行 |
| `server/` | `db`（SQLite/迁移/事务）、`auth`（scrypt/会话）、`products`、`orders`、`router`、`errors` |
| `assets/` | 前端模块（`app`/`controller`/`api-client`/`domain`/`styles`）与 14 张商品照片 |
| `tests/` | `node:test` 测试与夹具 |
| `scripts/` | 机械校验（链接/编号/追溯/证据清单/测试计数）与取图脚本 |
| `docs/` | API、契约、错误目录、设计词元、分支矩阵、义务台账、图片来源 |
| `evidence/` | 逐环证据、测试计数、证据清单、原始评审输出 |
| `data/` | 运行时数据库（gitignore） |

## 安全边界（如实声明，非生产）

- 只监听回环地址；无 HTTPS，Cookie 无 `Secure`；无会话过期/续期。
- 无 CSRF Token（仅有同源 `Origin`/`Sec-Fetch-Site` 的**部分**校验）；无登录失败限流/锁定。
- 他人订单返回 `403`（按 D-32 的取舍，会泄露订单号存在性）。
- `node:sqlite` 为实验特性，同步 API 会阻塞事件循环；本版接受该限制。
- 详细风险与取舍见 [`DECISIONS.md`](DECISIONS.md) 与 [`docs/decision-log.md`](docs/decision-log.md)。

## 图片与授权

14 张商品照片均为仓库内本地文件，来源与授权逐张记录在 [`docs/assets-credits.md`](docs/assets-credits.md)（含 CC BY 署名）。抓取与校验脚本：[`scripts/fetch-product-images.mjs`](scripts/fetch-product-images.mjs)。

## 证据与复盘

- 证据索引：[`evidence/index.md`](evidence/index.md)
- 本轮规格：[`SPEC.md`](SPEC.md)（v1.1） · 评审与义务：[`DECISIONS.md`](DECISIONS.md)
- R1 八环讲解：[`R1-八环讲解记录.md`](R1-八环讲解记录.md) · R1 义务核查：[`R1-义务覆盖率核查.md`](R1-义务覆盖率核查.md)
- 项目总交接：`通用AI_Coding课程与教材/HANDOFF.md`
