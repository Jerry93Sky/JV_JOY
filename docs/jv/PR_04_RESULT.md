# PR_04 — результат: спецификация материалов JV-Line

## Итог

Создан независимый, детерминированный и явно **частичный** BOM JV-Line. Он использует результат PR_03E напрямую, не пересчитывая геометрию/раскрой. В составе 14 подтверждённых строк: LN-010 из `L1!O5`; 11 прямых count/direction/angle/frame формул на source cells D5/D6/D7/D9/D15; LN-210 и LN-220 с literal zero в `L1!O40` и O41. Оставшиеся 26 из 40 строк каталога возвращаются в `unsupported` с исходной ячейкой, формулой/константой и кодом; спецификация помечается `PARTIAL`.

**Полная спецификация JV-Line пока не готова.** Никакие неизвестные количества не заменяются нулями. Стандартные закупочные хлысты, раскройный оптимизатор, цены, себестоимость, стекло и услуги не реализованы.

## Реализованные данные/правила

| L1 Excel | Выражение | SKU / unit | Реализация |
|---|---|---|---|
| `O5`, identity `L5:N5 -> Прайс-Line!B5:D5` | `=$D$32/1000+Настройки!$D$7/1000` | LN-010 / `п.м` | использует результат существующего правила `JV.LINE.CARRIER_PROFILE_MATERIAL_QUANTITY` |
| `O9:O11,O21:O25,O30:O32` | формулы в версионированном каталоге; см. `LINE_MATERIAL_CATALOG.md` | 11 SKU, по строкам и единицам Excel | DAG использует явно переданные значения `L1!D5,D6,D7,D15`; `D9=90` остаётся подтверждённой константой книги |
| `O40`, identity `L40:N40 -> Прайс-Line!B41:D41` | literal `0` | LN-210 / `шт.` | `JV.LINE.BOM.LN-210.CONSTANT` |
| `O41`, identity `L41:N41 -> Прайс-Line!B42:D42` | literal `0` | LN-220 / `шт.` | `JV.LINE.BOM.LN-220.CONSTANT` |

Материальный каталог содержит 40 проверенных идентификаторов/описаний/единиц из обеих книг, версия `JV-LINE-CATALOG-2026-10-08`. Цены, масса и покраска в snapshot не копируются. Подробности и исходные формулы для всех 40 строк — [`LINE_MATERIAL_CATALOG.md`](LINE_MATERIAL_CATALOG.md) и [`fixtures/line-material-catalog.json`](fixtures/line-material-catalog.json).

## Excel golden результаты

Обе книги пересчитаны Microsoft Excel 16.0 методом `CalculateFullRebuild` на временных копиях; VBA отключён. Скрипт сохраняет для `L1!L5:O44` только артикул, наименование, unit и quantity (без цен), а также геометрию и резы. Оригинальные XLSM не изменялись; их source hashes совпадают с предыдущими.

- 5 сценариев × 2 книги = 10 независимых пересчётов.
- Геометрия, раскрой, SKU, наименование и единица: совпадают во всех 10 случаях.
- LN-010 количество O5: 6 точных сравнений; 4 сравнения показывают точное различие представления double: Excel COM `5.537999999999999` против точной десятичной арифметики `5.538`, либо `6.404999999999999` против `6.405` (оба workbook в двух сценариях). Разность сохраняется в golden без округления и допуска.
- Другие 11 прямых формул материалов: все значения/коды/units совпали во всех 10 сценариях.
- LN-210/O40 и LN-220/O41: точный ноль во всех 10 сценариях.
- Итого: 14 реализованных строк, 26 явных неподдержанных; **полная BOM parity не заявляется**.

Сырые/сравнённые значения и версии: [`fixtures/line-cutting-excel-golden.json`](fixtures/line-cutting-excel-golden.json), отчёт независимой проверки: [`LINE_MATERIAL_PARITY.json`](LINE_MATERIAL_PARITY.json).

## Цена и BMS

Составлена карта формул стоимости LN-010 в [`LINE_MATERIAL_CATALOG.md`](LINE_MATERIAL_CATALOG.md): `P5=E5/Настройки!D2`, `Q5=P5*O5`, масса в `S5`, покраска в `V5`. Формулы других строк отличаются; отдельный price snapshot и единая политика округления отсутствуют, поэтому стоимость не переносилась. Комплектация и розница используют разные значения цен.

Legacy `apps/backend/src/prisma/import-formulas.ts` не менялся. Его `LN-010 round((width+100)/1000/cutCoeff,3)` не эквивалентен Excel D32/O5; BMS LN-210/LN-220 использует `panels`, хотя обе исходные книги содержат O40/O41 = 0. Совпадение SKU не означает совпадение формул.

## Код и тесты

- Каталог: `packages/shared/src/jv/catalog-line.ts`.
- Типизированный BOM и DAG trace: `packages/shared/src/jv/bom-line.ts`.
- Unit и golden assertions: `packages/shared/src/jv/bom-line.test.ts`, `packages/shared/src/jv/cutting.test.ts`.
- Recalc/compare/verify: `tools/jv/recalculate-line-cutting-golden.ps1`, `tools/jv/compare-line-cutting-excel-golden.mjs`, `tools/jv/verify-line-material-parity.mjs`.
- `pnpm --filter @bms/shared test:jv`: **34 passed, 0 failed**.
- `pnpm dlx --package typescript@5.9.3 tsc -p packages/shared/tsconfig.jv.json`: passed.
- `node tools/jv/verify-line-material-parity.mjs`: 6 exact O5 matches; 4 explicitly recorded Excel binary representation differences; literal zero lines all match.

## Обратная совместимость и ограничения

Изменения изолированы в `packages/shared` и `docs/jv`; Excel runner работает на копиях. Не менялись `/calculate`, legacy формулы BMS, Prisma schema, рабочий React UI и production DB. Не добавлялись цены в BOM. Проверка не доказывает полную эквивалентность всех конфигураций, материалов или рознично-комплектационной цены.

PR_04 продвинул спецификацию до проверяемого partial BOM, но не закрывает критерий полной спецификации. Оставшиеся 26 строк требуют поэтапного переноса веток, ПД/справочников, геометрических зависимостей и Excel parity; только после этого можно считать BOM полным.
