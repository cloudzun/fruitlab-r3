partial — code
Status: partial. Some required coverage is missing; findings below cover only the assessed part.
Ran: snapshot-inputs (partial); application-model (assessed); attack-surface (assessed); owasp-2025 (partial). Missing: snapshot-inputs (partial); history-inputs (not\_assessed); owasp-2025 (partial); stride (not\_assessed); data-classification (not\_assessed).
Reason: history-inputs: not assessed; stride: not assessed; data-classification: not assessed; assets/images/products/banana.jpg: in-scope source payload was unread and withheld from static and runtime assessment; assets/images/products/blueberry.jpg: in-scope source payload was unread and withheld from static and runtime assessment; assets/images/products/cherry.jpg: in-scope source payload was unread and withheld from static and runtime assessment; assets/images/products/durian.jpg: in-scope source payload was unread and withheld from static and runtime assessment; assets/images/products/fuji-apple.jpg: in-scope source payload was unread and withheld from static and runtime assessment; assets/images/products/golden-pineapple.jpg: in-scope source payload was unread and withheld from static and runtime assessment; assets/images/products/hami-melon.jpg: in-scope source payload was unread and withheld from static and runtime assessment; assets/images/products/kiwi.jpg: in-scope source payload was unread and withheld from static and runtime assessment; assets/images/products/mango.jpg: in-scope source payload was unread and withheld from static and runtime assessment; assets/images/products/navel-orange.jpg: in-scope source payload was unread and withheld from static and runtime assessment; assets/images/products/peach.jpg: in-scope source payload was unread and withheld from static and runtime assessment; assets/images/products/red-dragon-fruit.jpg: in-scope source payload was unread and withheld from static and runtime assessment; assets/images/products/shine-muscat.jpg: in-scope source payload was unread and withheld from static and runtime assessment; assets/images/products/strawberry.jpg: in-scope source payload was unread and withheld from static and runtime assessment; evidence/visual/home-1440.png: in-scope source payload was unread and withheld from static and runtime assessment; evidence/visual/home-390-cart.png: in-scope source payload was unread and withheld from static and runtime assessment; evidence/visual/home-390-top.png: in-scope source payload was unread and withheld from static and runtime assessment; evidence/visual/home-834.png: in-scope source payload was unread and withheld from static and runtime assessment; Could not read bounded Git metadata: log exceeded the output limit \(request rejected\); source may not be a Git repository; scanner profiles unavailable offline; Assessment has not been submitted.
Next: start a new /cso audit after resolving the reasons above; run `gstack-cso doctor --repo <repo>` to check prerequisites.
Run: 1792288145456-eef57b00cf6a29bb. Mode: daily.
Timing: started 2026-10-18T01:49:05.435Z; deadline 2026-10-18T01:59:05.435Z; terminal 2026-10-18T01:49:30.727Z; elapsed 25292 ms.
Material gaps: history-inputs: not assessed; stride: not assessed; data-classification: not assessed; assets/images/products/banana.jpg: in-scope source payload was unread and withheld from static and runtime assessment; assets/images/products/blueberry.jpg: in-scope source payload was unread and withheld from static and runtime assessment; assets/images/products/cherry.jpg: in-scope source payload was unread and withheld from static and runtime assessment; assets/images/products/durian.jpg: in-scope source payload was unread and withheld from static and runtime assessment; assets/images/products/fuji-apple.jpg: in-scope source payload was unread and withheld from static and runtime assessment; assets/images/products/golden-pineapple.jpg: in-scope source payload was unread and withheld from static and runtime assessment; assets/images/products/hami-melon.jpg: in-scope source payload was unread and withheld from static and runtime assessment; assets/images/products/kiwi.jpg: in-scope source payload was unread and withheld from static and runtime assessment; assets/images/products/mango.jpg: in-scope source payload was unread and withheld from static and runtime assessment; assets/images/products/navel-orange.jpg: in-scope source payload was unread and withheld from static and runtime assessment; assets/images/products/peach.jpg: in-scope source payload was unread and withheld from static and runtime assessment; assets/images/products/red-dragon-fruit.jpg: in-scope source payload was unread and withheld from static and runtime assessment; assets/images/products/shine-muscat.jpg: in-scope source payload was unread and withheld from static and runtime assessment; assets/images/products/strawberry.jpg: in-scope source payload was unread and withheld from static and runtime assessment; evidence/visual/home-1440.png: in-scope source payload was unread and withheld from static and runtime assessment; evidence/visual/home-390-cart.png: in-scope source payload was unread and withheld from static and runtime assessment; evidence/visual/home-390-top.png: in-scope source payload was unread and withheld from static and runtime assessment; evidence/visual/home-834.png: in-scope source payload was unread and withheld from static and runtime assessment; Could not read bounded Git metadata: log exceeded the output limit \(request rejected\); source may not be a Git repository; scanner profiles unavailable offline; Assessment has not been submitted.

