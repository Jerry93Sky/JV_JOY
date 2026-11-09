# Backend build and regression results — PR_14B

## Build status

The PR_14A baseline build had **275 TypeScript diagnostics** (full output in `build-logs/PR_14B_BASELINE_BACKEND_BUILD.log`). The final build still exits with code **2**, now with six diagnostics only:

| File / lines | Diagnostic | Why not auto-fixed |
|---|---|---|
| `apps/backend/src/routes/deals.ts:397` | `CALCULATION` and `PROPOSAL` comparisons are outside generated `DealStage`. | They were removed by the existing stage migration; replacing them changes transition rules. |
| `apps/backend/src/routes/deals.ts:400` | `DealStage.PROPOSAL` does not exist in the generated enum. | Existing proposal transition has no unambiguous equivalent in the new enum. |
| `apps/backend/src/routes/deals.ts:412` | `PROPOSAL` and `AWAITING_PAYMENT` comparisons are outside the generated enum. | The migration merged these legacy states into other current states. |
| `apps/backend/src/routes/deals.ts:425` | `DealStage.AWAITING_PAYMENT` does not exist. | Invoice transition/reservation behavior needs a lifecycle decision; no schema change or cast is safe here. |

The successful checks below do not change the backend-build result. No TS strictness, emit settings, or Prisma schema were weakened.

## Required command results

| Command | Result |
|---|---|
| `pnpm --filter backend build` | **FAIL / BLOCKED** — exit 2; six deal-stage diagnostics |
| `pnpm --filter @bms/shared build` | PASS |
| `pnpm --filter backend db:generate` | PASS; generated from existing schema, no DB connection |
| `pnpm --filter backend test:jv-api` | PASS — 8 tests |
| `pnpm test:jv` | PASS — 202 tests |
| `pnpm typecheck:shared` | PASS |
| `pnpm build:frontend` | PASS; existing Vite CJS, stale Browserslist, and chunk-size warnings |
| `pnpm validate:jv-fixtures` | PASS — 45 fixtures |
| `pnpm smoke:jv-line-lab` | PASS |
| Actual process smoke | PASS for module startup and auth-gated route registration; see runtime report. This was emitted JS from a TypeScript build that itself failed, so it is not a releasable clean build. |

## JV and Excel parity reruns

The existing parity scripts were rerun against the verified fixtures/captures; no JV formula code was changed.

| Family / ledger | Rerun result |
|---|---|
| Line Order | 12 cases; 77 EXACT, 34 NUMERICALLY_EQUIVALENT, 41 DISPLAY_MATCH; 0 mismatch/unverified |
| Zigzag Order | 1,948 comparisons; 1,034 EXACT, 902 DISPLAY_MATCH, 12 UNVERIFIED at the active-glass guard-error branch; 0 mismatch |
| Mixed Order | 10 cases; 746 EXACT, 374 NUMERICALLY_EQUIVALENT, 418 DISPLAY_MATCH; 0 mismatch/unverified |
| Slider-L3 geometry | 4 scenarios; 36 EXACT |
| Slider-L3 BOM | 8 scenarios; 210 EXACT, 14 DISPLAY_MATCH, 112 NOT_APPLICABLE |
| Slider-L3 commercial | 8 scenarios; 307 EXACT, 141 DISPLAY_MATCH, 128 UNVERIFIED |
| Slider-L5 geometry/BOM | 8 scenarios; 252 EXACT, 10 DISPLAY_MATCH, 112 UNVERIFIED |
| Slider-L5 commercial | 8 scenarios; 306 EXACT, 142 DISPLAY_MATCH, 128 UNVERIFIED |
| Slider-X3 geometry/BOM | 10 scenarios; 342 EXACT, 18 DISPLAY_MATCH, 130 UNVERIFIED |
| Slider-X3 commercial | 10 scenarios; 520 EXACT, 320 DISPLAY_MATCH, 160 UNVERIFIED |
| Slider-X5 geometry/BOM | 10 scenarios; 410 EXACT, 10 DISPLAY_MATCH, 130 UNVERIFIED |
| Slider-X5 commercial | 10 scenarios; 852 EXACT, 1 NUMERICALLY_EQUIVALENT, 327 DISPLAY_MATCH, 160 UNVERIFIED |
| Zigzag geometry | 12 scenarios; 528 EXACT, 168 UNVERIFIED |
| Zigzag pricing | 300 comparisons; 130 EXACT, 170 DISPLAY_MATCH |
| Front geometry/BOM | 24 scenarios / 3,120 comparisons; 3,022 EXACT, 98 DISPLAY_MATCH; no mismatch/unverified |
| Front components | 8 scenarios / 408 comparisons; 278 EXACT, 130 DISPLAY_MATCH; no mismatch/unverified |
| Front material prices | 6 scenarios / 342 comparisons; 282 EXACT, 57 DISPLAY_MATCH, 3 existing RETAIL `F1!R13` mismatches |
| Front S38 commercial | 56 comparisons; 8 EXACT, 48 DISPLAY_MATCH |
| Unified Order / all seven | 12 cases; 96 AA11:AA18 and 216 intermediate comparisons; no mismatch/unverified; all input bridges match |

