# Представление результатов JV

Источник — существующий защищённый `POST /api/jv/orders/calculate-preview`; контракт API и расчёты не изменены. Экран использует только явные поля: `orderId`, `profile`, `versions`, `status`, `calculation.positions`, `bom`, `totalSalePrice`, `diagnostics`, `limitations`, `trace`. `JVResultView.tsx` отделён от редактора; `jvResultAdapter.ts` форматирует точные значения без денежных вычислений JavaScript Number. Десятичная запись используется только если рациональное число имеет точное конечное представление; иначе показывается дробь.

| Семейство | Геометрия | Раскрой | Стекло / отделка / работы | Расходники |
| --- | --- | --- | --- | --- |
| Line | `geometry.openingWidth` | `geometry.cutting.items`: длина, количество, источник | `glass.panes`/суммы, `paint.finishTotal`, `work.assemblyAndMilling`/`installation` | отдельные количества не выводятся, если не представлены в явном безопасном поле |
| Zigzag | `geometry.outputs` | отдельный список деталей не предоставлен — явно недоступен | `costs.P40`, `P39`, `P41`, `P43` | отдельная детализация недоступна |
| Slider L3/L5/X3/X5 | `geometry.geometry` | отдельный список деталей не предоставлен — явно недоступен | `confirmedSubtotals.glassD50`, `paintingM48`, `additionalWorkM49`, `installationM52` | отдельная детализация недоступна |
| Front | `geometry.geometry` | `geometry.cutPieces` | `glass.pieces`/суммы; `works.painting`, `additionalWork`, `installation` | `consumables` — только скалярные и рациональные значения |

Общий и позиционные BOM используют строки `UnifiedBomLine` без повторного умножения или слияния. Цена/сумма показывается только при наличии поля и COMPLETE соответствующего представления; цена строки не превращается в итог. Общий итог выводится исключительно при COMPLETE и наличии `totalSalePrice`; при PARTIAL он не отображается. Число конструкций суммируется целочисленным BigInt без денежной арифметики.

Trace раскрывается по требованию, фильтруется и показывается порциями по 100. Вывод ограничен идентификатором, типом, правилом, адресом, списком строковых идентификаторов зависимостей, скалярным результатом и диагностикой. Вложенные input/result-объекты, серверные snapshots, настройки и произвольный JSON не отображаются. Роли OWNER/ADMIN проверяются существующим backend; это ограничение представления, а не новая серверная DTO. Существующий ответ API по-прежнему объёмный и требует отдельного аудита передачи избыточных внутренних данных до расширения круга ролей.

Для семейств/ветвей, где нужное поле отсутствует, показывается отсутствие детализации, а не ноль. Подписи ячеек геометрии оставлены адресными, когда устойчивая бизнес-семантика не подтверждена. Не реализованы подробные карточки стекла Zigzag/Slider, детали раскроя этих семейств и полный интерактивный граф зависимостей; исходный trace может содержать сложные результаты, которые намеренно не раскрываются.

## JV-RESULT-1 mapping update

Only explicit server-selected fields reach the UI. Zigzag geometry exposes confirmed Z1 H4:H9, H13:H18 and D29:D31; Slider geometry exposes S1 D31:D34 and D43:D45. These are source-backed geometry outputs, not invented cut lists. Engine exposes Slider material quantities and Zigzag BOM/geometry, but no normalized per-piece cut list or glass-pane list in these public family result objects; therefore the UI does not infer lengths, quantities or prices. Front and Line projected cut pieces and pane dimensions are retained. Inspect original formulas/Excel parity before expanding this contract.
