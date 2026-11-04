# JV-Zigzag P44 price dependency map

`Главная!S11` consumes `Z1!P44 / Настройки!D12`. `Z1!P44 = SUM(P42:P43)`; `P42 = SUM(P38:P41) + IF(Главная!F28=2,'Прайс-сб+монт'!C25*W5,0)`, `P43` is conditional installation work, and `P38=SUM(P5:P35)`.

The implemented N-quantity subset supplies only the quantity basis for 11 of 31 N rows. It does not provide all unit costs from `'Прайс-Line'`, dependent geometry/catalog lookups, `P39` accessory branch, `P40` painting/work branch, `P41` assembly/milling, order-level glue/activator factors W5, or installation P43. Therefore P44 and any Zigzag commercial price remain unsupported. JV-Line adhesive and paint allocation is not reused without Zigzag-specific parity. No price is calculated from partial BOM.
