# Slider-L5 commercial rules

The callable `calculateSliderL5Commercial` is in `packages/shared/src/jv/slider/l5-pricing.ts`. It uses the independently implemented L5 geometry and 42-row BOM, the existing JV rational DAG and trace, and distinct versioned completion/retail snapshots from the original workbooks. Excel 16 `CalculateFullRebuild` captures were made on temporary copies.

The 28 applicable material rows include 26 separately costed lines. K43 and K45 remain in the specification, but their costs are included in related materials; adding them again would double charge. L5 activates K6 and K8, drawing raw prices from `Прайс-Slider!E6` and `E8`, where L3 uses K5/K7. For rows 5–13, `Lrow=Erow/Настройки!D4`; rows 14 and 18 conditionally use `S26`; rows 33–35 divide by `L8`. Rows 40 and 41 use catalog E41/E42 and order-wide `Клей+акт!O5/O18`. `Mrow=Lrow*Krow` except those two adhesive multiplier rows; `M47=SUM(M5:M46)`.

`C47:C49` use L5-resolved D20/D24/D26 and the leaf/side count. Glass rates come from `INDEX('Прайс-Стекло'!D5:D16,C12)`. `D47:D49` use L17/L18 or the base rate and `D43*D44/1,000,000`. `D50=C47*D47+C48*D48+C49*D49`; `D53=D50+Прайс-сб+монт!C23*T5`; `M49=IF(Настройки!D32,D53,0)`.

Painting uses `R5:R21=Krow*Прайс-Slider!Grow`, `R22=SUM(R5:R21)*IF(C11=4,L11,1)`, `R23=L9*L10*T5`, `R24=MAX(R13:R23)`, `R26=C24*T5`, `R27=R24+R26`, and `M48=IF(C11<>1,R27,0)`. `M48` is the painting/work subtotal. `M50` uses D33/C7/width and L3/C19/K29; `M51` adds M47:M50 and the F28/C25/T5 branch; `M52` uses D34/C14/C15/width/height/leaves; `M53=IF(D6<=2,SUM(M51:M52),"ОШИБКА !")`.

`ПРМ!AA25:AA32/AB25` computes area share and `S1!T5`. `Клей+акт!N5:N12/O5` and `N18:N25/O18` allocate minimum whole adhesive packages across the order. Main row 11 is calculated from L5 K40/K41; other nonzero rows require source-provenance-linked family K40/K41 inputs in Order Context. Missing inputs yield `PARTIAL` without M47 or M53. There is no monetary rounding inside the rational engine; Excel `NumberFormat` is evaluated only by the parity comparator.
