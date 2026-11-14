# Slider-L3 commercial dependency graph

```text
Главная!C11:D11, M11, J11, selectors and Настройки
  └─ S1 geometry + selectors
      └─ S1!K5:K46 BOM quantities
          ├─ Прайс-Slider!E + Настройки ─ S1!L5:L46 ─ S1!M5:M46 ─ M47
          ├─ K43/K45 retained in BOM; no separate duplicate cost
          ├─ S1!K40/K41 × order count × Клей+акт!O5/O18 ─ M40/M41
          ├─ K5:K21 × Прайс-Slider!G5:G21 ─ R22
          └─ geometry + D20/D24/D26 + Прайс-Стекло + L17/L18 ─ D47:D50
               └─ D53 = D50 + service C23 × T5
      ├─ Главная!C11:D17, Z11:Z17 ─ ПРМ!AA25:AA32 ─ AB25 ─ S1!T5
      ├─ T5 + Настройки L9/L10 + R22 ─ R23:R24, R26:R27 ─ M48 (conditional)
      ├─ D32 + D53 ─ M49 (conditional)
      ├─ D33, width, C7, L3, K29, C19 ─ M50
      ├─ M47:M50 + F28/C25/T5 ─ M51
      └─ D34, width, height, leaves, C14/C15 ─ M52
          └─ D6<=2 and M51/M52 closed ─ M53
```

The graph is implemented as rules in `packages/shared/src/jv/slider/pricing.ts`; BOM dependencies remain in `slider/bom.ts` and geometry dependencies in `slider/geometry.ts`. Price literals retain source-cell and workbook version provenance.

## Open dependency for mixed-family orders

Rows 12–17 may select L1, L2, S2, S3, S4, or F1. `Клей+акт!E:K` reads each family sheet's `K40/K41`; those are family-calculated quantities. The order context accepts per-family K40/K41 only with matching source workbook and formula provenance. Until a family calculator supplies those values, the engine returns `PARTIAL` and withholds M47/M53 rather than using a guessed family consumption. PR_11D complete parity cases isolate Slider-L3 in Main row 11 and set the remaining order quantities to zero.

## Active branches

- `C11=1` makes M48 zero; other supported price modes need `R27` and order allocation `T5`.
- D32 off makes M49 zero without evaluating required additional work; D32 on requires D53.
- D33 and D34 independently control width work and installation.
- `F28=2` adds `C25*T5` to M51; the other selector branch adds zero.
- `D6>2` returns the source text error at M53, so the engine rejects a numeric total.
