# FruitLab `/autoplan` Decision Record

Run: `main-20261017-141613`
Date: 2026-10-17
Ring: 3 (`/autoplan`)
Status: **FINAL APPROVAL GATE APPROVED AS-IS. NO BUILD STARTED.**

## Hard Constraints

- `SPEC.md` was a read-only input. Its SHA-256 after this run is `446886200D4FE3AF37F83C65504D276C5A595D7AC9BEE8C3D4A13EBD3A187B64`, unchanged from the approved 455-line specification.
- CEO, Design, DX and Eng each ran exactly one review. No failed review was sent back for a second review and no phase was rerun.
- The four phases ran in the required order: CEO -> Design -> DX -> Eng.
- Each phase made one outside Claude Code attempt. All four returned `custom_provider_requires_model` before any model call, so outside coverage is `unavailable` in every phase; none was retried.
- Final Approval Gate `gate_rev=1` approved the reviewed plan as-is with `p1a uc1a d1a`. This does not start build or claim that any implementation or manual check has passed.

## Phase Summary

| Phase | Result | Native findings | Outside voice | Consensus |
| --- | --- | --- | --- | --- |
| CEO | **7/10, FAIL / issues_open** | 4 High, 3 Medium | unavailable (`custom_provider_requires_model`) | N/A, coverage missing |
| Design | **7/10, FAIL / issues_open** | 1 Critical, 5 High, 4 Medium | unavailable (`custom_provider_requires_model`) | N/A, coverage missing |
| DX | **6/10, FAIL / issues_open** | 1 Critical, 9 High, 5 Medium | unavailable (`custom_provider_requires_model`) | N/A, coverage missing |
| Eng | **FAIL / issues_open; no numeric Eng score defined; 0 critical gaps after accepted requirements** | 11 issues; reported headline count 3 P1, 6 P2, 2 P3, detail subtotal 4 P1, 6 P2, 1 P3 | unavailable (`custom_provider_requires_model`; no model call) | N/A, coverage missing |

All phase verdicts below are the one-round native results. Accepted fixes do not convert a failed review into a pass without another review, and no such second review was run.

All four external reviews were unavailable for the same pre-call configuration error, `custom_provider_requires_model`. No Claude Code model call was made, no retry or replacement provider was used, and no phase received outside-voice consensus credit.

## Phase 1: CEO

Native result: **7/10, FAIL**. Four High and three Medium findings were recorded.

| ID | Severity | Finding | One-round disposition |
| --- | --- | --- | --- |
| F1 | High | P5 learner value remains outside the release gate. | User Challenge `U1`; not auto-decided. |
| F2 | High | P6 is in tension with the storage and manual-check complexity. | No scope change. D1-D3 remain binding and the edge cases are the evidence for those decisions. |
| F3 | High | Clean-copy evidence did not prove the evidence package itself was copied intact. | Accepted: canonical copy manifest, per-file SHA-256, copied-directory checks and local-link validation. |
| F4 | High | The no-blocking-gate narrative was underdesigned. | Accepted: one concrete D1-or-D3 decision-to-evidence walkthrough and an honest no-block explanation. |
| F5 | Medium | D1-D3 lacked an explicit reopening rule. | Retained: stop and return to spec review rather than silently substituting another approach. |
| F6 | Medium | Node 18 is not an appropriate minimum. | Accepted: Node.js 22+ and record the actual tested Node and Chromium versions. |
| F7 | Medium | Competitive advantage is thinner than assumed. | No product change; addressed by the concrete case study and factual evidence narrative. |

Accepted CEO obligations also include treating catalog and stored-order strings as text, never HTML, and proving the behavior in manual check M18. No CEO finding requires a new product decision.

### `U1`: P5 learner-value validation

**Decision needed from the user. This is not auto-decided.**

Recommendation: **A** for this delivery. Keep P5 explicitly `UNVERIFIED`; schedule a learner check later if the teaching claim matters beyond the local demo.

