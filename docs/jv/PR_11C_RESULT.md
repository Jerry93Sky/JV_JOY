# PR_11C — Slider-L3 BOM completion

## Result

Implemented the remaining source-supported Slider-L3 quantity formulas and a single full 42-row BOM result in `packages/shared/src/jv/slider/bom.ts`, exported from the shared JV module. No new quantity was copied from Excel output; all quantities derive from construction inputs, geometry, source settings and raw selector indices resolved through the extracted Excel lookup tables using `ExactRational`.

The audited Excel selector facts revise the requested count: L3 has **28 applicable rows and 14 inapplicable rows**, not 33/9. The nine previously documented X-family rows remain inactive, and five additional rows are inactive by their actual L3 selector codes: K6 (C9=3 vs I6=5), K8 (C10=13 vs I8=15), K9 (C10=13 vs I9=23), K10 (C10=13 vs I10=25), and K13 (C8=10 vs I13=20). No source basis was found to claim these five as applicable.

## Implemented formulas and dependencies

The new TypeScript rules cover:

- K11: side profile using D36; D36 uses `D17`, C10=13 and `Настройки!S16`.
- K12: L sash profile from C33/C34 and D33/D34, plus `Настройки!D6` allowance.
- K25:K28: round/transparent handles and wall/glass locks using resolved D20/D24/D26 and H27.
- K33:K39: brush and glazing seals, including H19/H25 branches and the formula-derived count K38.
- K40:K42: order consumable quantities with exact ROUNDUP and L6 precision selection.

K25:K28 take raw I25/C20, I29/C24 and I31/C26 selector indices; their INDEX resolution uses the extracted #1 table labels and records selector dependencies in the calculation graph.

The full BOM includes all 42 catalog positions with ID, SKU, description, unit, source formula, status, trace identifier, source workbook catalog reference and rule version. `NOT_APPLICABLE` rows omit quantity; they are not fabricated as zero. Existing formulas K14:K17, K22:K23, K29:K30, K43 and K45, and geometry K5/K7 remain supported. The unusual negative K29 branch remains unchanged.

## Excel verification

`tools/jv/capture-slider-bom-pr11c.ps1` recalculates temporary copies of both original books with Excel 16 `CalculateFullRebuild`. It captures four varied scenarios per profile covering widths/heights, leaf counts, opening side, H19/H25/H27, both L6 precision branches and D20/D22/D24/D26 selector outputs, including the two-sided D26 “инд. по поз.” branch. The source files are not written. Fixture: [`slider-pr11c-bom-capture.json`](fixtures/slider-pr11c-bom-capture.json). The comparison runner is `tools/jv/compare-slider-bom-pr11c.mjs`; full results are in [`SLIDER_L3_BOM_PARITY.json`](SLIDER_L3_BOM_PARITY.json): **224 applicable quantity comparisons; 210 EXACT, 14 DISPLAY_MATCH, 0 MISMATCH, 0 UNVERIFIED**. Additionally, 112 checks across the eight scenarios confirm selector-inactive applicability (no engine quantity exposed; Excel cell value zero).

K12's exact rational result is 1547/500 (3.094), while Excel `Value2` can serialize as 3.0940000000000003. Its displayed 0.000 format agrees; this is recorded as DISPLAY_MATCH, not binary exact parity.

## Pricing readiness and double-charge guard

M53 remains **not implemented and not confirmed**. M47:M52 have conditional material, glass, work, service, modifier and installation dependencies still needing complete price snapshots and both-profile source-chain closure. K43/K45 unit-cost expressions say their costs are included in associated plug/latch costs; do not price those rows twice. Details are in [`SLIDER_L3_PRICE_DEPENDENCIES.md`](SLIDER_L3_PRICE_DEPENDENCIES.md).

K40/K41 are formulas at construction width, while workbook item descriptions refer to “2 шт. на весь заказ” via `Клей+акт!N12/N25`; order aggregation/allocation remains a separate future responsibility.

## AA-110 Line regression

The Line additional parity runner failed because it passed the fixture's decimal string for glue factor O5/O18 to `calculateLineAdditionalMaterialCost`, whose contract requires `ExactRational`. The fixture includes exact IEEE-754 `binary64` bits. `tools/jv/verify-line-additional-parity.mjs` now converts those bits to a rational through its existing helper. Re-run result: **20 scenarios; 120 quantity comparisons (60 EXACT, 60 DISPLAY_MATCH, 0 MISMATCH, 0 UNVERIFIED); 240 price/amount comparisons (70 EXACT, 170 DISPLAY_MATCH, 0 MISMATCH, 0 UNVERIFIED).** No Line formula changed and no invented value was added.

## Tests and remaining checks

Latest validation results:

| Check | Result |
|---|---|
| `pnpm typecheck:shared` | Passed |
| `pnpm test:jv` | Passed, 121/121 |
| `pnpm build:frontend` | Passed; existing Vite chunk-size and Browserslist warnings only |
| `pnpm validate:jv-fixtures` | Passed; 23 JV fixture JSON files validated |
| `pnpm smoke:jv-line-lab` | Passed; SSR smoke |
| Slider-L3 geometry parity | 36 EXACT, 0 mismatch/unverified |
| Slider-L3 BOM parity | 224 active comparisons: 210 EXACT, 14 DISPLAY_MATCH; 112 selector-inactive checks; 0 mismatch/unverified |
| JV-Line order parity | 36 EXACT, 20 DISPLAY_MATCH, 14 UNVERIFIED, 0 mismatch |
| JV-Line pricing parity | 1,600 comparisons: 853 EXACT, 747 DISPLAY_MATCH, 0 mismatch/unverified |
| JV-Line quantity/cost BOM parity | 800 quantity and 800 amount checks; no mismatch/unverified |
| JV-Line sash parity | 60 comparisons: 24 EXACT, 36 DISPLAY_MATCH, 0 mismatch/unverified |
| JV-Line additional/AA-110 parity | 120 quantities and 240 costs; no mismatch/unverified (details above) |
| JV-Zigzag geometry parity | 528 EXACT, 168 UNVERIFIED, 0 mismatch |
| JV-Zigzag pricing parity | 130 EXACT, 170 DISPLAY_MATCH, 0 mismatch/unverified |
| JV-Zigzag order parity | 1,034 EXACT, 902 DISPLAY_MATCH, 12 UNVERIFIED, 0 mismatch |
| Mixed Order parity | 746 EXACT, 418 DISPLAY_MATCH, 374 NUMERICALLY_EQUIVALENT, 0 mismatch/unverified |

The pre-existing UNVERIFIED groups remain explicitly unverified; these runs did not introduce new regressions. The standalone legacy Line cutting comparator was not run by itself because it requires a fresh raw Excel result JSON argument; the full JV suite and the relevant Line BOM/order/sash/price checks passed. No legacy `/calculate`, Prisma schema, database, UI or existing BMS calculation behavior was changed. No M53 price logic was added.

## Current coverage summary

| Measure | Result |
|---|---:|
| Registered positions | 42 |
| Applicable quantity positions | 28 |
| Proven inapplicable positions | 14 |
| Remaining unsupported quantity positions | 0 |
| New PR_11C rules | 16 |
| M53 price status | Not implemented; incomplete dependencies |

The source-grounded discrepancy from the requested 33 applicable / 9 inactive target is documented rather than hidden. Do not mark commercial pricing complete based on quantity coverage.
