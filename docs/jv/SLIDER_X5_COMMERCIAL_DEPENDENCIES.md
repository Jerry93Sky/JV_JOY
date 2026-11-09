# Slider-X5 dependency chain to S1!M53

```text
Главная F11=6, C11/D11/M11/J11/H11/I11/F28; Настройки; #1 selectors
  → S1 C8=20, C9=5, C10=25, D3:D6, D17:D28
  → X5 geometry D31:D45 → 29 applicable K5:K46 quantities
  → profile-specific Прайс-Slider E5:E43 + D4/L8/S26 → L5:L42
  → K40/K41 × Главная Z11:Z17 → Клей+акт N5:N12/N18:N25 → O5/O18
  → 26 material M5:M42 amounts → M47
  → ПРМ AA25:AA32/AB25 → S1 T5
  → Прайс-Стекло D5:D16 + D43/D44 + C47:C49 → D47:D50
  → D50 + service C23*T5 → D53 → optional M49
  → Прайс-Slider G5:G21 → R5:R27 → optional M48
  → service C7/C19 + switches → M50
  → M47:M50 + optional service C25*T5 → M51
  → service C14/C15 + installation switch → M52
  → M53 → Главная T11 → Главная Y11
```

X5 differs from X3 before the price graph: five-track K6/K10 instead of K5/K9, `D44` uses S24 instead of S23, `D36` uses S19 instead of S18, and K33 has C9=5. The commercial expressions and order allocation used by the shared graph were separately checked against the X5 Excel capture, including source formulas in trace. X5 has its own price snapshot and rule IDs, so an X3 result or price profile is never inserted as a finished X5 amount.

`COMPLETE` requires a valid matching source snapshot, geometry, all 26 price amounts, confirmed glass/work selectors, a seven-slot order context, traced adhesive quantities for any other nonzero positions, M51/M52, and source transfer settings. Missing order data or another family's K40/K41 yields `PARTIAL` without M53 or Main price. Invalid price literals and mismatched workbook profiles raise typed errors. The current implementation does not claim a COMPLETE mixed Slider order merely because its first X5 position is supported.

Evidence: `fixtures/slider-pr11j-commercial-capture.json` for raw workbook outputs, `fixtures/slider-x5-price-snapshots.json` for literals, `SLIDER_X5_PRICE_COVERAGE.json` for all 42 BOM rows and `SLIDER_X5_PRICE_PARITY.json` for cell-level comparisons. The ten captured scenarios span both profiles and include active glass/work, inactive work, painting, installation, H21 branches, surcharge and price-mode changes.