| Option | Completeness | Pros | Cons |
| --- | ---: | --- | --- |
| A. Keep P5 `UNVERIFIED` and publish the demo | 6/10 | Preserves the approved scope and schedule; no fabricated teaching claim is made; evidence stays honest. | The deliverable cannot claim verified teaching value; the main product premise remains assumed. |
| B. Make two learner observations a release condition | 9/10 | Forces the teaching claim to be tested before release; gives a clear gate and evidence target. | Requires learner access and coordination; can block delivery for reasons outside the codebase. |
| C. Run a lightweight two-learner validation before handoff | 10/10 | Produces direct evidence for the teaching premise; exposes confusing copy or workflow before the final demo. | Adds time and a manual process; should happen only after a runnable build exists. |

## Phase 2: Design

Native result: **7/10, FAIL / issues_open**. The score moved from 3/10 before fixes to 7/10 after the one-round dispositions. Ten findings were recorded: 1 Critical, 5 High and 4 Medium.

| ID | Severity | Finding | One-round disposition |
| --- | --- | --- | --- |
| DF1 | Critical | A successful write could be reported as not saved after strict readback failed, inviting a duplicate order. | Accepted: distinguish `saved`, `not-written`, `duplicate-order-number` and `save-unknown`; retain the cart and lock retry after an unknown write. |
| DF2 | High | The cart lacked line totals, a persistent total and primary checkout hierarchy. | Accepted: row math, persistent `合计`, and checkout directly below it. |
| DF3 | High | Mobile add had no immediate feedback and the cart could be far below the catalog. | Accepted: per-item confirmation, live-region feedback and a compact sticky cart below 720px. |
| DF4 | High | Lookup was buried and had no focus or scroll contract. | Accepted: top-level `查订单`, focus the result heading after query, and clear stale results on input. |
| DF5 | High | Module-load failure and no-JavaScript states were unspecified. | Accepted: boot status, `<noscript>` copy, disabled controls and explicit load-failure text. |
| DF6 | High | Success receipts and lookup results could remain visible after becoming stale. | Accepted: hide receipts on cart mutation and each new checkout attempt; clear lookup results on input. |
| DF7 | Medium | Local order-number time and canonical UTC receipt time could be misread. | Accepted: show local time prominently plus canonical UTC. |
| DF8 | Medium | The visual direction was generic for ten text-heavy fruit cards. | Taste decision `DV1` remains open for the user. |
| DF9 | Medium | Corrupt-data and storage warnings lacked ownership and lifecycle. | Accepted: dedicated storage notice, refresh after reads/appends, preserve still-valid warnings. |
| DF10 | Medium | Copy feedback, quantity boundaries, lookup idle state and ARIA error associations were missing. | Accepted: explicit copy results, 1/99 disabled boundaries, idle copy, `aria-invalid` and `aria-describedby`. |

Design did not pass because `DV1` remains unresolved. The report explicitly states that no external font, image, CDN or network request is allowed.

### `DV1`: Visual direction

**Decision needed from the user. This is not auto-decided.**

Recommendation: **A**. A hand-lettered fruit-stall identity is the most specific to this local teaching demo and gives the ten text-heavy cards a recognizable voice without external assets.

All options must use local CSS and locally available system fonts only. None may load a web font, and `system-ui` must not be the primary display font.

| Option | Completeness | Pros | Cons |
| --- | ---: | --- | --- |
| A. Handwritten fruit-stall signage | 8/10 | Strong local-market identity; local Chinese Kai or writing fonts, paper texture and seal-like fruit silhouettes fit the demo; distinctive against generic AI layouts. | Chinese Kai font availability varies by OS; uneven letterforms can hurt price and quantity legibility if overused. |
| B. Modern produce magazine | 8/10 | Serif headline plus sans-serif body creates clear hierarchy; editorial grid suits ten text-heavy cards; system serif stacks are relatively reliable. | Can feel upmarket or generic; less directly connected to a neighborhood fruit stall. |
| C. Retro market ticket | 7/10 | Ticket and label shapes make prices and order states feel physical; sticker-like fruit motifs create a playful demo identity. | Decorative shapes add CSS complexity and risk cramped 360px layouts; novelty can compete with checkout clarity. |

