# JV-Zigzag commercial dependency map

Verified directly with Excel 16 `CalculateFullRebuild` on temporary copies of both original books. The same formulas are present in completion and retail workbooks; price source tables differ by profile.

## P38:P44 source formulas

| Cell | Excel formula | Role / current status |
|---|---|---|
| P38 | `=SUM($P$5:$P$35)` | Sum of the 31 BOM row amounts. P38 cannot be final while N31 has no decimal quantity representation and several price/work rows have not been mapped into the new Zigzag calculation. |
| P39 | `=IF($C$8<>1,$U$18,0)` | Conditional charge from U18; its condition and source work/catalog pricing still need independent Zigzag parity. |
| P40 | `=IF(Настройки!$D$32,$H$33,0)` | Conditional paint/work charge; H33 dependency and both branches need porting. |
| P41 | `=IF(Настройки!$D$33,$D$3*'Прайс-сб+монт'!$C$6/1000,0)+IF(Настройки!$L$3,$N$10*'Прайс-сб+монт'!$C$19,0)` | Assembly and milling-related work; distinct settings and price inputs. |
| P42 | `=SUM($P$38:$P$41)+IF(Главная!$F$28=2,'Прайс-сб+монт'!$C$25*$W$5,0)` | Construction subtotal plus an optional order-level glue/activator allocation (W5). |
| P43 | `=IF(Настройки!$D$34,$D$3*'Прайс-сб+монт'!$C$8/1000+$D$5*$D$4*'Прайс-сб+монт'!$C$9/1000+$D$5*'Прайс-сб+монт'!$C$13,0)` | Conditional installation work; requires dimensions/counts, three price inputs and D34 branch. |
| P44 | `=SUM($P$42:$P$43)` | Workbook output consumed by `Главная!S11` after the workbook's own selector/divisor logic. This is not implemented as an engine final price. |

The direct P38:P44 formulas are identical in both XLSM. For the baseline 3600 x 2400 four-leaf scenario, Excel produced different P38/P39/P40/P41/P43 amounts by price profile as expected; those cached values are diagnostic only and are not code inputs or parity targets.

## Position price rows and order allocation

P5:P35 calculate per-row amount from the corresponding O price and N quantity. N34/N35 have separate whole-order glue factors in the existing workbook: `P34=O34*N34*'Клей+акт'!O5`, `P35=O35*N35*'Клей+акт'!O18`. The new Zigzag module returns only each construction's exact consumption formula. `Клей+акт!N12/N25` apply `MAX(1,ROUNDUP(SUM(...),0))`-style package minima, and O5/O18 allocate the order packages over eligible consumption. The shared order-level architecture can host the later allocation; duplicating it into each construction would double charge multi-position orders.

## Remaining commercial work

- Port and parity-check the 31 profile-specific O prices and all P5:P35 amount formulas, including exact glue allocation.
- Resolve the exact-rational N31 quantity through a rational-compatible specification and pricing contract. It must not be rounded into `DecimalString`.
- Trace and port U18 -> P39, H33 -> P40, and the source/settings for P41 and P43 with positive and zero branches.
- Confirm F28 selector allocation for P42/W5 using multi-construction orders; do not reuse JV-Line factors without Zigzag source parity.
- Compare P38, P39, P40, P41, P42, P43 and P44 against newly rebuilt workbook scenarios only after each dependency is implemented.

**Conclusion:** quantities are mathematically implemented for all 31 cells, with exact-rational serialization needed for N31. No P44 total is calculated or advertised by the engine.
