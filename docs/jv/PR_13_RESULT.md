# PR_13B — Unified Order shared resources and verification

## Implemented

`packages/shared/src/jv/unified-order.ts` still delegates geometry, BOM, and family pricing to the seven existing calculators. It now validates that the requested profile, workbook name, and workbook SHA-256 are consistent across the order. It also builds a source-backed `sharedResources` result from each family calculator:

- Line `AA-110/AA-120` quantities (`Lslot!O49/O50`).
- Zigzag material rows 34/35 (`Zslot!N34/N35`).
- Slider material rows 40/41 (`Sslot!K40/K41`) for L3, L5, X3, and X5.
- Front's selector-7 literal zero consumptions.
- Exact total consumption, Excel whole-package minima (`N12/N25`), package factors (`O5/O18`), area shares (`ПРМ!AB25:AB31`), and trace with source cells and Main quantities.

`mergeBom` now consolidates repeat Line/Zigzag rows when family, SKU, unit, normalized formula cell, and price source match; it retains every source cell, position ID, and trace ID. Different families, units, source rows, and price sources remain separate. The shared-resource report is not added again to any family price, preventing double charging.

Added `excel-number-parity.ts` for exact-rational to COM Value2 classification. `NUMERICALLY_EQUIVALENT` requires strict IEEE-754 number equality and uses no epsilon. A display comparison is only used when the actual Excel NumberFormat and `.Text` were captured.

## Excel evidence and comparisons

Both books were recalculated with Microsoft Excel 16 `CalculateFullRebuild` on temporary copies. `tools/jv/recalculate-line-order-golden.ps1` captured 12 valid Line orders (six per profile), including single positions, multiple quantity, two-position area scenarios, and a three-position case. `tools/jv/unified-order-parity.mjs` runs those inputs through the public `calculateJVOrder` and compares shared package factors and area allocations.

PR_13B initially reported **12 final-price UNVERIFIED** values. PR_13C traced all twelve to a missing Line-only Unified handoff and a comparator that hard-coded `UNVERIFIED`; the Line order was not sent through the existing `calculateLineOrder`, and captured Main settings were not passed into the Unified engine. After correction, those 12 Line-only totals compare as **3 NUMERICALLY_EQUIVALENT and 9 DISPLAY_MATCH**, with no MISMATCH or UNVERIFIED. The broader shared-resource parity currently reports **32 EXACT, 39 NUMERICALLY_EQUIVALENT, 11 DISPLAY_MATCH, 0 MISMATCH, 0 UNVERIFIED**.

The previously reported 14 Line Order `UNVERIFIED` values were caused by comparing exact rational values to the string representation of binary Excel `Value2`. Reclassification after direct numeric/display comparison:

| Cell/rule | COMPLETATION | RETAIL | Reason and active effect |
|---|---:|---:|---|
| `Клей+акт!O5 = N12/SUM(N5:N11)` | 4 `NUMERICALLY_EQUIVALENT` | 4 `NUMERICALLY_EQUIVALENT` | Exact rational maps to the same COM double; impacts allocated adhesive cost and Q totals |
| `L1!X5` / `L2!X5` → `ПРМ!AB25/AB26` | 2 `NUMERICALLY_EQUIVALENT`, 1 `DISPLAY_MATCH` | 2 `NUMERICALLY_EQUIVALENT`, 1 `DISPLAY_MATCH` | Slot 2's binary evaluation order differs; both render `0.145` in the captured `0.000` format, and Q totals still have zero mismatches |

The previous 14 are therefore **12 numeric-equivalent and 2 display matches**, not unknown formulas. The comparisons do not use a numeric tolerance. For the two area-share displays, Excel evaluates `AArow/(AA32*Wrow)` while the engine evaluates the algebraically reduced exact rational; these operations can differ in the last binary bit while preserving the exact formula result and displayed value.

`tools/jv/capture-unified-order-excel-probe.ps1` separately recalculated one all-seven-family Main-sheet case from temporary copies. In both profiles `F7!I23` returns `НЕТ`, `Главная!AA18` is numeric, and the workbook computes its total. The capture is retained at `fixtures/unified-order-excel-probe.json`. This proves the workbook accepts that case, but the captured order total is **not** claimed as engine parity.

## Coverage and remaining commercial blocker

The all-seven family integration and all 21 pair combinations now produce complete shared-resource allocations from engine outputs. This verifies routing plus the source-derived common-consumable layer; it does **not** verify all mixed-family Excel prices.

Line-only orders now route through the existing `calculateLineOrder`, then the new Unified Main transfer applies captured `Настройки!D11`, active-slot markups `D21:D27`, quantity and `D19`. Orders containing Slider or Front remain `PARTIAL` with per-position results, BOM, shared resources and trace retained. The all-seven Excel probe returns numeric `Главная!AA18` in both workbooks, but no all-seven engine price parity is claimed. Mixed family completion still requires:

