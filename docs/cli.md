# CLI 使用说明（R2）

> 契约真源：`SPEC.md` §5.5 / §15；退出码与错误码见 `docs/error-catalog.md`。
> 全局选项：`--db <path>`（或环境变量 `FRUITLAB_DB`，默认 `data/fruitlab.db`）、`--json`。

## 快速开始

```bash
node cli.mjs dev
```

`dev` = 建库（如缺）+ 种子（如空）+ 启动服务，默认 `http://127.0.0.1:4174`。按 `Ctrl+C` 停止。

## 命令

| 命令 | 说明 |
|---|---|
| `db init` | 建库与迁移（幂等） |
| `db seed` | 写入 14 商品与 3 个演示账号（幂等） |
| `db reset --yes` | 删除并重建数据库；执行前自动备份到 `data/backups/` |
| `db check` | `integrity_check` / `foreign_key_check` / `user_version` / 行数 |
| `user list` | 列出用户 |
| `user add --username <u> --password-stdin [--role user\|admin]` | 新建用户（口令从管道读，避免进 shell history） |
| `product list [--all]` | 列出商品；`--all` 含下架 |
| `product set-price --id <id> --unit-price-cents <n>` | 改价格（整数分） |
| `product set-stock --id <id> --stock <n>` | 改库存 |
| `product unlist --id <id>` | 下架 |
| `product relist --id <id>` | 上架 |
| `orders list [--user <username>]` | 列出订单（默认全部） |
| `orders show <orderNumber>` | 查看单张订单 |

## 退出码

| 码 | 含义 |
|---:|---|
| 0 | 成功 |
| 1 | 业务失败（如 `order-not-found`、`confirmation-required`） |
| 2 | 用法/参数错误 |
| 3 | 暂时性失败（如 `db-locked`） |
| 4 | 内部错误 |

## `--json`

成功：`{"ok":true,"data":...}`；失败：`{"ok":false,"code":"...","message":"..."}`；诊断信息走 stderr。

## 示例

```bash
node cli.mjs db init
node cli.mjs db seed
node cli.mjs --json product list
node cli.mjs product set-stock --id fuji-apple --stock 0
echo "password123" | node cli.mjs user add --username staff --password-stdin
node cli.mjs --json db check
```

## 注意

- `db reset` 会删除当前数据库（先自动备份）；无 `--yes` 时拒绝执行；
- CLI 与 HTTP 共用 `server/*` 业务模块，不提供第二套逻辑；
- CLI 不打印口令或哈希。
