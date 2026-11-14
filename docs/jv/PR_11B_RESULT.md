# PR_11B result — Slider-L3 material quantities

## Delivered

Added an exported `calculateSliderL3Bom(geometry, options)` function in `packages/shared/src/jv/slider/bom.ts`, exported through `packages/shared/src/jv/index.ts`. It executes ten newly implemented BOM quantity formulas through the existing `executeGraph` DAG and exact `ExactRational` arithmetic:

- K14:K17: L-system leaf plugs, including H21 and opening-direction branches.
- K22:K23: bumper and L roller carriage.
- K29:K30: L latch quantities, including the resolved S1!D22 choice and H23 switch.
- K43 and K45: L-specific fastener quantities.

The function returns a `PARTIAL` BOM, identifies the prior K5/K7 geometry rows, reports inactive X-family rows separately, and keeps the other unimplemented rows explicit. The code does not change `/calculate`, Prisma, or the existing geometry formulas.

## Excel parity

The source fixture `fixtures/slider-pr11b-bom-capture.json` was produced from temporary copies of both original XLSM files using Excel 16.0 `CalculateFullRebuild`, with VBA macros and worksheet events disabled. The 5,384 captured formula strings contain no external-workbook references. It covers four scenarios for each workbook: two-leaf left opening, four-leaf two-sided opening, four-leaf right opening with H21 disabled and the alternate D22 choice, and the source `D22="НЕТ"` branch that yields a negative K29 when H23 is enabled.

The unit tests independently invoke the new TypeScript rules and compare all ten formulas against each Excel `Value2`. Result: **80/80 exact comparisons, 0 mismatches** across the two books and eight scenarios. The comparison records and formula evidence are in `SLIDER_L3_BOM_PARITY.json`. No Excel output was supplied as a rule input.

## Automated checks

- New focused Slider BOM tests: 4 passed.
- `pnpm typecheck:shared`: passed.
- `pnpm test:jv`: passed, **117/117** after adding the source `D22="НЕТ"` case.
- `pnpm typecheck:shared`: passed.
- `pnpm build:frontend`: passed (existing Vite/browser-data and bundle-size warnings only).
- `pnpm validate:jv-fixtures`: passed, 22 fixture JSON files.
- `pnpm smoke:jv-line-lab`: passed.
- Resolver tests: passed, 5/5.
- Existing Slider geometry parity: 36/36 EXACT.
- Existing Line order parity: no MISMATCH (36 EXACT, 20 DISPLAY_MATCH, 14 UNVERIFIED).
- Existing Zigzag geometry parity: no MISMATCH (528 EXACT, 168 UNVERIFIED).
- Existing Zigzag order parity: no MISMATCH (1,034 EXACT, 902 DISPLAY_MATCH, 12 UNVERIFIED).
- Existing Mixed Order parity: no MISMATCH (746 EXACT, 418 DISPLAY_MATCH, 374 NUMERICALLY_EQUIVALENT).
- Existing Line material quantity/amount checks: no mismatches (800 quantity and 800 cost comparisons).
- Existing Line material and price checks: no mismatches (20 material cases; 1,600 price comparisons).
- Existing Line sash-profile parity: no mismatches (60 comparisons).
- `verify-line-additional-parity.mjs` did not complete on the checked-in golden fixture: it fails in the pre-existing AA-110 pricing branch with `Cannot convert undefined to a BigInt` because an expected glue/activator input is undefined. This code path was not changed by PR_11B. The line-cutting comparator requires the raw Excel results argument; the documented combined `run-excel-parity.ps1` performs a fresh capture and was not rerun as it rewrites shared golden fixtures.

## Scope and remaining work

The complete S1 range contains 42 rows. Current engine support covers 12 quantity rows total: the existing K5/K7 plus the ten PR_11B rows. Nine X-family rows are not applicable for L3. Twenty-one other rows remain captured but unsupported; notably the common brush seal K33 is applicable and unsupported, not a zero. The detailed register and source formulas are in `SLIDER_BOM_COVERAGE.json` and `SLIDER_L3_BOM_RULES.md`.

The new function does not price materials or compute S1!M53. `SLIDER_L3_PRICE_DEPENDENCIES.md` records the verified subtotal formulas and the remaining catalog mapping work. PR_11B does not declare the complete material specification, commercial calculation, or overall Excel parity complete.

## Source and changes

All Excel captures use temporary copies; the originals remain unchanged. Only the Slider-L3 module, its tests, the capture fixture/tool, and JV documentation are part of this stage. The existing Line, Zigzag, Mixed Order and Slider geometry code paths are not intentionally modified beyond the new export.
