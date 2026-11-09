# PR_11E — Slider-L5 geometry and material specification

## Implemented

`packages/shared/src/jv/slider/l5-geometry.ts` exports `calculateSliderL5Geometry`; `l5-bom.ts` exports `calculateSliderL5FullBom` and `calculateSliderL5Bom`. They use the existing JV rational arithmetic, DAG, trace and typed errors. Input is the user's width, height, leaf count, opening choice, resolved controls and source settings. No Excel cached output is an engine input.

Excel 16 `CalculateFullRebuild` on temporary copies of both original books confirmed `Главная!F11=4 → G11=3 → S1!A3=1`, `S1!C8=10`, `C9=5`, `C10=15`. L5 uses `Настройки!S22` in `D44` and `S17` in `D36`; K6/K8 are the five-track profile quantities. K33 uses five tracks. The other copied source expressions were compared against the L5 capture; source formulas and rational results are retained in trace.

The 42-row S1 material block contains 28 applicable L5 positions and 14 formulaically inactive positions in each captured case. The inactive rows are 5, 7, 9, 10, 13, 18–21, 24, 31, 32, 44 and 46. All 28 applicable positions have calculated quantities, including legitimate zero quantities in conditional branches. [Coverage](SLIDER_L5_BOM_COVERAGE.json) lists each row and all eight scenario dispositions.

## Independent Excel parity

The new capture `docs/jv/fixtures/slider-pr11e-bom-capture.json` contains four size/opening/leaf/control scenarios in each price profile, recalculated with Excel 16 on temporary copies. [Parity](SLIDER_L5_EXCEL_PARITY.json) compares geometry and every K5:K46 row: 252 `EXACT`, 10 `DISPLAY_MATCH`, 0 `MISMATCH`, 112 `UNVERIFIED` inactive rows. `DISPLAY_MATCH` is only an agreement at the source decimal display; it is not internal numeric equality. D43:D45 are independently compared for the default case in both books using the earlier F11=4 Excel capture. Further size combinations remain unverified.

## Commercial dependency

L5 routes through the same `S1` worksheet as L3 and reaches `S1!M53`. Its material prices use the L5-active catalog rows (notably E6/E8 rather than E5/E7), while glass, painting, work, installation and `Клей+акт` still depend on the resolved L5 geometry, BOM and order context. The existing L3 commercial function is deliberately variant-specific. A separate L5 price adapter and independent M53 Excel parity are required before declaring L5 commercially complete.

## Verification and scope

`l5.test.ts` calls the real geometry and full BOM functions for all eight Excel cases and checks bad selector/missing-setting errors. All required checks passed: `pnpm test:jv` (130/130), `pnpm typecheck:shared`, `pnpm build:frontend`, `pnpm validate:jv-fixtures` (27 fixture files), and `pnpm smoke:jv-line-lab`. Resolver tests passed 5/5. Existing parity checks for Slider-L3, JV-Line, JV-Zigzag and Mixed Order reported zero mismatches. The frontend build emitted its existing Vite/Browserslist/large-bundle warnings.

Legacy `/calculate`, Prisma and the existing L3 rules are unchanged. The original XLSM files were never saved. The pre-existing untracked `apps/backend/pnpm` and `query` are excluded from the commit.
