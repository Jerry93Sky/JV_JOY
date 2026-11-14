# Этап 0.2 — закрытие критических пробелов (доступная статическая проверка)

## Доказанные результаты
- VBA проект есть в обеих книгах, размер каждого `xl/vbaProject.bin` 150016 байт; SHA256 различается. В среде отсутствуют `oletools/olevba`, Microsoft Excel COM недоступен. Поэтому обработчики и арифметика VBA не извлечены и не подтверждены. Бинарник не исполнялся.
- XML показывает Z1–Z7 G40 формулу `INDEX('#3'!$O$5:$O$10,$H$39)`, G41 — `INDEX('#3'!$P$5:$P$10,$H$39)`, обе помечены array, `ref` только на собственную ячейку. Хранимые кэши соответственно 2 и 0. Комплектация и розница для этих формул/кэшей одинаковы. Это показывает lookup по индексу H39 в таблицу листа #3, но не валидирует кэш и не раскрывает upstream выбор H39.
- XML/библиотечный diff обнаружил `Настройки!E34` blank в комплектации и `=IF(D34,"ДА","НЕТ")` в рознице. Разница статуса/индикатора на вид; влияние на цену не доказано, нужен graph reachability к итоговым ячейкам. Другие выведенные отличия массива не подтверждены: сравнение объектов openpyxl ошибочно считает разные объектные identity различиями.
- Валидация списка Line содержит `#REF!` для D9:G9 и E12:G13 на листах L. Это UI validation defect, не доказано влияние формул/итога; допустимый ввод может быть затруднён.
- Excel COM и Microsoft Excel не обнаружены через проверку `win32com.client`/COM dispatch. Свежие эталоны не получены. Кэши только `cached_unverified`.
- Архитектурные риски BMS подтверждены путями в `RISKS.md`: new Function, ограниченное вычисление параметров, error fallback, zero-default bug, отсутствие immutable snapshot. Не исправлялись.

## Статус сценариев
Ниже сценарии готовят одинаковую процедуру исполнения в копиях обеих книг. Числовые поля ожиданий намеренно не заполнены: golden status `pending_excel_oracle`.

| ID | Семейство/режим | Вход/варианты | Ожидаемые промежуточные поля для записи | Итоговые поля | Эталон |
|---|---|---|---|---|---|
| L-01 | Line, COMPLETATION | минимальные допустимые W/H; штатные заполнение/створки | ограничения, длины профилей, раскрой, BOM, стекло | cost, sale, discount, total | pending_excel_oracle |
| L-02 | Line, RETAIL | типовой вход, штатный набор аксессуаров | те же + цены/коэффициенты retail | cost, sale, total | pending_excel_oracle |
| L-03 | Line, обе книги | max bounds и boundary ±1; смена створок/парковки | branch flags, PD row/index, cut lengths | итог и Excel error/status | pending_excel_oracle |
| Z-01 | Zigzag, COMPLETATION | типовой размер, секции и направление | geometry, H39, G40/G41, BOM | cost/sale/total | pending_excel_oracle |
| Z-02 | Zigzag, RETAIL | min/max габариты, альтернативное направление | active IF branches, lookup #3, components | итог | pending_excel_oracle |
| Z-03 | Zigzag, обе | invalid combination + отсутствующий lookup | error propagation vs IFERROR | ошибка, не подменять 0 | pending_excel_oracle |
| S-01 | Slider L3 | 3 tracks, типовой и минимальный размер | профиль/направляющие/ролики, раскрой | cost/sale | pending_excel_oracle |
| S-02 | Slider L5 | 5 tracks, boundary size | соответствующий BOM, glass dimensions | cost/sale/total | pending_excel_oracle |
| S-03 | Slider X3/X5 | каждый независимый профиль, max size | selected price table, BOM, обработки | total | pending_excel_oracle |
| F-01 | Front | обычное заполнение без двери | размеры/материал/количество | cost/sale/total | pending_excel_oracle |
| F-02 | Front | дверь/зажимной профиль и сложная опция | validation/error branch, BOM | total или явная ошибка | pending_excel_oracle |
| ALL-01 | все семейства | дополнительные работы, монтаж on/off, аксессуары | отдельные work lines и базы начисления | CC, glue+act, grand total | pending_excel_oracle |
| ALL-02 | обе цены | одинаковая физическая конфигурация | одинаковый geometry/BOM, профильные прайсы | различие retail/completion объяснимо | pending_excel_oracle |

Вводить реальные W/H и выбранные dropdown можно только после картирования именованных входных ячеек каждой ветви; на данном шаге намеренно не подставлять придуманные координаты/значения. Исполнитель эталонов заполнит `scenario-inputs.csv` после этого mapping; откроет копию в Excel, пересчитает Ctrl+Alt+F9 и зафиксирует workbook/build/input/output/checksum.

## Архитектурное решение
Сохранить React UI, Fastify auth/API и Prisma CRM/deals/products/files/finance. Расширить каталог версионированными lookups/prices после сравнения; новый backend domain package держать чистым от БД/UI. Заменить только путь вычислений JV, за feature flag и только после parity. Интеграция сначала сохраняет immutable quote snapshot рядом с текущими DTO, не меняя старые записи. Glass, BOM, работам и итогам необходимы отдельные typed lines с units/provenance.

## Классы задач
- BLOCKER для каждого production family: установить input→formula→lookup→output map, свежие golden и обработку ошибок именно этой ветви; не блокирует типы/serializable result/trace/test harness.
- IMPORTANT до эксплуатации: VBA статический аудит, полный PД и price snapshot, negative/half rounding oracle, полноценная Excel function compatibility, коммерческий totals parity, исторические quote snapshots.
- LATER: UI polishing, визуальное воспроизведение Excel, импорт старых записей, deployment/production migration.

## Готовность
Можно начинать PR_01 только как контракт/инфраструктуру, без вычислительной математики; его спецификация в `PR_01_TASK.md`. Реализация первого семейства должна ждать mapping и fresh goldens соответствующей ветви. Текущий этап не заявляется полностью закрытым.

## Дополнение после независимого VBA compare

В обеих книгах тела 43 модулей совпадают (нормализованные переносы строк), 28 `Worksheet_Calculate` изменяют только цвет вкладки по A3, 15 модулей без процедур. Риск различающейся арифметики VBA закрыт для этих версий. Формульные риски, UI validation/controls и внешняя автоматизация остаются отдельными. Microsoft Excel недоступен; golden values отсутствуют.

Для PR_01 отсутствие numerical goldens не блокирует независимую типизированную инфраструктуру: DTO/Result/error/trace и schema-level tests можно реализовать без формул и денежных expected values. Family engine и price math остаются gated на fresh Excel golden для каждой ветви.
