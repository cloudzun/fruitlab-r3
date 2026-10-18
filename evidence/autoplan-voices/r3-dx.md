同族第二智能体，非跨模型；对象 SPEC-snapshot-v1.0.md（de78e754cab77d0dcc7b9084d9028a0b80941527daeb7ab2c9aa4c9e14c3b53b）

## 结论

**FAIL，5.0/10。** SHA-256 与指定值一致。规格已经覆盖结构化启动日志、`X-Request-Id`、SQLSTATE 日志、五档退出码、healthcheck 和 `verify` 单一入口，方向正确；但“从干净 checkout 到可运行”仍缺关键引导，CLI 文档无法直接复制执行，测试 PostgreSQL 启动不确定，备份与恢复没有形成可操作闭环，并且 L2 容器仍有已接受决策 D-77 所修复的 Host/监听缺口。这些问题会直接增加首次运行和故障处置时间，故 DX 门禁不通过。

## Findings

| 编号 | 严重度 | 位置 | 问题 | 建议 |
|---|---|---|---|---|
| DX-01 | Critical | `evidence/codex/SPEC-snapshot-v1.0.md:284`、`:330`、`:370`；`PRD-R3.md:249`、`:251` | 规格要求 compose 从 `.env` 读取并强制 `POSTGRES_PASSWORD`，但快速开始只写 `docker compose up --build`，没有“复制 `.env.example`、填写哪些值、如何预检引擎”的干净 checkout 步骤。新机器直接执行 AC-51 命令会因缺少必填环境变量失败；`node cli.mjs dev` 需要 `DATABASE_URL`，也没有从零准备开发库的命令。 | 增加唯一的 Clean-room Quickstart：Node/npm/Docker/Compose 预检、复制并填写 `.env`、选择原生 Docker 或 WSL、启动、等待 health、预期 JSON 和停止命令；用临时目录/全新 clone 实测并设定首次可用时间上限。 |
| DX-02 | High | `evidence/codex/SPEC-snapshot-v1.0.md:7`、`:73`、`:374`；`docs/decision-log.md:131` | 目标版本和 AC-55 要求包版本同为 `3.0.0.0`。四段版本不是合法 SemVer，按快照实现会使 `npm ci`、包元数据和镜像构建链出现冲突；D-72 已接受“`VERSION=3.0.0.0`、`package.json=3.0.0`”的分离口径，但冻结快照未并入。 | 明确 `VERSION`、包版本、镜像标签三者各自格式；包版本固定为 `3.0.0`，并在 `engines`/`packageManager` 中记录 Node/npm 约束；增加干净环境 `npm ci` 烟测。 |
| DX-03 | High | `evidence/codex/SPEC-snapshot-v1.0.md:67`、`:74`、`:302`、`:332`、`:406`；`docs/decision-log.md:118`、`:125`、`:137` | 恢复链路不闭环：`cli db backup` 被称作“SQL 逻辑导出”，实际格式却是版本元数据加每表 JSON Lines，且没有对应的 `db restore`；`backup.sh`/`restore.sh` 又硬编码 `fruitlab` 用户和库，与 D-78 要求的同源 `POSTGRES_USER`/`POSTGRES_DB` 冲突。`restore.sh` 没有明确备份文件参数、二次确认或停 API 步骤，CLI 备份在容器内写到 `/app/backups` 也没有持久卷/拷出命令。 | 冻结一条可验证的恢复契约：要么提供 `db restore --in <file> --yes` 并按 `POSTGRES_*` 生成参数，要么只保留 `pg_dump`/`pg_restore` 并取消“SQL 导出/往返”表述；补齐备份落盘与拷出、停机/断连、恢复校验和失败保留策略，并做备份→毁库→恢复的端到端测试。 |
| DX-04 | High | `evidence/codex/SPEC-snapshot-v1.0.md:224`、`:319`、`:325`、`:328`、`:403`；`docs/decision-log.md:136` | api 容器只写 `serve.mjs --port 3000`，没有 `HOST=0.0.0.0`；配置契约也未列 `PUBLIC_URL` 和白名单派生规则。若沿用本地默认回环地址，Caddy 和容器 healthcheck 无法访问 api；若 Host 白名单仍只认外部域名，健康检查可能返回 403。D-77 已指出并修正该问题，但 v1.0 仍是旧口径。 | 在 compose/config/启动命令中同时冻结 `HOST=0.0.0.0`、`PUBLIC_URL`、Host 白名单和 Caddy 保留/覆盖 Host 的行为；把“api 容器内自检、Caddy→api、浏览器→Caddy”三层探活写入快速开始与 AC。 |
| DX-05 | Medium | `evidence/codex/SPEC-snapshot-v1.0.md:308`、`:309`、`:310` | 测试 PostgreSQL 只给了一条固定容器名、固定端口的 `docker run`，没有 readiness 等待、停止/清理命令或残留容器恢复说明。用户复制后立即运行测试会遇到连接竞态；上次测试中断后再次执行会遇到容器名占用。也未同时给出 Docker Desktop 与 WSL 两种前置写法。 | 提供 `scripts/test-pg-up/status/down` 或等价命令，使用 `pg_isready` 轮询、失败时打印容器状态，并在启动前清理/复用同名容器；README 同时给 WSL 与原生 Docker 版本和预期输出。 |
| DX-06 | Medium | `evidence/codex/SPEC-snapshot-v1.0.md:290`、`:301`、`:302`、`:422`；`../r2-fruitlab/DECISIONS.md:173`、`:174` | CLI 命令树被压成带 `|` 的伪语法，全局选项、子命令选项、stdin 用法和输出未给可复制的完整示例；`--json` 的成功/失败信封没有在 R3 契约中重述，`0/1/2/3/4` 也只写类别，没有规定连接失败、SQLSTATE `40001`/`40P01`、备份失败、schema 漂移等具体落到哪个退出码。文档命令与 `--help` 是否一致也没有机械验收。 | 在 `docs/cli.md` 冻结命令矩阵：每条 exact argv、必需 env、stdin、stdout/stderr、JSON schema、退出码和补救动作；根命令及每个子命令支持 `--help`，并用表驱动测试证明帮助文本、文档命令和解析器三者一致。 |
| DX-07 | Medium | `evidence/codex/SPEC-snapshot-v1.0.md:308`、`:415`；`PRD-R3.md:172` | AC-96 把 `verify.mjs` 定为单一入口，但未定义其前置检查、分层开关和输出契约。测试与 compose 检查依赖真实 PG、Docker/WSL；干净机器上 `verify` 会以测试失败或配置文件失败收尾，开发者难以区分“产品坏了”和“前置没装”。它也没有覆盖容器构建/启动烟测。 | 让 `verify` 先输出机器可读的 preflight（Node/npm/Docker/Compose/PG），缺项时给出唯一补救命令；区分 `verify --quick`（纯逻辑/静态）与 `verify --full`（PG/compose smoke），固定退出码和 PASS/FAIL 摘要。 |
| DX-08 | Medium | `evidence/codex/SPEC-snapshot-v1.0.md:332`、`:334`；`PRD-R3.md:242`、`:250` | Windows/WSL 双环境只在说明文字中承诺，示例仍硬编码 `/mnt/d/vibecoding/easyvibe/r3-fruitlab/...`，恢复脚本也只有 WSL bash。换用户、盘符或仓库位置后命令不可复制；PowerShell 用户没有等价的 backup/restore 入口。 | 文档统一使用相对当前目录的命令，WSL 需要绝对路径时通过 `wslpath` 动态转换；为备份/恢复提供 PowerShell 包装或明确 `wsl -- bash ...` 调用，并在两种入口下给出相同的文件路径和校验输出。 |
| DX-09 | Low | `evidence/codex/SPEC-snapshot-v1.0.md:35`、`:40`、`:56`、`:325`、`:326` | 可复现性仍依赖机器现状：Node/npm 只是实测值，镜像使用可漂移的 `node:22-alpine`、`postgres:16-alpine`、`caddy:2-alpine`，npm registry 只记录当前为 `registry.npmmirror.com`，但未说明 lockfile 中 resolved URL、`.npmrc` 或 Docker build 的 registry 策略。 | 记录 `engines`/`packageManager` 或版本文件；镜像 tag 旁记录 digest（验收时至少校验一次）；明确 npm 镜像是否允许及如何只对单条命令使用，避免主机全局配置悄悄改变依赖来源。 |

## 未评估项

- 未运行 npm、测试、PostgreSQL、Docker/Compose、CLI 或任何备份恢复命令；报告不证明运行时行为已通过，也未实测真实 TTHW。
- 未在 PowerShell、WSL、Docker Desktop 三种入口下逐条复制文档命令，无法确认路径、引号、stdin 和健康等待的实际体验。
- 未验证 `npm ci` 对当前 lockfile/registry 的行为、镜像拉取时间、digest 稳定性或端口占用。
- 未评估实现代码、v1.1 及后续未冻结修订；结论仅针对指定 SHA-256 的冻结快照和列明的权威输入。
