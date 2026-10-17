# FruitLab 八环可追溯演示包：可运行商城与证据入口

Repo: `r1-fruitlab`  
Ring: 2 (`/spec`)  
Date: 2026-10-17  
Status: APPROVED, 已获用户批准  
Source design: `docs/designs/fruitlab-traceable-demo.md`

修订记录：2026-10-17，D4 将 Node.js 最低版本要求由 18+ 修订为 22+。原因是本项目基线为 Node.js 22，`serve.mjs` 有意拒绝更低版本，且现有实现与测试按该基线验证；本次修订用于消除规格与实现的版本漂移。

## Context

本项目是 Hackathon / 教学演示交付物，不是生产商城。交付目标同时包含两件事：

1. 学员能在一个干净目录中启动并完成“浏览 -> 下单 -> 查单”闭环。
2. 仓库保留可核对的流程证据，并且不把未执行、未阻断或未验证的事项写成成功结论。

当前设计已经批准，但仓库中还没有商城实现、静态服务器、测试或证据索引。Ring 2 需要把运行行为、数据格式、异常处理、测试边界和证据要求冻结成可执行规格，使后续 autoplan 与 build 不再自行决定范围。

## Current State

验证日期：2026-10-17。验证提交：`a5c0702`。

- 当前仓库只有 `CLAUDE.md`、`OFFICE_HOURS.md`、设计文档和 pre-spec 学员记录。
- 没有 `index.html`、业务脚本、`serve.mjs`、测试目录或证据索引。
- 设计在 `docs/designs/fruitlab-traceable-demo.md:90` 固定了运行时范围，在 `:121` 固定了唯一启动方式，在 `:224` 定义了成功标准。
- `evidence/learner-checks/pre-spec.md:7` 已据实记录 `UNVERIFIED: no pre-spec learner observed`。P5 仍为 `UNVERIFIED`。
- 仓库没有配置远端，`gh issue` 去重检查无法执行。这不是“0 个重复项”的结论。

## Decision Resolution

| 决策 | 已选方案 |
| --- | --- |
| D1 测试层次 | A. Node 内置 `node:test` 加人工 Chromium 检查清单 |
| D2 购物车状态 | A. 购物车仅保存在当前页面内存中 |
| D3 损坏数据策略 | A. 非破坏性读取，保留原始存储 |

实现不得更换这三个决定。若实现中发现无法满足，必须停止并回到规格评审，不能自行改用浏览器自动化依赖、持久化购物车或自动清理损坏数据。

## Proposed Change

交付一个无构建步骤、无第三方运行时依赖的静态单页商城，并加入共享领域模块、浏览器 UI、静态服务器、Node 测试、README 和初始证据索引。

核心实现约束：

- 商品固定为 10 种水果，商品数据由本地 ES module 提供。
- 购物车只存在于页面内存，刷新后允许清空。
- 订单以 NDJSON 形式保存在 `localStorage` 键 `fruitlab.orders.v1` 中，一行一条订单记录。
- 读取订单只解析和过滤，绝不改写或删除已有字节。
- 新订单只能追加。追加前不重新序列化旧记录，追加后读回确认。
- 页面不请求远端资源，断网时仍可浏览、操作购物车和完成本地已加载页面的流程。

采用 NDJSON 是为了满足 D3：每一行可以独立校验，新订单可以直接追加，已有损坏行和原始顺序不会被自动改写。该格式是本规格固定的实现细节，实施者不需要再设计存储格式。

## Implementation Details

### File Layout

| File | Responsibility |
| --- | --- |
| `index.html` | 单页结构、商品区、购物车、成功收据、查单区 |
| `assets/styles.css` | 响应式布局、状态样式、焦点样式、无外部资源的视觉样式 |
| `assets/catalog.mjs` | 固定 10 种水果的快照数据 |
| `assets/domain.mjs` | 数量、金额、订单号、校验和 NDJSON 解析等纯函数 |
| `assets/order-store.mjs` | 基于可注入 `storage` 的订单读取和追加 |
| `assets/app.mjs` | DOM 事件、内存购物车、结账和查单流程 |
| `tests/domain.test.mjs` | 纯领域函数测试 |
| `tests/order-store.test.mjs` | 存储适配器测试，使用内存 fake，不依赖浏览器 |
| `serve.mjs` | Node 22+ 内置模块静态服务器 |
| `README.md` | 固定启动步骤、验收脚本、存储重置方法和证据入口 |
| `evidence/index.md` | 八环证据索引，只记录实际产物和实际状态 |
| `evidence/manual-checks/browser.md` | 实施后人工 Chromium 检查记录 |

