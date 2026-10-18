// 一次性补丁：SPEC v1.1 → v1.2（autoplan 修订并入）。
import fs from "node:fs";

const FILE = "SPEC.md";
let src = fs.readFileSync(FILE, "utf8");
const patches = [];
const add = (name, oldText, newText) => patches.push({ name, oldText, newText });

add("header",
"> **状态**：`DRAFT v1.0`（等待 spec 门禁：语义 / 脱敏 / 同族第二智能体复核 / 项目负责人确认）",
"> **状态**：`APPROVED v1.2`（spec 门禁 2026-10-18；autoplan 四方评审后并入 §16；用户已授权代理自审）");

add("gate-status",
"**状态**：`APPROVED v1.1`（2026-10-18，spec 环）。v1.0 快照保留在 `evidence/codex/SPEC-snapshot-v1.0.md`。",
"**状态**：v1.1 门禁记录（2026-10-18）。当前生效版本为 **v1.2**（§16 优先于前文）；v1.0/v1.1 快照保留在 `evidence/codex/`。");

add("revision",
"| 2026-10-18 | v1.1 | 并入语义审查 8 项修订与 codex 同族复核 10 条 findings 的处置：事务/23505 边界与幂等语义、service 工厂与组合根、容器 HOST/Public URL/健康检查 Host、DB 身份变量统一、SemVer 4 段映射、生产模式口令策略、连接池超时与 pool error、XFF 信任与限流上限、输入约束继承、测试处置表口径。跨模型门禁仍 `unavailable`（同族复核不冒充跨模型） |",
"| 2026-10-18 | v1.1 | 并入语义审查 8 项修订与 codex 同族复核 10 条 findings 的处置：事务/23505 边界与幂等语义、service 工厂与组合根、容器 HOST/Public URL/健康检查 Host、DB 身份变量统一、SemVer 4 段映射、生产模式口令策略、连接池超时与 pool error、XFF 信任与限流上限、输入约束继承、测试处置表口径。跨模型门禁仍 `unavailable`（同族复核不冒充跨模型） |\n| 2026-10-18 | v1.2 | autoplan 四阶段（CEO/DES/DX/ENG 均 FAIL）+ v1.1 第二轮同族复核（N-01..N-07）共 42 条发现 → 42 条 `OB-R3-*`；并入 §16：工时 35–45h、结果型 AC-106..118、R2 临时文件持久化、课程矩阵/demo 脚本、DB 身份全变量化、production/classroom seed 拆分、health 3s 时限、迁移 client 级 + advisory lock、锁顺序、异步 scrypt、web healthcheck、restore 停写/单事务、备份恢复契约、两桶限流、CSRF 轮换/恢复、int8 安全解析、路径规范化、quickstart/preflight、CLI 矩阵、陈旧口径扫描、R2 UI 回归 |");

const section = fs.readFileSync("evidence/codex/spec-section16.md", "utf8");

let applied = 0;
for (const patch of patches) {
  const at = src.indexOf(patch.oldText);
  if (at === -1) { console.log(`MISS ${patch.name}`); continue; }
  src = src.slice(0, at) + patch.newText + src.slice(at + patch.oldText.length);
  console.log(`OK ${patch.name}`);
  applied += 1;
}
if (!src.includes("## 16. autoplan 修订并入")) {
  src = src.replace(/\s*$/, "\n") + section;
  console.log("OK append-section16");
  applied += 1;
}
fs.writeFileSync(FILE, src, "utf8");
console.log(`applied ${applied}`);
