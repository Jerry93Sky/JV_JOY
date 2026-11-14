# Slider-X3: verified geometry

Sources: original `JV-комплектация 08.10.2026.xlsm` and `JV-розница 08.10.2026.xlsm`, recalculated with Excel 16.0 `CalculateFullRebuild` on temporary copies. Captures are in `fixtures/slider-pr11a-selector-capture.json` and `fixtures/slider-pr11g-bom-capture.json`. Executable rules are in `packages/shared/src/jv/slider/x3-geometry.ts`; each DAG step retains its source address and formula.

## Route and inputs

`Главная!F11=5`; `Главная!G11=IF(OR(F11=4,F11=5,F11=6),3,IF(F11=11,10,F11))=3`; `S1!A3=1`; `S1!C8=20` (X profile); `S1!C9=3` (three tracks); `S1!C10=C8+C9=23`. Width, height, leaf count and opening come from `Главная!C11`, `D11`, `M11`, `J11` through `S1!D3:D6`. The input also requires the source resolved `S1!D17/D18` switches and versioned `Настройки` values. No Excel output value is passed to the calculator.

| Output | Source calculation and distinction |
| --- | --- |
| `S1!D31` | `ROUNDUP(D3-IF(AND(C8=20,D18="ДА"),2*Настройки!S6,0),0)`; X-specific seal condition. |
| `S1!D32` | `ROUNDUP(D3-IF(D18="ДА",2*Настройки!S6,0),0)`. |
| `S1!C13/C14` | Four `D17/D18` choices over `Настройки!S9:S12`; two-sided choice uses `H25` and `S13/S14`. |
| `S1!D43` | `ROUNDUP((D3+(D5-D6)*Настройки!S2-2*C13-C14)/D5,0)+Настройки!L23`; leaf width. |
| `S1!D44` | Source `IF(C10=23,Настройки!S23,0)` branch subtracts from height. L3 and L5 use their own C10 and settings branches. |
| `S1!D33/D34/D45` | `D43+S4`; for two-sided opening `D33+S3`, otherwise zero; `D43+2*S3`. |
| `S1!K5/K9` | Three-track upper profile uses `D32`, X three-track support uses `D31`, each with `Настройки!D8/1000`. |

The implementation uses exact BigInt rationals, source `ROUNDUP` semantics, DAG dependencies, typed errors and trace. Five construction cases per book cover widths 2400–4200 mm, heights 2100–2500 mm, 2–4 leaves, three opening choices and different switches. The seven returned geometry outputs were compared in every case. See `SLIDER_X3_EXCEL_PARITY.json` for cell-level results. This does not establish every permitted construction limit or every selector combination.
