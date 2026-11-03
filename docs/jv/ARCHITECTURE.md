# GlasS-light: фактическая архитектура расчётов (Этап 0)

Анализ статический по `../reference`? Источник исходников — `_GlasS_source/GlasS` в рабочем пространстве; архивы не менялись. В GitHub положены только документация и каталоги аудита, исходники BMS сюда не копировались. Строки ниже относятся к распакованному `GlasS-light.zip`.

## Поток

1. Frontend `apps/frontend/src/modules/systems/SystemCalculator.tsx` собирает параметры и вызывает API systems.
2. `apps/backend/src/routes/systems.ts:239` объявляет `POST /:id/calculate`; параметры системы загружаются из Prisma, формулы вычисляются через `evaluateFormula` (:272, :297). Ответ включает контекст, displayParams, BOM компонентов, стекло и монтаж (:355).
3. `apps/frontend/src/modules/deals/AddSystemDialog.tsx:104` сводит displayParams к calcParams; UI показывает состав (`:294–297`) и отправляет систему/позиции через API deals.
4. `apps/backend/src/routes/deals.ts:156–205` создаёт/обновляет DealSystem, входы и calcParams, заменяет строки DealItem. Это не сохраняет полный воспроизводимый immutable snapshot формул, исходных цен и trace.
5. Дополнительные начисления считаются отдельно в `apps/backend/src/lib/dealExtras.ts`; это отдельный путь от `/calculate`. Строка 13 использует `parseFloat(...) || defaultVal`, из-за чего ноль заменяется значением по умолчанию.
6. Prisma `apps/backend/prisma/schema.prisma` содержит GlazingSystem, SystemParameter, SystemComponent, SystemGlass, GlassType, Product, DealSystem, DealItem, DealService и Setting. Цены продукта представлены retail/wholesale; единица Product.unit — строка.

## Границы доказательств

- `formulaEngine.ts:45` использует `new Function`; существующее ядро не подходит для новой формульной поверхности.
- `systems.ts:272` — последовательный расчёт параметров (ограниченное число проходов в коде); циклические ссылки требуют отдельной явной диагностики. Ошибки отдельных формул компонентов/стекла обрабатываются локально, местами через нулевые/резервные значения.
- Системный экспорт `apps/backend/systems-export.json` не является выгрузкой живой БД. В нём нет полного Product/Setting/GlassType и сделок.
- Упоминание отдельных функций/формул не подтверждает равенство цен результатам Excel без freshly recalculated golden cases.
