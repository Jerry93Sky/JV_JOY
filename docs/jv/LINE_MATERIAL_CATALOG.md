# JV-Line material catalog snapshot (identifier layer)

Version: `JV-LINE-CATALOG-2026-10-08`.

The source books contain 40 populated JV-Line specification rows in `L1!L5:O44`. Each row links its SKU/name/unit through `L1!Lx:Nx` to `Прайс-Line!B:C:D` (with catalog row 26 skipped: L1 row 26 points to catalog row 27). Both books have identical 40 SKU/name/unit mappings and identical `L1!O5:O44` formulas/constants. The exact row-level snapshot is [`fixtures/line-material-catalog.json`](fixtures/line-material-catalog.json); it intentionally excludes price, weight and painting values.

## Implemented rows

| Excel source | Catalog identity | Quantity rule | Status |
|---|---|---|---|
| `L1!O5`, `L1!L5:N5` → `Прайс-Line!B5:D5` | `LN-010`, Профиль несущий, `п.м` | `=$D$32/1000+Настройки!$D$7/1000`; reuse existing cutting result | exact decimal rule; Excel COM difference recorded in four cases |
| `L1!O9:O10` → catalog rows 9:10 | `LN-050-L/R`, left/right tee, `шт.` | `IF(OR(D7=... ,D6=2),1,0)`; left/right independent conditions | explicit D7 and D6 source inputs |
| `L1!O11` → catalog row 11 | `LN-060`, low roller carriage, `шт.` | `=D5-D6` | explicit D5/D6 source inputs |
| `L1!O21:O22` → catalog rows 21:22 | `LN-140-L/R`, left/right disconnectors, `шт.` | same side/direction branch as Excel expressions | explicit D7 and D6 source inputs |
| `L1!O23` → catalog row 23 | `LN-150`, connection plate, `шт.` | `=3*D6` | explicit D6 source input |
| `L1!O24:O25` → catalog rows 24:25 | `LN-160`, 90° plate; `LN-170`, 135° plate, `шт.` | `=D6*IF(D9=90,1,0)` / `=D6*IF(D9=135,1,0)` | D9 is source constant 90 in both books; no angle selector is exposed |
| `L1!O30:O32` → catalog rows 30:32 | `LN-TF`, `LN-TSL`, `LN-TSR`, upper side caps, `шт.` | frame switch D15 controls `0/2`, `1/0`, `1/0` | explicit D15 source input |
| `L1!O40`, `L1!L40:N40` → `Прайс-Line!B41:D41` | `LN-210`, Верхняя петля + 2 башмака + винты, `шт.` | constant `0` | literal zero rule |
| `L1!O41`, `L1!L41:N41` → `Прайс-Line!B42:D42` | `LN-220`, Нижняя петля + 2 башмака + винты, `шт.` | constant `0` | literal zero rule |

The 11 original switch/count formulas use explicit resolved L1 cells D5/D6/D7/D15; the angle formula uses the verified workbook constant `L1!D9=90`. No mapping of those cells to the new BMS UI is implied. Zero is a present, confirmed quantity. It is distinct from lines with unavailable/unimplemented quantity rules. A zero line must not be interpreted as proof that the item is generally unnecessary in other products or workbook versions.

## Remaining source rows

After PR_05, 26 lines are supported when all needed source inputs are supplied; the other 14 are preserved in the catalog snapshot with exact L1 quantity formulas/constants and marked `QUANTITY_RULE_NOT_IMPLEMENTED`. Missing conditional inputs leave their related rows unsupported rather than filling them with zero. Remaining rows depend on parking table lookups and validation, sash/profile geometry, or additional dimensions. See [`LINE_BOM_COMPLETION.md`](LINE_BOM_COMPLETION.md) and [`LINE_MATERIAL_COVERAGE.json`](LINE_MATERIAL_COVERAGE.json). Glass and services are not in this `Прайс-Line`/`L1!L5:O44` subset; they need separate sheets and categories.

Catalog categories are currently limited to `material` (`п.м`) and `component` (count/set/pair units) based on the source unit. Catalog snapshot parity confirms identity/unit equality between the two books; it does not establish quantity or cost parity for unsupported lines. Prices differ by workbook and are deliberately not copied to the versioned quantity catalog.

## Price/cost dependency map

For the carrier line, Excel contains:

- `L1!O5`: quantity in `п.м`.
- `L1!P5 = 'Прайс-Line'!$E5/Настройки!$D$2`.
- `L1!Q5 = $P$5*$O$5` (line amount; no explicit `ROUND` in this expression).
- `L1!S5 = O5*'Прайс-Line'!F5` (weight output).
- `L1!V5 = $O$5*'Прайс-Line'!$G$5` (painting amount output).

These formulas differ by item row: e.g. `L1!P9='Прайс-Line'!$E9` has no D2 divisor, while `L1!P44='Прайс-Line'!$E45/Настройки!$L$7`; `L1!O44` uses `ROUNDUP`. PR_05 preserves these row-specific formula groups and implements exact rational P/Q material amounts for supported BOM lines. The books use distinct price snapshots; `Настройки!D2` is an operand in P5:P8. S, V, painting, weight, discount, markup and construction totals remain outside the engine; see [`LINE_PRICE_RULES.md`](LINE_PRICE_RULES.md).

## Existing GlasS/BMS divergences observed

`apps/backend/src/prisma/import-formulas.ts` is an older formula import catalog. It maps some same SKU identifiers but quantity expressions do not reproduce the spreadsheet rules. Confirmed examples:

- BMS `LN-010`: `round((width + 100) / 1000 / cutCoeff, 3)`; Excel `L1!O5` consumes `D32` (the four-cut total) and `Настройки!D7`. It is a structurally different approximation.
- BMS `LN-050-L` and `LN-050-R`: each constant `1`; Excel `L1!O9:O10` conditionally selects left/right based on `D7` or `D6=2`.
- BMS `LN-060`: `panels - 1`; Excel `L1!O11=D5-D6`, so the expressions diverge when `D6` is not 1.
- BMS `LN-140-L/R`: each constant `1`; Excel `L1!O21:O22` uses the directional/two-side switch.
- BMS `LN-150`: `panels - 1`; Excel `L1!O23=3*D6`.
- BMS `LN-210`/`LN-220`: quantity `panels`; Excel `L1!O40:O41` is literal `0` in both provided source books.

PR_04 does not change those legacy records or endpoints. Reuse of an SKU label alone is not evidence that BMS and Excel quantities match.