1. Re-running each active family calculator with the shared `O5/O18` and `ПРМ!AB25:AB31` contexts (slider calculators already expose order-context inputs; Unified has not wired them across the mixed set).
2. Applying the captured family source outputs and divisors: Line `Lslot!Q58/D11`, Zigzag `Zslot!P44/D12`, Slider `Sslot!M53/D13`, Front `Fslot!S38/D14`.
3. Applying each active slot's `D21:D27`, quantity `Z11:Z17`, and order discount `D19` exactly once, then comparing row `Y/AA` and `Главная!AA18` with fresh Excel COM results.

The lower-level `calculateMixedOrder` result is a pre-discount subtotal. Unified now additionally requires a workbook/profile/hash-matched D19 and active-slot markup snapshot, applies the sourced Main `R/S → Y → AA` transfer, and traces it. The nonzero D19 arithmetic test exercises the confirmed formula but is not represented as Excel parity.

Known workbook issues remain visible: `F1!R13` is a known inactive-price mismatch, `S1!R10` has a known display difference, and `ПРМ!R25` contains `#REF!` masked by the workbook's `IFERROR`. They were not normalized by this work.

## Validation

PR_13B-specific tests cover strict numeric parity classification, seven-family resource extraction, all 21 family pairs, weighted resource conservation for repeated Line positions, repeat-article BOM provenance, source-revision rejection and discount gating. PR_13C adds a Line-only Main transfer test and exact rational/binary64 rounding-interval parity checks. Current `pnpm test:jv` reports **197 passed, 0 failed**. `pnpm typecheck:shared`, `pnpm build:frontend`, `pnpm validate:jv-fixtures` (42 JSON fixtures), and `pnpm smoke:jv-line-lab` pass. Frontend build retains the existing Vite CJS deprecation, stale Browserslist data, and >500 kB chunk warnings.

Additional parity scripts were rerun. Line Order: 12 COM cases, 77 `EXACT`, 41 `DISPLAY_MATCH`, 34 `NUMERICALLY_EQUIVALENT`, 0 mismatches. Existing Line+Zigzag mixed path: 10 scratch-order cases, 746 exact, 418 display matches, 374 numerically equivalent, 0 mismatches/unverified. Those scratch fixtures use `Настройки!D19=0` and compare the lower-level `Y×Z` mixed subtotal; they do not independently validate a nonzero Main discount or prove final commercial parity for the Unified Order. Zigzag order: 1,948 comparisons, 1,034 exact, 902 display matches, 0 mismatches, 12 unverified due the active-glass guard-error scenario. Slider L3/L5/X3/X5 commercial scripts: 8/8/10/10 scenarios; 0 mismatches, with existing unresolved comparison counts 128/128/160/160. Front geometry/BOM: 3,120 comparisons, 0 mismatches; Front commercial components: 408 comparisons, 0 mismatches; Front S38: 56 comparisons, 0 mismatches. Front material price parity preserves the known three Retail `F1!R13` mismatches (inactive branch), rather than normalizing them.

No legacy `/calculate`, Prisma schema, production database, React user flow, or family geometry/pricing formula was changed. No workbook, archive, secret, or user-owned untracked `apps/backend/pnpm` / `query` file is part of the changes.

## PR_13D follow-up status (2026-11-08)

PR_13D now builds and passes a shared context into the seven existing family calculators and computes the sourced Main transfer/AA18 from typed family results. This was exercised in both price profiles and with quantities `[2,1,3,2,1,2,3]`. A fresh Excel 16 capture added 12 valid all-seven cases (six per profile). COM verified slot-dependent Front address behavior: F1 maps to AB25, F7 maps to AB31. An implementation defect that hardcoded F1/AB25 is fixed and covered by tests.

The fresh PR_13D Excel cases did **not** establish engine parity; that historical blocker is closed for the PR_13E manifest cases below.

## PR_13E follow-up — all-seven parity

PR_13E created a canonical manifest shared by Excel COM and `calculateJVOrder`. All 12 recreated cases (six per profile) passed input compatibility. The required 96 `Главная!AA11:AA18` comparisons classify as 1 EXACT, 38 NUMERICALLY_EQUIVALENT, 45 DISPLAY_MATCH, 0 MISMATCH, and 0 UNVERIFIED. AA18 separately has 3 numeric-equivalent and 9 display-only matches. Additional 216 source-price, weighted-area, package-count, and factor checks have 0 mismatches/unverified values. The result applies only to these manifest configurations; display equality does not prove exact numeric parity. See `PR_13E_RESULT.md` and `UNIFIED_ORDER_SCENARIO_INPUTS.md`.