Application model:
- Actors: anonymous visitor; authenticated user \(userA/userB\); admin.
- Assets: products database; orders database; sessions; user credentials.
- Entrypoints: GET /api/products; POST /api/auth/register; POST /api/auth/login; POST /api/auth/logout; GET /api/auth/me; POST /api/orders; GET /api/orders/mine; GET /api/orders/\{orderNumber\}; GET /api/admin/orders; GET /api/admin/products; PATCH /api/admin/products/\{id\}; GET /api/health.
- Tenant boundaries: order.user\_id ownership; role admin vs user.
- Sensitive operations: read order by number; admin price/stock/listing update; session issuance.
- Security invariants: users can only read own orders; admin mutations require admin role; passwords stored as scrypt hash; stock never negative.

Supported findings:
- MEDIUM Login timing side channel enables username enumeration [7aa3eaa0c3c167a14de5bb9c4f2e7f9d]
  Location: server/router.mjs:145 (findUserByUsername / verifyPassword). Confidence: high — Direct source reading; scrypt runs only for existing users, a measurable difference. No runtime measurement performed in this offline static run.. Evidence: supported.
  Attacker scenario: POST login for candidate usernames and compare latency; valid names take scrypt time, invalid names return immediately.
  Attacker control: Chosen username on POST /api/auth/login. Impact: Attacker can distinguish valid usernames and build an account list for credential stuffing..
  Trace: POST /api/auth/login; router login handler; findUserByUsername then verifyPassword. Supporting references: server/router.mjs:144-145; server/auth.mjs verifyPassword.
  Counterevidence considered: rate limiting absent, so attacker can sample repeatedly. Challenge: independent\_agent by codex-second-agent. Conclusion: survives challenge; message equality does not hide timing.
  Repair recommendation: Always perform a scrypt verification against a dummy hash when the user is missing, and compare with timing-safe equality.
  Reproduction: not\_attempted. Repair: not\_attempted. Closure: open.
- MEDIUM No login rate limiting or account lockout [4d82eec4c036df0e744c0de0660cc7c4]
  Location: server/router.mjs:140 (POST /api/auth/login). Confidence: high — No rate-limit middleware exists; SPEC/PRD explicitly excludes it.. Evidence: supported.
  Attacker scenario: Concurrent login attempts against userA with a password wordlist.
  Attacker control: Unlimited POST /api/auth/login requests. Impact: Online password guessing is unbounded; weak demo passwords are trivially brute-forced..
  Trace: POST /api/auth/login; router login handler; verifyPassword. Supporting references: server/router.mjs login block; DECISIONS.md Known boundary.
  Counterevidence considered: PRD states this is out of scope; still a real weakness for any non-local use. Challenge: independent\_agent by codex-second-agent. Conclusion: survives challenge as a scoped limitation.
  Repair recommendation: Add bounded per-account/IP rate limiting and backoff before shipping outside a local demo.
  Reproduction: not\_attempted. Repair: not\_attempted. Closure: open.
- MEDIUM Sessions never expire and are not revocable except logout [33600ae03de640bf67e1d9b9e6cd563b]
  Location: server/db.mjs:91 (CREATE TABLE sessions). Confidence: high — Schema and createSession show no expiry field or cleanup.. Evidence: supported.
  Attacker scenario: Copy fruitlab\_session cookie from a logged-in browser and reuse it days later.
  Attacker control: Stolen session cookie \(e.g., from a shared machine or log\). Impact: A stolen token remains valid until explicit logout, indefinitely..
  Trace: any authenticated endpoint; getSessionUser; sessions table. Supporting references: server/db.mjs sessions; server/auth.mjs createSession.
  Counterevidence considered: PRD excludes expiry; local-only demo lowers exposure. Challenge: independent\_agent by codex-second-agent. Conclusion: survives challenge as a scoped limitation.
  Repair recommendation: Add expires\_at, enforce it on lookup, clean up expired rows, and document rotation.
  Reproduction: not\_attempted. Repair: not\_attempted. Closure: open.
- LOW Order ownership rejection discloses order-number existence [1b5825bce237bce1050bc80401cdd097]
  Location: server/router.mjs:189 (order-not-owned). Confidence: high — Response codes differ by existence; documented tradeoff D-32.. Evidence: supported.
  Attacker scenario: Iterate candidate FL-... numbers; 403 means exists, 404 means not.
  Attacker control: Guessed order numbers with a valid session. Impact: Attacker can confirm whether an order number exists \(limited enumeration\)..
  Trace: GET /api/orders/\{orderNumber\}; getOrderByNumber; ownership check. Supporting references: server/router.mjs:189; DECISIONS.md D-32.
  Counterevidence considered: D-32 records this as an intentional classroom tradeoff. Challenge: independent\_agent by codex-second-agent. Conclusion: survives challenge; accepted risk, not a functional bug.
  Repair recommendation: Return 404 for other users' orders if existence disclosure matters; keep 403 only if teaching requires it and document the tradeoff.
  Reproduction: not\_attempted. Repair: not\_attempted. Closure: open.

