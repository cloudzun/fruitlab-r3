// 生成 BUILD.md 与 docs/obligations.md 的表格骨架（内容来自 SPEC v1.2 与 DECISIONS 42 条）。
// 判定在 build 环为 implemented（待 review/qa）；最终 close 在 ship 环更新。
import fs from "node:fs";

const spec = fs.readFileSync("SPEC.md", "utf8");
const decisions = fs.readFileSync("DECISIONS.md", "utf8");

function parseTable(text, prefix, columns) {
  return text
    .split(/\r?\n/)
    .filter((line) => line.startsWith('| ' + prefix))
    .map((line) => {
      const cells = line.split('|').slice(1, -1).map((cell) => cell.trim());
      const row = {};
      for (let index = 0; index < columns.length; index += 1) row[columns[index]] = cells[index] ?? '';
      return row;
    });
}

const acRows = parseTable(spec, 'AC-', ['id', 'summary', 'maps', 'evidence']);
const obRows = parseTable(decisions, 'OB-R3-', ['id', 'obligation', 'criteria']);

if (acRows.length !== 70) throw new Error('expected 70 AC rows, got ' + acRows.length);
if (obRows.length !== 42) throw new Error('expected 42 OB rows, got ' + obRows.length);

const milestones = [
  '| 里程碑 | 内容 | 状态 | 证据 |',
  '|---|---|---|---|',
  '| M1 | Postgres 迁移 + L1 分层 + 测试基础设施 | 完成 | `tests/db.test.mjs`、`tests/auth.test.mjs`、`tests/api.test.mjs` |',
  '| M2 | 安全补漏（11 缺陷 + 会话/限流/CSRF/时序/404） | 完成 | `tests/api.test.mjs`、`tests/client.test.mjs`、`tests/auth.test.mjs` |',
  '| M3 | Dockerfile ×2 + compose 三容器 + Caddy + 备份恢复 | 完成 | `evidence/container/`、`docs/deploy.md` |',
  '| M4 | review/qa/ship/retro | 进行中 | `evidence/ring-*.md` |',
].join('\n');

const groupMap = [
  '| AC 范围 | 相关 OB |',
  '|---|---|',
  '| AC-49～AC-58 | OB-R3-CEO-01/02/03、OB-R3-SPEC-01/02/03/06 |',
  '| AC-59～AC-61 | OB-R3-CEO-05、OB-R3-ENG-01、OB-R3-SPEC-04 |',
  '| AC-62～AC-69 | OB-R3-ENG-02/03/05/06/12、OB-R3-DES-01 |',
  '| AC-70～AC-83 | OB-R3-ENG-07/08/09、OB-R3-SPEC-05、OB-R3-DES-02/03 |',
  '| AC-84～AC-89 | OB-R3-ENG-04、OB-R3-DX-03/04、OB-R3-CEO-06 |',
  '| AC-90～AC-96 | OB-R3-DX-01/05/06/07/09、OB-R3-CEO-07 |',
  '| AC-97～AC-105 | OB-R3-ENG-01/02/08/09/10/11/12、OB-R3-SPEC-01/03 |',
  '| AC-106～AC-118 | OB-R3-CEO-02/03/04、OB-R3-DES-01/04/05/06、OB-R3-DX-01/05/07、OB-R3-ENG-05/07/11 |',
  '',
  '> 逐条 AC 摘要与证据形态见下表；`docs/obligations.md` 给出 OB 台账。',
].join('\n');

const acTable = [
  '| AC | 判定（摘要） | 对应 | 证据 | build 判定 |',
  '|---|---|---|---|---|',
  ...acRows.map((row) => '| ' + row.id + ' | ' + row.summary + ' | ' + row.maps + ' | ' + row.evidence + ' | implemented（待 review/qa） |'),
].join('\n');

const obTable = [
  '| 编号 | 义务 | 完成判据 | 实现/证据 | build 判定 |',
  '|---|---|---|---|---|',
  ...obRows.map((row) => '| ' + row.id + ' | ' + row.obligation + ' | ' + row.criteria + ' | 见 `docs/obligations.md` 与各环证据 | implemented（待 review/qa） |'),
].join('\n');

