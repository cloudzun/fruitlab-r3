# 备份与恢复（R3）

> 两条真实路径，**不互相冒充**：
> 1. `pg_dump` / `pg_restore`（容器内，生产标准路径，A14 证据）；
> 2. CLI SQL 逻辑导出（JSON Lines，跨平台可跑，`db reset` 的保险）。

## 1. pg_dump / pg_restore（容器）

```bash
# 备份（建议先停写）
wsl -e docker compose -f /mnt/d/vibecoding/easyvibe/r3-fruitlab/docker-compose.yml stop api
wsl -e bash scripts/backup.sh
# 产物：backups/<timestamp>.dump
```

`scripts/backup.sh` 从 `.env` 读取 `POSTGRES_USER/POSTGRES_DB`，执行：

```bash
docker compose exec -T db pg_dump -U "$POSTGRES_USER" -d "$POSTGRES_DB" -Fc
```

恢复：

```bash
wsl -e bash scripts/restore.sh backups/<timestamp>.dump
```

`scripts/restore.sh` 的顺序（必须遵守）：

1. `docker compose stop api`（停写）；
2. 断开残留连接；
3. `pg_restore --clean --if-exists --single-transaction --exit-on-error`；
4. 校验 `schema_migrations`、种子计数（14 商品 / 用户）；
5. `docker compose start api`。

失败时保留数据库在可诊断状态，不自动删除备份。

## 2. CLI JSON Lines（跨平台）

```powershell
node cli.mjs db backup --out backups
node cli.mjs db restore --in backups/<file>.jsonl --yes
node cli.mjs db reset --yes --out backups   # 先备份，失败即中止
```

- 格式：首行 `meta`（版本/`schemaVersion`/时间），后续每表一行 `{type:"table",name,rows}`；
- `db restore` 在**单事务**内 drop → migrate → 逐表恢复 → 校验；失败整体回滚；
- `db reset` 必须先成功导出备份，再事务重建；备份失败直接退出 1，原库不变。

## 3. 验收（A14）

- 备份文件真实存在、非空、可解析；
- 恢复后商品/账号/订单/库存与备份一致；
- `db reset` 的失败路径经测试验证（备份目录不可写 → 退出 1 → 数据保留）。
