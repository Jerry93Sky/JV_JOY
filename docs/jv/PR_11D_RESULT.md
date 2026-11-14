# PR_11D — Slider-L3 commercial calculator

## Result

Implemented an independently callable Slider-L3 commercial calculation in `packages/shared/src/jv/slider/pricing.ts` and exported it through the existing JV Engine index. It reuses the existing geometry, BOM, rational arithmetic, DAG, typed errors, and trace; it does not modify legacy `/calculate`, Prisma, or the React application flow.

`calculateSliderL3Commercial` returns the geometry, 42-row BOM, separately priced material positions, closed commercial subtotals, exact trace, diagnostics, and `COMPLETE` or `PARTIAL`. It does not fabricate a total when upstream order inputs are missing.

## Verified calculation scope

- Both independent source price profiles are captured from Excel 16 `CalculateFullRebuild` runs. Snapshots retain workbook SHA-256, profile, source literal cell, source formula text, and version.
- The 28 applicable BOM rows remain represented by the material calculation. K43 and K45 remain in the BOM quantity specification, while their cost is excluded from the sum because Excel's labels/formulas treat them as included in related material pricing. The costed subtotal has 26 separately charged lines.
- Material subtotal: `S1!M47 = SUM(M5:M46)`.
- Glass: `S1!D47:D49` use `Прайс-Стекло!D5:D16`, `Настройки!L17/L18`, S1 pane area `D43*D44/1,000,000`; `D50=C47*D47+C48*D48+C49*D49`; `D53=D50+Прайс-сб+монт!C23*T5`.
- Painting: S1 `R5:R22`, including the `C11=4` multiplier, order-dependent labor `R23`, maximum work base `R24`, installation-related `R26`, and `R27=R24+R26`. Excel `M48` is the conditional painting subtotal, not glass.
- Additional work `M49` follows `Настройки!D32` and `D53`.
- Services `M50` follow `Настройки!D33`, `L3`, width, and `K29`.
- Main surcharge `M51` includes the `Главная!F28=2` branch and `Прайс-сб+монт!C25*T5`.
- Installation `M52` follows `Настройки!D34`, `C14`, `C15`, width, height, and leaf count.
- Total `M53` is published only when its dependencies are closed and `D6<=2`.
- Adhesive/activator package minimum is allocated once over the seven order rows using `Клей+акт!N5:N12/O5` and `N18:N25/O18`; `S1!M40/M41` multiply `L*K` by those order factors. Other nonzero families require source-traced K40/K41 context and otherwise keep the result `PARTIAL`.

The precise formula inventory and conditions are in [SLIDER_L3_PRICE_RULES.md](SLIDER_L3_PRICE_RULES.md) and [SLIDER_L3_COMMERCIAL_DEPENDENCIES.md](SLIDER_L3_COMMERCIAL_DEPENDENCIES.md).

## Excel parity

Eight independent cases (four per workbook/profile) were recalculated by Excel 16 on temporary workbook copies. The fixture includes raw order selectors and values after the order was isolated to Main row 11. The comparison covers 576 candidate cells: 307 `EXACT`, 141 `DISPLAY_MATCH`, 0 `MISMATCH`, 128 `UNVERIFIED`. `UNVERIFIED` means the engine has no closed numeric trace for that cell in the tested branch (for example an inactive/not-applicable BOM amount); it is not counted as parity.

For `S1!M53`, all eight cases are `DISPLAY_MATCH` or `EXACT`; seven match the Excel two-decimal display, and the retail `two_leaf_glass` result also equals the captured decimal `Value2`. A `DISPLAY_MATCH` is not asserted as internal numeric equality. The parity file also checks 42 S1 material amounts per case, glass/work/total cells, package factors, and the PRM allocation cells. Exact per-cell formulas, `Value2`, formats, and engine trace values are in [slider-l3-commercial-parity-pr11d.json](fixtures/slider-l3-commercial-parity-pr11d.json).

Supported complete fixtures are limited to single Slider-L3 orders (Main row 11) in the tested size/opening/glass/finish/work combinations, with rows 12–17 set to zero quantity. A nonzero mixed order is not declared complete unless each other selected family supplies formula-provenance-linked K40/K41 consumption. This PR does not claim exhaustive selector/size-boundary coverage.

## Tests and commands

- `pnpm test:jv`: 128 passed, 0 failed.
- `pnpm typecheck:shared`: passed.
- `pnpm build:frontend`: passed (Vite emitted the existing CJS API deprecation, old Browserslist data, and large-chunk warnings).
- `pnpm validate:jv-fixtures`: validated 26 JV JSON fixtures.
- `pnpm smoke:jv-line-lab`: passed (SSR smoke).
- Resolver tests: 5 passed, 0 failed.
- Slider geometry parity: 36 `EXACT`, 0 mismatches across 4 scenarios.
- Slider BOM parity: 224 comparisons; 210 `EXACT`, 14 `DISPLAY_MATCH`, 0 `MISMATCH` (112 cells classified not applicable).
- JV-Line order parity: 6 cases; 36 `EXACT`, 20 `DISPLAY_MATCH`, 0 `MISMATCH`, 14 `UNVERIFIED`.
- JV-Zigzag parity: 300 comparisons; 130 `EXACT`, 170 `DISPLAY_MATCH`, 0 `MISMATCH`.
- Mixed-order parity: 1,538 comparisons; 746 `EXACT`, 418 `DISPLAY_MATCH`, 374 `NUMERICALLY_EQUIVALENT`, 0 `MISMATCH`.
- `node --experimental-strip-types tools/jv/compare-slider-commercial-pr11d.mjs`: 8 recalculated Excel cases compared; see parity fixture.
- `node tools/jv/build-slider-price-snapshots-pr11d.mjs`: rebuilt separate completion/retail source snapshots (39 catalog literals per profile, plus paint/glass/service rates).

The available repository has pre-existing untracked `apps/backend/pnpm` and `query`; both are intentionally excluded and untouched.

## Remaining scope / PR_11E candidates

- Mixed-family orders need independently calculated upstream K40/K41 for each selected L1/L2/S1/S2/S3/S4/F1 slot before the global adhesive factors can close.
- Broaden Excel scenarios across additional selector combinations, dimension boundaries, and active/inactive branches; the current commercial capture is eight cases, not exhaustive coverage.
- The 152 `UNVERIFIED` candidate cells are not all supported active outputs; distinguish inactive formula branches from not-yet-modeled active branches as coverage expands.
- Confirm application integration only in a later PR. No legacy endpoint/API switch was made here.

## File integrity

Excel sources were opened read-only or copied to temporary files for recalculation. No original workbook, archive, production schema, or legacy calculation code was changed.
