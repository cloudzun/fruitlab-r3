partial — code
Status: partial. Some required coverage is missing; findings below cover only the assessed part.
Ran: snapshot-inputs (partial); application-model (assessed); attack-surface (assessed); owasp-2025 (partial). Missing: snapshot-inputs (partial); history-inputs (not\_assessed); owasp-2025 (partial); stride (not\_assessed); data-classification (not\_assessed).
Reason: history-inputs: not assessed; stride: not assessed; data-classification: not assessed; assets/images/products/banana.jpg: in-scope source payload was unread and withheld from static and runtime assessment; assets/images/products/blueberry.jpg: in-scope source payload was unread and withheld from static and runtime assessment; assets/images/products/cherry.jpg: in-scope source payload was unread and withheld from static and runtime assessment; assets/images/products/durian.jpg: in-scope source payload was unread and withheld from static and runtime assessment; assets/images/products/fuji-apple.jpg: in-scope source payload was unread and withheld from static and runtime assessment; assets/images/products/golden-pineapple.jpg: in-scope source payload was unread and withheld from static and runtime assessment; assets/images/products/hami-melon.jpg: in-scope source payload was unread and withheld from static and runtime assessment; assets/images/products/kiwi.jpg: in-scope source payload was unread and withheld from static and runtime assessment; assets/images/products/mango.jpg: in-scope source payload was unread and withheld from static and runtime assessment; assets/images/products/navel-orange.jpg: in-scope source payload was unread and withheld from static and runtime assessment; assets/images/products/peach.jpg: in-scope source payload was unread and withheld from static and runtime assessment; assets/images/products/red-dragon-fruit.jpg: in-scope source payload was unread and withheld from static and runtime assessment; assets/images/products/shine-muscat.jpg: in-scope source payload was unread and withheld from static and runtime assessment; assets/images/products/strawberry.jpg: in-scope source payload was unread and withheld from static and runtime assessment; evidence/autoplan-voices/r3-ceo.log: in-scope source payload was unread and withheld from static and runtime assessment; evidence/autoplan-voices/r3-des.log: in-scope source payload was unread and withheld from static and runtime assessment; evidence/autoplan-voices/r3-dx.log: in-scope source payload was unread and withheld from static and runtime assessment; evidence/autoplan-voices/r3-eng.log: in-scope source payload was unread and withheld from static and runtime assessment; evidence/baseline-tests.txt: in-scope source payload was unread and withheld from static and runtime assessment; evidence/codex/spec-review-run.log: in-scope source payload was unread and withheld from static and runtime assessment; evidence/codex/spec-review-run2.log: in-scope source payload was unread and withheld from static and runtime assessment; evidence/codex/spec-review-run3.log: in-scope source payload was unread and withheld from static and runtime assessment; evidence/visual/home-1440.png: in-scope source payload was unread and withheld from static and runtime assessment; evidence/visual/home-390-cart.png: in-scope source payload was unread and withheld from static and runtime assessment; evidence/visual/home-390-top.png: in-scope source payload was unread and withheld from static and runtime assessment; evidence/visual/home-834.png: in-scope source payload was unread and withheld from static and runtime assessment; review.md: in-scope source payload was unread and withheld from static and runtime assessment; Could not read bounded Git metadata: log exceeded the output limit \(request rejected\); source may not be a Git repository; offline run: gitleaks/osv/semgrep/trivy scanner profiles unavailable; Assessment has not been submitted.
Next: start a new /cso audit after resolving the reasons above; run `gstack-cso doctor --repo <repo>` to check prerequisites.
Run: 1792294626627-4aa9fb56ea93339d. Mode: daily.
Timing: started 2026-10-18T03:37:06.601Z; deadline 2026-10-18T03:47:06.601Z; terminal 2026-10-18T03:45:24.640Z; elapsed 498039 ms.
Material gaps: history-inputs: not assessed; stride: not assessed; data-classification: not assessed; assets/images/products/banana.jpg: in-scope source payload was unread and withheld from static and runtime assessment; assets/images/products/blueberry.jpg: in-scope source payload was unread and withheld from static and runtime assessment; assets/images/products/cherry.jpg: in-scope source payload was unread and withheld from static and runtime assessment; assets/images/products/durian.jpg: in-scope source payload was unread and withheld from static and runtime assessment; assets/images/products/fuji-apple.jpg: in-scope source payload was unread and withheld from static and runtime assessment; assets/images/products/golden-pineapple.jpg: in-scope source payload was unread and withheld from static and runtime assessment; assets/images/products/hami-melon.jpg: in-scope source payload was unread and withheld from static and runtime assessment; assets/images/products/kiwi.jpg: in-scope source payload was unread and withheld from static and runtime assessment; assets/images/products/mango.jpg: in-scope source payload was unread and withheld from static and runtime assessment; assets/images/products/navel-orange.jpg: in-scope source payload was unread and withheld from static and runtime assessment; assets/images/products/peach.jpg: in-scope source payload was unread and withheld from static and runtime assessment; assets/images/products/red-dragon-fruit.jpg: in-scope source payload was unread and withheld from static and runtime assessment; assets/images/products/shine-muscat.jpg: in-scope source payload was unread and withheld from static and runtime assessment; assets/images/products/strawberry.jpg: in-scope source payload was unread and withheld from static and runtime assessment; evidence/autoplan-voices/r3-ceo.log: in-scope source payload was unread and withheld from static and runtime assessment; evidence/autoplan-voices/r3-des.log: in-scope source payload was unread and withheld from static and runtime assessment; evidence/autoplan-voices/r3-dx.log: in-scope source payload was unread and withheld from static and runtime assessment; evidence/autoplan-voices/r3-eng.log: in-scope source payload was unread and withheld from static and runtime assessment; evidence/baseline-tests.txt: in-scope source payload was unread and withheld from static and runtime assessment; evidence/codex/spec-review-run.log: in-scope source payload was unread and withheld from static and runtime assessment; evidence/codex/spec-review-run2.log: in-scope source payload was unread and withheld from static and runtime assessment; evidence/codex/spec-review-run3.log: in-scope source payload was unread and withheld from static and runtime assessment; evidence/visual/home-1440.png: in-scope source payload was unread and withheld from static and runtime assessment; evidence/visual/home-390-cart.png: in-scope source payload was unread and withheld from static and runtime assessment; evidence/visual/home-390-top.png: in-scope source payload was unread and withheld from static and runtime assessment; evidence/visual/home-834.png: in-scope source payload was unread and withheld from static and runtime assessment; review.md: in-scope source payload was unread and withheld from static and runtime assessment; Could not read bounded Git metadata: log exceeded the output limit \(request rejected\); source may not be a Git repository; offline run: gitleaks/osv/semgrep/trivy scanner profiles unavailable; Assessment has not been submitted.

