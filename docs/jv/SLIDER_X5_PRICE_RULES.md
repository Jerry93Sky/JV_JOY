# Slider-X5: commercial rules

Sources: original completion and retail XLSM workbooks, independently recalculated on temporary copies by Excel 16.0 `CalculateFullRebuild`. The capture is `fixtures/slider-pr11j-commercial-capture.json`. `fixtures/slider-x5-price-snapshots.json` contains separate, SHA-256 bound source-literal catalogs for the two profiles. Runtime code is the existing shared Slider graph in `packages/shared/src/jv/slider/l5-pricing.ts`, with the X5 entry point `calculateSliderX5Commercial` and X5-specific geometry/BOM.

## Materials and prices

X5 has **26 separately charged BOM rows**: K6, K10, K11, K13, K18:K22, K24:K28, K31:K42. The other three applicable rows K43/K44/K46 are fasteners whose prices are included in parent materials: source `L43:L46` are explanatory text and `M43:M46` are blank. K45 is among the 13 inapplicable rows. The full 42-row status, source formula, catalog address and ten scenario comparisons are in `SLIDER_X5_PRICE_COVERAGE.json`. `M47=SUM(M5:M46)` therefore charges 26 material amounts without charging those fasteners twice.

`Прайс-Slider!E5:E43` supplies raw profile-specific price literals. Active profile rows K6/K10/K11/K13 divide E6/E10/E11/E13 by `Настройки!D4`; X cap L18 applies the `D28`/`Настройки!S26` switch; brush L33:L35 divides by `Настройки!L8`; K40:K42 use E41:E43. Each active amount is `Lrow*Krow`; K40/K41 also multiply by the shared-order factors `Клей+акт!O5/O18`. There is no general monetary `ROUND` in source M formulas. Exact rational values are preserved; presentation rounding is compared separately.

## Glass, painting and work

`Главная!I11 → S1!C12` selects `Прайс-Стекло!D5:D16`. The confirmed X5 D43/D44 geometry yields area `D43*D44/1000000`. `S1!C47:C49` allocates glass groups from leaf count and D20/D24/D26 choices. D47:D49 apply the glass rate and `Настройки!L17/L18`; D50 sums group costs. `S1!M49=IF(Настройки!D32,D53,0)` charges additional glass/processing work only when enabled, and D53 also uses `Прайс-сб+монт!C23*S1!T5`. Three active-work scenarios per profile have positive M49; the two inactive-work cases per profile retain calculated D50 and zero M49.

`S1!R5:R21` multiply K5:K21 by the profile's literal `Прайс-Slider!G5:G21` painting rates. R22 includes the C11/L11 branch. R23/R26 depend on T5; R24 is `MAX(R13:R23)` and R27 adds R26. M48 is R27 when C11 differs from 1, otherwise zero. M50 covers width service plus the L-specific K29 latch charge; K29 is inapplicable for X5. M51 sums M47:M50 and the `Главная!F28=2` surcharge. M52 applies the assembly/installation rates only when `Настройки!D34` is enabled. M53 guards `D6<=2` and sums M51:M52.

## Order-wide consumables and transfer

K40/K41 are per-construction activator/glue quantities. `Клей+акт!N5:N11/N18:N24` extend them by quantities of all seven order slots, round each aggregate up to a minimum of one package at N12/N25, then allocate via O5/O18. `ПРМ!AA25:AA32/AB25 → S1!T5` uses areas and quantities of the full order. A nonzero other-family order position without its traced K40/K41 forces `PARTIAL`, with no M47, M53 or Main transfer. The graph never charges a package minimum separately for each X5 construction.

The independently verified X5 route is `Главная!F11=6 → G11=3 → S1!A3=1`, `C8=20`, `C9=5`, `C10=25`. `S1!M53` transfers by `Главная!T11='S1'!M53/Настройки!D13`; `Главная!Y11=INDEX(R11:X11,G11)*(100+Настройки!D21)/100` selects T11. Both transfer settings are validated source literals. The X5 result publishes T11/Y11 only with a closed M53.

All money math uses BigInt rational operations. The source formula, sheet and cell, rule version and price snapshot version are retained in trace. The ten rebuilt cases verify this path for the captured widths, heights, options and single active X5 order slot. They do not establish parity for every permitted construction or a mixed Slider order.
