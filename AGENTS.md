# JV Project Working Rules

## Purpose and architecture
JV_JOY develops a new JV calculation engine on the existing GlasS-light/BMS foundation. Keep the existing application architecture and calculate paths stable unless a task explicitly authorizes a change.

## JV PROJECT — ORIGINAL EXCEL SOURCES

- The original completion and retail XLSM workbooks are primary sources for calculation logic and normally live outside this Git repository, often in its parent project directory.
- Their absence from GitHub or `git ls-files` is expected. Search locally configured source directories, repository root, and parent before concluding they are unavailable.
- Configure optional explicit paths with `JV_EXCEL_COMPLETION` and `JV_EXCEL_RETAIL`; `JV_EXCEL_SOURCE_DIR` may point to a local source folder. Never commit local configuration or workbook copies.
- Do not substitute cached golden JSON fixtures for the original workbooks. Fixtures support regression tests only.
- Treat Excel formulas, validated inputs, and lookup tables as authoritative evidence. Do not invent formulas, prices, coefficients, units, or quantities.
- Recalculate only temporary workbook copies with Excel COM when available; never save changes to original XLSM files.
- Verify workbook identity/version (including SHA-256) before comparing results. Classify exact numeric equality separately from display-only matches and unverified values.
- Preserve each formula's sheet/cell address, dependencies, and provenance in calculation traces.

## Calculation engine

- Use exact rational/BigInt arithmetic where the JV engine requires exact calculations; do not introduce implicit JavaScript `Number` money rounding.
- Keep Construction Calculation separate from Order Calculation. An order may be COMPLETE only if all included construction and order-level rules are supported; otherwise return PARTIAL with explicit diagnostics and no unsupported final commercial total.
- Preserve traceability, versioned catalogs, and typed errors. Do not hide missing inputs with defaults.
- Do not modify legacy `/calculate`, Prisma schema, or production database without an explicit task.

## Repository and data safety

- Never add original XLSM files, GlasS archives, temporary workbook copies, databases, secrets, or private local data to Git.
- Keep changes on the task branch. Do not force-push, rewrite published history, or merge to `main` unless specifically requested.
- Check staged and untracked files before commits; leave unrelated local files untouched.

## Documentation map

- PR_01 contracts/result: `docs/jv/PR_01_TASK.md`, `docs/jv/PR_01_RESULT.md`, `docs/jv/CONTRACT.md`.
- Research and formula maps: `docs/jv/STAGE_0_2_FINAL.md`, `docs/jv/STAGE_0_VERIFICATION.md`, formula/dependency CSVs under `docs/jv`.
- JV-Line work: `docs/jv/LINE_*` and `docs/jv/PR_02_RESULT.md` through `PR_08_RESULT.md`.
- Multi-position order: `docs/jv/ORDER_CALCULATION_RULES.md`, `ORDER_CALCULATION_COVERAGE.json`, `ORDER_EXCEL_PARITY.json`, `PR_09_RESULT.md`.
- Use `docs/jv/PR_10_TASK.md` and the applicable result/coverage/parity documents for the next-family work.

If the current execution environment cannot access local drives, state that boundary explicitly and continue independent tasks. Do not infer source absence from the Git repository alone.
