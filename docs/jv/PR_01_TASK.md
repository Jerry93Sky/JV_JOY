# PR_01 — безопасная основа расчётного ядра (без математики JV)

## Цель
Создать независимый, чистый типизированный calculation package и тестовый каркас. Этот PR не реализует ни одну формулу конструкции и не подключается к production BMS.

## Файлы
- `packages/shared/src/jv/types.ts`: DTO `PriceProfile`, семь `JVVariant`, вход позиции/заказа, `CalculationContext`, decimal-string и единицы.
- `packages/shared/src/jv/result.ts`: tagged status/errors, material/work lines, summary и trace.
- `packages/shared/src/jv/index.ts`: экспорт только типов/схем.
- `apps/backend/src/domain/jv/README.md`: граница чистого ядра и будущего адаптера. Реализацию `calculateJV` оставить интерфейсной заглушкой без расчёта, если текущая архитектура требует callable API.
- `apps/backend/src/domain/jv/__tests__/`: тесты сериализации/валидации контракта и статусов; никакого expected monetary output.
- `docs/jv/`: ссылки на контракт/риски и статус этого PR.

## Контракт
`calculateJV(input, immutableContext): Result` не импортирует Prisma, Fastify, React, fs, часы и сеть. Профиль только `COMPLETATION | RETAIL`; не маппить на DEALER/PRIVATE. Любое число имеет decimal-string и unit. Результат хранит независимые positions, BOM, work, summary, provenance trace, errors/status. Все использованные modelVersion/priceSnapshotId/lookupVersion обязаны присутствовать.

## Тесты
1. Один и несколько items сохраняют независимые itemId и variant.
2. Пустой прайс/lookup возвращает `unavailable`, неверный вход — `invalid_input`, не NaN/0.
3. Trace ссылается на version/source code, serializable deterministically.
4. Decimal strings сохраняют точный текст и unit.
5. Зафиксировать отрицательные/половинные rounding cases как ожидаемые `pending_excel_oracle`; не кодировать правила округления до goldens.
6. Текущий BMS baseline не меняется; никаких route/schema/migration файлов.

## Приёмка
- typecheck и unit test shared/backend проходят.
- В diff нет `apps/backend/src/routes`, `prisma/schema.prisma`, migrations, существующего `formulaEngine.ts`.
- Нет `eval`/`new Function`, импортов внешнего окружения из ядра.
- Нулевой claim о parity: отсутствуют свежие Excel goldens.
- PR малый, отдельная ветка, reviewer проверяет API границы.

## Не входит
Реализация геометрии/BOM/цены, импорт Excel/живой БД, Prisma-модели, API/UI, изменение legacy расчётов, перевод старых сделок.

## Статус подготовки
PR_01 можно начинать отдельным следующим заданием: ценность его scope — типизированные DTO, tagged errors, deterministic trace и contract tests; он не требует числовых эталонов. Ни одну формулу JV в PR_01 не переносить. Не переключать существующий endpoint, не менять Prisma schema/migrations и legacy calculation. Эталонные цены/округления остаются gate для последующих family PR.
