// 文档陈旧口径扫描：R3 学员文档不得出现未标注的 R2 旧口径。
// 允许在“R2/历史/升级前/不再/superseded”上下文中提及。
import fs from "node:fs";
import path from "node:path";

const ROOT = path.resolve(import.meta.dirname, "..");
const FILES = [
  "README.md",
  "docs/architecture.md",
  "docs/api.md",
  "docs/cli.md",
  "docs/contracts.md",
  "docs/deploy.md",
  "docs/backup-restore.md",
  "docs/error-catalog.md",
];
const PATTERNS = [
  { name: "old-port-4174", re: /\b4174\b/ },
  { name: "old-flag--db", re: /--db\b/ },
  { name: "sqlite", re: /\bSQLite\b|node:sqlite/i },
  { name: "zero-dependency", re: /零依赖|零第三方依赖/ },
];
const HISTORY = /R2|历史|升级前|superseded|不再|旧口径|迁移|before|已移除|破坏性|变更|对比|改为|→/i;

const hits = [];
for (const relative of FILES) {
  const file = path.join(ROOT, relative);
  if (!fs.existsSync(file)) continue;
  const lines = fs.readFileSync(file, "utf8").split(/\r?\n/);
  lines.forEach((line, index) => {
    for (const pattern of PATTERNS) {
      if (pattern.re.test(line) && !HISTORY.test(line)) {
        hits.push({ file: relative, line: index + 1, rule: pattern.name, text: line.trim().slice(0, 120) });
      }
    }
  });
}
if (hits.length > 0) {
  for (const hit of hits) process.stderr.write(`[stale] ${hit.file}:${hit.line} (${hit.rule}) ${hit.text}\n`);
  process.stderr.write(`stale docs: ${hits.length} hit(s)\n`);
  process.exitCode = 1;
} else {
  process.stdout.write(`stale docs: clean (${FILES.length} files)\n`);
}
