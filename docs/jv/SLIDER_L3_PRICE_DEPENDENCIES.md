# Slider-L3 pricing dependency investigation

## What is confirmed

- The selected system route is `Главная!F11=3 → Главная!G11=3 → S1!A3=1`.
- The top-level sale selector uses profile-specific S/T columns as recorded by PR_11A. Material cost is a separate path through `S1!Lrow` and `S1!Mrow`; S/T are not BOM unit-cost inputs.
- Catalog identity and unit cells for the new component rows link to `'Прайс-Slider'!B:D`. For example `S1!F14='Прайс-Slider'!B14`, `S1!G14` appends the “НОВАЯ” label based on `Настройки!H21`, and `S1!H14='Прайс-Slider'!D14`.
- The worksheet summary `S1!M53` is `=IF($D$6<=2,SUM($M$51:$M$52),"ОШИБКА !")`. It sums two intermediate totals only when side count `D6` is at most two.
- For the implemented material rows, line amounts follow `S1!Mrow=S1!Lrow*S1!Krow`. `S1!L14='Прайс-Slider'!E14*IF($D$28="ДА",Настройки!$S$26,1)` and `S1!M14=L14*K14`; `L15`, `L16`, `L17`, `L22`, `L23`, `L29` and `L30` source the corresponding `'Прайс-Slider'!Erow` value. These formulas were captured but are not implemented or asserted as price parity.
- `S1!L43` says “учтено в СС заглушек” and `S1!L45` says “учтено в СС L-задвижки”; these fastener costs are included in parent material costs. K43/K45 must not be priced a second time.
- In the prior Excel capture M53 displayed a numeric value, but that saved display value is not an engine input and does not prove price parity.

## Dependencies not yet verified for implementation

PR_11B's fresh capture includes `S1!L5:L46`, all 42 row amount formulas in column M, profile price columns S/T, `S1!M47:M53`, and `L51:N53` formula/value/format records for all eight `CalculateFullRebuild` scenarios. A row-by-row implementation mapping from the supported BOM rules to unit-cost formulas remains outstanding, including completion/retail differences. The catalog sourcing and formula chains listed below also need to be independently closed.

The six-scenario capture resolves the first aggregation layer:

| Cell | Formula / dependency | Meaning established by source |
|---|---|---|
| `S1!M47` | `=SUM($M$5:$M$46)` | Sum of the 42 BOM line amounts. |
| `S1!M48` | `=IF($C$11<>1,$R$27,0)` | Conditional painting/work subtotal from R27 when C11 is not 1; glass is calculated in D47:D50. |
| `S1!M49` | `=IF(Настройки!$D$32,$D$53,0)` | Conditional additional-work amount from D53. |
| `S1!M50` | `=IF(Настройки!$D$33,'Прайс-сб+монт'!$C$7*$D$3/1000,0)+IF(Настройки!$L$3,$K$29*'Прайс-сб+монт'!C19,0)` | Conditional width-based service and L3-specific add-on. |
| `S1!M51` | `=SUM($M$47:$M$50)+IF(Главная!$F$28=2,'Прайс-сб+монт'!$C$25*$T$5,0)` | Sum of material, glass, additional work, services and an optional F28 add-on. |
| `S1!M52` | `=IF(Настройки!$D$34,$D$3*'Прайс-сб+монт'!$C$14/1000+$D$5*$D$4*'Прайс-сб+монт'!$C$15/1000,0)` | Optional installation, calculated from width and area with price-sheet constants. |
| `S1!M53` | `=IF($D$6<=2,SUM($M$51:$M$52),"ОШИБКА !")` | Cost total guarded by side count. |

`S1!T5` is `=ПРМ!$AB$25` in the captured workbook. `'Прайс-сб+монт'!C7`, `C14`, `C15`, `C19`, `C25`, `S1!R27`, and `S1!D53` are formula dependencies that need their own source-chain and profile-specific validation before a cost rule is claimed. Captured M51/M53 values are recalculated outputs only, not trusted engine inputs or parity targets.

The following are deliberately not implemented or claimed as complete:

- Per-material unit-price snapshots, profile-specific cost catalogs and the D28/S26 adjustment.
- Mapping each BOM quantity row to its price expression and subtotal.
- Glass, processing, painting, installation, additional work and commercial modifiers.
- The calculation and validation of M47:M52, including source prices for each item row.
- The M53 summary, including its D6 error branch.

Therefore `S1!M53` is not parity-checked by the PR_11B engine. A future pricing task must trace every source formula back to the catalog/source setting and both workbook profiles before changing price behavior.

## PR_11C update

The quantity side now includes all 28 active L3 positions and 14 selector-inactive positions. This does not close pricing. Excel formula evidence for the extended material lines remains `Mrow=Lrow*Krow` (with Lrow sourced from the row-specific `'Прайс-Slider'!Erow` or the explicitly observed selector adjustment); the new rows require catalog snapshot coverage and full source checks for both price profiles before their amounts can be implemented. K43/K45 remain quantity-only presentation rows for costing: L43/L45 state their cost is included in parent seal/latch costs, so pricing either fastener separately would double charge.

The M53 chain is: M47 sums material line amounts; M48 can add the R27 painting/work subtotal; M49 can add D53, which includes D50 glass; M50 can add width service and the L3-specific latch-slot amount; M51 applies the optional F28 charge; M52 conditionally adds installation; M53 returns an error string when D6>2. The later PR_11D Excel capture and parity fixture document tested supported configurations. The PR_11C fixture alone does not certify a final price.

The existing source warning is confirmed for order-level consumables: S1 K40/K41 quantities derive from width and L4/L5 (with L6 precision), while descriptions mention “2 шт. на весь заказ” through `'Клей+акт'!N12/N25`. This is an order-level allocation question and must not be multiplied independently per construction or priced again as a per-frame norm without tracing the order formulas.
