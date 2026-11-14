# PR_13C — причины прежнего `UNVERIFIED` и доступная Main-цена

## Вывод

PR_13C устранил прежние 12 `UNVERIFIED` итогов для Line-only заказов. Причина была технической: `tools/jv/unified-order-parity.mjs` безусловно увеличивал счётчик `UNVERIFIED` и записывал этот статус, не сравнивая итог движка. Одновременно `calculateJVOrder` не подключал существующий `calculateLineOrder` для заказа только из JV-Line и не передавал Main-настройки цены.

После исправления все 12 сценариев имеют статус движка `COMPLETE`: 3 итога `NUMERICALLY_EQUIVALENT`, 9 — `DISPLAY_MATCH`, 0 — `MISMATCH`, 0 — `UNVERIFIED`. Общая статистика Unified-проверок: 32 `EXACT`, 39 `NUMERICALLY_EQUIVALENT`, 11 `DISPLAY_MATCH`, 0 `MISMATCH`, 0 `UNVERIFIED`.

Это закрывает только захваченные Line-only сценарии. Полная коммерческая parity для смешанных заказов Slider/Front и all-seven заказа не получена. Поэтому PR_13C **не подтверждает полную коммерческую цену всех семи семейств**. Исходный Excel содержит формулы Main для такого заказа, то есть установленный остаточный блокер — реализация и parity shared-context в движке, а не доказанное отсутствие бизнес-правила. Результаты A и B из задания пока не достигнуты: A требует all-family parity; B требует доказанного отсутствующего бизнес-правила, которого Excel-захват не показал.

## Разбор всех 12 бывших `UNVERIFIED`

Все случаи — LINE-only; наборы содержат 1–3 активных позиции и количества конструкций 1–3. Первичный статус для каждого из них: `ENGINE_RULE_MISSING`. Существующий Excel-результат `Главная!AA18` уже был захвачен; отсутствовали вычислительный маршрут Unified и корректный вызов comparator. `REFERENCE_NOT_CAPTURED` не был первичным блокером: PR_13C дополнительно захватил строки R:X и Y для установления точного пути цены.

| Сценарий | Профиль | Активные входы (слот, количество, размер мм) | Excel `Главная!AA18` | После исправления |
|---|---|---|---:|---|
| `line_single_qty1` | COMPLETATION | 1×1, 3200×2300 | 135 782 | DISPLAY_MATCH |
| `line_single_qty3` | COMPLETATION | 1×3, 3200×2300 | 402 119 | DISPLAY_MATCH |
| `line_two_slots_mixed_area` | COMPLETATION | 1×2, 3200×2300; 2×3, 1800×2100 | 597 997 | DISPLAY_MATCH |
| `line_two_slots_equal_area` | COMPLETATION | 1×1, 2400×2000; 2×1, 2000×2400 | 235 303 | DISPLAY_MATCH |
| `line_three_slots_mixed_quantity` | COMPLETATION | 1×2, 3200×2300; 2×1, 1800×2100; 3×3, 2500×2200 | 739 424 | DISPLAY_MATCH |
| `line_two_slots_large_and_small` | COMPLETATION | 1×1, 4000×2500; 2×2, 3000×2000 | 404 847 | DISPLAY_MATCH |
| `line_single_qty1` | RETAIL | 1×1, 3200×2300 | 293 144 | DISPLAY_MATCH |
| `line_single_qty3` | RETAIL | 1×3, 3200×2300 | 840 717 | NUMERICALLY_EQUIVALENT |
| `line_two_slots_mixed_area` | RETAIL | 1×2, 3200×2300; 2×3, 1800×2100 | 1 104 708 | DISPLAY_MATCH |
| `line_two_slots_equal_area` | RETAIL | 1×1, 2400×2000; 2×1, 2000×2400 | 431 832 | DISPLAY_MATCH |
| `line_three_slots_mixed_quantity` | RETAIL | 1×2, 3200×2300; 2×1, 1800×2100; 3×3, 2500×2200 | 1 417 084 | NUMERICALLY_EQUIVALENT |
| `line_two_slots_large_and_small` | RETAIL | 1×1, 4000×2500; 2×2, 3000×2000 | 848 012 | NUMERICALLY_EQUIVALENT |

Общая причина одинакова во всех 12 строках: Unified parity не проверял итог, а Unified Order не подключал Line order coordinator и Main transfer. Это не Excel-модельная ошибка и не неизвестное правило упаковки. `calculateLineOrder` уже закрывал порядок расходников, площадь/долю системы и агрегирование Q52:Q58, но прежний Unified path им не пользовался.

## Excel-цепочка и доказательства

Обе оригинальные книги пересчитаны через Excel 16 `CalculateFullRebuild` на временных копиях. Расширенный COM capture находится в `docs/jv/fixtures/line-order-excel-golden.json`; исходные XLSM не изменялись.

Для активного Line-слота Excel использует:

```text
Rrow = 'Lslot'!Q58 / Настройки!D11
Yrow = INDEX(Rrow:Xrow, Grow) * (100 + Настройки!D(20+slot)) / 100
AArow = Yrow * Zrow * (100 + Настройки!D19) / 100
AA18 = SUM(AA11:AA17)
```

Для всех семи селекторов в all-seven COM capture дополнительно подтверждены базовые ячейки:

