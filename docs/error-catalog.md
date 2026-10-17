# FruitLab Error Catalog

This catalog is the single reference for stable error codes exposed by the UI/controller, order store, domain boundary, static server, and CLI.

Status values and user-facing copy are intentionally separate from internal codes. Raw storage, filesystem paths, exception messages, and stack traces are never rendered in the page or returned in HTTP problem details.

## Outcome Model

Order append uses this precedence:

| Result | Meaning | Side effect |
| --- | --- | --- |
| `saved` | Exact expected NDJSON was read back and the new order occurred exactly once | New bytes appended; checkout may clear the cart |
| `not-written` | Failure happened before a write was confirmed | Existing storage bytes unchanged; cart preserved |
| `duplicate-order-number` | The candidate number already belongs to a valid stored order | Existing storage bytes unchanged; cart preserved |
| `save-unknown` | A write may have happened, but readback or uniqueness could not be confirmed | Cart and attempted snapshot frozen; retry blocked |

## Checkout and Store Codes

### `order-saved`

- Surface: checkout result / lookup result
- Meaning: the order was appended and strictly verified.
- User text: receipt heading `果子票开好了`; lookup status `订单已找到`.
- Fix: none.
- Recovery: copy or select the order number; refresh and query it.
- Side effect: the in-memory cart is cleared only after this result.
- Retry: not applicable.
- Redaction: no raw storage is shown.
- Native channel: DOM receipt plus `role="status"` live text.
- Documentation anchor: `#order-saved`

### `cart-empty`

- Surface: checkout controller
- Meaning: checkout was requested with no cart lines.
- User text: `购物车为空`.
- Fix: add at least one fruit.
- Recovery: retry after adding a fruit.
- Side effect: no order number is generated and storage is untouched.
- Retry: allowed after the cart changes.
- Redaction: no storage data is shown.
- Native channel: checkout status region.
- Documentation anchor: `#cart-empty`

### `domain-invalid-order`

- Surface: checkout / order store
- Meaning: the in-memory cart could not produce an order that passes the domain contract.
- User text: `订单未保存，请重试`.
- Fix: remove invalid cart state, refresh the page, and rebuild the cart.
- Recovery: inspect quantity values and retry only from a valid cart.
- Side effect: cart preserved; storage unchanged.
- Retry: allowed after the cart is corrected.
- Redaction: validation details are internal and are not copied into the page.
- Native channel: checkout status region.
- Documentation anchor: `#domain-invalid-order`

### `storage-unavailable`

- Surface: order store / lookup / checkout
- Meaning: `localStorage` is missing or inaccessible without a more specific `SecurityError` or quota signal.
- User text: lookup `本地订单存储不可用`; checkout `订单未保存，请重试。本地订单存储不可用，请检查站点数据权限后重试。`
- Fix: leave private browsing or restricted-storage mode; allow site data for `127.0.0.1`.
- Recovery: refresh after storage becomes readable.
- Side effect: cart browsing and mutation remain available; no order is confirmed.
- Retry: checkout may be retried after a healthy storage read.
- Redaction: exception text is not displayed.
- Native channel: checkout status, storage notice, lookup status.
- Documentation anchor: `#storage-unavailable`

### `storage-security-blocked`

- Surface: order store / storage notice
- Meaning: the browser raised a security-class storage error.
- User text: storage notice `浏览器阻止了本地订单存储。请允许本站使用站点数据后刷新。`; checkout `订单未保存，请重试。浏览器阻止了本地订单存储，请允许本站使用站点数据后刷新。`
- Fix: allow site data for the served origin and disable blocking extensions for the demo.
- Recovery: refresh and confirm the storage notice clears.
- Side effect: cart remains editable; no false success is shown.
- Retry: allowed only after storage access succeeds.
- Redaction: browser exception details remain local.
- Native channel: storage notice and checkout status.
- Documentation anchor: `#storage-security-blocked`

### `storage-quota-exceeded`

- Surface: order store / storage notice
- Meaning: the browser reported a quota-class failure.
- User text: storage notice `本地订单存储空间已满。请先导出并检查现有订单数据。`; checkout `订单未保存，请重试。本地订单存储空间已满，请先导出并检查现有订单数据。`
- Fix: export the raw key, inspect it, and remove only data you intentionally choose to discard.
- Recovery: retry after storage capacity is restored.
- Side effect: existing bytes are not automatically deleted or repaired.
- Retry: allowed after manual cleanup and a successful storage read.
- Redaction: no exception text is rendered.
- Native channel: storage notice and checkout status.
- Documentation anchor: `#storage-quota-exceeded`