不新增 `package.json`、npm 依赖、Playwright、测试框架、服务端 API、数据库或构建产物目录。

### Fixed Catalog

`assets/catalog.mjs` 必须导出冻结的 `FRUITS` 数组，内容如下：

| ID | 名称 | 单位 | 单价分 | 描述 |
| --- | --- | --- | ---: | --- |
| `fuji-apple` | 红富士苹果 | 500g | 1299 | 脆甜多汁，果香清亮 |
| `banana` | 海南香蕉 | 1kg | 899 | 软糯香甜，适合早餐 |
| `navel-orange` | 赣南脐橙 | 1kg | 1599 | 酸甜平衡，汁水充足 |
| `shine-muscat` | 阳光玫瑰葡萄 | 500g | 2999 | 果粒紧实，玫瑰香气 |
| `golden-pineapple` | 海南金钻凤梨 | 1个 | 1999 | 香气浓郁，少纤维 |
| `durian` | 泰国金枕榴莲 | 1kg | 4999 | 绵密香甜，气味鲜明 |
| `hami-melon` | 新疆哈密瓜 | 1个 | 2599 | 清甜脆爽，瓜香饱满 |
| `peach` | 山东水蜜桃 | 500g | 1899 | 果肉柔软，甜度高 |
| `blueberry` | 智利蓝莓 | 125g | 2199 | 颗粒饱满，微酸回甜 |
| `red-dragon-fruit` | 云南红心火龙果 | 1个 | 1399 | 果肉细嫩，色泽鲜明 |

每个对象必须包含 `id`、`name`、`unit`、`unitPriceCents`、`description`。ID 必须唯一，`unitPriceCents` 必须为正安全整数。

### Domain Contract

`assets/domain.mjs` 至少导出以下函数。函数不得访问 DOM、`window` 或 `localStorage`。

| Function | Required behavior |
| --- | --- |
| `parseQuantity(raw, previousQuantity)` | 返回 `{ quantity, error }`。去除首尾空格后，只接受十进制整数；空值、负数、小数、非数字和 0 返回上一有效数量与 `数量必须是 1-99 的整数`；大于 99 返回 99 和同一错误。 |
| `lineTotalCents(unitPriceCents, quantity)` | 返回整数分。输入非法时抛出 `TypeError`，不能静默产生 `NaN`。 |
| `subtotalCents(items)` | 返回所有 `unitPriceCents * quantity` 的整数和。 |
| `formatCny(cents)` | 返回固定两位小数的 `¥` 金额，不加千位分隔符。`1299` 输出 `¥12.99`，`3117` 输出 `¥31.17`。 |
| `normalizeOrderNumber(input)` | 去除首尾空格并转为大写；不改变其他字符。 |
| `isOrderNumberFormat(value)` | 只接受 `/^FL-\d{8}-\d{6}-[A-Z0-9]{4}$/`。 |
| `createOrderNumber(now, randomSuffix)` | 使用浏览器本地日期时间生成 `FL-YYYYMMDD-HHMMSS-XXXX`；`randomSuffix` 必须规范化为 4 位大写字母数字。 |
| `generateUniqueOrderNumber({ now, suffixFactory, isTaken })` | 最多尝试 10 个候选；全部碰撞时返回 `null`，调用方不得写入订单。 |
| `validateOrder(value)` | 返回 `{ valid, errors }`，按下方订单结构逐字段校验。 |
| `parseOrdersRaw(raw)` | 逐行解析 NDJSON，返回 `{ orders, invalidCount, duplicateNumbers }`。空行忽略，格式错误或字段不合法的行计入 `invalidCount`。 |
| `serializeOrder(order)` | 返回不含换行符的单行 JSON 字符串。 |

