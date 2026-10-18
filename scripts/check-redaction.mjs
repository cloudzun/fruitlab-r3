// 脱敏扫描（fail-closed 的本地等价实现）。
// 用途：spec / 各环报告落盘前，扫描密钥前缀、私钥块、赋值式口令、邮箱、非回环 IPv4。
// 说明：官方 gstack 脱敏扫描器不可用时的本地替代；不声称与官方扫描器等价。
// 用法：node scripts/check-redaction.mjs [文件...]（默认扫描 SPEC.md、docs/decision-log.md、evidence/spec-forensics.md）
import fs from "node:fs";
import path from "node:path";

const ROOT = path.resolve(import.meta.dirname, "..");
const DEFAULT_FILES = ["SPEC.md", "docs/decision-log.md", "evidence/spec-forensics.md"];

const HIGH = [
  { name: "private-key", re: /-----BEGIN (?:RSA |OPENSSH |EC |PGP )?PRIVATE KEY-----/ },
  { name: "aws-access-key", re: /\bAKIA[0-9A-Z]{16}\b/ },
  { name: "github-token", re: /\bgh[pousr]_[A-Za-z0-9]{20,}\b/ },
  { name: "openai-key", re: /\bsk-[A-Za-z0-9]{20,}\b/ },
  { name: "slack-token", re: /\bxox[baprs]-[A-Za-z0-9-]{10,}\b/ },
  { name: "assigned-secret", re: /(?:^|[^A-Za-z0-9_])(?:password|passwd|secret|token|api[_-]?key)\s*[:=]\s*["'][^"'\s$<{][^"']{3,}["']/i },
];
const MEDIUM = [
  { name: "email", re: /[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/ },
];
const WARN = [
  { name: "ipv4", re: /\b(?:\d{1,3}\.){3}\d{1,3}\b/ },
  { name: "long-hex", re: /\b[0-9a-f]{40,}\b/i },
];

function scan(file, text) {
  const hits = [];
  const lines = text.split(/\r?\n/);
  lines.forEach((line, index) => {
    for (const rule of HIGH) if (rule.re.test(line)) hits.push({ level: "HIGH", rule: rule.name, line: index + 1, text: line.trim().slice(0, 120) });
    for (const rule of MEDIUM) if (rule.re.test(line)) hits.push({ level: "MEDIUM", rule: rule.name, line: index + 1, text: line.trim().slice(0, 120) });
    for (const rule of WARN) if (rule.re.test(line)) hits.push({ level: "WARN", rule: rule.name, line: index + 1, text: line.trim().slice(0, 120) });
  });
  return hits;
}

const files = process.argv.slice(2).length > 0 ? process.argv.slice(2) : DEFAULT_FILES;
const counts = { HIGH: 0, MEDIUM: 0, WARN: 0 };
let missing = 0;
for (const relative of files) {
  const file = path.resolve(ROOT, relative);
  if (!fs.existsSync(file)) {
    process.stderr.write(`[missing] ${relative}\n`);
    missing += 1;
    continue;
  }
  const hits = scan(relative, fs.readFileSync(file, "utf8"));
  for (const hit of hits) counts[hit.level] += 1;
  const high = hits.filter((hit) => hit.level === "HIGH").length;
  const medium = hits.filter((hit) => hit.level === "MEDIUM").length;
  const warn = hits.filter((hit) => hit.level === "WARN").length;
  process.stdout.write(`${relative}: HIGH ${high} / MEDIUM ${medium} / WARN ${warn}\n`);
  for (const hit of hits) process.stdout.write(`  ${hit.level} ${hit.rule} L${hit.line}: ${hit.text}\n`);
}
process.stdout.write(`\n合计: HIGH ${counts.HIGH} / MEDIUM ${counts.MEDIUM} / WARN ${counts.WARN}\n`);
if (missing > 0 || counts.HIGH > 0) process.exitCode = 1;
