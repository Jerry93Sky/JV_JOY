# PR_09 — расчёт заказа JV-Line: результат

## Итоговый статус

Добавлен отдельный order coordinator поверх существующего JV-Line construction engine. Полная order price доступна только для заказа, где каждая позиция — поддержанный JV-Line и каждый Q58 прошёл существующий guard. Заказы со смешанными семьями, включая Zigzag/Slider/Front, возвращают `PARTIAL`; order totals и общая спецификация не публикуются. Никакой интеграции с legacy `/calculate`, API, Prisma или production DB нет.

Изменены только новые модули shared JV, клиентский import JV-Line Lab, Vite alias для выделенного экспорта, тесты/инструменты/документация и GitHub Actions workflow. Исходные XLSM не менялись. Файлы `apps/backend/pnpm` (0 bytes) и `query` (`postgresql-x64-18`, 19 bytes) проверены, но оставлены вне коммита как необъяснённые untracked артефакты.

## Реализовано

- `calculateLineOrder` принимает несколько JV-Line слотов, сохраняет исходный slot `L1`…`L7`, profile, количество экземпляров и независимые per-position результаты.
- Повторно использует `calculateLineConstruction` для BOM, стекла, покраски, работ и коммерческих итогов. Для order rules выполняет предварительный проход для BOM расхода и финальный проход с едиными правилами заказа; промежуточные предварительные цены не возвращаются.
- Один общий фактор `Клей+акт!O5` и `O18` вычисляется из суммарного расхода всех поддержанных JV-Line позиций с количеством Z. Проверка `factor × aggregate consumption = whole package count` сходится с Excel `N12` и `N25`.
- Per-instance `X5` вычисляется по подтверждённой формуле `ПРМ!AB25:AB31 = AA/(AA32*W)`. Формула trace включает корректный AB row для конкретного L-слота.
- Q52–Q58 агрегируются как `per-position Q × Main!Z`. Q56 остаётся подытогом, Q58 — итогом; Q52–Q56 повторно не прибавляются к Q58.
- BOM позиции агрегируются по SKU с суммами количеств и стоимостей, умноженными на количество конструкций и сохранением source position IDs.
- Trace содержит общие O5/O18, X5 allocations, Q aggregation rules и trace конструкций с адресами своего L-слота.
- Неподдержанная семья возвращает `PARTIAL`, явно помечает JV-Line diagnostic results как `CONSTRUCTION_ONLY_ORDER_RULES_UNAVAILABLE` и не публикует order totals/specification.

## Excel parity

Сценарии собраны Microsoft Excel 16.0 `CalculateFullRebuild` на временных копиях исходных книг. Исходные workbook SHA-256 находятся в JSON fixture. На каждый workbook проверены один экземпляр, три экземпляра и заказ из двух слотов разных размеров с количеством 2 и 3.

| Классификация | Количество | Объём |
|---|---:|---|
| EXACT | 36 | Q52–Q58 и два общих количества упаковок по кейсам |
| DISPLAY_MATCH | 20 | денежные итоги совпали в отображении Excel до 2 знаков |
| NUMERICALLY_EQUIVALENT | 0 | не использовалась отдельная tolerance-категория |
| MISMATCH | 0 | нет в проверенных кейсах |
| UNVERIFIED | 14 | не конечные десятичные значения X5/O5 в binary64 Excel |

Всего проверено 6 Excel order captures и все 6 построены движком из исходных входов и прайс-снимков. Из Excel не передавались X5, O5/O18, Q52–Q58 или иные вычисленные формульные ячейки. Проверка ограничена поддержанными JV-Line ветвями и не доказывает parity смешанного заказа.

Команды:

- `powershell -NoProfile -ExecutionPolicy Bypass -File tools/jv/recalculate-line-order-golden.ps1` — свежий Excel COM full rebuild на временных копиях.
- `pnpm parity:jv-order` — независимый пересчёт заказов движком и генерация сравнения.

## Проверки

- `pnpm test:jv` — **66/66 passed** после исправлений.
- `pnpm typecheck:shared` — passed.
- `pnpm build:frontend` — passed; остаются штатные предупреждения CJS Vite API, устаревшего Browserslist и большого JS chunk.
- `pnpm validate:jv-fixtures` — JSON fixture validation; число файлов фиксируется в CI output.
- `pnpm smoke:jv-line-lab` — компонент JV-Line Lab SSR smoke passed, 15,649 HTML characters.
- `pnpm build:backend` — failed на ранее известных Prisma/route/enum и TS5097 проблемах; backend вне области изменений PR_09. Диагностическая GitHub Issue создаётся отдельно.
- Сравнение `git diff --name-only` по backend routes, Prisma schema и frontend API/store не показало изменений. Legacy `/calculate` и БД этим PR не затронуты.

## JV-Line Lab

Статическая диагностика runtime импортов выявила конкретную несовместимость: страница импортировала `@bms/shared`, Vite alias направлял импорт в корневой `src/index.ts`, откуда подключался старый CommonJS `src/types/deal.js`; SSR evaluation падал с `ReferenceError: exports is not defined`. Lab переключён на `@bms/shared/jv`, Vite alias добавлен на выделенный JV entrypoint, после этого компонент успешно загружается через Vite SSR и выдаёт ожидаемую разметку.

**Полноценный визуальный браузерный smoke-test после исправления не подтверждён.** Интерактивный прогон после входа, изменение формы/профиля и отображение результата/trace остаются отдельной проверкой безопасного браузерного окружения. Production авторизация не отключалась и не обходилась. Подробности: `LINE_LAB_VISUAL_TEST.md`.

## GitHub CI и backend issue

`.github/workflows/jv-ci.yml` использует `pnpm install --frozen-lockfile` и Node.js 24.13.0; workflow запускает JV tests, shared typecheck, frontend production build, component smoke и JSON validation без production DB. Excel COM остаётся отдельной Windows + Excel проверкой.

`pnpm build:backend` по-прежнему не проходит: 125 TypeScript diagnostics (78 TS5097 из shared `.ts` imports и Prisma/routes/enums/types issues). Воспроизведение и ожидаемое/фактическое поведение задокументированы в [GitHub Issue #2](https://github.com/Jerry93Sky/JV_JOY/issues/2). CI не утверждает backend build green и не запускает DB миграции.

## Подготовка к PR_10

Следующий этап должен закрыть валидируемое сопоставление Main selectors с семьёй/системой и безопасный authenticated visual smoke-test, после чего можно добавлять новый независимый family engine. Смешанный полный order price, новые семейства и не подтверждённые Q54/дополнительные работы остаются вне готового покрытия. Задание записано в `PR_10_TASK.md`; реализация PR_10 не начиналась.
