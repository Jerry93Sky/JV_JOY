# JV Engine ↔ GlasS-light backend integration (PR_14A)

## Registered route

`POST /api/jv/orders/calculate-preview` is registered by `apps/backend/src/routes/index.ts` under the existing `/api` route convention. It runs without writing an order to Prisma or changing existing deals. The handler calls `calculateJvPreview`, which validates the request, resolves a server-owned profile provider, attaches its snapshots, and invokes the existing `calculateJVOrder` from `@bms/shared`.

The route is part of `registerRoutes`, used by `apps/backend/src/index.ts`. The HTTP integration suite registers the real route tree and exercises it through Fastify `inject`; it does not stub the JV handler, service, or Engine.

## Runtime path

1. Fastify parses JSON with a 256 KiB route body limit.
2. Existing `requireRole(Role.OWNER, Role.ADMIN)` verifies the BMS JWT and role before the handler runs.
3. Zod checks the discriminated family union, envelope, profile, versions, slots, identifiers, quantity strings, and object shape.
4. The versioned request shape for each family is checked against the selected server provider. Price snapshots, price fields, source provenance, rule settings, and calculation coefficient objects are not caller-controlled.
5. Positive dimensions and bounded decimal strings are checked before dispatch. Family calculators still perform their own confirmed engineering validations.
6. The service attaches only the selected server snapshots and derives the Front order-area context from the submitted positions. Front discount, markup, consumption quantity, and its internal divisor are reset from server-owned sources.
7. `calculateJVOrder` dispatches every position through the existing seven family calculators and the shared order coordinator.
8. A JSON-safe response preserves rational numerators and denominators as strings; Maps and Sets are represented as arrays. No database write occurs.

## Snapshot source

Backend providers are checked-in, versioned JSON snapshots at:

- `apps/backend/src/domain/jv/catalogs/completation-pr13e.json`
- `apps/backend/src/domain/jv/catalogs/retail-pr13e.json`

They are derived by `tools/jv/create-backend-snapshots-pr14a.mjs` from the two PR_13E canonical controlled scenarios in `docs/jv/fixtures/unified-order-all-seven-inputs.json`. Those scenarios were source-hash bound to the original completion and retail workbooks and captured with Excel 16. The provider keeps the source workbook SHA, formula provenance, snapshot versions, profile, and Main settings. Runtime never reads Excel files and never accepts client prices.

The selected provider IDs are `JV-PR13E-COMPLETATION-EXCEL16` and `JV-PR13E-RETAIL-EXCEL16`. The Engine rule contract currently accepted by the endpoint is `JV-UNIFIED-ORDER-PR13E-1`. No silent cross-profile fallback exists. If the requested provider version or rule version is unavailable, the endpoint returns 409.

This is a versioned static provider based on the existing verified snapshots, not a new price list and not a replacement for future BMS price administration. Changing live price data requires a separately reviewed snapshot release.

## Current limits

- The supported request shape and locked settings are based on the PR_13E source-bound typed inputs. Geometry, selectors, and explicit construction choices can vary within those shapes; missing or differently shaped fields are rejected.
- Formula coverage and Excel parity remain limited to the documented family calculators and tested cases. A `COMPLETE` result means the Engine says all dependencies for that submitted configuration are supported; it is not a new claim of exhaustive Excel parity.
- Trace and internal source prices are returned only to OWNER/ADMIN because the current BMS has no separate commercial-quote permission. Existing BMS roles do not carry a tenant claim, so this endpoint does not invent tenant authorization.
- UI composition, order persistence, database catalog administration, and migration are outside PR_14A.
- Backend TypeScript build remains blocked by pre-existing GlasS issues described in `PR_14A_RESULT.md`; API runtime/integration tests use the existing `tsx` development/test execution path.