### `storage-write-failed`

- Surface: order store
- Meaning: `setItem` failed without a recognized quota or security name.
- User text: `订单未保存，请重试。请检查浏览器存储权限和可用空间后重试。`
- Fix: inspect browser storage permissions and available site data.
- Recovery: retry after storage access/write recovers.
- Side effect: `not-written`; cart and prior raw bytes are preserved.
- Retry: allowed.
- Redaction: exception text is not displayed.
- Native channel: checkout status.
- Documentation anchor: `#storage-write-failed`

### `storage-read-failed`

- Surface: order store / lookup / checkout
- Meaning: the stored value is not a string.
- User text: lookup falls back to `本地订单存储不可用`; checkout `订单未保存，请重试。本地订单数据不是文本，无法读取，原始值未被修改。`; storage notice explains the value is not text.
- Fix: export or inspect the raw value manually; do not let the app rewrite it.
- Recovery: restore a valid string value or intentionally remove the key after backup.
- Side effect: no write occurs.
- Retry: lookup can be retried after manual repair.
- Redaction: raw value is not echoed into the UI.
- Native channel: storage notice and lookup status.
- Documentation anchor: `#storage-read-failed`

### `storage-readback-failed`

- Surface: order store
- Meaning: `setItem` returned, but the readback threw or was not text.
- User text: `订单可能已保存，请先查询订单号，不要重复提交`.
- Fix: query the displayed order number; if the store remains inaccessible, inspect the original storage manually.
- Recovery: only an exact matching order or a healthy-storage absence proof resolves the state.
- Side effect: `save-unknown`; cart and attempted snapshot frozen.
- Retry: blocked until explicit resolution.
- Redaction: no readback exception is rendered.
- Native channel: checkout status, unknown-actions panel, lookup.
- Documentation anchor: `#storage-readback-failed`

### `storage-readback-mismatch`

- Surface: order store
- Meaning: the value read after `setItem` did not exactly equal the expected append result.
- User text: `订单可能已保存，请先查询订单号，不要重复提交`.
- Fix: query the displayed order number and inspect raw storage if it is still ambiguous.
- Recovery: exact snapshot match resolves as saved; clean absence permits retry.
- Side effect: `save-unknown`; cart frozen.
- Retry: blocked until resolution.
- Redaction: expected and actual strings are not rendered wholesale.
- Native channel: checkout status, unknown-actions panel.
- Documentation anchor: `#storage-readback-mismatch`

### `storage-readback-duplicate`

- Surface: order store
- Meaning: the readback parsed but the new order number occurred more than once.
- User text: `订单可能已保存，请先查询订单号，不要重复提交`, followed by duplicate-storage guidance.
- Fix: back up the raw key and inspect duplicate records before manual cleanup.
- Recovery: the frozen state is inconclusive while duplicates remain.
- Side effect: `save-unknown`; cart frozen.
- Retry: blocked.
- Redaction: no full order body is shown in the error.
- Native channel: checkout status and storage notice.
- Documentation anchor: `#storage-readback-duplicate`

### `storage-readback-invalid`

- Surface: order store
- Meaning: the readback failed the second validation/uniqueness pass even though its text matched.
- User text: `订单可能已保存，请先查询订单号，不要重复提交`.
- Fix: export the raw value and validate it manually.
- Recovery: inspect the order number and raw NDJSON before any retry.
- Side effect: `save-unknown`; cart frozen.
- Retry: blocked.
- Redaction: raw line contents are not rendered.
- Native channel: checkout status.
- Documentation anchor: `#storage-readback-invalid`

### `duplicate-order-number`

- Surface: generated order number / append / lookup / unknown resolution
- Meaning: a normalized order number appears more than once in valid records.
- User text: checkout `订单号生成失败，请重试`; lookup `本地订单数据存在重复订单号`.
- Fix: back up and inspect raw data; do not choose either duplicate as authoritative.
- Recovery: remove the duplicate only by deliberate manual action.
- Side effect: checkout preserves the cart; lookup returns no candidate order.
- Retry: checkout can regenerate within the fixed 10-candidate budget; lookup retries only after data is repaired.
- Redaction: duplicate order number may be shown as the queried key, but no candidate body is shown.
- Native channel: checkout status, storage notice, lookup status.
- Documentation anchor: `#duplicate-order-number`

