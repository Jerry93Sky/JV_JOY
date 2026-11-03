# JV-Line BOM and material-cost verification

## Fresh Excel runs

Microsoft Excel 16.0 recalculated five scenarios in each source book using temporary copies, with VBA macros and events disabled. The raw capture records formula, COM `Value2` decimal text, IEEE-754 bits, displayed text and `NumberFormat` for outputs. Workbook hashes in the fixtures match the original sources.

| Check | Result |
|---|---:|
| Scenario/book runs | 10 |
| Geometry + supported BOM output comparisons | 10/10 exact decimal values |
| Supported BOM positions per run (with all source inputs) | 26 |
| Unsupported positions per run | 14 |
| Supported quantity comparisons | 260: 240 EXACT, 20 NUMERICALLY_EQUIVALENT, 0 mismatch, 0 unverified |
| Supported material Q comparisons | 260: 181 EXACT, 79 NUMERICALLY_EQUIVALENT, 0 mismatch, 0 unverified |
| P/Q price-cell comparisons, all 40 rows | 800: 427 EXACT, 373 NUMERICALLY_EQUIVALENT, 0 mismatch, 0 unverified |

`NUMERICALLY_EQUIVALENT` means exact engine value and Excel value render alike under the captured cell format; values remain unrounded and individually available. `EXACT` compares engine rational value to the exact rational represented by Excel's binary64 bits. No epsilon is used.

## Automated suite

Commands used:

```powershell
node --experimental-strip-types --test packages/shared/src/jv/*.test.ts
pnpm dlx --package typescript@5.9.3 tsc -p packages/shared/tsconfig.jv.json
node --experimental-strip-types tools/jv/compare-line-cutting-excel-golden.mjs $env:TEMP\jv-pr05-excel-raw.json docs/jv/fixtures/line-cutting-excel-golden.json
node --experimental-strip-types tools/jv/verify-line-price-parity.mjs
node --experimental-strip-types tools/jv/verify-line-bom-price-parity.mjs
```

PR_05 adds tests for new quantity formulas, trace dependencies, exact rational division/multiplication, independent profiles, missing prices, and unit mismatch. The line-price golden fixture uses fresh Excel output rather than saved formula caches.

## Fixtures and limits

- `fixtures/line-cutting-excel-golden.json`: five scenarios × two books for geometry and quantity rules.
- `fixtures/line-price-excel-golden.json`: L1 P/Q/S/V and exact COM capture fields across 10 runs.
- `fixtures/line-price-snapshots.json`: price values, catalog units, separate profile versions and source hashes.
- `LINE_MATERIAL_PARITY.json`: per-SKU quantity and cost parity.
- `LINE_PRICE_PARITY.json`: per-cell P/Q parity for all 40 rows.

The supported subtotal is exact and partial; no Excel aggregate total has been independently mapped. Painting (V), weight (S), glass, assembly, installation, commercial markup and discount calculations remain outside this PR. The 14 unsupported BOM rows remain explicit and prevent a full-system parity claim.
