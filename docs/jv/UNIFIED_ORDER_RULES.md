# Unified order rules and status boundaries

- Position quantity must parse as an exact decimal whose value is a positive integer. Invalid text raises `INVALID_DECIMAL`; zero, negative, and fractional values raise `INVALID_CONFIGURATION`.
- All positions must use the requested `COMPLETATION` or `RETAIL` profile. Family calculators remain responsible for workbook hashes, catalog versions, and their specific input constraints.
- No family formula is copied into the order layer. Position result status and trace come from the existing calculator.
- The established Line+Zigzag coordinator remains the only cross-family calculator that propagates shared-resource factors into each family price result.
- Unified Order publishes a Line+Zigzag final total only when the caller supplies a provenance-matched Excel 16 snapshot for `Настройки!D19`; it then applies the source `AArow=Yrow*Zrow*(100+D19)/100` multiplier exactly once. The lower-level mixed coordinator subtotal is pre-discount and must not be treated as the final Main-sheet amount.
- `sharedResources` independently aggregates source-confirmed glue/activator consumption from all seven family adapters, applies the Excel minimum-package `ROUNDUP` formulas once per order, and returns the exact area-share factor and trace. These values are not charged again by the unified layer.
- Other mixed-family results are PARTIAL. Their position calculations, BOM, and shared-resource allocation are retained, but a final total is withheld until the common factors are wired through every family commercial formula and the Main-sheet transfer settings are versioned and verified.
- Multi-position orders outside the Line+Zigzag coordinator remain PARTIAL because a single confirmed per-slot commercial transfer and order total are not implemented.
- Missing amounts are omitted; they are never converted to zero. Exact rational quantities are retained; this module adds no rounding policy.
- A position calculation marked COMPLETE does not imply that the unified order is COMPLETE. A final order total is published only when the order-level calculation can establish it.

Known financial exceptions remain governed by their family calculators. This layer does not activate, hide, or normalize Front `F1!R13`, Slider `S1!R10`, or `ПРМ!R25` differences.
