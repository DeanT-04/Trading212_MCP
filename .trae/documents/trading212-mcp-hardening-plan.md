# Trading212 MCP — Precision Plan (Quality, Robustness, Security)

## Summary

This plan upgrades the current Trading212 MCP server to be production-quality and agent-friendly:

- Default to **live** environment (per requirement).
- Fix **schema mismatches** with Trading212 official API (positions + orders).
- Rename tools to a clean, discoverable surface using a `trading212_` prefix and remove legacy names.
- Make tool outputs **compact** by default, while also returning **structuredContent** for reliable agent workflows.
- Improve **rate limiting**, **retry behavior**, and **error handling** in the API client.
- Add **unit + smoke tests** (no real Trading212 calls) to support test-driven development.

Repo entrypoints and key files:
- Server bootstrap: [src/index.ts](file:///workspace/src/index.ts)
- API client: [src/api/client.ts](file:///workspace/src/api/client.ts)
- Schemas: [src/api/types.ts](file:///workspace/src/api/types.ts)
- Tools: [src/tools](file:///workspace/src/tools)

## Current State Analysis (Observed)

### Configuration / Environment
- Server defaults to **demo** unless `TRADING212_LIVE_MODE === "true"` ([src/index.ts](file:///workspace/src/index.ts#L12-L27), [.env.example](file:///workspace/.env.example)).
- Requirement: default must be **live** (demo only if explicitly configured).

### API / Schema Alignment Issues
- `get_positions` tool schema does **not** match Trading212 positions response (nested `instrument`, `walletImpact`, and different field names). This will cause runtime Zod parsing errors ([src/tools/positions.ts](file:///workspace/src/tools/positions.ts), [src/api/types.ts](file:///workspace/src/api/types.ts)).
- `get_positions` currently exposes `limit/cursor`, but Trading212 positions endpoint documents `ticker` as the query parameter and does not document pagination (Trading212 docs: https://docs.trading212.com/api/positions/getpositions.md).
- Pending orders endpoint returns a list of orders (no documented query params) and the schema should match the nested `instrument` shape (Trading212 docs: https://docs.trading212.com/api/orders/orders.md).

### Tool Surface / Agent UX
- Tool names are unprefixed (`get_positions`, `place_limit_order`, …). MCP best practice recommends service prefix for discoverability and collision avoidance.
- No MCP tool annotations (`readOnlyHint`, `destructiveHint`, `idempotentHint`, `openWorldHint`).
- Tool outputs are text-only; agents benefit from structured outputs (`structuredContent`) to reduce ambiguity and tokens.
- SELL order placement is not possible via API-native convention because schemas enforce positive `quantity` for all order tools.

### Rate Limiting / Robustness
- Global minimum request interval is hardcoded to 5 seconds for all endpoints ([src/api/client.ts](file:///workspace/src/api/client.ts#L35-L59)), which is overly conservative and reduces performance.
- Retry-after logic is internally inconsistent (seconds vs timestamps) and likely incorrect ([src/api/client.ts](file:///workspace/src/api/client.ts#L50-L56)).
- Singleton client cache ignores `liveMode`, so switching environments with the same creds could reuse the wrong base URL ([src/api/client.ts](file:///workspace/src/api/client.ts#L196-L203)).

## Proposed Changes (Decision-Complete)

### 1) Make LIVE the default environment

**Files**
- [src/index.ts](file:///workspace/src/index.ts)
- [.env.example](file:///workspace/.env.example)
- [README.md](file:///workspace/README.md)

**Changes**
- Change runtime default so that **liveMode defaults to true** unless explicitly disabled.
  - Proposed logic: `liveMode = process.env.TRADING212_LIVE_MODE !== "false"` (live by default; demo only when explicitly set to `"false"`).
- Update the startup log line to reflect live mode clearly (but keep stderr logging only).
- Update `.env.example` and README configuration text accordingly.

**Why**
- Meets the stated requirement and avoids accidental demo mode when users expect live.

### 2) Align API schemas to official Trading212 docs

**Files**
- [src/api/types.ts](file:///workspace/src/api/types.ts)

**Changes**
- Replace the current `PositionSchema` with a schema aligned to the official positions response:
  - `instrument: { ticker, name, isin, currency }`
  - `averagePricePaid`, `currentPrice`, `quantity`, `walletImpact: { currency, currentValue, totalCost, unrealizedProfitLoss, fxImpact }`, etc.
- Replace/extend the current `OrderSchema` to match official pending order fields:
  - `id` integer, `createdAt`, `instrument` object, `timeInForce`, `type`, `status`, `side`, etc.
- Keep schemas tolerant where Trading212 may omit optional fields, using `.optional()` appropriately (avoid brittle parsing).

**Why**
- Prevents tool runtime failures and enables reliable structured outputs.

### 3) Rename tools + make them agent-friendly (prefixed, compact, structured)

**Files**
- [src/tools/accounts.ts](file:///workspace/src/tools/accounts.ts)
- [src/tools/positions.ts](file:///workspace/src/tools/positions.ts)
- [src/tools/orders.ts](file:///workspace/src/tools/orders.ts)
- [README.md](file:///workspace/README.md)

**Tool naming convention**
- Prefix all tools with `trading212_`.
- Remove old names entirely (per decision).

**New tool list (proposed)**
- `trading212_get_account_summary` (read-only)
- `trading212_get_positions` (read-only; optional `ticker`)
- `trading212_get_pending_orders` (read-only; optional `limit` purely for output truncation)
- `trading212_get_order` (read-only)
- Buy tools (destructive):
  - `trading212_place_limit_buy_order`
  - `trading212_place_market_buy_order`
  - `trading212_place_stop_buy_order`
  - `trading212_place_stop_limit_buy_order`
- Sell tools (destructive) — separate tools, internally convert to negative quantity:
  - `trading212_place_limit_sell_order`
  - `trading212_place_market_sell_order`
  - `trading212_place_stop_sell_order`
  - `trading212_place_stop_limit_sell_order`
- `trading212_cancel_order` (destructive)

**Input schemas**
- Positions: `ticker?: string` only (match official endpoint).
- Pending orders: no cursor; optional `limit` to avoid token-heavy outputs (pure presentation).
- Buy/sell tools: `quantity` remains positive; sell tools negate `quantity` when calling the API.

**Outputs**
- Default to compact, low-token text:
  - Lists: one line per item with essential fields only.
  - Single resources: concise key fields; no redundant blocks.
- Always include `structuredContent` with the validated full object(s) and minimal metadata:
  - `accountSummary`, `positions`, `orders`, `order`, etc.
  - Include `source: "live" | "demo"` in structured metadata.

**Annotations**
- Add MCP tool annotations for all tools:
  - Read-only tools: `readOnlyHint: true`, `destructiveHint: false`, `idempotentHint: true`, `openWorldHint: true`
  - Order placement tools: `readOnlyHint: false`, `destructiveHint: true`, `idempotentHint: false` (Trading212 explicitly documents non-idempotency for some order placement endpoints), `openWorldHint: true`
  - Cancel: `destructiveHint: true`, `idempotentHint: false`

**Why**
- Improves tool discoverability (prefix), safety (annotations), and agent reliability (structuredContent) while keeping token usage low.

### 4) Fix API client rate limiting, retries, and environment correctness

**Files**
- [src/api/client.ts](file:///workspace/src/api/client.ts)

**Changes**
- Replace global `MIN_REQUEST_INTERVAL = 5000` with endpoint-aware pacing based on official limits:
  - `/equity/account/summary`: 1 req / 5s
  - `/equity/orders` (GET): 1 req / 5s
  - Order placement endpoints (POST): 1 req / 2s
  - `/equity/positions`: 1 req / 1s
- Fix retry-after behavior:
  - Treat `x-ratelimit-retry-after` as seconds (when present) and sleep that duration.
  - Treat `x-ratelimit-reset` as a Unix timestamp (per docs) and, when needed, compute remaining time until reset.
- Add safe Axios defaults:
  - Reasonable request timeout (avoid hanging in MCP tool calls).
  - Ensure errors never include secrets (no logging of headers/auth).
- Fix singleton cache key to include `liveMode` (or baseURL) so environment switches cannot reuse an incorrect client.

**Why**
- Correctness + performance: respects Trading212 limits without being unnecessarily slow.

### 5) Testing (Unit + Smoke, no real Trading212 calls)

**Files**
- Add `test/` directory (ESM JS tests) + minimal test utilities.
- Update [package.json](file:///workspace/package.json) to include `test` script.

**Approach**
- **Unit tests**
  - Validate Zod schemas parse representative fixtures (positions + orders) based on official docs.
  - Validate transformation/formatting functions produce compact outputs.
  - Validate sell-tool quantity negation logic.
- **Smoke tests**
  - Instantiate an `McpServer` in-process, register tools, and invoke handlers directly (no stdio transport).
  - Use dependency injection for the Trading212 client so handlers can run with a deterministic stub (no HTTP).

**Implementation detail for testability**
- Refactor tool modules to separate:
  - “create handler” functions that accept a `clientFactory` (defaulting to `createClient`)
  - “register tools” functions that wire handlers into MCP server
- This avoids fragile module mocking and keeps production behavior identical.

**Why**
- Supports test-driven development and prevents regressions without needing real funds or live API access.

### 6) Security hardening checklist (applies during implementation)

- Never log secrets or auth headers (ensure all logs remain non-sensitive).
- Keep stdout clean (stdio transport requirement); only log to stderr.
- Validate all inputs with Zod (already used); keep constraints tight (positive quantities, price bounds).
- Provide actionable errors without leaking internals.

## Assumptions & Decisions

- Old tool names will be **removed** immediately (no aliases).
- SELL will be exposed via **separate sell tools**; sell tools accept positive `quantity` and internally negate.
- `trading212_get_positions` will match Trading212 endpoint semantics (optional `ticker`, no cursor pagination).
- Outputs will be **compact** by default and always include `structuredContent`.
- Live is default; demo is opt-in by explicitly setting `TRADING212_LIVE_MODE=false`.

## Verification Steps (Executor Checklist)

1. Install + compile:
   - `npm ci`
   - `npm run build`
2. Run tests:
   - `npm test` (unit + smoke)
3. Manual local validation with MCP Inspector (using **live** credentials):
   - Start server and connect via inspector
   - Call each tool once with safe parameters (avoid placing real trades unless explicitly intended)
4. Spot-check:
   - Outputs are compact and include structuredContent
   - Rate limiting behaves per endpoint (no unnecessary 5s delays on positions, correct waits on 429)
   - No secrets appear in logs/errors