| Семейство / Main-колонки | База и делитель |
|---|---|
| Line, R | `Lslot!Q58 / Настройки!D11` |
| Zigzag, S | `Zslot!P44 / Настройки!D12` |
| Slider L3/L5/X3/X5, T | `Sslot!M53 / Настройки!D13`; U:W повторяют T |
| Front, X | `Fslot!S38 / Настройки!D14` |

Далее Excel выбирает столбец по `G11:G17`, применяет индивидуальную наценку соответствующего слота `D21:D27`, количество `Z11:Z17`, скидку заказа `D19` и суммирует AA11:AA17 в AA18. В обоих профилях all-seven сценарий выдаёт числовое AA18; `F7!I23` — `НЕТ`. Capture `docs/jv/fixtures/unified-order-excel-probe.json` содержит формулы и значения R:X, Y, Z, AA и Main-настроек.

## Изменения кода

- `calculateJVOrder` направляет Line-only позиции через уже существующий `calculateLineOrder`; геометрия, BOM, цены и shared-cost формулы Line не переписаны.
- После проверки provenance Excel 16 snapshot цены Main вычисляет `Q58 / D11`, применяет наценку активного слота D21:D27, количество и D19; отсутствующий Main snapshot оставляет заказ `PARTIAL` без финальной цены.
- Line+Zigzag Main transfer рассчитывается по позиционным исходникам `Q58`/`P44`, делителям D11/D12, markup конкретного Excel-слота и D19. Требуются source/profile/workbook/hash-matched snapshots.
- `compareRationalToExcelValue2` сравнивает рациональное число с точным интервалом округления IEEE-754 без epsilon и без ограничения числителя/знаменателя `MAX_SAFE_INTEGER`.
- Unified parity теперь реально сравнивает `Главная!AA18`; при несовпадении binary64 использует фактический Excel `NumberFormat` и `.Text` для `DISPLAY_MATCH`.
- COM capture дополнен Main R:X/Y/Z/AA и настройками D11:D14, D19, D21:D27.

Численные различия на полном binary64 не скрываются допуском: паритет `NUMERICALLY_EQUIVALENT` присваивается только если точное рациональное значение попадает в IEEE-754 round-to-nearest-even интервал захваченного Excel Value2. `DISPLAY_MATCH` требует точного совпадения строки после форматирования по захваченному Excel number format.

## Остаточное покрытие и неподтверждённые ветки

- 21 комбинация пар и all-seven маршрутизируются; подтверждённые shared consumption, упаковки и площадь доступны, но это само по себе не означает коммерческий `COMPLETE`.
- Line-only покрыт Main AA18 в 12 независимых сценариях: по шесть на каждый ценовой профиль.
- Line+Zigzag может выдать total при закрытых family расчётах и валидных snapshots; свежая независимая parity Main AA18 для смешанного сценария с ненулевым D19 не выполнена. Существующая 10-сценарная mixed parity использует D19=0 и нижний `Y×Z` путь, поэтому она не закрывает этот пробел.
- Сочетания Slider и Front сохраняют `PARTIAL`; итоговая цена отсутствует. Их Main формулы теперь непосредственно зафиксированы, но Unified ещё не reruns все семейные калькуляторы с едиными O5/O18 и AB25:AB31. В результате не проверены row-level T/X → Y → AA и общая цена для Slider/Front mixes.
- All-seven Excel AA18 числовой, но независимого engine↔Excel сравнения нет. Требуются row-aligned входы и family-specific order contexts, затем сравнение Y11:Y17, AA11:AA17 и AA18 для обоих профилей.
- Не найдено доказанного отсутствующего бизнес-решения, требующего владельца: Excel содержит Main формулы передачи цены и общий итог. Поэтому `UNIFIED_ORDER_BUSINESS_RULE_DECISIONS.md` не создан; остаток классифицируется как `ENGINE_RULE_MISSING` плюс отсутствующая mixed-family engine parity, а не как неизвестная бизнес-формула.

Известные исключения сохранены: Retail `F1!R13` (неактивная ветвь), денежное отображение `S1!R10`, `ПРМ!R25` с исходным `#REF!`.

## Проверки и статус этапа

- `pnpm test:jv`: 197 пройдено, ошибок нет.
- `pnpm typecheck:shared`: пройдено.
- `pnpm build:frontend`: пройдено; сохранились обычные предупреждения Vite CJS, Browserslist и размера chunk.
- `pnpm validate:jv-fixtures`: все 42 fixture-файла прошли.
- `pnpm smoke:jv-line-lab`: пройдено.
- Unified Excel parity: 12/12 итогов закрыты, без MISMATCH/UNVERIFIED.
- Семейные Line, Mixed Line+Zigzag, Zigzag, Slider L3/L5/X3/X5, Front geometry/BOM/components/S38 повторно запущены. Сохранены 12 известных UNVERIFIED Zigzag guard-error сравнений и 3 известных Retail `F1!R13` MISMATCH неактивной цены Front.

Итог PR_13C — **подтверждённое исправление технического пробела по всем 12 прежним Line UNVERIFIED**, но не закрытие всего Unified коммерческого движка. Полная цена смешанного заказа всех семи семейств не подтверждена и не публикуется как `COMPLETE`.
