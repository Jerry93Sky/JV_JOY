# PR_01 — результат

## Изменения
- `packages/shared/src/jv/types.ts`: типизированные входы позиций/заказа, системы и семь вариантов, геометрия, материалы, комплектующие, заполнение, работы, pricing profile, version set, спецификация, costs, ошибки/предупреждения и summary.
- `decimal.ts`: проверка десятичной строки без преобразования к JS Number и без правил округления.
- `trace.ts`: неизменяющий входы конструктор trace-step и детерминированная агрегация статусов.
- `index.ts`: публичные экспорты.
- `packages/shared/package.json`, `tsconfig.jv.json`: минимальные настройки в согласии с `@bms/shared` из snapshot; отдельная команда тестов, API не подключён.
- `types.test.ts`: 3 независимых теста.
- `docs/jv/fixtures/excel-case.schema.json`: формат кейса с явным статусом cache/pending/verified oracle.
- `apps/backend/src/domain/jv/README.md`: граница будущего доменного модуля без вычислителя.

## Проверки
Команда `node --experimental-strip-types --test packages/shared/src/jv/types.test.ts`: 3 passed, 0 failed. Проверены decimal string preservation/rejection, immutable trace provenance, статусы ошибок. TypeScript compiler и существующие BMS lint/test команды недоступны в клоне: приложение/монорепо GlasS и установленные зависимости отсутствуют в `JV_JOY`. Формула, API и Prisma не запускались.

## Совместимость и ограничения
Текущий клон содержит только README и документы, поэтому сравнение runtime BMS baseline невозможно. PR_01 не меняет legacy исходники: добавлены только shared contract files, backend boundary README и документация. Схема Prisma, API маршруты и UI не менялись. Нет округления/арифметики и числовых expected values. Контракт сериализуем; `DecimalString` остаётся строкой на runtime и требует вызывать валидатор на границе.

## Следующий шаг
PR_02: завершить input-to-cell mapping конкретной ветви и получить свежие golden cases в Excel; затем реализовать независимый lookup/Excel semantics слой. Сначала утвердить decimal representation, единицы и правила Excel округления по эталонам. Не включать family formulas, пока их golden suite не готов.