`parseOrdersRaw` 遇到同一规范化订单号出现多次时，把所有重复订单号放入 `duplicateNumbers`。重复订单仍可保留在原始存储中，但查询该订单号时必须报数据异常，不得返回其中任意一条。

### Order Snapshot

每条订单记录固定为：

```json
{
  "orderNumber": "FL-20261017-131500-A7K2",
  "createdAt": "2026-10-17T05:15:00.000Z",
  "currency": "CNY",
  "subtotalCents": 3117,
  "items": [
    {
      "fruitId": "fuji-apple",
      "name": "红富士苹果",
      "unit": "500g",
      "unitPriceCents": 1299,
      "quantity": 2,
      "lineTotalCents": 2598
    }
  ]
}
```

校验规则：

- `orderNumber` 符合固定格式。
- `createdAt` 是可由 `Date.parse` 解析的规范 ISO 时间字符串。
- `currency` 必须为 `CNY`。
- `items` 至少一行；`fruitId` 在一张订单内唯一。
- 每行数量为 `1-99` 的整数，单价和行小计为正安全整数。
- 每行 `lineTotalCents === unitPriceCents * quantity`。
- `subtotalCents` 等于全部行小计之和。
- 商品名称与单位保存为结账时快照，后续商品目录变化不能改变旧订单。

### In-Memory Cart

`assets/app.mjs` 使用一个 `Map<fruitId, quantity>` 保存购物车，不写入任何存储。

- 首次点击“加入购物车”创建数量 1 的行；再次点击同一商品加 1，最高 99。
- 购物车每行显示商品名称、单价、数量输入、加号、减号和“移除”。
- 数量输入在 `change`、失焦和 Enter 时提交。非法输入恢复上一有效值并显示 `数量必须是 1-99 的整数`。大于 99 时值改为 99，同时显示该错误。
- 加号最高到 99；减号最低到 1；清除商品只能使用“移除”。
- 移除最后一行后显示 `购物车为空`，结账按钮为 `disabled`。
- 刷新页面后购物车为空。刷新不得被宣传为保留购物车。

### Amounts

所有金额以整数分计算和存储。

- 行小计：`unitPriceCents * quantity`。
- 订单小计：所有行小计之和。
- 页面统一调用 `formatCny`，始终显示两位小数。
- 不使用 `parseFloat` 后累加金额，不把格式化后的字符串重新转成数值参与计算。
- 例：`¥12.99 x 2 + ¥5.99 x 1` 必须显示订单小计 `¥31.97`。

### Checkout

结账必须按以下顺序执行：

1. 购物车为空时直接返回，不生成订单号，不读取或写入存储。
2. 从当前购物车生成不可变商品快照。
3. 调用 `readOrders(localStorage)` 获取最新有效订单号，并检查存储是否可访问。
4. 使用 `generateUniqueOrderNumber` 生成最多 10 次候选。候选必须不与当前有效订单号重复。
5. 调用 `appendOrder(localStorage, order)`。该函数会再次检查新订单号是否与最新有效订单重复。
6. `appendOrder` 成功时，读回值必须与本次追加后的完整字符串完全相同，并确认新订单作为有效记录恰好出现一次。
7. 只有第 6 步成功后，才清空内存购物车、隐藏旧错误并显示成功收据。
8. 任一步失败时保留购物车，不显示成功收据，不清空数量，不写入错误的成功状态。

错误文案：

| Condition | UI text |
| --- | --- |
| 空购物车 | `购物车为空` |
| 10 次订单号仍碰撞 | `订单号生成失败，请重试` |
| `localStorage` 不可用、写入抛错或读回失败 | `订单未保存，请重试` |
| 损坏行 | `本地订单数据有损坏，已跳过 N 条` |
| 同一订单号重复 | `本地订单数据存在重复订单号` |

成功收据必须显示订单号、创建时间、每个商品行、每行小计、订单小计，并提供可选择的订单号文本和“复制订单号”按钮。复制失败不得影响订单成功状态，订单号仍必须可手工选中。

“查询此订单”按钮把当前订单号填入查单输入框并立即执行查询。

### Order Storage

