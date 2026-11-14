# PR_13E — Manifest-driven all-seven Excel parity

## Result

PR_13E replaced the PR_13D all-seven `UNVERIFIED` ledger with a canonical manifest used by both Excel COM and `calculateJVOrder`. The manifest defines 12 recreated controlled scenarios: six COMPLETATION and six RETAIL, with all seven JV families present in each case (84 positions total). Excel 16 `CalculateFullRebuild` ran on fresh temporary copies of both original XLSM files. Their SHA-256 identities match the versioned snapshots. No Excel output value was passed into the engine.

The explicit input bridge wrote and read back 88 primary cells per scenario (1,056 total). All 12 scenarios passed input compatibility before commercial comparisons. For `Главная!AA11:AA18` the 96 statuses are:

| Status | Count |
|---|---:|
| EXACT | 1 |
| NUMERICALLY_EQUIVALENT | 41 (38 in AA11:AA17; 3 in AA18) |
| DISPLAY_MATCH | 54 (45 in AA11:AA17; 9 in AA18) |
| MISMATCH | 0 |
| UNVERIFIED | 0 |

`EXACT` compares the Engine rational with the exact decimal export from Excel COM. `NUMERICALLY_EQUIVALENT` requires the same IEEE-754 binary64 number; no epsilon is used. `DISPLAY_MATCH` means the exact numeric values differ but render identically under the captured Excel NumberFormat; it does not prove exact numeric equality. No scenario has an unresolved or mismatching primary input.

The 216 additional checks cover seven source-price outputs, seven weighted area shares, activator/adhesive package counts, and both distribution factors for each scenario:

| Status | Count |
|---|---:|
| EXACT | 25 |
| NUMERICALLY_EQUIVALENT | 87 |
| DISPLAY_MATCH | 104 |
| MISMATCH | 0 |
| UNVERIFIED | 0 |

The ledger separately verifies that Engine AA18 is the exact rational sum of its seven Engine Main row amounts and that Excel `AA18` matches the sum of Excel `AA11:AA17` at its captured binary64 value. Front uses slot 7 throughout: `F7!Y5 → ПРМ!AB31`, and the Main price source trace is `F7!S38`. Shared consumables are calculated once and not added a second time to the position totals.

## Confirmed input-bridge defects corrected

These were test input mapping defects, not changes to production family math:

1. The retail standalone Line fixture carried `assemblyEnabled` and `installationEnabled` values that did not match the all-seven workbook settings. The manifest builder now sets these from the order-level `Настройки!D33` / `D34` inputs before invoking the Engine.
2. The Front fixture's `finishingEnabled` was not tied to the selected `Настройки!D32` input, although the workbook activates `F7!S35` with that flag. The manifest builder maps Front finishing from D32.
3. Front's surcharge source is `Главная!B26` in `F7!S36`; this is independent of the other-family `Главная!F28` controls. The canonical scenario writes and checks `B26=1`, and Engine receives the same base branch. Front slot and output remain F7 / AB31 / S38.

The expected/actual input comparator reports the exact scenario, family, cell address, values, and provenance for any future mismatch. A unit test intentionally changes a direct input and confirms it is detected. A manifest-driven integration test calls the real Engine for all 12 cases.

## Artifacts

- `docs/jv/fixtures/unified-order-all-seven-inputs.json` — canonical 12-case manifest with seven typed positions, snapshots, source mappings, and primary Excel writes.
- `docs/jv/fixtures/unified-order-all-seven-excel-pr13e.json` — fresh Excel COM primary input and formula/value/display capture from temporary copies.
- `docs/jv/UNIFIED_ORDER_ALL_SEVEN_PARITY.json` — 96 required comparisons, 216 intermediate comparisons, Engine traces, AA18 arithmetic checks, and separate status counts.
- `docs/jv/UNIFIED_ORDER_SCENARIO_INPUTS.md` — family slot/input mapping, scenario sources, common controls, and scope limits.
- `tools/jv/create-unified-order-all-seven-pr13e-manifest.mjs` — deterministic manifest generator using existing source-bound family fixtures.
- `tools/jv/capture-unified-order-all-seven-pr13e.ps1` — Excel 16 COM runner; temporary workbook copies only.
- `tools/jv/compare-unified-order-all-seven-pr13e.mjs` — strict primary input check and rational/IEEE/display comparison ledger.
- `packages/shared/src/jv/unified-order-input-compatibility.ts` and test — typed mismatch details.
- `packages/shared/src/jv/unified-order-all-seven-pr13e.test.ts` — integration regression over all scenarios, slots, Front routing, AA18, and parity statuses.

