# Slider-X3: 42-row source BOM

`packages/shared/src/jv/slider/x3-bom.ts` implements `calculateSliderX3FullBom`. It calculates source `S1!K5:K46` from user dimensions, geometry, resolved switches, source settings and `#1` lookup controls. The exact expression for every row, its value in each recalculated scenario and its applicability are recorded in `SLIDER_X3_BOM_COVERAGE.json` and `SLIDER_X3_EXCEL_PARITY.json`. The module records formula, source address, quantity, catalog version and DAG trace for each position.

| Source rows | Function |
| --- | --- |
| K5:K13 | Three-track upper and X support profiles, side profile, X sash profile. K9 and K13 distinguish X from L. |
| K14:K22 | X sash end caps and damper caps. L cap rows K14:K17 are inactive; X rows K18:K21 depend on side count, interlock and opening direction. |
| K23:K32 | X roller carriages, handles, locks and X bottom latches. X carriage K24 is `2*D5`; X latch rows K31/K32 follow `D22`. |
| K33:K39 | Brush seals and transparent/magnetic seals. K33 includes the three-track width term and the X sash width term. |
| K40:K42 | Activator, glue and support-profile screws; K40/K41 apply the source `ROUNDUP` precision controlled by `Настройки!L6`. These are construction quantities, not allocated order costs. |
| K43:K46 | Fastener counts from cap, carriage and latch quantities. K43/K44/K46 are active; K45 is inactive. |

Across ten Excel-rebuilt cases, **29 rows are applicable and calculated**: K5, K9, K11, K13, K18:K22, K24:K28, K31:K44 and K46. The **13 inactive rows** are K6:K8, K10, K12, K14:K17, K23, K29:K30 and K45. The extra `Настройки!H21=0` case activates K19 and suppresses K20/K21, confirming the alternative X-cap branch. Some applicable rows correctly return a formula-derived zero for a selected option; this is distinct from inapplicability. No quantity was synthesized from a saved Excel cache.

The source catalog is `Прайс-Slider`; `Настройки!D6/D8/S7/S18/L4/L5/L6/H19/H21/H23/H25/H27`, `#1!F24:F26/F29:F32/G29:G31` and resolved `S1!D22` are additional dependencies. The metadata retains a null SKU for K43/K44/K46 because no confirmed article code has been mapped for these fastener lines; their quantities are still calculated. Both pricing profiles use the same quantity expressions and different price data. Their price parity belongs to PR_11H.

Current coverage is for the five captured selector/switch combinations per profile. Other valid option combinations require further parity before claiming universal equivalence. The fixture and capture script preserve source expressions and `NumberFormat`; `DISPLAY_MATCH` means rounded display agreement only.
