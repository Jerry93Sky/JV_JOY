# Slider-X3 commercial rules

Sources: `JV-комплектация 08.10.2026.xlsm` and `JV-розница 08.10.2026.xlsm`, recalculated by Excel 16.0 on temporary copies. The shared execution graph is in `packages/shared/src/jv/slider/l5-pricing.ts`; its exported `calculateSliderX3Commercial` selects X3 geometry and BOM and uses an independently captured X3 price snapshot. L5 continues to use its own variant and snapshot. Every calculated amount is an `ExactRational`; the graph retains source address, dependencies, rule version and workbook provenance.

## Materials

There are **26 separately priced X3 BOM rows**, **3 active fastener rows included in related materials**, and **13 inapplicable rows**. `SLIDER_X3_PRICE_COVERAGE.json` lists every `K5:K46` row, its `L` price formula, `M` amount formula, catalog cell and scenario comparisons. The active profile prices are literals in `Прайс-Slider!E5:E43`, captured separately for completion and retail. Profiles differ numerically; no price from one profile is substituted into the other.

- `S1!L5:L13` divide source profile prices by `Настройки!D4`. X3 uses active E5, E9, E11 and E13, not L3/L5's inactive support/sash rows.
- `S1!L18` uses `Прайс-Slider!E18*IF(D28="ДА",Настройки!S26,1)`; X cap rows L19:L21 and X carriage/latch prices use their matching catalog rows.
- `S1!L33:L35` divide the brush prices by `Настройки!L8`. `S1!L40:L42` map to catalog E41:E43.
- Each charged `S1!Mrow` multiplies its `Lrow*Krow`; `M40/M41` additionally multiply `Клей+акт!O5/O18`. There is no monetary rounding inside these source formulas. Display comparison uses each Excel `NumberFormat`.
- `S1!L43:L46` contain text stating that each fastener is included in caps, X carriages or latches, while `M43:M46` are blank in both books. K43, K44 and K46 quantities remain in BOM; they are not charged again. K45 is inapplicable for X3. `M47=SUM(M5:M46)` sums only the 26 charged material amounts.

## Glass, work and total

`Главная!H11` is the price mode feeding `S1!C11`; `Главная!I11` is the literal glass selector feeding `S1!C12`. `S1!C47:C49` split leaf count into glass handle, glass lock and remaining groups using resolved D20/D24/D26. `D47:D49` apply `INDEX('Прайс-Стекло'!D5:D16,C12)` to the exact X3 glass geometry D43*D44/1,000,000 and `Настройки!L17/L18`; `D50=C47*D47+C48*D48+C49*D49`. The source still computes D50 when the optional additional work is off; `M49=IF(Настройки!D32,D53,0)` then excludes it. An inactive charge is a verified zero, not a missing value.

`R5:R21` multiply source material quantities by `Прайс-Slider!G5:G21`. `R22` adds the price-mode L11 branch; `R23/R26` depend on the order allocation `T5=ПРМ!AB25`; `R24=MAX(R13:R23)`, `R27=R24+R26`, and `M48=IF(C11<>1,R27,0)`. `D53=D50+'Прайс-сб+монт'!C23*T5` supplies the enabled `M49` branch. `M50` handles width service and the source K29 latch condition; K29 is inactive for X3. `M51` sums M47:M50 with the F28 surcharge; `M52` is assembly/installation from width, leaf count and height when `Настройки!D34` is enabled. `M53=IF(D6<=2,SUM(M51:M52),"ОШИБКА !")`.

The verified X3 selector gives `Главная!G11=3`, so the `INDEX(R11:X11,G11)` branch in `Главная!Y11` selects T11. The graph computes `T11='S1'!M53/Настройки!D13`, then `Y11=T11*(100+Настройки!D21)/100`. Completion D13=1 and retail D13=0.3 in the captured source versions; these settings are snapshot literals and the API rejects a zero divisor. Both Main outputs are omitted when M53 is unavailable.

The source has no explicit `ROUND` in these commercial total formulas. The implementation preserves exact rational values and reports `DISPLAY_MATCH` separately from equality of Excel's binary `Value2`.
