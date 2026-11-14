# PR_11H — Slider-X3 commercial calculator

`calculateSliderX3Commercial` is exported through `packages/shared/src/jv/index.ts` from the shared Slider commercial graph in `packages/shared/src/jv/slider/l5-pricing.ts`. The graph was made variant-aware for L5 and X3; X3 supplies its own geometry, 42-row BOM, independently captured completion/retail price snapshots, rule IDs and trace. No new parallel money engine was introduced. The result includes 26 charged material positions, glass, painting, additional work, services, installation, order package factors, M47/M51/M53, Main T11/Y11, diagnostics and `COMPLETE`/`PARTIAL`.

Excel 16.0 `CalculateFullRebuild` on temporary copies of both original XLSM books produced five scenarios per profile. The comparator verifies the current source SHA-256 against the capture and snapshot. Inputs for order allocation come from literal `Главная!C11:D17/F11:F17/Z11:Z17`, not Excel's computed `ПРМ` outputs. Source `L` and charged `M` formulas are checked against the engine trace, ignoring whitespace only.

| Comparison class | Count |
| --- | ---: |
| EXACT | 520 |
| NUMERICALLY_EQUIVALENT | 0 |
| DISPLAY_MATCH | 320 |
| MISMATCH | 0 |
| UNVERIFIED | 160 |

The 160 unverified comparisons are 13 inactive material rows and 3 blank, included-fastener amounts per scenario. All **10 `S1!M53` outputs** and all `Главная!T11/Y11` outputs are `DISPLAY_MATCH`; their underlying Excel `Value2` is not asserted equal to exact rational arithmetic. Full cell-level evidence is in `SLIDER_X3_PRICE_PARITY.json`; the 26/3/13 row classification is in `SLIDER_X3_PRICE_COVERAGE.json`.

| Scenario | Completion M53 display | Retail M53 display |
| --- | ---: | ---: |
| Two leaves, optional glass charge off | 70,956.99 | 25,537.18 |
| Four leaves, two-sided, work and installation on | 185,806.15 | 92,939.57 |
| Three leaves, H21 interlock off, glass type I11=2, glass work on | 153,846.32 | 72,603.16 |
| Four leaves, right opening | 163,054.14 | 66,943.54 |
| Two leaves, glass charge off, installation on | 71,116.98 | 30,275.57 |

The new nine X3 commercial tests exercise both price profiles, all ten source cases, distinct price provenance, material costs, non-double-charged fasteners, glass/work totals, Main transfer, missing context and other-family `PARTIAL`. The previous 139 JV tests remain in the suite. **148/148 JV tests pass**.

The engine does not change `/calculate`, Prisma, React work flows or the legacy BMS calculator. Mixed orders involving other nonzero Slider/Line families remain `PARTIAL` unless traced K40/K41 order inputs are supplied. Other selector and dimension combinations beyond the captured cases are not declared universally equivalent.

## Verification commands

- `pnpm test:jv`: 148 passed, 0 failed.
- `pnpm typecheck:shared`: passed.
- `pnpm build:frontend`: passed. Vite CJS, Browserslist age and chunk-size warnings predate this module.
- `pnpm validate:jv-fixtures`: 32 JSON fixtures validated.
- `pnpm smoke:jv-line-lab`: passed.
- Resolver tests: 5 passed.
- Existing parity scripts: Slider-L3 geometry, BOM and commercial; Slider-L5 BOM and commercial; Slider-X3 geometry/BOM; JV-Line order and prices; Zigzag geometry, pricing and order; Mixed Order. All exited successfully with no reported mismatches. The Zigzag pricing script rewrote its generated report as a side effect; that unrelated change was restored before staging.
- X3 price parity: 10 source-rebuilt cases, 520 EXACT, 320 DISPLAY_MATCH, 0 MISMATCH, 160 UNVERIFIED inactive/blank rows.