## Phase 2.5: DX

Native result: **6/10, FAIL / issues_open**. Fifteen native findings were recorded: 1 Critical, 9 High and 5 Medium. The persisted disposition table also contains DX16 as an additional state-transition clarification; it does not change the native count.

| ID | Severity | Finding | One-round disposition |
| --- | --- | --- | --- |
| DX1 | Critical | `save-unknown` could be retried immediately and duplicate an order whose write outcome was unknown. | Accepted: block retry until healthy storage proves the order absent; otherwise require inspection or human escalation. |
| DX2 | High | The CLI lacked help, port override, version, unknown-argument behavior and actionable port-conflict output. | Accepted: keep `node serve.mjs`, add `--help`, `--port`, `--version`, exit 2 for bad arguments and print a safe conflict command. |
| DX3 | High | HTTP 404, 405, traversal and file-read failures lacked a complete response and recovery contract. | Accepted: one problem+json body, `Allow` on 405, 404 for traversal and a redacted 500 trace. |
| DX4 | High | Storage access, quota and security failures collapsed into generic retry copy. | Accepted: distinct stable codes and actionable remedies. |
| DX5 | High | `duplicate-order-number` had no checkout UI or bounded recovery. | Accepted: regenerate within the fixed budget, preserve the cart and expose a stable code after exhaustion. |
| DX6 | High | The cart remained mutable during `save-unknown` and the order number was not copyable. | Accepted: freeze the attempted snapshot and cart controls, make the number copyable and resolve only against that snapshot. |
| DX7 | High | Corrupt and duplicate storage warnings offered no safe manual recovery. | Accepted: backup/export raw storage before inspection or removal; no automatic repair. |
| DX8 | High | Invalid-input contracts were missing for most exported domain functions. | Accepted: define accepted types, exact failure shape and tests for every exported function. |
| DX9 | High | Module-load failures before `app.mjs` could not update boot status or provide a trace. | Accepted: a small classic-script error handler before the module; keep controls disabled. |
| DX10 | High | Canonical order and money examples contradicted `validateOrder` and the catalog. | Accepted: replace examples with valid catalog data and add sample-consistency tests. |
| DX11 | Medium | Stable error codes were absent across UI, HTTP and domain surfaces. | Accepted: one error catalog mapping code, surface, message, fix, recovery, side effects, retry policy and doc anchor. |
| DX12 | Medium | Malformed lookup input was reported as not found. | Accepted: validate format before storage access and show the expected format with an example. |
| DX13 | Medium | Manual failure checks M11, M12, M18 and M19 were not reproducible. | Accepted: self-contained setup, backup and restore snippets. |
| DX14 | Medium | Reset instructions omitted the served origin, backup and irreversibility. | Accepted: document all three beside the reset command. |
| DX15 | Medium | Node compatibility and readiness were documentation-only. | Accepted: Node.js 22+ preflight with a stable code and ready URL printed after bind. |

No new taste decision was created by DX. The 15 findings were treated as implementation and recovery obligations, not as permission to expand into a developer platform.

## Phase 3: Eng

Native result: **FAIL / issues_open**. No numeric Eng score is defined. The native voice reported 11 issues. The persisted detail sections show an internal severity subtotal of 4 P1, 6 P2 and 1 P3, while the native summary line says 3 P1, 6 P2 and 2 P3. This discrepancy is recorded without a second review, as required by the one-round constraint.

### Accepted Findings E1-E11

