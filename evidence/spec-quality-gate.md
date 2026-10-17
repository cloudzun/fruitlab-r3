# Spec Quality Gate Record

Date: 2026-10-17
Ring: 2 (`/spec`)
Status: `unavailable`
Reviewer: Claude Code outside review
Spec: `SPEC.md`
Spec SHA-256: `db846f9e0c7e10cf5ffd624285ec33548bf43838ca146e69b6c5454ea0d9b72d`

## Pre-Gate Checks

- Semantic review: `SEMANTIC_REVIEW: clean`
- Redaction scan: clean
- Redaction counts: HIGH 0, MEDIUM 0, LOW 0, WARN 0
- Final `SPEC.md` re-scan: clean with the same SHA-256
- Repository visibility resolved as `unknown` because the repository has no remote.

## Quality Gate Result

No quality score was produced. The outside reviewer returned `unavailable` before
making a Claude Code call because the active custom Anthropic endpoint requires an
explicit model ID. No substitute model or provider was used.

### Raw stdout

```json
{"status":"unavailable","provider":"claude-code","result":"","error":{"code":"custom_provider_requires_model","message":"no frontier plan-review model is set for your custom Anthropic (Claude Code) endpoint custom routing is active (ANTHROPIC_BASE_URL (C:\\Users\\cheng\\.claude\\settings.json)), so gstack will not send the public catalog ID claude-fable-5-1 to it Repair: gstack-config set model_frontier_claude <model-id-your-endpoint-serves>; export GSTACK_CLAUDE_MODEL=<model-id-your-endpoint-serves>; gstack-config set plan_review_tier host. https://github.com/garrytan/gstack/blob/main/docs/troubleshooting.md#model-policy-provider No Claude Code call was made; outside coverage is unavailable."}}
```

### Raw stderr

Empty.

### Reviewer Result Parser

stdout:

```text
VERDICT: unavailable
FINDINGS: none
REASON: execution_failed
```

stderr:

```text
Claude Code outside review unavailable: the reviewer process failed (exit 1). No review ran; this is missing coverage, not a pass. Fix: read the provider diagnosis above (auth, model, network), repair it, then re-run the review.
```

## Disposition

`SPEC.md` was written byte-for-byte from the confirmed Phase 4 draft. The quality
gate remains missing coverage, not a pass. Re-run the gate only after the Claude
Code review provider has an explicitly configured model.
