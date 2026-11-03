# PR_03C result

> Исторический результат PR_03C. Примечания о неподдерживаемой ветке PD/I25 отражают состояние до PR_03D; текущее состояние и сверенные данные зафиксированы в [PR_03D_RESULT.md](PR_03D_RESULT.md) и [PD_LOOKUP_MAP.md](PD_LOOKUP_MAP.md).

## Direct source extraction
Both original workbooks have identical formulas for the examined L1 cells. Current saved workbook caches (unverified, not test oracles): D5=5, D6=1, D22=50, D23="НЕТ", O15=3, I25=791, I26=369, I27=691; D28=391, D29=604, D30=260, D31=3522, D32=4777.

Input lineage observed: `Главная!M11 = CEILING(L11,1)` -> `L1!D5`; `L1!D6 = IF(Главная!K11<=2,Главная!K11,"НЕТ")`; `L1!D23` depends on checkbox C23 and D5/D6. Settings P5/P8/P9/P10 are labelled sash profile width, min edge-to-axis distance, side-lock handle projection, parking depth reserve. Units are not printed in the cells. The implementation accepts one explicit common unit; it does not assert millimetres.

When C23=false, D23="НЕТ" and O15 selects D6+2. With C23=true, O15 indexes PD!D5:BA54 for D6=1 or PD!D61:BA110 for D6=2 using row D5 and column C24. This PD branch stays unsupported pending validated table schema/indices.

## New implementation
New rules in `packages/shared/src/jv/geometry/line.ts`: D23 (false checkbox branch only), O15 (D23="НЕТ" branch only), I26 parking depth. They run in the existing DAG and attach source formula/cell to trace. This closes one chain from the L1 geometry inputs/settings to I26. I27 from PR_03 is not counted as new here.

Manual exact-decimal unit test for the documented I26 expression with leaves 5, side count 1, P8=52, P5=34, P9=9, P10=70 and D22=50 gives 369. That is a technical calculation, not an Excel golden; the matching stored cache remains unverified.

## Verification
Two new tests cover the no-PD chain/source trace and error path. Full shared suite: 10 passed, 0 failed. No Excel parity tests or freshly recalculated values exist. Legacy `/calculate`, Prisma schema and database unchanged. Backend build retains pre-existing Prisma/TypeScript errors; no backend fixes in this task.

Remaining: C23=true PD lookup, complete I25 inputs/ROUNDDOWN behavior, provenance and units for settings, further cut/BOM rules. Do not call this full JV-Line geometry.
