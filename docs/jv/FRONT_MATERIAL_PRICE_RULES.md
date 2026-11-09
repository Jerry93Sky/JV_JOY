# JV-Front material prices (PR_12B1)

`calculateFrontMaterialCosts` in `packages/shared/src/jv/front/material-pricing.ts` prices the existing PR_12A BOM. It returns a material subtotal only; it does not return a Front commercial or order total.

Two independent snapshots are stored in `fixtures/front-material-price-snapshots.json`. Each snapshot is bound to the original workbook name, SHA-256, profile and version. `Настройки!D5`, `D14` and `D15` are held in the snapshot settings section. `D5` is the divisor for metre based profile rates. `D15` is used by the accessory source formulas `E51:E58=Настройки!D15` and `F51:F58=D51:D58/E51:E58`; the engine evaluates `E*F` with exact rationals. `D14` is retained as an independently verified transfer coefficient for the later commercial stage; it does not enter `F1!S5:S33`.

`Прайс-Front!E5:E20`, `Прайс-Аксессуары!D12:D61`, and the accessory price factors are source inputs, not cached calculation outputs. Blank catalog cells are explicitly represented as blank; a blank is treated as zero only where Excel `INDEX` returns that blank or the source formula is guarded by `IFERROR`. Missing cells and formula-backed unresolved prices produce `PARTIAL` diagnostics.

For `F1!R5:R32`, rows 5–6 and 12–16 divide the matching Front price by `Настройки!D5`; rows 7–11, 17–18, 31–32 use the matching source price; rows 19–26 reproduce `E*F` using `D` and `Настройки!D15`; rows 27–30 follow the source `INDEX` selector and error fallback. `F1!S5:S32` is `Q*R`, except `S6=P6*R6*2*ROUNDUP(C3/1000,0)`. `S33=SUM(S5:S32)`. Q23 is an original literal zero and is not charged twice.

The retail source formula `F1!R13=Прайс-Front!E13/Настройки!D5` yields Excel Value2 `557.3749999999999`; exact rational arithmetic yields `4459/8`. This is a unit price for a P-profile row whose P13 and S13 are zero in the captured scenarios. The unit-price display differs at two decimals; the charged material subtotal remains a display match. No rounding was inserted into the engine to hide this binary boundary.
