# JV-Line implementation status — after PR_07

## Implemented

- Exact decimal/rational calculation graph and source trace infrastructure.
- JV-Line geometry and parking lookup with provenance; four extracted PD matrices, including `ПД!D117:BA166` and `D173:BA222`.
- Carrier and sash cut calculations, profile lengths, and parking components.
- All 40 base BOM rows plus six additional BOM quantity rules.
- Material pricing for supported catalog rows, Q55 assembly/milling, Q57 installation, and a public adapter returning only a partial status until commercial closure.
- Isolated authenticated frontend page `/jv-line-lab`; local calculation through `@bms/shared`, no API/DB writes.

## Verification

- Fresh Excel 16.0 recalculation: 10 scenarios per workbook, 20 total.
- Geometry/BOM/work outputs match captured values in all listed scenarios.
- Base BOM quantity comparisons: 724 EXACT, 76 DISPLAY_MATCH, 0 mismatch; material amounts: 493 EXACT, 307 DISPLAY_MATCH, 0 mismatch.
- Q52/Q55/Q57: 40 EXACT, 20 DISPLAY_MATCH; the 20 DISPLAY_MATCH cases are Q52, which remains a supported partial subtotal and uses Excel-captured adhesive factors in parity runs.
- JV tests: 53 passed. Shared typecheck and frontend build pass.

## Still partial

- Glass/fill calculation through `L1!C46:G49`, D53/D54 and the selected glass catalog has been formula-mapped but is not implemented end-to-end.
- Paint V13:V18 and Q53 are not implemented.
- `Клей+акт!O5/O18` factors are not derived by the public adapter.
- Q54, Q56 and Q58 are not implemented as a complete guarded total.
- Final commercial price is unavailable; all tested configurations return partial results.
- Backend build remains blocked by existing TypeScript/Prisma issues. No legacy `/calculate`, Prisma schema or production calculation logic changed.

Detailed current coverage: `LINE_FINAL_COVERAGE.json`; remaining work: `PR_08_TASK.md`.