## Scope and limits

Parity is established for the 12 manifest-defined configurations only. Each family uses one source-bound geometry/control set; this set varies quantity vectors but does not explore every size boundary, material selector, opening branch, or service option. Exact numeric parity is not claimed for `DISPLAY_MATCH` entries; they are visible in the JSON ledger and remain candidates for later binary-operation-order analysis. The scenarios are recreated fixtures rather than recovered historic PR_13D scenario inputs.

The shared resource comparison includes package counts, allocation factors, and weighted areas. A full per-SKU order-wide material-price reconciliation remains a separate coverage task. Existing recorded exceptions from family parity (inactive `F1!R13`, `S1!R10`, Zigzag guard cases, and `ПРМ!R25 #REF!`) remain unchanged and are not reclassified by PR_13E.

No legacy `/calculate`, Prisma schema, production database, React flow, existing family math, source workbook, or unrelated untracked user file was modified.

## Verification

The PR_13E integration test and full regression passed:

| Command | Result |
|---|---|
| `pnpm test:jv` | 202 passed, 0 failed |
| `pnpm typecheck:shared` | Passed |
| `pnpm build:frontend` | Passed; existing Vite CJS, stale Browserslist, and large-chunk warnings remain |
| `pnpm validate:jv-fixtures` | Passed; 45 JSON fixtures |
| `pnpm smoke:jv-line-lab` | Passed |
| `git diff --check` | Passed; only line-ending normalization warnings |

Existing parity comparators were also run after the all-seven comparison:

| Area | Result |
|---|---|
| Line Order | 12 cases; 77 EXACT, 41 DISPLAY_MATCH, 34 NUMERICALLY_EQUIVALENT; no mismatch/unverified |
| Zigzag Order | 1,948 comparisons; 1,034 EXACT, 902 DISPLAY_MATCH; 12 UNVERIFIED at the known active-glass guard-error branch |
| Mixed Order | 10 cases; 746 EXACT, 418 DISPLAY_MATCH, 374 NUMERICALLY_EQUIVALENT; no mismatch/unverified |
| Slider L3 pricing | 8 cases; 307 EXACT, 141 DISPLAY_MATCH, 128 UNVERIFIED |
| Slider L5 pricing | 8 cases; 306 EXACT, 142 DISPLAY_MATCH, 128 UNVERIFIED |
| Slider X3 pricing | 10 cases; 520 EXACT, 320 DISPLAY_MATCH, 160 UNVERIFIED |
| Slider X5 pricing | 10 cases; 853 EXACT, 327 DISPLAY_MATCH, 160 UNVERIFIED |
| Front Geometry/BOM | 3,120 comparisons; 3,022 EXACT, 98 DISPLAY_MATCH; no mismatch/unverified |
| Front material pricing | 342 comparisons; 282 EXACT, 57 DISPLAY_MATCH, 3 known RETAIL `F1!R13` mismatches |
| Front commercial | 56 comparisons; 8 EXACT, 48 DISPLAY_MATCH; no mismatch/unverified |
| Existing Unified Order | 12 cases; 32 EXACT, 39 NUMERICALLY_EQUIVALENT, 11 DISPLAY_MATCH; no mismatch/unverified |
| PR_13E all-seven | 96 required comparisons plus 216 intermediates; all inputs compatible; no mismatch/unverified |

The family parity exceptions above remain independent of PR_13E's new controlled mixed-order cases. The test run emits existing Node module-type warnings; the frontend build also emits the warnings listed above.