存储键固定为 `fruitlab.orders.v1`。值是一段 NDJSON 文本，一行一条订单记录，每行由 `JSON.stringify(order)` 产生。文件末尾的建议形式是换行，但读取不能依赖末尾换行。

读取流程：

1. `storage.getItem(KEY)`。
2. `null` 视为空存储。
3. 按换行切分，忽略空行。
4. 每行独立 `JSON.parse` 和 `validateOrder`。
5. 无法解析或字段不兼容的行被跳过，并计入损坏数量。
6. 有效订单按订单号检查重复。
7. 读取过程不得调用 `setItem`、`removeItem` 或 `clear`。

追加流程：

1. 再次读取原始字符串。
2. 如果新订单号与任何有效旧订单号重复，返回 `duplicate-order-number`，存储保持不变。
3. 生成单行 JSON。
4. 若旧字符串非空且不以 `\n` 结尾，插入一个分隔换行，然后追加新行和一个结尾换行。
5. 若旧字符串为空，只写入新行和一个结尾换行。
6. 旧字符串的每个字符必须保留为新字符串的前缀，不得重新序列化、排序、去除损坏行或改写旧订单。
7. `setItem` 后读回原始字符串，必须严格等于预期追加结果。
8. 再次解析读回值，确认新订单有效且订单号在该次解析结果中只出现一次。
9. 任一步失败都返回失败结果，不自动修复或删除任何数据。

`storage.getItem`、`storage.setItem` 或访问 `localStorage` 抛错时，页面仍须允许浏览、加购、修改数量和移除商品。查单显示 `本地订单存储不可用`，结账显示 `订单未保存，请重试`。

### Lookup

查单每次执行都重新读取当前存储，不长期缓存订单列表。

- 输入先执行 `normalizeOrderNumber`。
- 空输入显示 `请输入订单号`。
- 存储不可用显示 `本地订单存储不可用`。
- 输入命中 `duplicateNumbers` 时显示 `本地订单数据存在重复订单号`，不显示任何一条候选。
- 没有命中显示 `未找到该订单`。
- 命中唯一有效订单时显示订单号、创建时间、商品行、行小计和订单小计。
- 损坏行警告与查询结果分开显示，查询其他有效订单不能被损坏行阻断。

### User Interface

`index.html` 至少包含以下可定位区域：

- 顶部说明区，明确“本地演示、无账号、无服务端”。
- `#catalog` 商品网格。
- `#cart` 购物车区。
- `#checkout-message` 结账状态区，使用 `role="status"` 或 `role="alert"`。
- `#order-success` 成功收据区，默认隐藏。
- `#lookup` 查单区。

视觉与可用性要求：

- 无外部字体、图片、CDN 或网络请求。使用 CSS 渐变、色块和简单几何装饰建立水果摊氛围。
- 主要色为暖米色、番茄红和叶绿色，不使用默认紫色主题。
- 桌面双栏显示商品和购物车；宽度小于 720px 时改为单栏。
- 360px 宽度下不得出现横向滚动。
- 所有输入都有可见标签或 `aria-label`。
- 所有按钮可用键盘操作，焦点样式可见。
- 动态错误和成功消息进入可读的 live region。
- 页面不因 JavaScript 异常显示虚假的订单成功状态。

### Static Server

`node serve.mjs` 必须：

- 只使用 Node.js 22+ 内置模块。
- 监听 `127.0.0.1:4173`。
- 根路径返回 `index.html`。
- 支持 `GET` 和 `HEAD`；其他方法返回 405。
- 为 `.html`、`.css`、`.mjs`、`.js`、`.json`、`.md` 提供正确 MIME 类型。
- 拒绝目录穿越，未知路径返回 404。
- 不提供目录列表，不代理或请求外网。
- 响应包含 `Cache-Control: no-store`，避免演示时读取旧脚本。
- 端口被占用时以非零状态退出并打印明确错误。

唯一支持的启动命令是：

```bash
node serve.mjs
```

访问地址固定为 `http://127.0.0.1:4173`。`file://` 不属于验收路径。

### README

`README.md` 必须包含：