const disposition = [
  '## 4. R2 96 项测试处置（AC-91 / OB-R3-SPEC-04）',
  '',
  '| R2 文件 | 原项数 | 处置 | 说明 |',
  '|---|---:|---|---|',
  '| `domain.test.mjs` | 17 | 原样保留 | 仅新增 `PRODUCT_SEED` 别名导入，断言不变 |',
  '| `controller.test.mjs` | 11 | 原样保留 | 无 DOM reducer，未改 |',
  '| `app.test.mjs` | 19 | 等价迁移 | fake DOM 保留；越权文案从 403 `order-not-owned` 改为 404 `order-not-found`（D-57） |',
  '| `assets.test.mjs` | 3 | 原样保留 | 图片/台账断言不变 |',
  '| `static-scan.test.mjs` | 13 | 预期契约变更 | “无 package.json”改为“运行时依赖恰好 {pg}”（D-48/D-64）；CSP/视觉断言保留 |',
  '| `contracts.test.mjs` | 4 | 预期契约变更 | AC 续号（AC-49..118）、OB 改为 `OB-R3-*`、错误码集合更新 |',
  '| `auth.test.mjs` | 5 | 等价迁移 + 扩充 | 改为真实 PG；新增会话过期/轮换/限流/dummy scrypt 分支 |',
  '| `db.test.mjs` | 7 | 等价迁移 + 扩充 | 改为真实 PG；新增迁移 checksum、advisory lock、并发、锁顺序、reset 回滚 |',
  '| `cli.test.mjs` | 7 | 等价迁移 + 扩充 | 改为 `DATABASE_URL`；新增 backup/restore、reset 失败、生产口令、checksum |',
  '| `api.test.mjs` | 10 | 等价迁移 + 扩充 | 改为真实服务器+PG；新增 405 表、优先级、CSRF、限流、404、health down |',
  '',
  '**预期变更白名单**：D-32（403→404）、D-47（换库）、D-53（会话过期）、D-55（CSRF）、D-57（404）、D-58（优先级）、D-62（health 形状）、D-64（依赖口径）、D-79（输入约束）、D-82（XFF）。除这些之外，其余 R2 断言应保持等价。',
].join('\n');

const build = [
  '# BUILD.md（R3 build 环验收）',
  '',
  '> 输入：`SPEC.md` v1.2（SHA-256 `81761E4E15E4C3622E657F6FD994F2C9C49F1EE5E10CEFFD63419E60E99C4462`）+ `DECISIONS.md` 42 条 `OB-R3-*`。',
  '> 测试计数唯一来源：`evidence/test-count.txt`；本文件不手写计数。',
  '> 判定口径：`implemented`（build 完成）≠ `verified`（review/qa 复核）；最终判定在 ship 环。',
  '',
  '## 1. 里程碑',
  '',
  milestones,
  '',
  '## 2. 验收（AC × OB）',
  '',
  groupMap,
  '',
  acTable,
  '',
  '## 3. 义务落实（OB × 证据）',
  '',
  obTable,
  '',
  disposition,
  '',
  '## 5. 未完成 / 降级',
  '',
  '- 跨模型复核：`unavailable`（同族 codex；不冒充）。',
  '- cso 官方 run：`partial`（离线无 scanner profiles/history-inputs），见 review 环。',
  '- 读屏器/对比度仪器人工审查：`UNVERIFIED`，qa 环记录。',
  '- 云平台部署：`requires-remote`（M5 选修）。',
  '',
  '## 6. 结论',
  '',
  'build 环产出：Postgres schema/迁移、repositories/services/router、CLI（含 backup/restore）、真实 PG 测试、Dockerfile ×2、compose 三容器、Caddy、备份恢复脚本、docs/ 与证据。',
  '本文件的 implemented 不等于 verified；review/qa 环逐项复核后，最终判定在 ship 环汇总。',
  '',
].join('\n');

const obligationLines = [
  '# 义务台账（R3）',
  '',
  '> 来源：`DECISIONS.md` 的 Accepted Obligations（42 条）。',
  '> 判定词汇：`closed` / `downgraded`（附理由）/ `not-covered`（附理由）。build 填实现状态，最终判定在 ship 环。',
  '',
  '| 编号 | 义务 | 完成判据 | build 实现状态 | 最终判定 |',
  '|---|---|---|---|---|',
  ...obRows.map((row) => '| ' + row.id + ' | ' + row.obligation + ' | ' + row.criteria + ' | implemented（待 review/qa 复核） | 待定 |'),
  '',
].join('\n');

fs.writeFileSync('BUILD.md', build, 'utf8');
fs.writeFileSync('docs/obligations.md', obligationLines, 'utf8');
console.log('BUILD.md + docs/obligations.md generated: ' + acRows.length + ' AC, ' + obRows.length + ' OB');