### `order-number-exhausted`

- Surface: checkout controller
- Meaning: all 10 generated candidates collided with valid stored numbers.
- User text: `订单号生成失败，请重试`.
- Fix: retry later to obtain a new timestamp/suffix.
- Recovery: cart remains available for retry.
- Side effect: no write occurs.
- Retry: allowed.
- Redaction: no generated candidate list is shown.
- Native channel: checkout status.
- Documentation anchor: `#order-number-exhausted`

### `save-unknown-absent`

- Surface: unknown-checkout resolution
- Meaning: storage is healthy, contains no duplicates or invalid lines, and the attempted order is definitively absent.
- User text: `已确认本次订单未保存，购物车已保留，可以重新结账`.
- Fix: none; retry is now safe.
- Recovery: retry checkout with the preserved cart.
- Side effect: frozen state is cleared; cart remains.
- Retry: allowed.
- Redaction: no storage body is shown.
- Native channel: checkout status and live region.
- Documentation anchor: `#save-unknown-absent`

### `save-unknown-mismatch`

- Surface: unknown-checkout resolution
- Meaning: an order with the attempted number exists, but its snapshot differs.
- User text: `订单号已存在，但内容与本次快照不一致，请人工核对`.
- Fix: export and inspect the stored record manually.
- Recovery: human review only.
- Side effect: cart stays frozen.
- Retry: blocked.
- Redaction: full stored snapshot is not echoed into the error.
- Native channel: checkout status.
- Documentation anchor: `#save-unknown-mismatch`

### `save-unknown-unhealthy-storage`

- Surface: unknown-checkout resolution
- Meaning: the attempted order is absent, but invalid or duplicate records prevent a clean absence proof.
- User text: `本地订单数据有损坏或重复，无法确认保存状态，请先备份并检查原始存储`.
- Fix: export the raw key and inspect it before manual cleanup.
- Recovery: human review only.
- Side effect: cart stays frozen.
- Retry: blocked.
- Redaction: corrupt lines are not copied into the message.
- Native channel: checkout status and storage notice.
- Documentation anchor: `#save-unknown-unhealthy-storage`

## Lookup Codes

### `lookup-empty`

- Surface: lookup
- Meaning: the trimmed input is empty.
- User text: `请输入订单号`.
- Fix: enter an order number.
- Recovery: submit again.
- Side effect: no storage read.
- Retry: allowed.
- Redaction: not applicable.
- Native channel: lookup status.
- Documentation anchor: `#lookup-empty`

### `lookup-malformed`

- Surface: lookup
- Meaning: the input does not match `FL-YYYYMMDD-HHMMSS-XXXX`.
- User text: `订单号格式不正确，应为 FL-YYYYMMDD-HHMMSS-XXXX，例如 FL-20261017-131500-A7K2`.
- Fix: correct the value or paste the receipt number.
- Recovery: submit again.
- Side effect: no storage read.
- Retry: allowed.
- Redaction: the input is not echoed beyond the visible field.
- Native channel: lookup status.
- Documentation anchor: `#lookup-malformed`

### `lookup-not-found`

- Surface: lookup
- Meaning: storage was readable and no unique matching order exists.
- User text: `未找到该订单`.
- Fix: verify the order number and the served origin.
- Recovery: retry with a corrected number.
- Side effect: additional corrupt-line warnings may remain in the storage notice.
- Retry: allowed.
- Redaction: stored data is not listed.
- Native channel: lookup status.
- Documentation anchor: `#lookup-not-found`

### `lookup-found`

- Surface: lookup
- Meaning: exactly one valid order matched.
- User text: `订单已找到`.
- Fix: none.
- Recovery: not applicable.
- Side effect: result rendered as text; storage unchanged.
- Retry: not applicable.
- Redaction: only the matched snapshot is shown.
- Native channel: lookup result and focused heading.
- Documentation anchor: `#lookup-found`

## Domain Boundary

Invalid domain inputs throw `TypeError`; they do not invent fallback orders.

