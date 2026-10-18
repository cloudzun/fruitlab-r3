# CLI 契约（R3）

> 用法：`node cli.mjs [--url <DATABASE_URL>] [--json] <command> ...`
> 退出码：0 成功 / 1 业务失败 / 2 用法错误 / 3 暂时性失败 / 4 内部错误。
> `--json` 输出 `{ok:true,data}` / `{ok:false,code,message}`；stdout 数据、stderr 诊断。

## 1. 命令矩阵

| 命令 | 必需 | 说明 | 退出码 |
|---|---|---|---|
| `dev [--port <n>]` | `DATABASE_URL` | 迁移 + 按需 seed + 启动（含静态） | 0/1/3 |
| `db migrate` | `DATABASE_URL` | 幂等迁移（advisory lock + checksum） | 0/3/4 |
| `db seed` | `DATABASE_URL` + 模式口令 | classroom=14+3；production=14+admin | 0/1/3 |
| `db check` | `DATABASE_URL` | 连接/版本/约束/计数/checksum | 0/1 |
| `db backup [--out <dir>]` | `DATABASE_URL` | JSON Lines 逻辑导出（默认 `backups/`） | 0/1 |
| `db restore --in <file> --yes` | `DATABASE_URL` + 文件 | 单事务恢复（先停写） | 0/1/3 |
| `db reset --yes [--out <dir>]` | `DATABASE_URL` | 先备份→事务重建→校验 | 0/1/4 |
| `user list` | `DATABASE_URL` | 用户名 + 角色 | 0 |
| `user add --username <u> --password-stdin [--role user\|admin]` | stdin | 口令走 stdin，不进进程列表 | 0/1/2 |
| `product list [--all]` | `DATABASE_URL` | `--all` 含下架 | 0 |
| `product set-price --id <id> --unit-price-cents <n>` | | 0–9,999,999 整数 | 0/1 |
| `product set-stock --id <id> --stock <n>` | | 0–99,999 整数 | 0/1 |
| `product unlist\|relist --id <id>` | | 上下架 | 0/1 |
| `orders list [--user <username>]` | | 全部/按用户 | 0/1 |
| `orders show <orderNumber>` | | 订单详情 | 0/1 |
| `--help` / `--version` | | 不连接数据库 | 0 |

## 2. 环境变量

| 变量 | 说明 |
|---|---|
| `DATABASE_URL` | 必需（或 `--url`） |
| `APP_ENV` | `development`（classroom，默认）/ `production` |
| `DEMO_PASSWORD` | classroom 演示口令 |
| `ADMIN_PASSWORD` | production 必填（≥12、非默认） |
| `COOKIE_SECURE` | production 必须 1 |
| `--url` | 覆盖 `DATABASE_URL` |

## 3. 示例

```powershell
$env:DATABASE_URL = "postgres://postgres:postgres@127.0.0.1:55432/fruitlab"
node cli.mjs db migrate
node cli.mjs db seed
node cli.mjs db check --json
node cli.mjs user add --username ops --password-stdin --role admin
node cli.mjs db backup --out backups
node cli.mjs db reset --yes --out backups
```

## 4. 不做

- 不打印口令、哈希、完整 DSN；
- `--db` 已移除，出现即用法错误（提示改用 `--url`）；
- `db reset`/`db restore` 必须 `--yes`；备份失败即中止，不"假成功"。
