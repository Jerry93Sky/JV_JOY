# JV-Slider-L3 BOM quantity rules (PR_11C)

## Scope and source

This module adds ten quantity formulas for the L-system, three-track Slider-L3 (`Главная!F11=3`, `S1!C8=10`, `S1!C9=3`, `S1!C10=13`). It consumes the independently computed `SliderL3GeometryResult`, the source switch `Настройки!H21`, `Настройки!H23`, and the resolved selector value `S1!D22`. The workbook resolves `D22` through `Настройки!I27` and `#1!G24:G26`; PR_11B accepts the resolved label and does not recreate the selector UI mapping.

Source capture: [`slider-pr11b-bom-capture.json`](fixtures/slider-pr11b-bom-capture.json), Excel 16.0 `CalculateFullRebuild` on temporary copies of both original books across eight scenarios. The original workbooks were not modified. BOM catalog identity is read from `S1!F:H`; formulas generally link the catalog cells to matching rows in `'Прайс-Slider'!B:D`. Descriptions in this table are the recalculated Excel values.

## Implemented material quantities

| Cell | SKU | Name / unit | Excel quantity formula | Direct computed dependencies | Branch |
|---|---|---|---|---|---|
| `S1!K14` | `SL-140-0` | Заглушка L створочная боковая НОВАЯ / шт. | `=$J$14*2*$D$6` | L system selector, `D6` side count | Three-track L system |
| `S1!K15` | `SL-140-2` | Заглушка L створочная 2-стор. / шт. | `=$J$15*(2*$D$5-$K$14)` | leaf count, `K14`, `H21` (`D28`) | Selected only when `H21=FALSE` |
| `S1!K16` | `SL-140-L` | Заглушка L створочная левая НОВАЯ / шт. | `=$J$16*(2*$D$5-$K$14)/$D$6` | leaf count, `K14`, `D6`, `H21`, opening | H21 and opening left/two-sided |
| `S1!K17` | `SL-140-R` | Заглушка L створочная правая НОВАЯ / шт. | `=$J$17*(2*$D$5-$K$14)/$D$6` | leaf count, `K14`, `D6`, `H21`, opening | H21 and opening right/two-sided |
| `S1!K22` | `S-080` | Демпфер заглушки c кольцом / шт. | `=2*($K$15+$K$19)+$K$16+$K$17+$K$20+$K$21` | K15:K17 and X-family K19:K21 | For L3, K19:K21 are inactive because their selector code is 20 while `C8=10` |
| `S1!K23` | `SL-150` | Роликовая каретка L / шт. | `=$J$23*2*$D$5` | leaf count, L system selector | L variant |
| `S1!K29` | `SL-160` | Задвижка нижняя L с винтом (комплект) / шт. | `=$J$29*$D$6*(IF($D$22="1 / 2",1,0)+IF($D$22="2 / 4",2,0))-$K$30` | `D6`, resolved `D22`, `K30` | Uses exact source choice labels; subtraction is preserved even if a source scenario yields a negative result |
| `S1!K30` | `SL-161` | Задвижка нижняя L с ручкой (комплект) / шт. | `=$J$30*$D$6` | `D6`, `H23` | `H23` is the source selector for J30 |
| `S1!K43` | — | Саморез 3,5х20 головка впотай, крепл. заглушек / шт. | `=2*SUM($K$14:$K$21)` | Every K14:K21 value | Source-described material, no SKU in `S1!F43` |
| `S1!K45` | — | Саморез с прессшайбой 4,2x25 - креп. L-задвижки / шт. | `=2*$K$29` | K29 | Source-described material, no SKU in `S1!F45` |

All ten formulas execute using `ExactRational` BigInt arithmetic in [`bom.ts`](../../packages/shared/src/jv/slider/bom.ts). Each result has a graph trace carrying the formula, source cell, rule version and dependency IDs. No Excel output is fed into the calculation. The catalog capture also shows `S1!L43` and `L45` are text stating that their cost is included in the corresponding plug/latch cost; those rows are quantity lines and must not get a separate unit-price charge.

## L3 inactive branches and unsupported rows

The X-system plug, trolley, latch and dependent screw rows are not applicable to this L3 branch: their selector code is 20, while `S1!C8=10`. The captured workbook returns zero for these rows in L3. They are reported as not applicable, not presented as generally implemented zero formulas. The full status list is in [`SLIDER_BOM_COVERAGE.json`](SLIDER_BOM_COVERAGE.json).

The pre-existing profile quantities K5/K7 remain implemented in geometry. The historical PR_11B snapshot below this point listed the rows that were unsupported at that time; PR_11C closes the remaining active quantity rules. Current applicability and status are defined by the PR_11C section above. Material pricing and the M53 commercial total remain incomplete.

## Exactness note

The implemented rules do not round quantities. Rows K14:K17, K22:K23 and K29:K30 are piece counts; K43/K45 are fastener counts. The formulas and Excel display format were retained in the parity fixture. Any future decimal-valued quantities must keep exact numerator/denominator semantics and only adopt rounding when the corresponding Excel formula applies it.

## PR_11C: complete source-supported quantity coverage

`calculateSliderL3FullBom` in `packages/shared/src/jv/slider/bom.ts` assembles all 42 registered rows, preserving exact quantities, formula text, catalog identity, status, rule version and trace IDs. It returns 28 `CALCULATED` positions and 14 `NOT_APPLICABLE` positions for the verified L3 selector. A non-applicable position omits quantity; it is never silently represented as zero. Rows 5 and 7 continue to use the geometry module outputs. The selector-derived zero rows 6, 8, 9, 10 and 13 add five proven inactive rows beyond the nine X-family rows documented in PR_11B.

New source formulas are S1!K11:K12, K25:K28, K33:K42. K11 depends on S1!D36; D36 is calculated from `D17`, `C10=13`, height and `Настройки!S16:S19`. The L3 path uses S16 (captured source setting 55.4 in both books). K12 uses `C33=D5-C34`, `C34=IF(D6=2,2,0)`, and existing D33:D34. K25:K28 resolve the real INDEX selector rules: D20 uses I25/C20 against `#1!F24:F26`; D24 uses I29/C24 against `#1!F29:F32`; D26 uses I31/C26 against `#1!G29:G31` only when D6=2, otherwise Excel returns “НЕТ”. The source table labels, including “инд. по поз.”, are explicit. K33 uses `C9=3`; its J33 branch is inactive because L3 has C8=10. K35:K39 implement H19 and H25 alternatives, K40/K41 preserve `ROUNDUP` precision selected by L6 and K42 preserves integer `ROUNDUP`. No norm is copied from Line or Zigzag.

The additional independent Excel 16 `CalculateFullRebuild` capture is in [`slider-pr11c-bom-capture.json`](fixtures/slider-pr11c-bom-capture.json), using temporary copies of both original books over varied dimensions, opening sides, H19/H25/H27, L6 precision and selector-table choices. [`SLIDER_L3_BOM_PARITY.json`](SLIDER_L3_BOM_PARITY.json) records 224 applicable quantity comparisons: 210 EXACT, 14 DISPLAY_MATCH, no mismatches or unverified values; 112 additional cells across eight cases confirm inapplicable formulas evaluate to zero. K12 may produce Excel `Value2=3.0940000000000003` while the rational formula result is exactly 1547/500; the cell format displays 3.094. This is recorded as display parity, not exact IEEE parity.

The observed source supports 28 applicable and 14 selector-inactive positions, not the requested 33/9 target. Do not reinterpret 5 additional selector-inactive rows as applicable formulas to match a target count. The quantity BOM is complete for L3; cost calculation is still partial and is not implied by BOM completeness.
