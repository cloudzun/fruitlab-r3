// 公开静态文件白名单：Node 静态服务与 web 镜像构建共用，避免两处漂移。
// 规则：白名单里的每个路径必须在仓库真实存在；scripts/build-public.mjs 会逐个校验。
export const PUBLIC_ALLOWLIST = Object.freeze([
  "/index.html",
  "/README.md",
  "/SPEC.md",
  "/DECISIONS.md",
  "/OFFICE_HOURS.md",
  "/BUILD.md",
  "/BUILD-LOG.md",
  "/CHANGELOG.md",
  "/VERSION",
  "/PRD-R2.md",
  "/PRD-R3.md",
  "/assets/app.mjs",
  "/assets/api-client.mjs",
  "/assets/boot-guard.js",
  "/assets/controller.mjs",
  "/assets/domain.mjs",
  "/assets/styles.css",
  "/docs/api.md",
  "/docs/error-catalog.md",
  "/docs/contracts.md",
  "/docs/design-tokens.md",
  "/docs/assets-credits.md",
  "/docs/branch-matrix.md",
  "/docs/obligations.md",
  "/docs/decision-log.md",
  "/docs/cli.md",
  "/docs/architecture.md",
  "/docs/deploy.md",
  "/docs/backup-restore.md",
  "/docs/coverage-audit.md",
  "/docs/learnings.md",
  "/docs/designs/fruitlab-traceable-demo.md",
  "/evidence/index.md",
  "/evidence/clean-run.md",
  "/evidence/manual-checks/browser.md",
  "/evidence/spec-quality-gate.md",
  "/evidence/spec-forensics.md",
  "/evidence/test-count.txt",
  "/evidence/assets-manifest.json",
  "/evidence/demo-script.md",
  "/evidence/learner-checks/pre-spec.md",
  "/evidence/ring-spec.md",
  "/evidence/ring-autoplan.md",
  "/evidence/ring-build.md",
  "/evidence/ring-review.md",
  "/evidence/ring-qa.md",
  "/evidence/ring-ship.md",
  "/evidence/ring-retro.md",
]);

export const IMAGE_RE = /^\/assets\/images\/products\/[a-z0-9-]+\.jpg$/;

const MIME_TYPES = Object.freeze({
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".mjs": "text/javascript; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".md": "text/markdown; charset=utf-8",
  ".txt": "text/plain; charset=utf-8",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".png": "image/png",
  ".webp": "image/webp",
});

export function mimeTypeFor(file) {
  const index = file.lastIndexOf(".");
  return index === -1 ? "application/octet-stream" : MIME_TYPES[file.slice(index).toLowerCase()] ?? "application/octet-stream";
}

export function isAllowedPublicPath(pathname) {
  return PUBLIC_ALLOWLIST.includes(pathname) || IMAGE_RE.test(pathname);
}

export function listPublicFiles() {
  return PUBLIC_ALLOWLIST.map((item) => item.replace(/^\//, ""));
}
