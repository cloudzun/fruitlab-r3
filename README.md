# FruitLab · 教学演示应用（R2 工作区）

> 本目录是 **R2（升级后）** 的工作区。**R1（升级前）** 在 `D:\vibecoding\easyvibe\r1-fruitlab`，**已冻结，不得改动**。
> **下一步**：R2 从 **spec** 环节开始，输入是 [`PRD-R2.md`](PRD-R2.md)。**不要**重跑 office-hours。

---

## 1. 这是什么

一个卖水果的电商演示应用，用途是作为课程 **GStack 八环工作流**的教学演示载体。

它分两轮迭代，两轮都是"真实执行、留下证据"的：

| 轮次 | 定位 | 状态 | 目录 |
|---|---|---|---|
| **R1** | **升级前**的展品 | **已完成** | `D:\vibecoding\easyvibe\r1-fruitlab`（冻结） |
| **R2** | **升级后**的成果 | **待开发** | 本目录 |

**为什么要两个目录**：课堂上需要**同时**展示升级前后并排对比。切分支时同一目录只有一个版本在场，做不到并排，所以用两个独立目录。

---

## 2. R1 是什么样（升级前）

一句话：**固定 10 种水果，浏览器内存购物车，订单存在当前浏览器的 `localStorage`，没有账号、数据库、服务端订单 API、第三方依赖或构建步骤。**

| 项 | 值 |
|---|---|
| 版本 | `1.0.0.0` |
| 提交 | 15 个，`main` 分支 |
| 测试 | 62 项（61 通过、1 平台跳过、0 失败） |
| 依赖 | 零第三方依赖，无 `package.json` |
| 服务端 | `serve.mjs` 仅做静态托管，只接受 GET / HEAD |
| 监听 | `127.0.0.1:4173` |

R1 的八环产物（`OFFICE_HOURS.md`、`SPEC.md`、`DECISIONS.md`、`BUILD.md`、`review.md`、`qa-report.md`、`CHANGELOG.md`、`retro.md`）在本目录中，**是本目录的起点状态**。

---

## 3. R2 要做什么（升级后）

| 方向 | 内容 |
|---|---|
| 持久化 | 服务端数据库，商品与订单落库 |
| 用户与身份 | 注册登录、预置 `userA` / `userB` / `admin`、口令哈希、**服务端会话 + Cookie** |
| 权限 | 用户只能查自己的订单，管理员可查全部 |
| 管理员 | 改库存、改价格、上架下架 |
| 命令行 | 运维与管理员命令行能力 |
| 商品 | 从 10 种**扩展到 14 种** |
| 视觉 | **废弃 R1 的手写果摊招牌方向**，改为真实商品照片 + 专业电商版式 |
| 流程机制 | 新增**义务追溯**，修补 R1 暴露的追溯链断裂 |

**完整需求见 [`PRD-R2.md`](PRD-R2.md)。**

---

## 4. R1 留下的已知缺口（R2 必须收敛）

| # | 缺口 |
|---|---|
| G1 | 4 个失效链接：`/BUILD-LOG.md`、`/evidence/clean-run.md`、`/evidence/index.md`、`/evidence/manual-checks/browser.md` |
| G2 | 证据包从未生成（逐文件哈希、拷贝清单） |
| G3 | 契约冻结不完整（导出签名、精确失败形状、分支矩阵） |
| G4 | `aria-invalid` 只加在数量输入框，同类输入未覆盖 |
| G5 | 规格引用了不存在的检查项编号（M18/M19，规格只到 M16） |
| G6 | 测试计数三处不一致（`BUILD.md` 56、review/qa 60、实测 62） |
| G7 | R1 发布分支未合并回 `main`（已完成） |

**根因**：R1 的追溯链只对规格、不对义务，导致"文档类义务无落点即掉队"。该缺口被 build、review、qa 各自发现一次，**三环均未修复**。

---

## 5. 如何继续开发（给下一个会话）

| 步骤 | 做什么 |
|---|---|
| 1 | 读 [`PRD-R2.md`](PRD-R2.md)，它替代 office-hours |
| 2 | 从 **spec** 环节开始，产出 R2 的 `SPEC.md` |
| 3 | 依次走 autoplan → build → review → qa → ship → retro（共 7 环） |
| 4 | 每环边界停下汇报产出，得到明确许可才流转 |

**硬约束**：

- **`r1-fruitlab` 目录一行都不得改动。** 它是课堂展品。
- 两个目录必须**能同时启动并各自访问**，因此 **R2 的监听端口需与 R1 的 `4173` 区分**。
- R2 的产出**不得写回** R1 目录。
- 本目录保留 R1 的完整 Git 历史，因此"改了哪些地方"始终可出 diff。

**诚实工程红线**（R1 全程遵守，R2 必须继续）：

- 一切代码、输出、日志与指标必须来自真实执行，不得伪造。
- 门禁不可用就写"不可用"，**不得换模型充数、不得把"未覆盖"写成"通过"**。
- 没有发现问题就写"未发现"，**不得为凑数编造缺陷**。
- 需要人工受试者的项**如实记 `UNVERIFIED`**，不得编造记录。

