# PR_14A — JV backend preview integration

## Delivered

- Added authenticated, registered route `POST /api/jv/orders/calculate-preview` under the existing `/api/jv` namespace.
- Added `jvCalculationService`, which validates the request, chooses the explicit profile provider, injects server-side snapshots, and calls the real `calculateJVOrder`.
- Added a strict Zod boundary for all seven discriminated construction families, up to seven positions, unique slots and IDs, bounded exact decimal strings, quantity and dimension checks, source/version checks, and price/settings tamper resistance.
- Added static server-owned COMPLETATION and RETAIL provider snapshots extracted from the already versioned, source-hash-checked PR_13E manifest. No client-controlled price data or new price list is accepted.
- Added server-side Front Main settings and order-area context derived from the submitted positions, preventing a caller from sending fictitious related constructions or altering Main settings.
- Added a JSON serializer that keeps rational fields in string form, handles BigInt without Number conversion, and serializes internal Maps/Sets without losing entries.
- Added a real HTTP integration suite covering both profiles, all seven variants, all 12 PR_13E scenarios, AA11:AA17 and AA18, PARTIAL handling, role checks, invalid inputs, provider/version mismatch, price/context tampering, determinism, and the legacy endpoint authorization path.
- Added API, integration, security, and test report documentation.

## Verification summary

- `pnpm --filter backend test:jv-api`: **6 passed, 0 failed**. The 12 all-seven endpoint calculations exactly match independent `calculateJVOrder` rational outputs and PR_13E Engine golden rationals at each AA11:AA17 row and AA18.
- `pnpm test:jv`: **202 passed, 0 failed**.
- `pnpm typecheck:shared`: passed.
- `pnpm build:frontend`: passed with existing CJS/Browserslist/chunk warnings.
- `pnpm validate:jv-fixtures`: passed, 45 fixtures.
- `pnpm smoke:jv-line-lab`: passed.
- Existing family/unified parity reruns and the one unrelated Line cutting comparator blocker are detailed in `JV_BACKEND_TEST_REPORT.md`.

## Backend build baseline

`pnpm --filter backend build` failed before PR_14A was changed and still fails afterward. Baseline errors include generated Prisma model/enum mismatches in existing deal and finance routes, existing route typing errors in glass/vendors/systems, Prisma JSON typing, and TS5097 from shared `.ts` import extensions under the backend CommonJS emitter. The final compiler run reports no diagnostics from the new JV service, route, or catalog files. The compiler problem needs a separate repository-wide build work item; this PR does not alter Prisma or legacy BMS code to hide it.

The endpoint is registered in the same `registerRoutes` tree that `src/index.ts` serves and was executed via the real Fastify route tree in API tests. Production deployment remains contingent on resolving the pre-existing backend build baseline.

## Compatibility and scope

- No modifications to `/api/systems/:id/calculate` or legacy `/calculate` implementation.
- No change to existing BMS formulas, shared JV math, Prisma schema, production DB, or existing deal records.
- No saving of preview orders; persistence and UI wiring remain later phases.
- Server snapshots currently come from committed PR_13E captured versions. Live BMS catalog administration and broader sales-role authorization do not yet exist.
- `COMPLETE` is an Engine status for the submitted supported inputs and selected snapshots. Prior Excel parity limitations remain documented and are not broadened by the HTTP integration.

## Files

- `apps/backend/src/routes/jv.ts`
- `apps/backend/src/routes/index.ts`
- `apps/backend/src/domain/jv/jvCalculationService.ts`
- `apps/backend/src/domain/jv/catalogs/completation-pr13e.json`
- `apps/backend/src/domain/jv/catalogs/retail-pr13e.json`
- `apps/backend/test/jv/jvCalculationService.test.ts`
- `apps/backend/package.json`
- `tools/jv/create-backend-snapshots-pr14a.mjs`
- `docs/jv/JV_BACKEND_INTEGRATION.md`
- `docs/jv/JV_API_CONTRACT.md`
- `docs/jv/JV_BACKEND_SECURITY.md`
- `docs/jv/JV_BACKEND_TEST_REPORT.md`