| ID | Finding | Accepted engineering decision |
| --- | --- | --- |
| E1 | `save-unknown` had mutually exclusive recovery rules. | Make the frozen attempted state canonical. Retry is allowed only after healthy storage and a definitive absence proof. |
| E2 | The canonical order and money examples were invalid. | Use two Fuji apples at 1299 cents and one banana at 899 cents: subtotal `3497` cents, display `¥34.97`; add a catalog-consistency assertion. |
| E3 | The storage outcome taxonomy and precedence were not frozen. | Freeze `saved \| not-written \| duplicate-order-number \| save-unknown`, with stable codes and explicit precedence for access, write, readback and uniqueness failures. |
| E4 | Checkout and lookup state transitions were manual-only. | Extract a DOM-independent reducer/controller and test saving, unknown writes, exact match, proven absence, malformed, duplicate, corrupt, unavailable and inconclusive states with `node:test`. |
| E5 | Static serving had no public-file allowlist or cross-platform path policy. | Serve only an explicit project-root allowlist. Reject dotfiles, backslashes, NUL, encoded separators, mixed-case traversal, query variants and symlink escapes. |
| E6 | HTTP and CLI edge behavior was only partially delegated. | Export a server factory, test on port `0`, and freeze bodyless HEAD, 405 `Allow`, exact MIME values, problem+json objects, no-store, redacted 500 responses, exit codes and child-process cleanup. |
| E7 | Public domain and storage contracts were not exact. | Freeze every exported signature, accepted type, exact error class/message or result shape, and `duplicateNumbers: string[]`; add `docs/error-catalog.md`. |
| E8 | Malformed lookup was absent from the normative lookup contract. | Add a distinct malformed state before storage access with the exact message `订单号格式不正确，应为 FL-YYYYMMDD-HHMMSS-XXXX，例如 FL-20261017-131500-A7K2`. |
| E9 | The clean-run hash was self-referential. | Generate `evidence/clean-run.sha256` last, exclude the manifest itself, cover every canonical copied file and verify it from the copied directory. |
| E10 | The assertion count was a weak coverage proxy. | Replace it with a named branch matrix covering every exported function, result code, storage transition, server route/error and the NDJSON matrix, plus a static scan rejecting `innerHTML`, `outerHTML`, `insertAdjacentHTML` and `document.write`. |
| E11 | Oversized stored records had no resource envelope. | Limit an order to 10 items, bound strings and each NDJSON line, require safe-integer arithmetic and count over-limit records as invalid without deleting raw bytes. |

### Eng Implementation Constraints

- **Save-unknown is a hard freeze.** Preserve the cart, attempted snapshot and generated order number. Disable cart mutation and checkout. Malformed, duplicate, unavailable or inconclusive lookup results keep the frozen state. The old confirmation-based retry path is superseded.
- **Storage outcomes are precedence-based.** A pre-write access/read failure or atomic `setItem` failure is `not-written`. A successful write followed by readback throw, mismatch or failed uniqueness is `save-unknown`. Exact expected readback with one valid occurrence is `saved`.
- **The domain must be testable without a DOM.** The checkout/lookup reducer is independent of browser APIs; Chromium checks remain for DOM wiring, focus and clipboard behavior.
- **The server is a security boundary.** Use an explicit allowlist and realpath containment, not prefix checks. Add `X-Content-Type-Options: nosniff` and a restrictive CSP.
- **Errors must be machine-readable and human-recoverable.** The error catalog must cover UI, HTTP and domain surfaces, including side effects, retry policy, redaction and documentation anchors.
- **Stored data bounds are part of validation.** At most 10 items per order; `fruitId` at most 64 UTF-16 code units and matching `^[a-z0-9]+(?:-[a-z0-9]+)*$`; `name` at most 80; `unit` at most 32; each NDJSON line at most 16,384 UTF-16 code units.
- **Evidence must be reproducible without a self-hash.** The clean-run manifest is generated after all recorded files are final and verifies the copied directory.
- **Manual verification remains required.** D1 still excludes automated DOM/browser testing. Real Chromium storage, clipboard, focus, responsive layout and learner comprehension remain manual or unverified.

After these accepted changes, Eng reports **0 critical gaps**. Residual risks are the missing outside voice, manual-only browser coverage, and P5 remaining `UNVERIFIED`. Eng created no new user decision.

## Accepted Phase Artifacts

