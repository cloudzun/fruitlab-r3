# 5–8 分钟课堂演示脚本（R3 三幕）

> 对应 AC-110。每步给「做什么 / 看到什么 / 讲什么」。三版本并排，升级不覆盖。

## 课前 10 分钟（一次）

```powershell
cd D:\vibecoding\easyvibe
# R1（冻结）
cd r1-fruitlab; node serve.mjs                       # 4173
# R2（冻结；仓库外临时 SQLite 文件，重启不丢）
cd ..\r2-fruitlab; node cli.mjs --db "$env:TEMP\fruitlab-r2-demo.db" dev   # 4174
# R3（容器）
cd ..\r3-fruitlab; wsl -e docker compose -f /mnt/d/vibecoding/easyvibe/r3-fruitlab/docker-compose.yml up -d   # 4175
```

预期：`curl http://127.0.0.1:4175/api/health` 返回 `{"ok":true,"db":"up",...}`；三容器 healthy。

## 第一幕：R1（约 2 分钟）

1. 打开 http://127.0.0.1:4173 → 「果子摊」单页、10 种水果、纯文字卡。
2. 加购 → 结账 → 刷新页面 → 查订单；关掉浏览器再打开同一浏览器，订单还在（`localStorage`）。
3. 讲：**升级前**——前端单机、无服务端、无账号；数据只在浏览器里。

## 第二幕：R2（约 2–3 分钟）

1. 打开 http://127.0.0.1:4174 → Apple 式版式、14 张照片卡。
2. `userA / demo1234` 登录 → 加购 → 下单 → 「我的订单」；用 `userB` 查 `userA` 的订单号 → 403（R2 的已知取舍，D-32）。
3. 停掉 R2 进程再重启 → 订单仍在（`data/fruitlab.db` 或演示用的临时 SQLite 文件）。
4. 讲：**升级后**——服务端 SQLite、账号/会话/权限、管理员、CLI；但仍是一台机器、一个进程、零第三方依赖。

## 第三幕：R3（约 3 分钟）

1. 打开 http://127.0.0.1:4175 → 同样版式；`userA / demo1234` 登录 → 加购 → 下单 → 收据。
2. 看 `curl /api/health`：`db:"up"`、`schemaVersion`、版本；讲 **L2 三层**（Caddy web / Node api / Postgres db）。
3. `wsl -e docker compose ps` → 三容器 healthy；`docker compose exec api id -u` → 1000（非 root）。
4. 重启：`wsl -e docker compose restart api db` → 刷新/重新登录 → 订单仍在（volume）。
5. 备份/恢复（可选 60 秒）：`wsl -e bash scripts/backup.sh` → 删订单 → `wsl -e bash scripts/restore.sh backups/<file>.dump` → 订单回来。
6. 讲：**R3 的新课**——Postgres + 逻辑三层 + 物理三层 + 可部署交付；会话过期/限流/CSRF/时序/404 补漏；11 个 R2 缺陷逐条关闭。
7. 回退演示：`docker compose down` 后 R1/R2 仍可访问；R1/R2 工作树一行未改（`git status` 为空）。

## 失败兜底

| 现象 | 兜底 |
|---|---|
| Docker/WSL 未就绪 | 只演示 R1/R2；R3 用 `node cli.mjs dev` + 本机 Postgres 55432 |
| 4175 被占用 | `PUBLIC_URL`/compose 端口临时改为 4176，并同步 `PUBLIC_URL` |
| 数据库起不来 | `docker compose logs db`；`docker compose down` 后重试（不删卷） |

## 课堂要点

- 三版本**同台**：4173 / 4174 / 4175，数据互不共享；
- 升级是**新增版本**，不是覆盖：R1 永久冻结、R2 自 R3 起冻结；
- 每一幕都有一个可观察的“升级点”，不靠 PPT 讲。
