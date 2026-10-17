# FruitLab

FruitLab 是一个本地教学演示：固定 10 种水果，浏览器内存购物车，订单保存在当前浏览器的 `localStorage`，没有账号、数据库、服务端订单 API、第三方依赖或构建步骤。

## 前置条件

- Node.js 22+。本次实际测试版本记录在 [`evidence/clean-run.md`](evidence/clean-run.md)。
- 现代 Chromium。使用全新 profile，或按下方步骤清空本站订单数据。
- 不需要运行 `npm install`，仓库中也没有 `package.json`。

## 启动与停止

在仓库根目录执行：

```powershell
node serve.mjs
```

访问固定地址：

```text
http://127.0.0.1:4173
```

停止服务器：在启动它的终端按 `Ctrl+C`。

服务器只监听回环地址 `127.0.0.1`。`file://` 不是受支持或受测的启动方式。诊断 CLI 时可运行 `node serve.mjs --help`。

## 浏览 -> 下单 -> 查单

1. 打开 `http://127.0.0.1:4173`，确认页面显示 10 种水果。
2. 将“红富士苹果”加入购物车两次，将“海南香蕉”加入一次。
3. 确认苹果行显示 `¥12.99 × 2 = ¥25.98`，香蕉行显示 `¥8.99 × 1 = ¥8.99`，购物车合计为 `¥34.97`。
4. 点击“去结账”。成功收据应显示订单号、本地时间、规范 UTC 时间、商品快照、行小计和 `¥34.97` 合计。
5. 复制或手工选中订单号，刷新页面。
6. 在“查订单”输入订单号。首尾空格与字母大小写会被忽略，查询应找回同一张收据。

购物车只在当前页面内存中保留，刷新后清空；已成功保存的订单仍可查询。

## 重置订单数据

重置必须在受支持页面 `http://127.0.0.1:4173` 的 DevTools Console 中执行，因为 `localStorage` 按 origin 隔离。

先导出原始值并保存到你信任的位置：

```js
const rawOrders = localStorage.getItem("fruitlab.orders.v1");
console.log(rawOrders);
```

确认已经备份后再执行：

```js
localStorage.removeItem("fruitlab.orders.v1");
```

此操作不可撤销。应用不会自动修复、去重、重排或删除损坏的订单字节。也可以改用全新的 Chromium profile 获得空白站点存储。

## 测试

```powershell
node --test
```

测试只使用 Node.js 内置 `node:test`、内存 fake storage 和 `127.0.0.1` 回环 HTTP 请求；不启动浏览器，不访问外网，不安装依赖。

## 一个决策到证据的例子

**D3 损坏数据策略**

- 已选：非破坏性读取，保留原始存储。
- 未选：读取时自动修复、去重或删除损坏行。
- 依据：[`SPEC.md`](SPEC.md) 的 `Decision Resolution` 与 `Order Storage`。
- 实现后果：`readOrders` 只解析和报告；`appendOrder` 把旧字符串整体作为新值前缀，不重写旧字节。
- 验证：[`tests/order-store.test.mjs`](tests/order-store.test.mjs) 覆盖“旧原始前缀保留”和“读取不写入”；最终命令结果记录在 [`BUILD-LOG.md`](BUILD-LOG.md)。

## 错误与恢复

稳定错误码、用户文案、重试策略、副作用与恢复路径见 [`docs/error-catalog.md`](docs/error-catalog.md)。

## 证据阅读顺序

从 [`evidence/index.md`](evidence/index.md) 开始，按八环顺序阅读：

1. `OFFICE_HOURS.md`
2. `SPEC.md`
3. `DECISIONS.md`
4. build 产物：本 README、代码、测试、`BUILD-LOG.md`
5. 当前尚未执行的 review、qa、ship、retro 行会明确标为 `NOT_RUN`

[`evidence/clean-run.md`](evidence/clean-run.md) 记录干净目录复制文件集、per-file SHA-256、全新 profile/reset、就绪检查、停止方式、`node --test` 与服务器启动/停止状态、stderr 和本地链接检查。

人工 Chromium 记录位于 [`evidence/manual-checks/browser.md`](evidence/manual-checks/browser.md)。

## 证据表述规则

本演示包在 build 阶段没有预造门禁事件，也不声称曾经发生门禁拦截。没有真实记录时，统一表述为：

> 本演示包未发生门禁阻断；它展示的是流程与检查记录，不证明门禁曾拦下问题。

P5 教学价值仍为 `UNVERIFIED`。没有独立的 `evidence/learner-checks/post-build.md` 观察，不得宣称教学价值已经验证。