1. Node.js 22+ 和现代 Chromium 的前置条件。
2. 启动命令、地址和停止方式。
3. 完整的“浏览 -> 下单 -> 查单”验收步骤。
4. `localStorage.removeItem("fruitlab.orders.v1")` 的重置方法。
5. 全新浏览器 profile 的说明。
6. `node --test` 命令。
7. `evidence/index.md` 的位置和阅读顺序。
8. 门禁表述规则：没有真实记录时不得声称门禁曾拦下问题。

### Evidence Index

`evidence/index.md` 必须使用以下字段：

| Ring | Artifact | Produced by | Gate result | Evidence | Note |
| --- | --- | --- | --- | --- | --- |

`Gate result` 只能是 `PASS`、`BLOCKED`、`NOT_RUN` 或 `NOT_APPLICABLE`。尚未执行的环必须写 `NOT_RUN`。Artifact 路径必须实际存在；不存在的环节在 Artifact 中写 `none`，不能让读者点击不存在的文件。

实施阶段只记录实施时真实已知的状态，不能预先把 autoplan、review、qa、ship 或 retro 写成 `PASS`。没有真实阻断时，最终才允许创建 `evidence/gate-events/no-blocking-event.md`，本规格不授权在 build 阶段补造该文件。

### Manual Browser Checklist

`evidence/manual-checks/browser.md` 必须记录日期、操作系统、Node 版本、Chromium 版本、profile 重置方式和每条检查的实际结果。至少覆盖：

| ID | Check |
| --- | --- |
| M1 | 全新 profile 中运行 `node serve.mjs`，固定地址可加载。 |
| M2 | 1440px 与 360px 宽度下 10 种水果均可见，360px 无横向滚动。 |
| M3 | 10 种水果都可加入购物车。 |
| M4 | 数量接受 1、99；0、负数、小数、非数字、空值恢复上一有效值；100 变为 99。 |
| M5 | 多商品、多数量的行小计和订单小计与手算一致。 |
| M6 | 移除最后一行后显示“购物车为空”，结账按钮禁用。 |
| M7 | 成功结账显示规范订单号、时间、商品快照和总额，购物车清空。 |
| M8 | 刷新后可用订单号查回订单。 |
| M9 | 查单忽略首尾空格和字母大小写。 |
| M10 | 空输入和未知订单号显示规定文案。 |
| M11 | 注入一行非法 NDJSON 后，页面显示损坏数量，其他有效订单仍可查，原始非法行仍存在。 |
| M12 | 复制一行有效订单制造重复订单号，查询该号显示重复异常，不返回任意一条。 |
| M13 | 临时让 `Storage.prototype.setItem` 抛出配额错误后结账，页面不显示成功，购物车保留。 |
| M14 | DevTools 设为 Offline 后继续当前页面的加购、下单和查单，无外部请求依赖。 |
| M15 | 完整流程中控制台无未处理异常。 |
| M16 | 用全新 profile 或删除 `fruitlab.orders.v1` 后重复核心闭环。 |

M13 的临时注入方式：

```js
const original = Storage.prototype.setItem;
Storage.prototype.setItem = function () {
  throw new DOMException("Quota exceeded", "QuotaExceededError");
};
```

恢复：

```js
Storage.prototype.setItem = original;
```

检查失败必须原样记录，不能删除失败样本。

## Acceptance Criteria

