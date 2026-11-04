# JV-Zigzag BOM quantity rules

Source: both original XLSM workbooks, recalculated with Excel 16 `CalculateFullRebuild` on temporary copies. Quantity formulas are in `Z1!N5:N35`; source workbook hashes are recorded in `fixtures/zigzag-geometry-excel.json`. The implementation is `packages/shared/src/jv/zigzag/material-quantities.ts` and is exported from `packages/shared/src/jv/index.ts`.

## Implemented rows

| Cell | Catalog ID | Unit | Excel formula | Implemented dependency |
|---|---|---|---|---|
| N5 | LN-010 | m | `=$D$20/1000+Настройки!$D$8/1000` | D20 is confirmed as D3; width and D8 are raw inputs. |
| N6 | LN-020 | m | `=($C$22*$D$22+$C$23*$D$23)/1000+Настройки!$D$6/1000` | C22=D6; C23=D5*D6-C22; D22=D29+2P16+2P17-P12-P13+L23; D23=D30+2P16+2P17-2P13+L23. D29/D30 come from Zigzag geometry. |
| N7 | LN-030 | m | `=$N$6` | Exact alias of N6. |
| N8 | LN-040 | m | `=IF(D13="ДА",C21*D21/1000+Настройки!D8/1000,0)` | Confirmed existing frame branch; D13 false produces exact zero. |
| N9 | LN-070-A | piece | `=($D$5-1)*$D$6` | Sash/opening counts. |
| N10 | LN-080 | piece | `=$D$5*$D$6` | Sash/opening counts. |
| N11 | LN-100 | piece | `=$N$10+IF($D$15="ДА",1,0)` | N10 and selector D15. |
| N12 | LN-110 | piece | `=IF($D$14="ДА",$D$6,0)` | Selector D14 and opening count. |
| N13 | LN-120 | set | `=$D$6` | Opening count. |
| N14 | LN-130 | set | `=$D$6` | Opening count. |
| N15 | LN-150 | piece | `=1` | Constant quantity. |
| N16 | LN-180 | piece | `=$N$9` | N9 alias. |
| N17 | LN-TL | piece | `=0` | Formula-confirmed zero. |
| N18 | LN-TR | piece | `=IF($D$6=2,2,0)` | Opening branch. |
| N19 | LN-TF | piece | `=IF($D$13="ДА",0,2)` | Frame branch. |
| N20 | LN-TSL | piece | `=IF($D$13="ДА",1,0)*$G$40` | G37/G38/G39 -> MATCH of #3!N5:N10 -> INDEX #3!O5:O10. |
| N21 | LN-TSR | piece | `=IF($D$13="ДА",1,0)*$G$41` | Same key/index path, INDEX #3!P5:P10. |
| N22 | LN-BL | piece | `=$N$17` | Exact alias of formula-zero N17. |
| N23 | LN-BR | piece | `=$N$18` | N18 alias. |
| N24 | LN-BF | piece | `=$N$19` | N19 alias. |
| N25 | LN-BSL | piece | `=$N$20` | N20 alias. |
| N26 | LN-BSR | piece | `=$N$21` | N21 alias. |
| N27 | LN-210 | piece | `=$D$5*$D$6-$D$6` | Sash/opening counts. |
| N28 | LN-220 | piece | `=$N$27` | N27 alias. |
| N29 | LN-230 | piece | `=IF($D$17="ДА",1,0)` | Selector D17. |
| N30 | AA-010 | piece | `=ROUNDUP(2*$N$7/(Настройки!$L$7*Настройки!$P$21/1000),0)` | Exact rational calculation and Excel ROUNDUP to integer. |
| N31 | AA-020 | m | `=(2*$N$5+IF($D$16="ДА",2*$N$6,0)+IF($D$13="ДА",$N$8,0))/Настройки!$L$8` | Exact rational formula, including independent D16 and D13 branches. Non-terminating results remain rational. |
| N32 | AA-050 | piece | `=$D$6*$D$5-1` | Sash/opening counts. |
| N33 | AA-070 | piece | `=2` | Constant quantity. |
| N34 | AA-110 | piece | `=ROUNDUP(0.001*2*$D$3/Настройки!$L$4,IF(Настройки!$L$6,0,3))` | Per-construction activator consumption. L6 chooses 0 or 3 digits; no order package count is inferred here. |
| N35 | AA-120 | piece | `=ROUNDUP(0.001*2*$D$3/Настройки!$L$5,IF(Настройки!$L$6,0,3))` | Per-construction glue consumption. Whole-order packaging/allocation is not counted here. |

## Selector path for N20:N21

Excel source formulas observed in both workbooks:

```text
G37 = IF(Главная!J11=1,1,IF(Главная!J11=2,2,IF(Главная!J11=3,3,"ОШИБКА !")))
G38 = IF(ISEVEN(D5),2,1)
G39 = 10*G37+G38
H39 = MATCH(G39,'#3'!N5:N10)
G40 = INDEX('#3'!O5:O10,H39)
G41 = INDEX('#3'!P5:P10,H39)
```

`#3!N5:P10` is a literal lookup table in both original files; it is not an array formula or a calculated result:

| Row | N key | O left cap count | P right cap count |
|---|---:|---:|---:|
| 5 | 11 | 2 | 0 |
| 6 | 12 | 1 | 1 |
| 7 | 21 | 0 | 2 |
| 8 | 22 | 1 | 1 |
| 9 | 31 | 1 | 1 |
| 10 | 32 | 1 | 1 |

The six possible selector/parity combinations are covered by unit tests; the Excel fixture also varies J11 and sash parity.

## Exactness and remaining integration limit

The engine retains exact rational quantities for all 31 formulas. Thirty quantities convert exactly to the shared decimal specification type in the exercised scenarios. N31 is often non-terminating (for example, `6017/475` for the verified 3600 mm fixture); the engine keeps its rational value and trace, and does not round it to fit `DecimalString`. The current `SpecificationLine.quantity.value` cannot carry this fraction, so the returned specification remains `PARTIAL` and N31 is listed in `unsupportedRows` until the exact quantity contract is extended. No formula rule is missing, but a decimal-only BOM export or price layer must not consume that line as zero or as an approximation.

N34/N35 are per-construction consumption. `Клей+акт!N12/N25` and O5/O18 use whole-order package minimums and allocation factors. They are intentionally not folded into each construction line here, avoiding double allocation. No P44 total is exposed.
