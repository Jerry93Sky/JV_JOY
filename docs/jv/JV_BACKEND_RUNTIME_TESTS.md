# Backend runtime and JV API verification — PR_14B

## Process-level smoke

Started the backend entry point `node dist/apps/backend/src/index.js` on an isolated local port with a disposable test-only `JWT_SECRET`. The server logged `Server listening`; no production database was configured or contacted. Actual HTTP requests returned:

| Request | Result |
|---|---|
| `POST /api/jv/orders/calculate-preview`, no token | 401 `Не авторизован` |
| `POST /api/systems/nonexistent/calculate`, no token | 401 `Не авторизован` |

This checks Node module loading, Fastify startup, route registration, and the auth guard on both endpoints. The TypeScript build still exits 2 on the deal-stage conflict, while `tsc` emits JS by default; therefore this smoke is not evidence of a clean/releasable backend build. The authenticated calculation path is covered by registered-route integration tests below.

## Fastify API integration tests

Command: `pnpm --filter backend test:jv-api`
Result: **8 passed, 0 failed**.

The suite registers existing plugins and `registerRoutes`; it does not replace the JV route, service, or Engine with mocks. It covers:

- Registration and authorization: unauthenticated 401, `USER` 403, authorized `ADMIN` requests; legacy calculate route still requires authentication.
- All 12 PR_13E manifest cases through HTTP (both profiles; all seven position families); returned per-position AA11:AA17 and AA18 rationals match the ledger and direct `calculateJVOrder` output after JSON serialization.
- Each of the seven family dispatches individually.
- `PARTIAL` returns confirmed BOM/trace and omits the order total.
- Invalid decimal/dimensions/quantity/family, caller price snapshot injection, provider mismatch, and rules version mismatch.
- Front commercial context/settings tampering is overwritten from server-owned snapshots/actual submitted positions.
- Deterministic calculation results across repeated calls.
- Prisma JSON null/value input handling and valid post-refactor finance stage selection.

## Startup limitations

`index.ts` constructs Prisma Client but does not connect during startup; the smoke intentionally makes only auth-rejected requests, so no DB read/write occurs. Deal proposal/invoice actions and finance queries were not executed against a database because no isolated disposable DB is configured. These are not marked as tested. The current deal-stage TypeScript conflict must be reconciled before a clean backend build and full DB-backed legacy test run can be claimed.
