# PR_10 — входной контракт заказа и следующий системный модуль

## Preconditions

PR_10 begins only after review of PR_09. Do not modify or merge PR_09 from this task. Keep legacy `/calculate`, Prisma schema/database, and production data unchanged unless a later task explicitly scopes an integration.

## Goals

1. Confirm the Main sheet's validated selector ranges, labels, and exact `F` → `G` mappings for all system families. Do not infer a named family from numeric selectors until the original workbook values and target sheet references confirm it.
2. Replace caller-supplied family claims with a validated source selector in the order input. Reject selector/family mismatches with typed errors.
3. Decide whether the first next family module is JV-Zigzag, JV-Slider, or JV-Front using source formula coverage and technical audit evidence. Implement only that independently confirmed construction chain.
4. Preserve the `Construction Calculation` / `Order Calculation` separation and the shared X5 / whole-package allocation interfaces established in `order-line.ts`.
5. Extend mixed orders only when each active family can calculate the exact shared adhesive and paint basis consumed by Excel. Until then, retain `PARTIAL` and omit the order total.
6. Continue exact rational/decimal arithmetic and source-cell trace. Any Excel rounding rule must be sourced to the specific formula.
7. Add Excel 16 `CalculateFullRebuild` cases on temporary copies, raw-input fixtures, independent comparisons, boundary tests, and JSON validation.
8. Obtain a safe authenticated browser session for the visual JV-Line Lab smoke test. Do not disable or bypass production auth.

## Acceptance

- Selector validation has exact workbook provenance and tests for supported, unsupported, invalid, and conflicting system choices.
- At least one new family closes a tested path from actual Main inputs through geometry and BOM; no cached formula output is supplied as an engine input.
- Mixed orders return `COMPLETE` only when all family and global order rules are supported and parity-verified; otherwise return `PARTIAL` without publishable totals.
- Excel comparisons distinguish EXACT, DISPLAY_MATCH, NUMERICALLY_EQUIVALENT, MISMATCH, and UNVERIFIED without concealing error behind tolerance.
- Full JV test suite, shared typecheck, frontend build, Lab component smoke, and fixture validation pass in GitHub Actions.
- Interactive visual testing is reported separately from SSR/component tests.

## Explicit non-goals

- Do not migrate the whole workbook in one PR.
- Do not add guessed technological limits, incomplete family totals, price defaults, or approximate formulas.
- Do not expose the independent engine through production API or DB without a separately reviewed integration task.