The separate Line cutting comparator was rerun with the temporary Excel capture and still stops at `JV.LINE.ADDITIONAL.COST.AA-110` with `Cannot convert undefined to a BigInt`. This predates PR_14B and is not hidden as a passing parity check. The source capture and output remain in the OS temporary directory, not Git.

Previously documented exceptions remain unchanged: inactive Retail Front `F1!R13`, Slider-X5 `S1!R10` display rounding, Zigzag active-glass guard errors, and the source `#REF!` at `ПРМ!R25`. `DISPLAY_MATCH` remains distinct from exact numeric equality.

## Legacy regression scope

- The live compiled process returned 401 for unauthenticated `POST /api/systems/nonexistent/calculate`; the route and implementation are untouched by this patch.
- The live JV route returned 401 unauthenticated; its role check also passes the Fastify integration test (`USER` receives 403, `ADMIN` calculates).
- Backend API tests exercise Fastify's real registered route tree and all PR_13E golden inputs.
- Database-backed deal/finance/system mutations were **not run**: no disposable test database is configured, and production DB access/migrations are prohibited. No schema, migration, deal records, or production data were changed.

## PR_14C final rerun — 2026-11-09

The PR_14B build-blocked status above is historical. Following Prisma Client generation and the shared build, the backend build now exits **0**. Final results after the transition implementation:

| Check | Result |
|---|---|
| Backend build | PASS, exit 0 |
| Deal workflow tests | PASS, 6 tests |
| Backend JV API tests | PASS, 8 tests |
| Shared JV tests | PASS, 202 tests |
| Shared typecheck / frontend build / fixture validation / Line Lab SSR smoke | PASS; 45 fixtures |
| Line order | PASS, 12 cases; 77 EXACT, 34 NUMERICALLY_EQUIVALENT, 41 DISPLAY_MATCH; no mismatch/unverified |
| All-seven Unified Order | PASS, 12 scenarios / 96 price comparisons; no mismatch/unverified |
| Mixed Order | PASS, 10 scenarios; 746 EXACT, 374 NUMERICALLY_EQUIVALENT, 418 DISPLAY_MATCH; no mismatch/unverified |
| Zigzag geometry/order/pricing | No mismatch; geometry has 168 UNVERIFIED; order has 12 active-glass UNVERIFIED; pricing has no unverified cells |
| Slider L3/L5/X3/X5 | No mismatch; previously known commercial/BOM UNVERIFIED counts persist |
| Front geometry/components/commercial | No mismatch; material-price comparator retains the 3 Retail `F1!R13` mismatches |
| Compiled backend runtime | Server startup and unauthenticated route guards passed for JV preview, legacy `/calculate`, proposal, invoice, and payment |
| Authenticated Prisma-backed deal mutations | NOT_RUN; isolated database unavailable |

Detailed counts and boundaries are in [PR_14C_RESULT.md](./PR_14C_RESULT.md) and [DEAL_STAGE_WORKFLOW_TESTS.md](./DEAL_STAGE_WORKFLOW_TESTS.md). The line-cutting comparator's prior blocker still needs its temporary Excel-result JSON input and is not marked as passing here.
