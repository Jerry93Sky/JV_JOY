# PR_10E — Zigzag BOM quantity rule closure

## Implemented

- Added the previously missing rules N6/N7, N20:N26, N30/N31, and N34/N35. Together with prior rules, every formula row in Z1!N5:N35 now has an executable exact-rational calculation rule (31/31).
- N6 expands C22/C23 and D22/D23 to the existing Zigzag D29/D30 outputs plus source Настройки values. N7 is the exact N6 alias.
- N20/N21 now reproduce G37/G38/G39, `MATCH` into `#3!N5:N10`, and `INDEX` into O/P. The workbook literal table is captured as source data; all six selector/sash-parity combinations have unit tests.
- N22:N26 are implemented as their exact aliases.
- N30 uses exact rational division then Excel `ROUNDUP(...,0)`.
- N31 follows both D16 and D13 branches and stays an exact rational. A non-terminating value is never rounded to fit the shared decimal quantity type; it carries a trace warning and is listed in `unsupportedRows` for decimal-only specification export.
- N34/N35 calculate per-construction consumption with the exact `Настройки!L6` precision switch. Whole-order package minimums/allocation remain separate and are not duplicated per construction.
- Trace entries now include each formula's actual dependency references, resolved values where available, exact rational result, rule ID, source cell/formula, and lookup catalog/version.

## Independent Excel parity

Both original workbook hashes were verified by the resolver. Excel 16 `CalculateFullRebuild` ran on 12 temporary-copy cases covering both price profiles, 3600/4200 mm widths, 4/5 sashes, opening selectors 1/2/3, D13 and D16 branches, and both L6 rounding modes.

There were 696 comparisons across geometry, N5:N35 and the intermediate cells C22/C23, D22/D23 and G37:G41:

| Classification | Count |
|---|---:|
| EXACT | 528 |
| DISPLAY_MATCH | 0 |
| NUMERICALLY_EQUIVALENT | 0 |
| MISMATCH | 0 |
| UNVERIFIED | 168 |

All integer and terminating-decimal BOM quantities and lookup values matched exactly. UNVERIFIED covers non-terminating exact rational results compared with Excel COM's finite `Value2` decimal string; no tolerance or prior comparison was promoted to confirmed. Details are in `ZIGZAG_BOM_PARITY.json` and `NEXT_FAMILY_EXCEL_PARITY.json`.

## Specification and price limits

The mathematical BOM rule set is 31/31. Thirty quantities in the captured scenarios serialize as exact decimals. N31 includes cases such as `6017/475`, for which a finite `DecimalString` does not exist. The shared specification type requires a decimal string, so its `quantity` is intentionally omitted for such a case and its rational remains accessible in `exactQuantities` and trace. The exported specification is therefore still `PARTIAL` until consumers accept exact rational quantities.

No P44 price was implemented. P38:P44 formulas have been refreshed in `ZIGZAG_PRICE_DEPENDENCIES.md`; per-order consumable allocation, profile prices, additional work, assembly/milling, painting and installation still require separate formulas and Excel parity.

## Verification

- `pnpm test:jv`: 89/89 pass, including 7 PR_10E-specific tests.
- `pnpm typecheck:shared`: pass.
- `pnpm build:frontend`: pass (existing Vite CJS, stale Browserslist data and large chunk warnings).
- `pnpm validate:jv-fixtures`: 15 fixtures valid.
- `pnpm smoke:jv-line-lab`: pass.
- `node --test tools/jv/resolve-excel-sources.test.mjs`: 5/5 pass.
- `pnpm parity:jv-order`: 6 cases, 0 mismatch; prior 36 EXACT, 20 DISPLAY_MATCH, 14 UNVERIFIED retained.
- `git diff --check`: pass.

Legacy `/calculate`, Prisma schema, production database, existing BMS algorithms and React workflow were not changed. The new calculation remains in the independent shared JV engine; no final Zigzag price is exposed.