1. 在仓库根目录执行 `node serve.mjs` 后，`http://127.0.0.1:4173` 可加载商城首页，且不安装任何 npm 包。
2. 页面固定显示 10 种水果，ID 唯一，名称、单位、描述和整数分单价与固定目录一致。
3. 运行 `node --test` 时全部测试通过，且不启动浏览器、不访问外网。
4. 购物车状态只存在于页面内存；刷新页面后购物车为空，但已保存订单仍可查询。
5. 数量输入对 1 和 99 成功，对 0、负数、小数、非数字、空值和大于 99 的值按规定恢复或钳制，并显示 `数量必须是 1-99 的整数`。
6. 加号、减号和移除行为符合 1-99 边界，移除是清空商品行的唯一方式。
7. 空购物车显示 `购物车为空`，结账按钮禁用，点击不会生成订单。
8. 行小计和订单小计全部由整数分计算，页面固定显示两位小数；`¥12.99 x 2 + ¥5.99 x 1` 得到 `¥31.97`。
9. 订单号匹配 `FL-YYYYMMDD-HHMMSS-XXXX`，`XXXX` 为 4 位大写字母数字。
10. 订单号生成最多尝试 10 次；全部碰撞时显示 `订单号生成失败，请重试`，购物车保留。
11. 结账只有在追加、严格读回验证和订单唯一性复核全部成功后，才清空购物车并显示成功收据。
12. `localStorage` 不可用、`setItem` 抛错或读回不一致时，显示 `订单未保存，请重试`，不显示成功收据，购物车不变。
13. 成功收据包含订单号、创建时间、商品快照、每行小计和订单小计，并提供可复制或手工选择的订单号。
14. 刷新后可按订单号查回已保存订单；查单忽略首尾空格和字母大小写。
15. 空输入显示 `请输入订单号`，未知订单显示 `未找到该订单`。
16. 非法 NDJSON 行被跳过并计入损坏数量，显示 `本地订单数据有损坏，已跳过 N 条`，有效订单仍可查询。
17. 同一订单号出现多次时，查询该号显示 `本地订单数据存在重复订单号`，不返回任意一条。
18. 读取订单不写入存储；追加订单后，旧原始字符串的全部字节仍是新字符串的前缀。
19. 存储失败不影响商品浏览、加入购物车、数量修改和移除。
20. `README.md` 只提供 `node serve.mjs` 启动路径，并包含全新 profile 或删除 `fruitlab.orders.v1` 的验收前置条件。
21. `evidence/index.md` 的每个状态都可从实际产物或实际命令结果复核，未运行环节写 `NOT_RUN`。
22. `evidence/manual-checks/browser.md` 记录全部 M1-M16 的实际结果，失败项不得删除或改写为通过。
23. 页面在 360px 与桌面宽度下可用，键盘可操作，控制台无未处理异常。
24. 核心闭环不依赖数据库、登录、管理员后台、服务端 API、第三方资源或线上部署。

## Testing Plan

| ID | Layer | Covers | Test card |
| --- | --- | --- | --- |
| T1 | Unit | 10 个商品、唯一 ID、整数分价格 | `protects=catalog contract; fails_when=ID duplicates or price is not a positive integer; no_claim=does not prove cards render correctly` |
| T2 | Unit | `parseQuantity` 合法值与全部非法边界 | `protects=1-99 quantity contract; fails_when=0, decimal, text, empty or >99 is accepted without the required result; no_claim=does not prove DOM change events are wired` |
| T3 | Unit | 行小计、订单小计、金额格式化 | `protects=integer-cent totals; fails_when=float accumulation or wrong two-decimal output appears; no_claim=does not prove browser layout displays the value` |
| T4 | Unit | 订单号格式、本地时间、碰撞重试、10 次耗尽 | `protects=readable unique order numbers; fails_when=invalid suffix, more than 10 tries, or collision is accepted; no_claim=does not prove crypto entropy in the browser` |
| T5 | Unit | `validateOrder` 必填字段和一致性校验 | `protects=stored order integrity; fails_when=bad totals, invalid date, bad currency or illegal quantity passes; no_claim=does not prove the UI only creates valid orders` |
| T6 | Unit | NDJSON 逐行解析、损坏计数和重复订单号 | `protects=non-destructive read semantics; fails_when=one bad line discards valid lines or duplicate lookup is undetected; no_claim=does not prove browser localStorage behaves like the fake` |
| T7 | Unit | 查单规范化 | `protects=trim and case-insensitive lookup; fails_when=equivalent order numbers do not normalize equally; no_claim=does not prove the form calls normalization` |
| T8 | Integration | 空存储追加、旧原始前缀保留、读回验证 | `protects=append-only persistence; fails_when=old bytes are rewritten or readback mismatch is reported as success; no_claim=does not prove real quota or security errors` |
| T9 | Integration | 重复订单号、`getItem` 抛错、`setItem` 抛错、读回不一致 | `protects=checkout failure safety; fails_when=storage failure yields success or cart clearing; no_claim=does not prove visual state without manual checks` |
| T10 | Manual E2E | M1-M16 浏览器闭环与异常检查 | `protects=real Chromium behavior; fails_when=any recorded check fails or is omitted; no_claim=does not prove learner comprehension or P5` |

