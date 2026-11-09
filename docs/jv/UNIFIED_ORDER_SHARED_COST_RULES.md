# Unified Order shared-resource rules

## Source formulas and resource quantities

Both original workbooks use Main rows 11–17 and the matching family sheets. `Клей+акт!N5:N11` and `N18:N24` multiply each selector's per-construction quantity by `Главная!Z11:Z17`; `N12` and `N25` apply a one-package minimum and Excel `ROUNDUP`; `O5=N12/SUM(N5:N11)` and `O18=N25/SUM(N18:N24)` allocate purchased package consumption back over real usage.

| Main family | Activator per construction | Adhesive per construction | Engine source |
|---|---|---|---|
| Line | `Lslot!O49` | `Lslot!O50` | Additional BOM `AA-110`, `AA-120` |
| Zigzag | `Zslot!N34` | `Zslot!N35` | Material rows 34, 35 |
| Slider L3/L5/X3/X5 | `Sslot!K40` | `Sslot!K41` | Slider BOM rows 40, 41 |
| Front | literal zero in selector-7 branch | literal zero in selector-7 branch | Front consumable adapter, only confirmed selector-7 path |

The calculations preserve exact rational demand and whole-pack procurement as separate values. Shared resource output is not summed a second time into position prices. Line, Zigzag, Slider and Front family calculators consume shared allocation in their own formulas.

## Weighted area

`ПРМ!AA25=IFERROR(U25*V25*W25/1000000,0)`, `AA32=SUM(AA25:AA31)`, and `AB25:AB31=IFERROR(AArow/($AA$32*Wrow),0)` use Main rows 11–17. On positive inputs the exact share equals `widthMm*heightMm / Σ(widthMm*heightMm*quantity)` and is not rounded by the shared engine.

Front slot references are row-dependent: Excel COM confirmed `F1!Y5=ПРМ!$AB$25` and `F7!Y5=ПРМ!$AB$31`; `ПРМ!AB25:AB31` each contain the corresponding same-row formula. Unified Front dispatch now passes the active Main row so the family consumes its own area share.

## Main commercial transfer

Confirmed source links from the original Main formula capture:

| Family | Main candidate cell |
|---|---|
| Line | `Rrow='Lslot'!Q58/Настройки!D11` |
| Zigzag | `Srow='Zslot'!P44/Настройки!D12` |
| Slider | `Trow='Sslot'!M53/Настройки!D13`; `Urow:Wrow=Trow` |
| Front | `Xrow='Fslot'!S38/Настройки!D14` |

`Yrow=INDEX(Rrow:Xrow,Grow)*(100+Настройки!D(20+slot))/100`; `AArow=Yrow*Zrow*(100+Настройки!D19)/100`; `AA18=SUM(AA11:AA17)`. The Unified Main trace records source output, family divisor, active markup, slot quantity, order discount and source formula. Front slot 7 uses `F7!S38`, not F1.

## Status boundary and evidence

The all-seven adapters and mixed quantities execute in both profiles with source-backed snapshots and shared-context integration tests. `pnpm test:jv` currently passes 198 cases. The separate Line-only comparator remains at 12 scenarios with 3 `NUMERICALLY_EQUIVALENT`, 9 `DISPLAY_MATCH`, no mismatches. The existing Line+Zigzag mixed fixture is a separate lower-level path and does not prove all-seven parity.

Fresh Excel 16 `CalculateFullRebuild` captures on temporary workbook copies provide 12 valid all-seven cases (six per profile); each produces numeric `AA11:AA18`. For those cases, all 84 AA11:AA17 and 12 AA18 engine comparisons remain `UNVERIFIED` in `UNIFIED_ORDER_ALL_SEVEN_PARITY.json` because the available standalone family fixtures do not reproduce the same underlying input set. No Excel Value2 is passed into the engine. The workbook rules exist and are confirmed; the pending step is a provenance-matched fixture bridge plus value comparison, not inference of missing business logic.

Known exceptions remain: three inactive Retail Front `F1!R13` mismatches, `S1!R10` display/dollar distinction, 12 Zigzag active guard-error comparisons, and `ПРМ!R25` source `#REF!`. A financially active mismatch must block parity acceptance even if an engine calculation returns COMPLETE.