---

## 6. R1 的操作说明（R2 开发期间仍然有效）

### 前置条件

- Node.js 22+。实际测试版本记录在 [`qa-report.md`](qa-report.md)。
- 现代 Chromium。使用全新 profile，或按下方步骤清空本站订单数据。
- 不需要 `npm install`，仓库中没有 `package.json`。

### 启动与停止

在仓库根目录执行：

```powershell
node serve.mjs
```

访问 `http://127.0.0.1:4173`。停止：在启动它的终端按 `Ctrl+C`。

服务器只监听回环地址 `127.0.0.1`，`file://` 不是受支持的启动方式。诊断 CLI 可运行 `node serve.mjs --help`。

### 走查：浏览到下单到查单

1. 打开 `http://127.0.0.1:4173`，确认页面显示 10 种水果。
2. 将"红富士苹果"加入购物车两次，将"海南香蕉"加入一次。
3. 确认苹果行显示 `¥12.99 × 2 = ¥25.98`，香蕉行显示 `¥8.99 × 1 = ¥8.99`，合计 `¥34.97`。
4. 点击"去结账"。成功收据应显示订单号、本地时间、规范 UTC 时间、商品快照、行小计与合计。
5. 复制或手工选中订单号，刷新页面。
6. 在"查订单"输入订单号。首尾空格与字母大小写会被忽略，应找回同一张收据。

购物车只在当前页面内存中保留，刷新后清空；已成功保存的订单仍可查询。

### 重置订单数据

重置必须在受支持页面 `http://127.0.0.1:4173` 的 DevTools Console 中执行，因为 `localStorage` 按 origin 隔离。

先导出原始值并保存到可信位置：

```js
const rawOrders = localStorage.getItem("fruitlab.orders.v1");
console.log(rawOrders);
```

确认已备份后再执行：

```js
localStorage.removeItem("fruitlab.orders.v1");
```

此操作不可撤销。应用不会自动修复、去重、重排或删除损坏的订单字节。也可改用全新 Chromium profile 获得空白站点存储。

### 测试

```powershell
node --test
```

测试只使用 Node.js 内置 `node:test`、最小化内存 fake DOM/storage 与 `127.0.0.1` 回环 HTTP 请求；不启动真实浏览器，不访问外网，不安装依赖。

---

## 7. 一个决策到证据的例子（R1 沿用）

**D3 损坏数据策略**

- 已选：非破坏性读取，保留原始存储。
- 未选：读取时自动修复、去重或删除损坏行。
- 依据：[`SPEC.md`](SPEC.md) 的 `Decision Resolution` 与 `Order Storage`。
- 实现后果：`readOrders` 只解析和报告；`appendOrder` 把旧字符串整体作为新值前缀，不重写旧字节。
- 验证：[`tests/order-store.test.mjs`](tests/order-store.test.mjs) 覆盖"旧原始前缀保留"与"读取不写入"。

---

## 8. 错误与证据

- 稳定错误码、用户文案、重试策略、副作用与恢复路径见 [`docs/error-catalog.md`](docs/error-catalog.md)。
- R1 的八环证据按此顺序阅读：[`OFFICE_HOURS.md`](OFFICE_HOURS.md) → [`docs/designs/fruitlab-traceable-demo.md`](docs/designs/fruitlab-traceable-demo.md) → [`SPEC.md`](SPEC.md) → [`DECISIONS.md`](DECISIONS.md) → [`BUILD.md`](BUILD.md) → [`review.md`](review.md) → [`qa-report.md`](qa-report.md) → [`CHANGELOG.md`](CHANGELOG.md) → [`retro.md`](retro.md)。

### R1 的证据表述规则（R2 必须继续遵守）

R1 的 build 阶段**没有预造门禁事件**，也**不声称曾经发生门禁拦截**。没有真实记录时，统一表述为：

> 本演示包未发生门禁阻断；它展示的是流程与检查记录，不证明门禁曾拦下问题。

P5 教学价值仍为 `UNVERIFIED`：未观察到真实学员，记录见 [`evidence/learner-checks/pre-spec.md`](evidence/learner-checks/pre-spec.md)；没有独立的 `post-build.md` 观察，**不得宣称教学价值已经验证**。

---

## 9. 相关文档

| 文档 | 位置 | 用途 |
|---|---|---|
| R2 PRD | 本目录 [`PRD-R2.md`](PRD-R2.md) | R2 的输入，替代 office-hours |
| R1 八环讲解记录 | `reference-app/reports/R1-八环讲解记录.md` | 课堂讲解用 |
| R1 义务覆盖率核查 | `reference-app/reports/R1-义务覆盖率核查.md` | 38 条义务逐条实测 |
| R1 操作经验教训 | `reference-app/reports/R1-操作经验教训.md` | 执行层经验 |
| 项目总交接 | `通用AI_Coding课程与教材/HANDOFF.md` | 整个项目的来龙去脉 |
