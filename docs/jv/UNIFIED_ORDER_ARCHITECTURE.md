# Unified JV order architecture

The public API is `calculateJVOrder({ orderId, profile, positions, mainDiscount? })`, exported through `@bms/shared/jv`. `UnifiedPositionInput` is a discriminated union for seven existing family calculators. Each position has a stable ID, a unique Excel Main slot 1–7, a positive integer quantity, one price profile and snapshots from the same source workbook revision.

## Family routing

| Family | Existing calculator |
|---|---|
| LINE | `calculateLineConstruction` |
| ZIGZAG | `calculateZigzagOrder` |
| SLIDER_L3 | `calculateSliderL3Commercial` |
| SLIDER_L5 | `calculateSliderL5Commercial` |
| SLIDER_X3 | `calculateSliderX3Commercial` |
| SLIDER_X5 | `calculateSliderX5Commercial` |
| FRONT | `calculateFrontCommercial` |

## Order phases

1. Validate IDs, slots, integer quantity, profile and workbook/SHA consistency.
2. Obtain preliminary geometry/BOM/commercial source values from the family engines.
3. Build source-backed per-position consumables and area allocations from the full order; preserve physical consumption and package counts separately.
4. Re-run each applicable family calculator with the shared factors/context. The existing Line+Zigzag coordinator remains intact for its supported combination; Line-only retains its order coordinator.
5. Apply Main transfer only when matched D11:D14 family divisors, D19, D21:D27, family outputs and quantities are available. Sum `AA11:AA17` for AA18 without charging shared consumables a second time.

Detailed rules, formula references and slot behavior are in `UNIFIED_ORDER_SHARED_CONTEXT.md` and `UNIFIED_ORDER_SHARED_COST_RULES.md`.

## Output and status

`UnifiedOrderResult` carries per-position family results, per-position and merged BOM, `UnifiedOrderContext`, shared resource trace, diagnostics and limitations. The trace records exact-rational inputs, workbook/profile provenance, family source cell and Main formulas. A missing required family/context/transfer dependency produces PARTIAL without a final total. `COMPLETE` means the typed execution graph returned a value; it does not by itself assert parity with Excel.

## Compatibility and parity boundary

The unified layer has no React, backend API, or database dependency. This work does not change legacy `/calculate`, Prisma, production data, or existing family formulas. Line-only and lower-level Line+Zigzag parity remain documented separately. Fresh Excel captures show that both books calculate a valid all-seven order, but there is not yet a provenance-matched all-seven Engine input fixture; thus AA11:AA18 engine parity is UNVERIFIED and full mixed-order commercial equivalence is not declared.
