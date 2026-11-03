# PR_07 — результат расширения JV-Line

## Итог

Добавлены расчёт парковочных компонентов и полная поддержка базовой BOM JV-Line (40 из 40 строк) в независимом модуле. Получены новые пересчитанные Excel-эталоны: 10 сценариев в каждой книге, всего 20. Числовая коммерческая цепочка пока **не закрыта**: итоговая цена недоступна, и переход к подключению в production/API не готов.

## Изменения

- `packages/shared/src/jv/geometry/pd-catalog-longitudinal.ts` — две дополнительные 50×50 матрицы: `ПД!D117:BA166` и `ПД!D173:BA222`; обе книги сопоставлены структурно.
- `packages/shared/src/jv/geometry/parking-components.ts` — D24 и парковочные количества O12:O14, O16:O20, O26:O27 с правилами и происхождением. O15 остается из существующего геометрического правила.
- `packages/shared/src/jv/bom-line.ts` — подключения недостающих 11 строк парковочной BOM; полная спецификация содержит 40 строк.
- `packages/shared/src/jv/line-calculator.ts` — публичный адаптер JV-Line: geometry → parking → BOM → доступные material/work subtotals. Возвращает `PARTIAL` и запрещает финальную цену пока зависимости не закрыты.
- `apps/frontend/src/modules/jv-line/JVLineLabPage.tsx`, `reference-data.json`, маршрут `/jv-line-lab`, навигация Layout — локальный read-only тестовый интерфейс внутри существующего приложения.
- Excel fixture теперь содержит 10 случаев на профиль, включая варианты размеров, полотен, направления, парковки, специального полотна и переключателей работ.
- Обновлены проверки, чтобы количество сценариев задавалось обновлённым fixture, а не было жестко зафиксировано на 12.

## Сверки с Excel

Все значения сняты из временных копий после Excel 16.0 `CalculateFullRebuild`, с отключенными макросами и событиями. Оригинальные `.xlsm` не менялись.

| Область | Проверено | Результат |
|---|---:|---|
| Геометрия/резы/работы | 20 сценариев | 20 полных совпадений по захваченным ячейкам |
| Базовая BOM | 40 строк × 20 | 800 количеств: 724 EXACT, 76 DISPLAY_MATCH; 800 сумм строк: 493 EXACT, 307 DISPLAY_MATCH; 0 MISMATCH |
| Дополнительные позиции AA-020…AA-120 | 6 × 20 | количества: 60 EXACT, 60 DISPLAY_MATCH; стоимости/суммы: 70 EXACT, 170 DISPLAY_MATCH; 0 MISMATCH |
| Цена работ Q55/Q57 и поддержанная сумма Q52 | 3 ячейки × 20 | 40 EXACT, 20 DISPLAY_MATCH, 0 MISMATCH; все 20 DISPLAY_MATCH относятся к Q52 |

`DISPLAY_MATCH` означает совпадение отображаемого текста Excel с форматированной точной рациональной суммой. Это не доказательство числового равенства. Для Q52 сверка использует O5/O18 клея, захваченные из Excel; публичный адаптер пока не получает эти коэффициенты из собственной полностью реализованной цепочки, поэтому Q52 остается только поддержанной частичной суммой.

## Исследованные коммерческие ветви

- **Стекло/заполнение:** `L1!C46:C51` делит выбранные полотна между типами; `D45` использует высоту за вычетом `Настройки!P19`; `D46:D51` используют геометрические результаты I47:I49 и `Настройки!L23`; `F43:F48` индексируют `Прайс-Стекло!D5:D16` по `C11`, применяют L17/L18 и L21, умножают на площадь в мм² `/1000000`; `G43:G48` дают стоимость типа, `G49` суммирует её. `D53=I55*I46*D45/1000000`; `D54=G49+Прайс-сб+монт!C23*X5`. В движке полный выбор наполнителя, цены и вся эта цепочка ещё не реализованы.
- **Покраска:** `Q53=IF(C10<>1,V18,0)`; `V13=SUM(V5:V12)*IF(C10=4,Настройки!L11,1)`, `V14=Настройки!L9*Настройки!L10*X5`, `V15=MAX(V10:V14)`, `V17=Прайс-сб+монт!C24*X5`, `V18=V15+V17`. Значение X5 берётся из `ПРМ!AB25`, где `AB25=IFERROR(AA25/(AA32*W25),0)`, `AA25=IFERROR(U25*V25*W25/1000000,0)`, `AA32=SUM(AA25:AA31)`. Формулы исследованы, но ветвь не перенесена в движок.
- **Итог:** `Q54=IF(Настройки!D32,D54,0)`; `Q56=SUM(Q52:Q55)+IF(Главная!F28=2,Прайс-сб+монт!C25*X5,0)`; `Q58=IF(AND(D6<=2,D7<>"ОШИБКА !"),SUM(Q56:Q57),"ОШИБКА !")`. Эти ячейки не реализованы как замкнутый итоговый расчёт.
- **Клей:** O5/O18 получаются из формул листа `Клей+акт` с зависящими от выбора материала размерами/площадями и `ROUNDUP(MAX(...),0)`. Их значения в parity capture были взяты из Excel; вычисление этой цепочки приложением не заявляется.