最低要求：`node --test` 覆盖 T1-T9，并有至少 20 个独立断言场景；人工记录覆盖 T10。没有自动化 DOM 测试，这是 D1 已接受的覆盖缺口。

## Rules for the Implementing Agent

1. 实现代码、测试、README 和证据记录必须在同一变更中落地，不得留下未执行的成功声明。
2. 不得安装 npm 包、下载浏览器、添加 CDN、请求外网或引入构建步骤。
3. 不得修改 D1-D3；发现问题时报告并停止，不自行换方案。
4. 不得在读取订单时自动修复、去重、重排或删除损坏行。
5. 不得把测试中的 fake storage 行为当成真实浏览器已验证。
6. 人工检查失败必须原样记录；没有执行的项目写 `NOT_RUN`，不能写 `PASS`。
7. 不得声称出现过门禁阻断，除非存在当时发生的原始记录。
8. 不得声称 P5 已验证。没有独立的 `post-build.md` 观察时，教学价值保持 `UNVERIFIED`。
9. 最终报告必须列出实际运行的命令、退出状态和失败项，不得省略 stderr。
10. 修改任何测试阈值、断言或证据状态时，必须单独说明原因。

## Rollback Plan

本变更不对应已有生产系统。回滚方式是还原本次提交或删除新增的静态商城、测试和文档文件。

订单数据位于用户浏览器的 `fruitlab.orders.v1` 中，实现不得自动迁移或清理。用户需要检查或删除该键时，应由本人通过 DevTools 明确操作。回滚代码不会触碰该键。

## Effort Estimate

| Component | Estimate |
| --- | ---: |
| 静态页面和视觉效果 | 2.5h |
| 商品、领域逻辑和订单存储 | 2h |
| 测试 | 2h |
| 静态服务器 | 0.5h |
| README、证据索引和人工检查记录 | 1.5h |
| 总计 | 8.5h |

## Files Reference

| File | Change |
| --- | --- |
| `index.html` | 新增单页商城结构 |
| `assets/styles.css` | 新增响应式视觉样式 |
| `assets/catalog.mjs` | 新增固定 10 种水果数据 |
| `assets/domain.mjs` | 新增数量、金额、订单号、校验和 NDJSON 纯函数 |
| `assets/order-store.mjs` | 新增非破坏性读取和只追加存储适配器 |
| `assets/app.mjs` | 新增内存购物车、结账和查单交互 |
| `tests/domain.test.mjs` | 新增领域测试 |
| `tests/order-store.test.mjs` | 新增存储 fake 测试 |
| `serve.mjs` | 新增固定回环地址静态服务器 |
| `README.md` | 新增启动、验收、重置和证据说明 |
| `evidence/index.md` | 新增八环证据索引 |
| `evidence/manual-checks/browser.md` | 人工 Chromium 检查后写入实际结果 |
| `SPEC.md` | Ring 2 最终规格 |

## Out of Scope

- 数据库、服务端订单存储、后端 API。
- 登录、用户身份、权限、管理员后台。
- 支付、库存、履约、退款、税费、运费和折扣。
- 线上部署、CI/CD、域名和 HTTPS。
- 购物车刷新恢复或任何购物车持久化。
- 订单删除、修改、自动修复、自动去重或迁移 UI。
- 第三方依赖、CDN、远程字体、远程图片、分析脚本。
- Playwright、Puppeteer 或其他自动浏览器测试。
- PWA、Service Worker、离线缓存清单。
- 多标签页实时同步或冲突合并。
- 自动证据链校验器、可视化回放面板。
- 伪造门禁事件、伪造学员反馈或把未执行检查写成通过。

## Related

- `OFFICE_HOURS.md`: 第 1 环批准记录。
- `docs/designs/fruitlab-traceable-demo.md`: 已批准设计。
- `evidence/learner-checks/pre-spec.md`: pre-spec `UNVERIFIED` 记录。
- P5 教学价值验证仍依赖未来独立的 `evidence/learner-checks/post-build.md`。
