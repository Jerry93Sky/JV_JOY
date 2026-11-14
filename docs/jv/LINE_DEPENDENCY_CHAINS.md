# JV-Line dependency chains (verified sources vs interpretation)

## L1 parking/cut chain

`Главная!C11` (label: width) → `L1!D3` → `L1!I25` → `L1!I27` → `L1!D29` → `L1!D32`

`Главная!M11` (formula `=CEILING($L11,1)`) → `L1!D5`; `Главная!K11` → `L1!D6`; `L1!D22` is numeric 50 in workbook; `Настройки!P2/P4/P5/P6/P7/P8/P9/P10/P14/P15` feed the parking formulas. Cell values are configuration, not confirmed universal constants.

Formula sources: I25 (ROUNDDOWN width formula), I26 (depth, depends on O15), I27 (`=I25-2*D22`), D28 (`=I26+P2/2`), D29 (`=I27+P2/2-P7`), D30 (`=I26-P6/2`), D31 (`=D3-D6*(P6+D30)`), D32 (sum count×cut length). `C28:C31` provide counts. Source extraction is recorded in `ВСЕ_ФОРМУЛЫ_РАЗВЕРНУТЫЕ.csv`.

## O15 / PD lookup

O15 branches on D23 and D6: no parked door uses D6+2; parked-door branches INDEX one of two PD blocks using D5 and C24. The table contents encode a discrete lookup, not a continuous geometric formula. Do not implement until row/column labels and valid index conditions are mapped. `I24` emits OK/ЛАЖА from a width comparison; status strings are diagnostics, not numbers.

## Evidence labels

Formula text/address = source fact. Dependency edges = parsed cell references. Semantic labels above derive from adjacent Excel captions. Physical unit = unresolved (cells display bare numeric formats; no unit suffix). Counts and cached values are not asserted as expected outputs. Implemented I27 accepts a same-unit contract and is not a full UI-to-cut chain.
