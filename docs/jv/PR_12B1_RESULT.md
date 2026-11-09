# PR_12B1 result — Front material costs

Implemented `calculateFrontMaterialCosts` while preserving the geometry/BOM API. The function consumes PR_12A output and a source-bound completion or retail price snapshot, returns 28 priced positions, a confirmed material subtotal, per-position provenance and trace, and `COMPLETE`/`PARTIAL` for the material portion only. It never publishes a final Front price.

Snapshot settings are read from their dedicated section. Completion and retail are validated against distinct workbook names and SHA-256 values. Captured source values include E5 `2727.733333333333` (completion) and `1227.48` (retail), `D5=0.8` in both books, `D14=1` and `0.5`, and D15 for accessory factors. D14 is returned as a verified transfer coefficient but is not applied to S33 because the source material formulas do not use it.

The material source formulas cover all 28 BOM rows. Formula-backed accessories E/F are reconstructed from D and D15. Blank accessory INDEX destinations are represented explicitly; only source-confirmed blank/IFERROR branches become zero. Q23 remains the literal source zero. No material is excluded as included in another line: S5:S32 charges Q*R except the explicit S6 rule, so all source quantities are retained without duplicate charges.

Excel 16 `CalculateFullRebuild` ran on temporary copies for base, wide and one-leaf door cases in each workbook (six scenarios). Of 342 comparisons, 282 are EXACT, 57 DISPLAY_MATCH, 3 MISMATCH, 0 UNVERIFIED. All 18 S5:S32 row amounts and S33 subtotals matched exactly or by source display; no charged-line mismatch occurred. Three unit-price mismatches are the inactive retail R13 case described in `FRONT_MATERIAL_PRICE_RULES.md`.

`pnpm test:jv`: 171 passed. `pnpm typecheck:shared`, `pnpm build:frontend`, `pnpm validate:jv-fixtures` (38 fixtures), and `pnpm smoke:jv-line-lab` all passed. Dedicated legacy-family parity scripts were not rerun in this substage; the JV test suite passed without regressions.