Application model:
- Actors: anonymous visitor; authenticated user \(userA/userB\); admin; operator with database/backup access.
- Assets: products database; orders database; sessions; user credentials \(scrypt hashes\); database backups.
- Entrypoints: GET /api/health; GET /api/products; POST /api/auth/register; POST /api/auth/login; POST /api/auth/logout; GET /api/auth/me; POST /api/orders; GET /api/orders/mine; GET /api/orders/\{orderNumber\}; GET /api/admin/orders; GET /api/admin/products; PATCH /api/admin/products/\{id\}; web static files via Caddy \(4175\).
- Tenant boundaries: order.user\_id ownership \(other users' orders return 404\); role admin vs user; compose network boundary: api/db not published.
- Sensitive operations: session issuance and expiry; password verification \(scrypt\); read order by number; admin price/stock/listing update; database backup and restore.
- Security invariants: users can only read own orders; other users' orders are indistinguishable from missing \(404\); admin mutations require admin role; passwords stored as salted scrypt hash; dummy scrypt runs for missing users; stock never negative \(conditional UPDATE\); state-changing requests with a session require CSRF token; sessions expire server-side.

Supported findings:
- LOW Database backup artifacts contain password hashes and inherit default file permissions [036baa11ac1dd244470e93e22426cf11]
  Location: cli.mjs:1 (exportBackup). Confidence: high — Direct source reading of exportBackup and scripts/backup.sh; no runtime inspection of resulting file modes.. Evidence: supported.
  Attacker scenario: A backup file created during class or operations is readable by another local account and copied off the machine.
  Attacker control: Local user or process with read access to the backups directory. Impact: Offline password-hash disclosure enables offline guessing; order/user data disclosure..
  Trace: node cli.mjs db backup --out backups; exportBackup writes rows incl. password\_hash; scripts/backup.sh writes pg\_dump output. Supporting references: cli.mjs exportBackup; scripts/backup.sh; docs/backup-restore.md.
  Counterevidence considered: local classroom demo has no multi-user host threat model. Challenge: independent\_agent by codex-second-agent. Conclusion: survives as a low-severity operational hygiene issue.
  Repair recommendation: Create backups with mode 0600 \(or a dedicated directory 0700\), document encryption-at-rest for production, and avoid shipping backups with the repo.
  Reproduction: not\_attempted. Repair: not\_attempted. Closure: open.
- LOW Rate limiting state is process-local; restart or a second instance resets counters [9864501f165ae9690115c8269f74bc80]
  Location: server/auth.mjs:1 (createRateLimiter). Confidence: high — Direct source reading; R3 explicitly designs a single-instance demo and documents the boundary.. Evidence: supported.
  Attacker scenario: Attacker waits for a service restart or deployment scale-out and retries the password list.
  Attacker control: Ability to wait for a restart or to target a deployment with multiple replicas. Impact: Online password guessing budget resets; brute-force protection is weaker than a shared store..
  Trace: POST /api/auth/login; auth service rateLimiter.check; createRateLimiter Map. Supporting references: server/auth.mjs; docs/deploy.md; README.md security boundaries.
  Counterevidence considered: R3 declares no horizontal scaling and a single replica in compose. Challenge: independent\_agent by codex-second-agent. Conclusion: survives as a scoped limitation, not a functional bug.
  Repair recommendation: Keep for R3 and document the single-instance boundary; for production, move counters to a shared store \(or edge/WAF rate limiting\).
  Reproduction: not\_attempted. Repair: not\_attempted. Closure: open.
- LOW Local compose does not terminate TLS; cookie Secure flag depends on deployer configuration [c85092e68c5b44bf5bc375240ce2b157]
  Location: docker-compose.yml:1 (web service port mapping). Confidence: high — Direct reading of compose env defaults and config.mjs production checks; no external TLS terminator is shipped.. Evidence: supported.
  Attacker scenario: Operator publishes the compose port to a LAN/WAN without a TLS proxy; login credentials and session cookie are sent in clear text.
  Attacker control: Network attacker on the path between browser and host. Impact: Session cookie could travel over plaintext if the deployer exposes 4175 directly..
  Trace: browser -\> web:4175 \(HTTP\); Caddy :8080; api sets fruitlab\_session. Supporting references: docker-compose.yml; config.mjs production checks; docs/deploy.md.
  Counterevidence considered: PRD explicitly excludes HTTPS certificates for local compose. Challenge: independent\_agent by codex-second-agent. Conclusion: survives as a documented deployment boundary.
  Repair recommendation: Document that the delivered stack is localhost/demo only; for deployment terminate TLS at an external proxy and keep COOKIE\_SECURE=1 enforced in production \(already checked\).
  Reproduction: not\_attempted. Repair: not\_attempted. Closure: open.
- LOW CLI db restore trusts operator-supplied JSON Lines without schema-version compatibility check [c5ff7110138659de7030a44e04d44da0]
  Location: cli.mjs:1 (importBackup). Confidence: medium — Direct source reading; transactional rollback limits impact to restore failure rather than corruption.. Evidence: supported.
  Attacker scenario: An old backup file is restored after a future schema change; insert order/columns no longer match.
  Attacker control: Operator/supply-chain control over the backup file. Impact: Restore fails or produces schema/data mismatch that is detected only by later checks..
  Trace: node cli.mjs db restore --in \<file\> --yes; importBackup parses meta; resetDatabase \+ inserts. Supporting references: cli.mjs importBackup; server/migrations/0001\_init.sql.
  Counterevidence considered: R3 ships a single schema version, so mismatch is not reachable in classroom. Challenge: independent\_agent by codex-second-agent. Conclusion: survives as a low-severity forward-compatibility gap.
  Repair recommendation: Compare meta.schemaVersion with the current migration version and refuse mismatches with a clear error; add a backup format version test.
  Reproduction: not\_attempted. Repair: not\_attempted. Closure: open.

Snapshot transformations:
- .env.example: excluded: credential or execution configuration
- BUILD.md: secret spans redacted
- CLAUDE.md: excluded: credential or execution configuration
- DECISIONS.md: secret spans redacted
- Dockerfile: secret spans redacted
- Dockerfile.web: secret spans redacted
- NEXT-SESSION-PROMPT.md: secret spans redacted
- PRD-R2.md: secret spans redacted
- PRD-R3.md: secret spans redacted
- R1-八环讲解记录.md: secret spans redacted
- README.md: secret spans redacted
- SPEC.md: secret spans redacted
- VERSION: secret spans redacted
- assets/api-client.mjs: secret spans redacted
- assets/app.mjs: secret spans redacted
- assets/images/products/banana.jpg: withheld: binary or redaction failed
- assets/images/products/blueberry.jpg: withheld: binary or redaction failed
- assets/images/products/cherry.jpg: withheld: binary or redaction failed
- assets/images/products/durian.jpg: withheld: binary or redaction failed
- assets/images/products/fuji-apple.jpg: withheld: binary or redaction failed
- assets/images/products/golden-pineapple.jpg: withheld: binary or redaction failed
- assets/images/products/hami-melon.jpg: withheld: binary or redaction failed
- assets/images/products/kiwi.jpg: withheld: binary or redaction failed
- assets/images/products/mango.jpg: withheld: binary or redaction failed
- assets/images/products/navel-orange.jpg: withheld: binary or redaction failed
- assets/images/products/peach.jpg: withheld: binary or redaction failed
- assets/images/products/red-dragon-fruit.jpg: withheld: binary or redaction failed
- assets/images/products/shine-muscat.jpg: withheld: binary or redaction failed
- assets/images/products/strawberry.jpg: withheld: binary or redaction failed
- compose.simple.yml: secret spans redacted
- config.mjs: secret spans redacted
- docker-compose.yml: secret spans redacted
- docs/api.md: secret spans redacted
- docs/assets-credits.md: secret spans redacted
- docs/contracts.md: secret spans redacted
- docs/decision-log.md: secret spans redacted
- docs/deploy.md: secret spans redacted
- evidence/assets-manifest.json: secret spans redacted
- evidence/autoplan-voices/ceo.txt: secret spans redacted
- evidence/autoplan-voices/design.txt: secret spans redacted
- evidence/autoplan-voices/dx.txt: secret spans redacted
- evidence/autoplan-voices/eng.txt: secret spans redacted
- evidence/autoplan-voices/r3-ceo-prompt.txt: secret spans redacted
- evidence/autoplan-voices/r3-ceo.log: withheld: binary or redaction failed
- evidence/autoplan-voices/r3-des-prompt.txt: secret spans redacted
- evidence/autoplan-voices/r3-des.log: withheld: binary or redaction failed
- evidence/autoplan-voices/r3-dx-prompt.txt: secret spans redacted
- evidence/autoplan-voices/r3-dx.log: withheld: binary or redaction failed
- evidence/autoplan-voices/r3-dx.md: secret spans redacted
- evidence/autoplan-voices/r3-eng-prompt.txt: secret spans redacted
- evidence/autoplan-voices/r3-eng.log: withheld: exceeds the 1 MiB redacting-reader limit
- evidence/baseline-tests.txt: withheld: binary or redaction failed
- evidence/codex/SPEC-snapshot-v1.0.md: secret spans redacted
- evidence/codex/SPEC-snapshot-v1.1.md: secret spans redacted
- evidence/codex/apply-spec-v1.1.mjs: secret spans redacted
- evidence/codex/review-prompt.txt: secret spans redacted
- evidence/codex/spec-review-codex.md: secret spans redacted
- evidence/codex/spec-review-disposition.md: secret spans redacted
- evidence/codex/spec-review-prompt.txt: secret spans redacted
- evidence/codex/spec-review-prompt2.txt: secret spans redacted
- evidence/codex/spec-review-run.log: withheld: binary or redaction failed
- evidence/codex/spec-review-run2.log: withheld: exceeds the 1 MiB redacting-reader limit
- evidence/codex/spec-review-run3.log: withheld: exceeds the 1 MiB redacting-reader limit
- evidence/codex/spec-review2-prompt.txt: secret spans redacted
- evidence/cso/cso-report.md: secret spans redacted
- evidence/cso/report.json: secret spans redacted
- evidence/debug415.mjs: secret spans redacted
- evidence/handle-probe.mjs: secret spans redacted
- evidence/index.md: secret spans redacted
- evidence/ring-build.md: secret spans redacted
- evidence/ring-review-codex.md: secret spans redacted
- evidence/ring-review-cso.md: secret spans redacted
- evidence/ring-ship.md: secret spans redacted
- evidence/smoke-m1.mjs: secret spans redacted
- evidence/spec-forensics.md: secret spans redacted
- evidence/toolchain-recon.md: secret spans redacted
- evidence/visual/home-1440.png: withheld: binary or redaction failed
- evidence/visual/home-390-cart.png: withheld: binary or redaction failed
- evidence/visual/home-390-top.png: withheld: binary or redaction failed
- evidence/visual/home-834.png: withheld: binary or redaction failed
- retro.md: secret spans redacted
- review.md: withheld: binary or redaction failed
- server/app.mjs: secret spans redacted
- server/router.mjs: secret spans redacted
- tests/app.test.mjs: secret spans redacted
- tests/controller.test.mjs: secret spans redacted
- tests/helpers/pg.mjs: secret spans redacted

Coverage:
- snapshot-inputs: partial; fail-closed captured source inventory.
  Scope: code. Evidence: 172 sanitized execution inputs captured; 2 explicit non-executable exclusions; 27 unread in-scope inputs; 0 tracked deletions. Gaps: assets/images/products/banana.jpg: in-scope source payload was unread and withheld from static and runtime assessment; assets/images/products/blueberry.jpg: in-scope source payload was unread and withheld from static and runtime assessment; assets/images/products/cherry.jpg: in-scope source payload was unread and withheld from static and runtime assessment; assets/images/products/durian.jpg: in-scope source payload was unread and withheld from static and runtime assessment; assets/images/products/fuji-apple.jpg: in-scope source payload was unread and withheld from static and runtime assessment; assets/images/products/golden-pineapple.jpg: in-scope source payload was unread and withheld from static and runtime assessment; assets/images/products/hami-melon.jpg: in-scope source payload was unread and withheld from static and runtime assessment; assets/images/products/kiwi.jpg: in-scope source payload was unread and withheld from static and runtime assessment; assets/images/products/mango.jpg: in-scope source payload was unread and withheld from static and runtime assessment; assets/images/products/navel-orange.jpg: in-scope source payload was unread and withheld from static and runtime assessment; assets/images/products/peach.jpg: in-scope source payload was unread and withheld from static and runtime assessment; assets/images/products/red-dragon-fruit.jpg: in-scope source payload was unread and withheld from static and runtime assessment; assets/images/products/shine-muscat.jpg: in-scope source payload was unread and withheld from static and runtime assessment; assets/images/products/strawberry.jpg: in-scope source payload was unread and withheld from static and runtime assessment; evidence/autoplan-voices/r3-ceo.log: in-scope source payload was unread and withheld from static and runtime assessment; evidence/autoplan-voices/r3-des.log: in-scope source payload was unread and withheld from static and runtime assessment; evidence/autoplan-voices/r3-dx.log: in-scope source payload was unread and withheld from static and runtime assessment; evidence/autoplan-voices/r3-eng.log: in-scope source payload was unread and withheld from static and runtime assessment; evidence/baseline-tests.txt: in-scope source payload was unread and withheld from static and runtime assessment; evidence/codex/spec-review-run.log: in-scope source payload was unread and withheld from static and runtime assessment; evidence/codex/spec-review-run2.log: in-scope source payload was unread and withheld from static and runtime assessment; evidence/codex/spec-review-run3.log: in-scope source payload was unread and withheld from static and runtime assessment; evidence/visual/home-1440.png: in-scope source payload was unread and withheld from static and runtime assessment; evidence/visual/home-390-cart.png: in-scope source payload was unread and withheld from static and runtime assessment; evidence/visual/home-390-top.png: in-scope source payload was unread and withheld from static and runtime assessment; evidence/visual/home-834.png: in-scope source payload was unread and withheld from static and runtime assessment; review.md: in-scope source payload was unread and withheld from static and runtime assessment. Exclusions: .env.example: excluded: credential or execution configuration; CLAUDE.md: excluded: credential or execution configuration.
- history-inputs: not\_assessed; bounded helper-retained Git history.
  Scope: code. Evidence: none. Gaps: Could not read bounded Git metadata: log exceeded the output limit \(request rejected\); source may not be a Git repository. Exclusions: none.
- application-model: assessed; manual static review of routes, auth/session, rate limiting, CSRF, schema and backup paths.
  Scope: code. Evidence: server/router.mjs; server/services/auth.mjs; server/auth.mjs; server/repositories/sessions.mjs; server/migrations/0001\_init.sql. Gaps: none. Exclusions: none.
- attack-surface: assessed; route census over /api, static allowlist and compose-exposed ports.
  Scope: code. Evidence: server/router.mjs; server/allowlist.mjs; docker-compose.yml; Caddyfile. Gaps: none. Exclusions: none.
- llm-agentic-mcp: not\_applicable; repository has no LLM/MCP surface.
  Scope: code. Evidence: no agent tooling in repo. Gaps: none. Exclusions: none.
- owasp-2025: partial; manual review of A01/A02/A03/A05/A07.
  Scope: code. Evidence: server/router.mjs; server/services/auth.mjs; server/services/orders.mjs. Gaps: offline run: gitleaks/osv/semgrep/trivy scanner profiles unavailable. Exclusions: none.
- stride: not\_assessed; pending investigation.
  Scope: code. Evidence: none. Gaps: Assessment has not been submitted. Exclusions: none.
- data-classification: not\_assessed; pending investigation.
  Scope: code. Evidence: none. Gaps: Assessment has not been submitted. Exclusions: none.