## Тестовый интерфейс

JV-Line Lab вычисляет локально через `@bms/shared` и JSON-снимки справочников. Интерфейс показывает геометрию, 40 строк BOM, дополнительные количества, доступные стоимости/работы и trace. Результат всегда отмечен как частичный; Q52 не объявляется итоговой ценой. Страница не обращается к API или БД. `pnpm --filter frontend build` проходит. Визуальный браузерный smoke-test не запускался.

## Проверки

- `pnpm --filter @bms/shared test:jv` — 53 passed, 0 failed.
- `pnpm --filter frontend exec tsc -p ../../packages/shared/tsconfig.jv.json --noEmit` — passed.
- `pnpm --filter frontend build` — passed; остаются предупреждения о CJS Vite API, устаревшем Browserslist и крупном bundle.
- Excel parity tooling: 20 сценариев; MISMATCH/UNVERIFIED отсутствуют в перечисленных сравнениях. Числовые эталоны относятся только к этим сценариям.
- `pnpm --filter backend build` — failed на TypeScript/Prisma ошибках в существующих routes и Prisma utilities, плюс `TS5097` для `.ts` import paths при backend tsconfig. Backend бизнес-логику и конфигурацию для подавления этих ошибок не менял.
- `git diff --cached --check` остаётся с прежними trailing whitespace/blank-at-EOF замечаниями в staged `apps/backend/import-systems.mjs`, `apps/backend/src/domain/jv/engine/graph.ts`, `apps/backend/src/prisma/check-formulas.ts`, `apps/frontend/src/modules/deals/DealItemsPanel.tsx` и `packages/shared/src/jv/graph.ts`. Эти файлы не исправлялись в PR_07.

## Совместимость и Git

Не изменялись legacy `/calculate`, Prisma schema, существующие формулы/алгоритмы BMS и API. Route/nav добавляют отдельный локальный lab без backend side effects. Git worktree до PR_07 уже содержал значительные staged, unstaged и untracked изменения; PR_07 не выполнял `reset`, `clean` или массовое staging. Идентичность автора Git не задана, поэтому коммит не создан.

PR_07-specific список для отдельного review/commit:

- Runtime: `packages/shared/src/jv/geometry/pd-catalog-longitudinal.ts`, `packages/shared/src/jv/geometry/parking-components.ts`, `packages/shared/src/jv/bom-line.ts`, `packages/shared/src/jv/line-calculator.ts`, `packages/shared/src/jv/index.ts`, `packages/shared/src/index.ts`.
- Tests: `packages/shared/src/jv/geometry/parking-components.test.ts`, `packages/shared/src/jv/bom-line.test.ts`, `packages/shared/src/jv/cutting.test.ts`, `packages/shared/src/jv/line-calculator.test.ts`.
- Frontend: `apps/frontend/src/modules/jv-line/JVLineLabPage.tsx`, `apps/frontend/src/modules/jv-line/reference-data.json`, `apps/frontend/src/App.tsx`, `apps/frontend/src/components/Layout.tsx`.
- Excel/parity tooling: `tools/jv/compare-line-cutting-excel-golden.mjs`, `tools/jv/recalculate-line-cutting-golden.ps1`, `tools/jv/verify-line-material-parity.mjs`; `docs/jv/fixtures/line-cutting-cases.json`, `docs/jv/fixtures/line-cutting-excel-golden.json`, `docs/jv/fixtures/line-price-excel-golden.json`, `docs/jv/fixtures/line-price-snapshots.json`.
- Reports: `docs/jv/PR_07_RESULT.md`, `docs/jv/LINE_FINAL_COVERAGE.json`, `docs/jv/LINE_COMMERCIAL_PARITY.json`, `docs/jv/LINE_CALCULATOR_UI.md`, `docs/jv/PR_08_TASK.md`, plus regenerated `docs/jv/LINE_FULL_BOM_COVERAGE.json`, `docs/jv/LINE_BOM_COVERAGE.json`, `docs/jv/LINE_BOM_PRICE_PARITY.json`, `docs/jv/LINE_MATERIAL_PARITY.json`, `docs/jv/LINE_PRICE_PARITY.json`, `docs/jv/LINE_SASH_PROFILE_PARITY.json`, `docs/jv/LINE_ADDITIONAL_BOM_PARITY.json`, `docs/jv/LINE_FINAL_PRICE_PARITY.json`.

Весь текущий индекс уже содержит 206 staged paths до создания PR_07 файлов; это не список только PR_07. Git `user.name` и `user.email` не настроены. Ничего не добавлено в индекс и не закоммичено в этом этапе.

## Следующий этап

Реализовать источник стекла/заполнения, клеевые множители, покраску, Q54/Q56 и Q58; затем повторно снять эталоны и проверить Q52:Q58. Точный список см. `PR_08_TASK.md`. До этого итоговая цена и коммерчески полная конфигурация недоступны.
