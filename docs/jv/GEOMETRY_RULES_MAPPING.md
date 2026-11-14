# JV-Line geometry mapping (partial)

| Rule | Cell | Formula | Meaning | Dependencies | Unit | Status |
|---|---|---|---|---|---|---|
| JV.LINE.PARKING_AXIS_WIDTH | L1!I27 | `=$I$25-2*$D$22` | Parking axis width (label H27) | I25, D22; I25 itself depends on opening width, leaves, special-width flag/value, settings P14/P15/P4 and D15 option | Same explicit caller-supplied unit for both inputs/output; workbook does not label a unit | VERIFIED_SOURCE, EXCEL_PARITY_UNVERIFIED |
| JV.LINE.LEAF_WIDTH | L1!I25 | `=ROUNDDOWN(($D$3-IF($C$21,$D$6*$D$21,0)-2*Настройки!$P$15-($D$5-1)*Настройки!$P$14-IF($D$15="ДА",2*Настройки!$P$4,0))/($D$5-IF($C$21,$D$6,0)),0)` | Calculated leaf width | D3,D5,D6,C21,D21,D15, Настройки P4/P14/P15 | Not explicit | implemented with exact decimal truncation; parity unverified |
| JV.LINE.PARKING_DEPTH | L1!D23,O15,I26 | D23 `=IF($C$23,IF($D$5/$D$6>1,"ДА","ОШИБКА"),"НЕТ")`; O15 `=IF($D$23="НЕТ",$D$6+2,0)+IF(AND($D$23="ДА",$D$6=1),INDEX(ПД!$D$5:$BA$54,$D$5,$C$24),0)+IF(AND($D$23="ДА",$D$6=2),INDEX(ПД!$D$61:$BA$110,$D$5,$C$24),0)`; I26 exact source | Parked-door state, table lookup, parking depth (labels only; no unit inferred) | C23,D5,D6,C24, PD matrix, Настройки P5/P8/P9/P10,D22 | Not explicit | implemented; parity unverified |
| JV.LINE.CUT_A/B/E/F | L1 C28:D31 | C28=C29=C30=D6; D28=I26+P2/2; D29=I27+P2/2-P7; D30=I26-P6/2; C31=1; D31=D3-D6*(P6+D30) | Four separate carrier-profile cuts | D3,D6,I26,I27, Настройки P2/P6/P7 | Settings in mm; D3 must use same explicit unit | implemented; 10/10 Excel golden scenario runs match |
| JV.LINE.CUT_TOTAL | L1 D32 | `=$C$28*$D$28+$C$29*$D$29+$C$30*$D$30+$C$31*$D$31` | Sum of quantity × each cut length | C28:D31 | Inherits explicit length unit | implemented; golden matched |
| JV.LINE.CARRIER_PROFILE_MATERIAL_QUANTITY | L1 O5 | `=$D$32/1000+Настройки!$D$7/1000` | Carrier-profile line quantity | D32, Настройки D7; catalog mapping L5:N5 -> Прайс-Line B5:D5 | D7 is mm (E7); result `п.м` (N5) | implemented; geometry/cuts match 10/10; O5 exact decimal match 6/10 and four Excel binary-representation differences; see `LINE_MATERIAL_PARITY.json`; price excluded |

Line user inputs originate at Главная C11 (width), D11 (height), M11 (leaf count formula CEILING(L11,1)), K11 (opening sides) and J11 (direction); L1 D3:D8 reference these. Settings selectors I2/I4/... control options and Line C15:C25 are local selectors. Numeric cells use general format and have no unit labels, so units are not inferred here.

Full formula ledger is `ВСЕ_ФОРМУЛЫ_РАЗВЕРНУТЫЕ.csv`. No formula output from the stored cache is treated as a golden.