Snapshot transformations:
- CLAUDE.md: excluded: credential or execution configuration
- DECISIONS.md: secret spans redacted
- NEXT-SESSION-PROMPT.md: secret spans redacted
- PRD-R2.md: secret spans redacted
- R1-八环讲解记录.md: secret spans redacted
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
- docs/api.md: secret spans redacted
- docs/assets-credits.md: secret spans redacted
- evidence/assets-manifest.json: secret spans redacted
- evidence/autoplan-voices/ceo.txt: secret spans redacted
- evidence/autoplan-voices/design.txt: secret spans redacted
- evidence/autoplan-voices/dx.txt: secret spans redacted
- evidence/autoplan-voices/eng.txt: secret spans redacted
- evidence/index.md: secret spans redacted
- evidence/ring-build.md: secret spans redacted
- evidence/ring-ship.md: secret spans redacted
- evidence/ring-spec.md: secret spans redacted
- evidence/toolchain-recon.md: secret spans redacted
- evidence/visual/home-1440.png: withheld: binary or redaction failed
- evidence/visual/home-390-cart.png: withheld: binary or redaction failed
- evidence/visual/home-390-top.png: withheld: binary or redaction failed
- evidence/visual/home-834.png: withheld: binary or redaction failed
- retro.md: secret spans redacted
- tests/app.test.mjs: secret spans redacted
- tests/controller.test.mjs: secret spans redacted

Coverage:
- snapshot-inputs: partial; fail-closed captured source inventory.
  Scope: code. Evidence: 95 sanitized execution inputs captured; 1 explicit non-executable exclusion; 18 unread in-scope inputs; 0 tracked deletions. Gaps: assets/images/products/banana.jpg: in-scope source payload was unread and withheld from static and runtime assessment; assets/images/products/blueberry.jpg: in-scope source payload was unread and withheld from static and runtime assessment; assets/images/products/cherry.jpg: in-scope source payload was unread and withheld from static and runtime assessment; assets/images/products/durian.jpg: in-scope source payload was unread and withheld from static and runtime assessment; assets/images/products/fuji-apple.jpg: in-scope source payload was unread and withheld from static and runtime assessment; assets/images/products/golden-pineapple.jpg: in-scope source payload was unread and withheld from static and runtime assessment; assets/images/products/hami-melon.jpg: in-scope source payload was unread and withheld from static and runtime assessment; assets/images/products/kiwi.jpg: in-scope source payload was unread and withheld from static and runtime assessment; assets/images/products/mango.jpg: in-scope source payload was unread and withheld from static and runtime assessment; assets/images/products/navel-orange.jpg: in-scope source payload was unread and withheld from static and runtime assessment; assets/images/products/peach.jpg: in-scope source payload was unread and withheld from static and runtime assessment; assets/images/products/red-dragon-fruit.jpg: in-scope source payload was unread and withheld from static and runtime assessment; assets/images/products/shine-muscat.jpg: in-scope source payload was unread and withheld from static and runtime assessment; assets/images/products/strawberry.jpg: in-scope source payload was unread and withheld from static and runtime assessment; evidence/visual/home-1440.png: in-scope source payload was unread and withheld from static and runtime assessment; evidence/visual/home-390-cart.png: in-scope source payload was unread and withheld from static and runtime assessment; evidence/visual/home-390-top.png: in-scope source payload was unread and withheld from static and runtime assessment; evidence/visual/home-834.png: in-scope source payload was unread and withheld from static and runtime assessment. Exclusions: CLAUDE.md: excluded: credential or execution configuration.
- history-inputs: not\_assessed; bounded helper-retained Git history.
  Scope: code. Evidence: none. Gaps: Could not read bounded Git metadata: log exceeded the output limit \(request rejected\); source may not be a Git repository. Exclusions: none.
- application-model: assessed; manual static review of routes, auth and schema.
  Scope: code. Evidence: server/router.mjs; server/auth.mjs; server/db.mjs. Gaps: none. Exclusions: none.
- attack-surface: assessed; route census over /api endpoints.
  Scope: code. Evidence: server/router.mjs. Gaps: none. Exclusions: none.
- llm-agentic-mcp: not\_applicable; repository has no LLM/MCP surface.
  Scope: code. Evidence: no agent tooling in repo. Gaps: none. Exclusions: none.
- owasp-2025: partial; manual review of A01/A02/A03/A07/A05.
  Scope: code. Evidence: server/router.mjs; server/auth.mjs; server/orders.mjs. Gaps: scanner profiles unavailable offline. Exclusions: none.
- stride: not\_assessed; pending investigation.
  Scope: code. Evidence: none. Gaps: Assessment has not been submitted. Exclusions: none.
- data-classification: not\_assessed; pending investigation.
  Scope: code. Evidence: none. Gaps: Assessment has not been submitted. Exclusions: none.
