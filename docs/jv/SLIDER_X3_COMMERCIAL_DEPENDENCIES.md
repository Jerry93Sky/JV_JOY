# Slider-X3 commercial dependency graph

```text
Main F11=5, C11/D11/M11/J11, H11/I11, F28; Настройки and #1 selectors
  -> S1 C8=20, C9=3, C10=23, D3:D6, D17:D28
  -> X3 geometry D31:D45 -> K5:K46 -> L5:L42 -> M5:M42 -> M47
  -> C47:C49, D47:D50 -> D53 -> M49 (only if D32 enabled)
  -> K5:K21 + Прайс-Slider G5:G21 -> R22:R27 -> M48
  -> Main order C11:D17/Z11:Z17 -> ПРМ AA25:AA32/AB25 -> S1 T5
  -> per-construction K40/K41 * order quantity -> Клей+акт N5:N12/N18:N25
     -> whole-package minima N12/N25 -> O5/O18 -> M40/M41 -> M47
  -> M50, F28 surcharge -> M51; installation D34 -> M52
  -> M53 -> Main T11 -> Main Y11
```

`T5` is an allocation across all seven order slots. `Клей+акт` also aggregates all slots before rounding up packages and allocating the factors. The calculator accepts the seven raw Main positions. For another nonzero family, it requires that family's traced K40/K41 per-unit quantities; otherwise it returns `PARTIAL` with no M47, M53 or Main transfer. It does not invent zero consumption or implement a mixed Slider order in this PR.

`COMPLETE` is supported for the tested X3 order configurations when the X3 geometry/BOM, source prices, glass and work switches, and entire order context are present. Missing order context, missing other-family adhesive quantities, invalid source profile or missing transfer settings are rejected or produce `PARTIAL` as appropriate. The ten Excel cases cover three opening choices, 2–4 leaves, both H21 branches, glass selectors I11=9 and I11=2, active and disabled optional glass-related work, additional work, installation and varying package factors. They do not exhaust all possible option combinations or production order mixes.

The capture in `fixtures/slider-pr11h-commercial-capture.json` records each source formula, `Value2` and `NumberFormat`. `SLIDER_X3_PRICE_PARITY.json` records the independently computed rational, displayed value, trace ID and comparison class for every examined commercial cell. `DISPLAY_MATCH` never certifies internal binary equality.
