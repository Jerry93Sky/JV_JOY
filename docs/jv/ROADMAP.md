# План небольших PR после Этапа 0

1. Test harness и версионированные decimal/trace типы (без endpoints/DB). Gate: unit semantics.
2. Lookup/Excel function library: IF/IFERROR/INDEX/MATCH/ROUND variants/SUM/AND/OR. Gate: boundary tests и независимый review.
3. LINE: геометрия, раскрой, BOM, PD; затем стекло/работы. Gate: fresh goldens обеих книг.
4. ZIGZAG по той же модели, но собственные ветвевые правила. Gate: сценарии сторон/границ.
5. Slider L3/L5/X3/X5 отдельно; gate по каждой ветке.
6. FRONT с несовместимыми сочетаниями и error parity.
7. Совместные блоки: accessories, coating, assembly, installation, delivery, discounts, CC, Glue+act. Gate: totals parity.
8. Только затем feature-flag адаптер BMS + quote snapshot; регрессия старого расчёта при выключенном флаге.
9. UI и экспорт спецификации; визуальная/UX проверка.
10. Shadow comparison и контролируемый релиз отдельным согласованным этапом, backup/rollback.

В каждой точке новый engine opt-in. Никаких production миграций/импортов и переписывания старых сделок на этапах 0–7.
