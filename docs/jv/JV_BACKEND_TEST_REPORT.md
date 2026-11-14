# JV backend integration test report (PR_14A)

## New HTTP suite

Run from the repository root:

```powershell
pnpm --filter backend test:jv-api
```

The suite registers existing backend plugins and `registerRoutes`, then exercises the real `/api/jv/orders/calculate-preview` route through Fastify HTTP injection. Result: **6 tests passed, 0 failed**.

Coverage:

- Route registration, BMS JWT rejection, USER role denial, and unauthenticated legacy `/api/systems/:id/calculate` regression.
- All **12 PR_13E scenarios** through HTTP (six COMPLETATION, six RETAIL; all seven positions per scenario). The endpoint response is compared to a separate direct `calculateJVOrder` invocation. Per-position AA11:AA17 rational amounts and AA18 exact rational total are checked against PR_13E's independent Excel parity ledger. No Excel Value2 is used as an Engine input.
- Separate HTTP invocation of each of the seven construction families.
- PARTIAL result with preserved BOM and trace and no `totalSalePrice`.
- Invalid decimal, zero dimension, fractional quantity, unknown family, client price snapshot injection, wrong provider version, and wrong rules version.
- Tampering with Front markup, discount, divisor, quantity, and submitted order-area context does not change the server-calculated total.
- Repeated identical requests produce identical calculation values; correlation IDs remain request-specific.

## Required repository checks

| Command | Result |
|---|---|
| `pnpm test:jv` | 202 passed, 0 failed |
| `pnpm typecheck:shared` | Passed |
| `pnpm build:frontend` | Passed; existing Vite CJS, stale Browserslist, and large-chunk warnings |
| `pnpm validate:jv-fixtures` | Passed; 45 fixture JSON files |
| `pnpm smoke:jv-line-lab` | Passed |
| `pnpm --filter backend test:jv-api` | 6 passed, 0 failed |
| `pnpm --filter backend build` | Fails on existing backend/shared TypeScript errors; see PR_14A_RESULT.md |

The backend build was run once at the untouched base commit before implementation and again after PR_14A. The baseline already failed in legacy Prisma/deal/finance/system typing and the shared-package `.ts` import extension configuration. The final build still fails on those pre-existing areas; no compiler diagnostic points to the new JV service, route, or provider catalog. This PR does not change Prisma, legacy routes, or the shared calculation math to mask those baseline failures.

## Existing Excel and family parity rerun

| Comparator | Result |
|---|---|
| Line Order | 12 cases; 77 EXACT, 34 NUMERICALLY_EQUIVALENT, 41 DISPLAY_MATCH; no mismatch/unverified |
| Zigzag Order | 1,948 comparisons; 1,034 EXACT, 902 DISPLAY_MATCH, 12 UNVERIFIED at the known active-glass guard-error branch |
| Mixed Order | 10 cases; 746 EXACT, 374 NUMERICALLY_EQUIVALENT, 418 DISPLAY_MATCH; no mismatch/unverified |
| Slider L3 BOM | 8 scenarios; 210 EXACT, 14 DISPLAY_MATCH; 112 NOT_APPLICABLE |
| Slider L3 commercial | 8 scenarios; 307 EXACT, 141 DISPLAY_MATCH, 128 UNVERIFIED |
| Slider L5 geometry/BOM | 8 scenarios; 252 EXACT, 10 DISPLAY_MATCH, 112 UNVERIFIED |
| Slider L5 commercial | 8 scenarios; 306 EXACT, 142 DISPLAY_MATCH, 128 UNVERIFIED |
| Slider X3 geometry/BOM | 10 scenarios; 342 EXACT, 18 DISPLAY_MATCH, 130 UNVERIFIED |
| Slider X3 commercial | 10 scenarios; 520 EXACT, 320 DISPLAY_MATCH, 160 UNVERIFIED |
| Slider X5 geometry/BOM | 10 scenarios; 410 EXACT, 10 DISPLAY_MATCH, 130 UNVERIFIED |
| Slider X5 commercial | 10 scenarios; 852 EXACT, 1 NUMERICALLY_EQUIVALENT, 327 DISPLAY_MATCH, 160 UNVERIFIED |
| Zigzag geometry | 12 scenarios; 528 EXACT, 168 UNVERIFIED |
| Zigzag pricing | 300 comparisons; 130 EXACT, 170 DISPLAY_MATCH; no mismatch/unverified |
| Front geometry/BOM | 24 cases, 3,120 comparisons; 3,022 EXACT, 98 DISPLAY_MATCH; no mismatch/unverified |
| Front component commercial | 8 scenarios, 408 comparisons; 278 EXACT, 130 DISPLAY_MATCH; no mismatch/unverified |
| Front material pricing | 6 scenarios, 342 comparisons; 282 EXACT, 57 DISPLAY_MATCH, 3 known RETAIL `F1!R13` mismatches |
| Front commercial | Existing comparison output remains 56 comparisons: 8 EXACT, 48 DISPLAY_MATCH; no mismatch/unverified |
| Unified Order / all-seven | 12 cases; all 96 AA11:AA18 and 216 intermediate comparisons have no mismatch/unverified; all input bridges match |

The independent Line cutting Excel capture was rerun on temporary workbook copies. Its comparator stopped at existing `JV.LINE.ADDITIONAL.COST.AA-110` with `Cannot convert undefined to a BigInt`; this is documented as a comparator/data dependency blocker, not a PR_14A Engine change. The Excel result file is in the local temporary directory only.

The known Zigzag guard, slider `UNVERIFIED` branches, and three inactive Front `F1!R13` mismatches remain visible. `DISPLAY_MATCH` is not reported as exact numeric equality.
