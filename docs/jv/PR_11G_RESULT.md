# PR_11G — Slider-X3 geometry and BOM

## Executable result

`calculateSliderX3Geometry` and `calculateSliderX3FullBom` are exported from `packages/shared/src/jv/index.ts`. They use the existing rational arithmetic, DAG, typed errors and trace. They accept source user dimensions, opening, leaf count, switches and source `Настройки` values; Excel output cells are never used as calculator inputs. There is no X3 commercial calculator in this PR.

The original XLSM books were opened only as temporary copies in Excel 16.0 with `CalculateFullRebuild`. The source route is `Главная!F11=5 -> G11=3 -> S1!A3=1`, `S1!C8=20`, `C9=3`, `C10=23`. X3 uses `Настройки!S23` in `S1!D44` and `S18` in `D36`, plus X-specific profile, cap, roller and latch rows. See `SLIDER_X3_GEOMETRY_RULES.md` and `SLIDER_X3_BOM_RULES.md`.

All 42 registered `S1!K5:K46` rows are classified. **29 are applicable and calculated** (including formula-derived zeros in selected option branches); **13 are selector-inactive**. The returned positions retain formula, address, SKU when confirmed, unit, exact rational quantity, catalog/rule version and trace. No source book, VBA project or ZIP is stored in the repository.

## Independent Excel checks

`tools/jv/capture-slider-bom-pr11g.ps1` generated `fixtures/slider-pr11g-bom-capture.json` from five scenarios per book, varying size, leaf count, opening direction, `H19`, `H21`, `H25`, `H27`, L6 precision and selector controls. `tools/jv/compare-slider-x3-pr11g.mjs` independently calls the TypeScript calculator and checks the seven returned geometry cells plus all 42 BOM rows in each scenario. Geometry formulas are compared to the original captured formulas; every BOM formula is checked by the automated test.

Both original files were SHA-256 checked against the prior selector capture before the comparison (`COMPLETATION` and `RETAIL`: matches). The capture script enforces the same identity check on repeat runs.

| Class | Comparisons |
| --- | ---: |
| EXACT | 342 |
| NUMERICALLY_EQUIVALENT | 0 |
| DISPLAY_MATCH | 18 |
| MISMATCH | 0 |
| UNVERIFIED (selector-inactive rows) | 130 |

The 18 display matches are binary Excel `Value2` differences on K5, K9, K11, K13 or K33, within their source cell display format. They are **not** claims of exact internal-number equality. See `SLIDER_X3_EXCEL_PARITY.json` for each formula, workbook, value, engine rational and class; `SLIDER_X3_BOM_COVERAGE.json` lists all 42 row decisions.

## Regression and build checks

- `pnpm test:jv`: 139/139 passed, including two new X3 tests that execute ten book scenarios, assert seven geometry outputs, all applicable BOM quantities, source formulas, source trace and invalid inputs.
- `pnpm typecheck:shared`: passed.
- `pnpm build:frontend`: passed (existing Vite deprecation, Browserslist age and chunk-size warnings).
- `pnpm validate:jv-fixtures`: passed, 30 fixture files.
- `pnpm smoke:jv-line-lab`: passed.
- Resolver tests: 5/5 passed.
- Existing parity scripts for Slider-L3 geometry/BOM/commercial, Slider-L5 BOM/commercial, Zigzag geometry/pricing/order, Mixed Order and Line order/prices: all exited successfully with zero reported mismatches. The Zigzag price script rewrites its report as a side effect; that unrelated generated change was restored before committing.

The new modules are exported but are not connected to `/calculate`, Prisma, the React work flow or the L3/L5 commercial functions. No existing calculation rule was edited.

## Limits and PR_11H

`S1!M53` and its route to `Главная!T11/Y11` are identified; X3 price arithmetic, source price snapshots, glass, work, paint, installation, `ПРМ` allocation and order-wide `Клей+акт` packaging have not been independently closed against both Excel books. They must remain `PARTIAL` until PR_11H verifies them. The ten scenarios do not exhaust all valid selector combinations or dimensional boundaries. K43/K44/K46 retain null SKU because a source article mapping has not been confirmed; their quantities are verified.
