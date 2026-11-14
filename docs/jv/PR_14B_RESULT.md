# PR_14B — backend build repair and JV runtime verification

## Status

**Partial; the backend TypeScript build remains blocked by a pre-existing deal-stage contract conflict.** The workspace/shared package build and the JV API tests pass. The last `pnpm --filter backend build` exited with code 2 and six TypeScript diagnostics in `apps/backend/src/routes/deals.ts`. No schema change or migration was made because the missing stages were deliberately removed by the existing stage-refactor migration and a safe replacement requires a product decision about the deal lifecycle.

Working branch: `feature/jv-backend-build-fix`
Base/parent: `415abba1d5581df762b842d4348ac92de647fca4`

## Delivered

- Added a real build for `@bms/shared` that emits CommonJS JavaScript and declarations to ignored `packages/shared/dist`; relative `.ts` imports are rewritten by TypeScript 5.7.3. Backend build, dev, API-test, and root `build:shared` commands now build this package first. Backend type resolution uses the package’s generated declaration entry instead of compiling the raw shared source tree.
- Regenerated Prisma Client with the committed schema using `pnpm --filter backend db:generate`; no database connection or migration was used.
- Replaced nullable Prisma JSON `never` casts with a checked JSON conversion that distinguishes omitted values, SQL `NULL` (`Prisma.DbNull`), and valid JSON values. The static `add-glass-params` string payload remains a JSON string, preserving its previous value shape.
- Aligned backend authorization role typing with both existing shared and generated Prisma role enums without changing the role checks.
- Replaced `never` spread casts in SystemParameter/SystemGlass updates with generated unchecked update input types. Explicit `null` still clears a relation; absent and empty-string IDs remain omitted, as before.
- Typed deal `deliveryType` and deal update data with the generated Prisma contract.
- Updated finance filters to use stages present in the post-refactor Prisma enum. The replacement follows `20260507000000_patch14_refactor_stages_vendors/migration.sql`; a test locks the selected enum values.
- Added JSON-null and finance-stage regression checks to the existing backend API test suite.
- Did not change JV formulas, legacy `/calculate`, Prisma schema, or production data.

## Verification

| Check | Result |
|---|---|
| `pnpm --filter @bms/shared build` / `pnpm build:shared` | Pass |
| `pnpm --filter backend db:generate` | Pass; schema-only client generation, no DB access |
| `pnpm --filter backend build` | **Blocked**; six remaining stage-contract diagnostics, exit 2 |
| `pnpm --filter backend test:jv-api` | 8 passed, 0 failed |
| `pnpm test:jv` | 202 passed, 0 failed |
| `pnpm typecheck:shared` | Pass |
| `pnpm build:frontend` | Pass; existing Vite/Browserslist/chunk warnings |
| `pnpm validate:jv-fixtures` | Pass; 45 fixtures |
| `pnpm smoke:jv-line-lab` | Pass |
| Startup smoke from emitted backend JS | Server listened; JV preview and legacy calculate each returned 401 without credentials |

The process smoke is explicitly not a successful production build: TypeScript emits JavaScript despite the six diagnostics, and the emitted process was used only to check module loading, route registration, and authorization. API calculation behavior was exercised separately through Fastify’s registered route tree by the eight integration tests.

Excel/family parity reruns and known exceptions are recorded in [BACKEND_BUILD_REGRESSION.md](./BACKEND_BUILD_REGRESSION.md). The full initial 275-diagnostic build log and final six-diagnostic build log are in [build-logs](./build-logs/).

## Remaining blocker

The current Prisma enum in `apps/backend/prisma/schema.prisma` has `APPLICATION`, `IN_PROGRESS`, `INVOICE_SENT`, `PAID`, `ASSEMBLY`, `PAINTING`, `INSTALL_FIRST`, `INSTALL_SECOND`, `SHIPMENT`, `DOCS`, `COMPLETED`, and `FAILED`. `deals.ts` still implements transitions using `CALCULATION`, `PROPOSAL`, and `AWAITING_PAYMENT`. The migration refactor maps old lead statuses to `IN_PROGRESS`, non-lead `CALCULATION`/`PROPOSAL` to `ASSEMBLY`, and non-lead `AWAITING_PAYMENT` to `INVOICE_SENT`. This loses distinctions required by the old proposal/invoice route flow. Mapping those routes to a single current stage would silently change transitions and response behavior; adding the old states back would conflict with the migration/schema and require a database migration.

The six remaining compiler diagnostics are therefore left visible. Before a fully green backend build, the deal-stage API contract must be reconciled with the post-migration lifecycle. No type assertion, `@ts-ignore`, Prisma schema edit, or migration was used to hide the conflict.

The finance filters now compile against persisted stages, but the stage migration collapsed old proposal/calculation rows into `ASSEMBLY`; the analytics query has no `paymentStatus` guard to distinguish such rows from later assembly work. This classification is recorded as a review risk; no finance calculations or stored values were changed.

## Files and Git

Changed code is limited to build/package configuration, auth type compatibility, Prisma JSON/update DTO typing, finance stage filters, and tests. No generated `dist`, XLSM, archive, `.env`, or database file is part of the patch. Existing untracked `apps/backend/pnpm` and `query` remain untouched and untracked.