| Artifact | Path / identity |
| --- | --- |
| Active plan | `.gstack/tmp/autoplan/main-autoplan-active-20261017-141613.md` |
| Eng review input | `.gstack/tmp/autoplan/autoplan-eng-4hdgnZ/eng-implementation.md` |
| Eng close packet | `.gstack/tmp/autoplan/autoplan-eng-SlEQA2/close-packet.md` |
| Eng close-packet SHA-256 | `3ade6da41d27b9ce1cf84df922f4641e30ea313f2daf1ed5f99b0b191faaba6a` |
| Eng test plan | `C:\Users\cheng\.gstack\projects\r1-fruitlab\cheng-main-eng-review-test-plan-20261017-150224.md` |
| Eng test-plan SHA-256 | `4DABF10D329854D0A4847A08E8676FA4AAB4260568CD6814292034F66946B92D` |
| Outside CEO result | `.gstack/tmp/autoplan/outside-ceo-result.json` |
| Outside Design result | `.gstack/tmp/autoplan/outside-design-result.json` |
| Outside DX result | `.gstack/tmp/autoplan/outside-dx-result.json` |
| Outside Eng result | `.gstack/tmp/autoplan/outside-eng-result.json` |
| Final Gate list | `.gstack/tmp/autoplan/gate.json` |
| Final Gate decisions | `.gstack/tmp/autoplan/decisions.jsonl` |

## Final Approval Gate

Gate revision: `1`. Displayed reply hash: `10ccc97994ef`. User reply: `p1a uc1a d1a`. The reply parsed with zero pending items and zero unparsed tokens.

Result: **APPROVED AS-IS. No phase rerun. No build started.**

| Gate item | User decision | Recorded effect |
| --- | --- | --- |
| P1 Plan approval | **A. Approve as-is** | Approved the reviewed plan together with all accepted CEO, Design, DX and Eng obligations. No override, interrogation, phase rerun or rejection was selected. |
| U1 P5 learner-value validation | **A. Keep P5 `UNVERIFIED` and publish** | P5 remains `UNVERIFIED`. Two learner observations are not a release condition, and no learner validation is added to this round. The teaching premise remains an explicit residual risk. |
| DV1 Visual direction | **A. Handwritten fruit-stall signage** | The build must use a handwritten fruit-stall identity with local CSS and locally available Chinese Kai or writing fonts only. It must not load web fonts, images, CDNs or other network assets, and `system-ui` must not be the primary display face. |

### Four-Phase Result At Gate

| Phase | Native score | Gate-time status | Critical gaps | External review | Consensus |
| --- | --- | --- | --- | --- | --- |
| CEO | **7/10** | **FAIL / issues_open** | Not scored separately; 4 High and 3 Medium findings retained | **unavailable** (`custom_provider_requires_model`) | N/A, outside coverage missing |
| Design | **7/10** | **FAIL / issues_open** | Not scored separately; 1 Critical, 5 High and 4 Medium findings retained | **unavailable** (`custom_provider_requires_model`) | N/A, outside coverage missing |
| DX | **6/10** | **FAIL / issues_open** | Not scored separately; 1 Critical, 9 High and 5 Medium findings retained | **unavailable** (`custom_provider_requires_model`) | N/A, outside coverage missing |
| Eng | **No numeric Eng score defined** | **FAIL / issues_open** | **0 critical gaps after accepted requirements** | **unavailable** (`custom_provider_requires_model`; no model call) | N/A, outside coverage missing |

These are the original one-round native results. Gate approval accepts the plan and its recorded obligations; it does not rewrite `FAIL / issues_open` into a pass and does not create outside-review coverage.

### Eng Count Discrepancy Preserved

The Eng report remains internally inconsistent in its title count and detail subtotal:

- Headline count: **3 P1, 6 P2, 2 P3**.
- Detail subtotal: **4 P1, 6 P2, 1 P3**.
- Both counts total 11 findings.

This discrepancy is recorded exactly as reported. It was not normalized, silently corrected or hidden by a rerun. Eng has no numeric score, and the accepted requirements leave **0 critical gaps**.

### Final Disposition

The `/autoplan` plan is approved for the next ring with:

- P5 still `UNVERIFIED`.
- The handwritten fruit-stall visual direction selected.
- All accepted CEO, Design, DX and Eng obligations intact.
- Eng's headline/detail count discrepancy preserved.
- All four outside reviews recorded as unavailable.
- No build work started in this ring.
