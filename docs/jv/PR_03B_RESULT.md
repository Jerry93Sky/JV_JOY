# PR_03B результат: JV-Line dependency recovery

Исследованы обе книги, семь Line worksheets на книгу: 6,832 формульные ячейки суммарно по реестру (488 × 7 × 2). Простая нормализация ссылок даёт 298 шаблонов; это syntactic grouping, не число бизнес-правил. Скрипт статического анализа добавлен в `tools/analyze_line_formulas.py`; исходные формулы/кэши не вычисляет и сохраняет cache status как unverified. XML-анализ дополнительно нужен для array/shared formulas.

Реализовано дополнительно одно точное правило: `L1!I27 = I25 - 2*D22`. Оно запускается через общий DAG, использует BigInt decimal operations, контролирует равные явно поданные единицы и трассирует Excel source. Технические unit tests не являются Excel goldens. Реализовано правил: 2 суммарно (включая PR_03 I27); сквозных цепочек от UI input до размеров: 0 полностью закрытых, поскольку I25/I26 upstream provenance/unit пока неполны. Отдельный output I27 возможен при предоставленных I25 и D22.

Ветка `I26` использует `O15`; O15 выбирает либо D6+2, либо одну из ПД матриц `ПД!D5:BA54` / `D61:BA110` индексами D5 и C24, в зависимости от D23/D6. Полная семантика table rows, единицы P settings и UI provenance нуждаются в подтверждении. Автоматический перенос массива формул не делался.

Тесты: 8/8 engine tests pass; среди них 2 теста I27. Excel golden tests: 0. Backend type errors остаются в legacy Prisma/DTO; frontend build и shared check проходят по PR_03 результату. Изменений `/calculate`, Prisma schema и legacy math нет. Следующие шаги: достроить Main→L1 input mapping, выяснить O15/PД lookup semantics, определить unit source и затем реализовать I25/I26 + carrier cuts как один DAG пакет; только после этого готовить материал BOM.
