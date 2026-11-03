# JV-Line end-to-end report — PR_07

## Environment and method

Both original XLSM files were copied to temporary per-case folders and recalculated with Microsoft Excel 16.0 `CalculateFullRebuild`. Macros and events were disabled. Captured data includes formula, Value2, IEEE-754 bits, format and displayed text. Original books were not edited.

## Results

- 10 scenario inputs per workbook; 20 workbook/scenario recalculations.
- Scenarios include fractional and varied dimensions, 3/4/5/6 leaves, opening selectors 1/2/3, parked and unparked doors, alternative parked-door position, special sash, and service switches.
- Geometry/cuts/BOM/available work outputs: 20 of 20 full captured-case matches, 0 mismatches.
- Base BOM: 40 of 40 rows implemented; 800 quantity comparisons (724 EXACT, 76 DISPLAY_MATCH), 800 amounts (493 EXACT, 307 DISPLAY_MATCH); 0 MISMATCH/UNVERIFIED.
- Additional AA-020…AA-120: 120 quantity comparisons (60 EXACT, 60 DISPLAY_MATCH), 240 amount/price comparisons (70 EXACT, 170 DISPLAY_MATCH); 0 MISMATCH/UNVERIFIED.
- Q52/Q55/Q57: 60 comparisons; 40 EXACT, 20 DISPLAY_MATCH, 0 mismatches. Q52 is partial and all its 20 comparisons are DISPLAY_MATCH; O5/O18 adhesive factors were captured from Excel, not independently derived by the public adapter. Q55/Q57 are exact for these cases.
- `@bms/shared` JV suite: 53 passed, 0 failed.
- Frontend production build and shared typecheck: passed. Frontend development server returned the SPA for `/jv-line-lab` with HTTP 200.

## Limits

The 20 recalculated scenarios do not prove all possible inputs. DISPLAY_MATCH is not numeric equality. No full final price is available: Q53 paint, Q54 glass, Q56 surcharge, Q58 guard and construction-derived adhesive factors remain unresolved in the engine. Glass/fill and paint formulas have been researched and traced in `PR_07_RESULT.md` but are not implemented as full price chains. The UI therefore returns a partial result only.

Backend build still reports existing Prisma/type errors and TypeScript import-extension errors; no legacy business logic was changed to suppress them.

Artifacts: `fixtures/line-cutting-cases.json`, `fixtures/line-cutting-excel-golden.json`, `fixtures/line-price-excel-golden.json`, `LINE_BOM_COVERAGE.json`, `LINE_BOM_PRICE_PARITY.json`, `LINE_FINAL_PRICE_PARITY.json`, `LINE_ADDITIONAL_BOM_PARITY.json`, `LINE_SASH_PROFILE_PARITY.json`.
