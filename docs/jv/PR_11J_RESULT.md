# PR_11J — Slider-X5 commercial calculator

Base commit: PR_11I `92e79cdbf08232b823286904685c45c8a21a8851`, branch `feature/jv-slider-x5`. The existing shared Slider commercial DAG in `packages/shared/src/jv/slider/l5-pricing.ts` now has independently exported `calculateSliderX5Commercial` and `buildSliderX5PriceSnapshot`. X5 uses its PR_11I geometry and BOM, its own rule IDs and separate completion/retail source-literal price snapshots. L3/L5/X3 code paths and exports remain available. Legacy `/calculate`, Prisma, database and React behavior were not changed.

## Source evidence and implemented chain

`tools/jv/capture-slider-commercial-pr11j.ps1` used Excel 16.0 `CalculateFullRebuild` on temporary copies of the original two XLSM books for five cases per profile. `tools/jv/build-slider-x5-price-snapshots-pr11j.mjs` extracted 39 literal material price cells, 17 paint rates, 12 glass rates and service/settings rates per profile, with workbook SHA-256 provenance. The comparator rechecks both original workbook hashes and the snapshot identity.

The ten cases confirm `Главная!F11=6 → G11=3 → S1!A3=1`, `C8=20`, `C9=5`, `C10=25`. The implemented graph calculates 26 separately priced materials among 29 applicable BOM rows; K43/K44/K46 remain quantity-only fasteners included in parent materials, and 13 rows are inapplicable. The graph includes separate profile prices, glass area and group allocation, painting, optional glass/processing work, width service, optional assembly/installation, order-wide glue/activator packages and `ПРМ` area allocation. It closes `S1!M47:M53` and transfers the price via `Главная!T11/Y11` when dependencies are complete. Source formula, address, rule version, catalog/version and dependencies are retained in trace.

`COMPLETE` is supported for the ten captured single-X5 order configurations. A missing full seven-slot order context, a nonzero other-family slot without traced per-unit K40/K41, invalid or missing price literals, or a mismatched workbook profile cannot produce a published M53/Main total. Unsupported order dependencies return `PARTIAL` with diagnostics; invalid source inputs raise typed errors. This PR does not claim full mixed-Slider order parity or universal parity across all size/option combinations.

## Independent Excel parity

`tools/jv/compare-slider-commercial-pr11j.mjs` computes from literal Main inputs, X5 raw selectors, settings, full order context and source catalog literals. It checks source formulas against trace and compares 134 cells per scenario: price/amount rows, glass, painting, work, adhesive allocation, `ПРМ`, subtotal, M53 and Main transfer. `SLIDER_X5_PRICE_PARITY.json` retains source formula, Value2, NumberFormat, exact engine rational, displayed value, comparison class, trace ID and classification evidence.

| Class | Comparisons |
| --- | ---: |
| EXACT | 852 |
| NUMERICALLY_EQUIVALENT | 1 |
| DISPLAY_MATCH | 327 |
| MISMATCH | 0 |
| UNVERIFIED | 160 |

All ten `S1!M53` values and corresponding `Главная!T11/Y11` display-match Excel. The 160 unverified cells are only the 13 inapplicable material amounts and three included-fastener amounts per scenario; the comparator rejects any other unverified mandatory result. Each profile includes three positive active `M49` glass/processing work cases and two disabled `M49=0` cases. The glass D50 calculation remains available in both branches.

The single `NUMERICALLY_EQUIVALENT` is `S1!R10` in the completion `two_leaf_no_glass` case. Exact rational K10=2.45 multiplied by source literal G10=312.5 is 765.625; Excel stores K10 as 2.4499999999999997 and R10 as 765.6249999999999. Its two-decimal display is 765.62, while exact rational rounding gives 765.63. The comparator proves Excel Value2 is **exactly** its captured IEEE-754 operand product and the engine value is **exactly** its rational operand product; no epsilon or forced agreement is used. This one-cent displayed difference is reported, and this scenario's M48 is disabled by price mode, so it does not affect M53. It must be revisited if exact Excel binary display parity is required for all intermediate paint cells.

## Verification

- `pnpm test:jv`: **160 passed, 0 failed**, including ten new X5 commercial tests and existing X5 geometry/BOM tests.
- `pnpm typecheck:shared`: passed.
- `pnpm build:frontend`: passed, with existing Vite/Browserslist/chunk-size warnings.
- `pnpm validate:jv-fixtures`: **35 JSON fixtures** validated.
- `pnpm smoke:jv-line-lab`: passed.
- Resolver tests: **5 passed**.
- Slider-L3 geometry/BOM/commercial, Slider-L5 geometry/BOM/commercial, Slider-X3 geometry/BOM/commercial, Slider-X5 geometry/BOM and new X5 commercial parity: all comparator processes exited successfully; no reported MISMATCH.
- JV-Line order/material/price/final, JV-Zigzag geometry/price/order and Mixed Order parity: all comparator processes exited successfully; no reported MISMATCH. Generated reports from other families were restored to their pre-task Git state before the commit.

Artifacts: `SLIDER_X5_PRICE_RULES.md`, `SLIDER_X5_COMMERCIAL_DEPENDENCIES.md`, `SLIDER_X5_PRICE_COVERAGE.json`, `SLIDER_X5_PRICE_PARITY.json`, `fixtures/slider-pr11j-commercial-capture.json`, `fixtures/slider-x5-price-snapshots.json`. Full per-cell evidence and captured scenario inputs are in the JSON artifacts.
