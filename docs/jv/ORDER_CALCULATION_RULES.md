# JV Order calculation rules (PR_09)

## Scope

`calculateLineOrder` in `packages/shared/src/jv/order-line.ts` is an order-level coordinator for supported JV-Line positions. It delegates all construction arithmetic to `calculateLineConstruction`; it does not copy the geometry, BOM, glass, paint, or commercial formulas. The module is independent of React, `/calculate`, Prisma, and the production database.

An order position has an ID, a unique Excel slot 1–7, a family, a count, and—when family is `LINE`—the existing `LineEngineInputs`. The selected workbook, profile, and price snapshots are order context. Each line position is stamped with its actual `L1`…`L7` provenance before calculation.

## Confirmed Excel dependencies

Both workbooks use the following formulas (verified by Excel 16 COM reads and full rebuilds on temporary workbook copies):

| Source | Formula | Order meaning |
|---|---|---|
| `ПРМ!U25` | `=Главная!C11` | Slot width input in millimetres |
| `ПРМ!V25` | `=Главная!D11` | Slot height input in millimetres |
| `ПРМ!W25` | `=Главная!Z11` | Number of instances in slot |
| `ПРМ!AA25` | `=IFERROR(U25*V25*W25/1000000,0)` | Slot area in square metres multiplied by count |
| `ПРМ!AA32` | `=SUM(AA25:AA31)` | Total area across seven order slots |
| `ПРМ!AB25` | `=IFERROR(AA25/($AA$32*W25),0)` | Per-instance allocation for slot 1; sibling formulas continue through `AB31` |
| `L1!X5` | `=ПРМ!$AB$25` | Per-instance allocation consumed by the construction sheet |
| `L2!X5` | `=ПРМ!$AB$26` | Slot 2 reads the next allocation; the corresponding source row is captured per slot |
| `Клей+акт!N12` | `=IF(ROUNDUP(SUM(N5:N11),0)>1,ROUNDUP(SUM(N5:N11),0),1)` | Whole activator package minimum for the workbook order |
| `Клей+акт!O5` | `=N12/SUM(N5:N11)` | One shared multiplier applied to the activator position amount |
| `Клей+акт!N25` | `=IF(ROUNDUP(SUM(N18:N24),0)>1,ROUNDUP(SUM(N18:N24),0),1)` | Whole adhesive package minimum for the workbook order |
| `Клей+акт!O18` | `=N25/SUM(N18:N24)` | One shared multiplier applied to the adhesive position amount |
| `L1!Q52` | `=SUM($Q$5:$Q$50)` | Material subtotal for this slot, including the supported supplemental BOM rows |
| `L1!Q53` | `=IF($C$10<>1,$V$18,0)` | Slot paint charge, including the X5-based share of minimum/transport |
| `L1!Q54` | `=IF(Настройки!$D$32,$D$54,0)` | Optional glass/fill surcharge |
| `L1!Q55` | `=IF(Настройки!$D$33,$D$3*'Прайс-сб+монт'!$C$5/1000,0)+IF(Настройки!$L$3,$O$15*'Прайс-сб+монт'!$C$19,0)` | Assembly and milling for this slot |
| `L1!Q56` | `=SUM(Q52:Q55)+IF(Главная!$F$28=2,'Прайс-сб+монт'!$C$25*$X$5,0)` | Slot subtotal with the mode-2 X5 allocation |
| `L1!Q57` | `=IF(Настройки!$D$34,$D$3*'Прайс-сб+монт'!$C$8/1000+$D$5*$D$4*'Прайс-сб+монт'!$C$9/1000+IF($D$6=2,'Прайс-сб+монт'!$C$10)+$D$8*'Прайс-сб+монт'!$C$11+IF($C$23,'Прайс-сб+монт'!$C$12,0),0)` | Installation for this slot |
| `L1!Q58` | `=IF(AND($D$6<=2,D7<>"ОШИБКА !"),SUM($Q$56:$Q$57),"ОШИБКА !")` | Final guarded slot amount |

The COM evidence confirms `U25*V25*W25` and `AA32*W25` in the AB formula. The count cancels algebraically, so the implemented exact rational share for a supported Line slot is `width*height / sum(width*height*quantity)`. This is the per-instance X5 factor; the order subtotal then multiplies each slot result by its count.

## Order orchestration

1. Run the existing JV-Line construction engine once to obtain each position's base/additional BOM quantities. These provisional prices are not returned.
2. Sum `L1!O49` activator and `L1!O50` adhesive consumption across the explicit position counts. Call the existing `calculateLineAdhesiveFactors` once with the order aggregate and a unit count of one. That preserves the source whole-package `ROUNDUP` rule and calculates one shared factor per material.
3. Derive exact per-instance `X5` allocations from `ПРМ!AB25:AB31` using the active slot dimensions and counts.
4. Rerun `calculateLineConstruction` with the shared glue factors and slot X5. Q52–Q58 values remain per instance in each construction result.
5. Use a traced order aggregation rule to sum each per-instance Q52–Q58 amount multiplied by that slot's construction count. Q56 is a subtotal and is exposed separately; final order value is aggregate Q58, so Q52–Q56 are not added a second time to Q58.
6. Aggregate supported BOM rows by SKU, summing `quantity × count` and `amount × count`. Preserve source position IDs on every aggregate line.

The shared glue rules are not applied a second time during aggregation: line pricing receives the single shared O5/O18 multiplier before the per-instance totals are multiplied by order count. The shared allocation and Q52:Q58 aggregation steps have trace IDs and their inputs/results are included in the order result.

## Completeness contract

- **COMPLETE** is returned only if every active position is supported JV-Line, snapshots match the chosen workbook/profile, each line calculation has a publishable Q58, and no Excel guard fails.
- **PARTIAL** is returned for a mixed-family order. Construction-level JV-Line diagnostics may be included, but each is marked `CONSTRUCTION_ONLY_ORDER_RULES_UNAVAILABLE`; order totals and order specification are omitted. This prevents a Line-only glue minimum or X5 allocation from being misrepresented as a mixed-order result.
- Any incomplete JV-Line price branch prevents order totals. Typed validation errors reject duplicate/invalid Excel slots and incompatible price snapshots.

## Evidence and limits

Excel capture is in `fixtures/line-order-excel-golden.json`; comparison is in `ORDER_EXCEL_PARITY.json`. Six scenarios were recalculated with Microsoft Excel 16 `CalculateFullRebuild`: quantities 1, 3, and a two-slot order with different dimensions and quantities, in both books. Inputs are raw Main!C/D/Z values and the captured source settings/selectors; Q cells, X5, and glue factors are outputs, never engine inputs.

These cases verify one and multiple JV-Line slots in the two pricing profiles. They do not prove mixed-family aggregation. Cross-family glue/activator consumption, unsupported system engines, exhaustive additional-work branches, and a fully interactive authenticated UI are outside verified coverage.