| Function family | Trigger | Required behavior |
| --- | --- | --- |
| Quantity input | empty, zero, negative, decimal, text, or greater than 99 | `parseQuantity` returns the previous valid quantity and `数量必须是 1-99 的整数`; greater than 99 clamps to 99 |
| Money and totals | non-safe integers, quantity outside 1-99, overflow, non-array | throw `TypeError`; never return `NaN` |
| Order number suffix | after trim/uppercase, not exactly four ASCII letters/digits | throw `TypeError`; never truncate or pad |
| Order validation | malformed fields, totals, duplicate fruit IDs, or record bounds | return `{ valid: false, errors }` |
| Serialization | invalid order or line over 16,384 UTF-16 code units | throw `TypeError`; no write |

## HTTP Codes

All introduced HTTP errors use `application/problem+json` with `type`, `title`, `status`, `detail`, `instance`, `code`, and `fix`. Every response carries `Cache-Control: no-store`.

### `http-method-not-allowed`

- Surface: static server
- Meaning: method is not `GET` or `HEAD`.
- HTTP: `405`, `Allow: GET, HEAD`.
- Fix: use `GET` or `HEAD`.
- Recovery: repeat with a supported method.
- Side effect: none.
- Retry: allowed with a supported method.
- Redaction: no filesystem path is returned.
- Native channel: problem+json body.
- Documentation anchor: `#http-method-not-allowed`

### `http-not-found`

- Surface: static server
- Meaning: path is unknown, private, queried, encoded, traversing, outside the allowlist, or resolves outside the project root.
- HTTP: `404`.
- Fix: open `/` or a path documented in this repository.
- Recovery: use an allowed local path.
- Side effect: none.
- Retry: only with a valid allowed path.
- Redaction: the filesystem location is not returned.
- Native channel: problem+json body.
- Documentation anchor: `#http-not-found`

### `http-static-read-failed`

- Surface: static server
- Meaning: an allowed file could not be read.
- HTTP: `500`.
- Fix: check repository files and restart `node serve.mjs`.
- Recovery: restart after files are readable.
- Side effect: none.
- Retry: allowed after restart.
- Redaction: only the stable code and a local stderr trace are emitted; paths and exception text stay out of the response.
- Native channel: problem+json body plus local stderr.
- Documentation anchor: `#http-static-read-failed`

### `http-port-in-use`

- Surface: CLI startup
- Meaning: the requested loopback port could not be bound.
- User text: `Port N is already in use [http-port-in-use].`
- Fix: stop the other process or use the printed `node serve.mjs --port N+1` command.
- Recovery: restart after the port is free.
- Side effect: no server is left running.
- Retry: allowed.
- Redaction: no system path is printed.
- Native channel: stderr, non-zero exit.
- Documentation anchor: `#http-port-in-use`

### `http-server-start-failed`

- Surface: CLI startup
- Meaning: the server failed to start for a reason other than port occupancy.
- User text: `Failed to start the static server [http-server-start-failed].`
- Fix: rerun from the repository root and inspect local terminal permissions.
- Recovery: restart after the environment issue is corrected.
- Side effect: no server is left running.
- Retry: allowed.
- Redaction: no exception stack is printed.
- Native channel: stderr, non-zero exit.
- Documentation anchor: `#http-server-start-failed`

### `node-version-unsupported`

- Surface: CLI preflight
- Meaning: Node.js major version is below 22.
- User text: `Node.js 22 or newer is required [node-version-unsupported].`
- Fix: install Node.js 22+.
- Recovery: run `node serve.mjs` again.
- Side effect: server does not bind.
- Retry: allowed after upgrading Node.js.
- Redaction: no environment dump.
- Native channel: stderr, exit code 1.
- Documentation anchor: `#node-version-unsupported`

### `cli-invalid-argument`

- Surface: CLI parser
- Meaning: an argument is unknown or `--port` has an invalid value.
- User text: the argument error, `[cli-invalid-argument]`, and the help hint.
- Fix: run `node serve.mjs --help`.
- Recovery: retry with supported arguments.
- Side effect: server does not bind.
- Retry: allowed.
- Redaction: only the offending argument/value is referenced.
- Native channel: stderr, exit code 2.
- Documentation anchor: `#cli-invalid-argument`
