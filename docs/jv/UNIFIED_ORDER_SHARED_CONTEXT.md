# Unified Order shared context — PR_13D

## Вычислительная модель

`calculateJVOrder` принимает список позиций с уникальными идентификаторами, уникальными Main slots 1–7, целым положительным количеством, единым профилем и едиными workbook name/SHA. Вход описывает семейный запрос и источник снимков; опубликованные Excel `Value2` не являются входом движка.

Алгоритм выполняется в двух фазах:

1. Каждый существующий семейный калькулятор выполняет предварительный расчёт и выдаёт геометрию, BOM, локальные стоимости, потребление клея/активатора и трассу.
2. `buildSharedResources` сводит потребление с учётом количества каждой позиции, вычисляет упаковки, коэффициенты распределения и точные доли площади. `buildUnifiedOrderContext` связывает рассчитанные значения с исходными ID/слотами, ячейками и ревизией книги. Затем семейные калькуляторы вызываются повторно с этим контекстом.
3. Для всех завершённых семейств `calculateUnifiedMainPrice` переносит подтверждённый выход позиции на Главная, применяет family divisor, slot markup, количество `Zrow` и скидку заказа `D19`; `AA18` строится только как сумма семи рассчитанных строк.

Это сохраняет один физический заказный расход: ресурсы участвуют в расчётах семейных цен через коэффициенты, а `sharedResources` — только контроль/аудит и BOM aggregation, не второй charge.

## Источники и формулы расходников

| Семейство | Активатор на конструкцию | Клей на конструкцию | Примечание |
|---|---|---|---|
| LINE | `Lslot!O49` (BOM `AA-110`) | `Lslot!O50` (BOM `AA-120`) | Передаётся существующему Line calculator |
| ZIGZAG | `Zslot!N34`, строка 34 | `Zslot!N35`, строка 35 | Передаётся Zigzag order calculator |
| SLIDER_L3/L5/X3/X5 | `Sslot!K40` | `Sslot!K41` | Расчёт каждого варианта получает семь строк orderContext |
| FRONT | literal `0` для selector 7 | literal `0` для selector 7 | Условия Front-zero применяются только к этой ветви |

Для `Главная!Z11:Z17` количество умножает потребление на конструкцию. В Excel `Клей+акт!N12` и `N25` задают `max(ROUNDUP(total,0),1)`; `O5=N12/SUM(N5:N11)`, `O18=N25/SUM(N18:N24)`. Engine хранит BigInt rational, считает packages отдельно от физической потребности и сохраняет divide-by-zero/неполные зависимости как ошибки или PARTIAL, не как нули.

## Area allocation и индексация слота

ПРМ вычисляет weighted area для Main rows 11–17 (`AA25:AA31`, `AA32`) и долю для каждой строки (`AB25:AB31`). Для позиции `j` формула `AB(row)=IFERROR(AA(row)/(AA32*W(row)),0)` эквивалентна exact ratio `width*height / Σ(width*height*quantity)` на известных положительных входах. Для пустых позиций сохраняется нулевая доля.

Front листы ссылаются на разные строки ПРМ: Excel COM подтвердил `F1!Y5=ПРМ!$AB$25`, `F7!Y5=ПРМ!$AB$31`; все строки `AB25:AB31` содержат построчные аналоги формулы. PR_13D заменил прежнюю жёсткую привязку Front к slot 1 на `positionMainRow`, `F{slot}!Y5` и `AB{24+slot}`. Тест использует slot 7 и сравнивает точную долю `50/333` на указанном наборе размеров.

## Main price transfer

Для slot `s` (Main row `r=10+s`) подтверждены источники:

- Line: `Rr='L{s}'!Q58/Настройки!D11`.
- Zigzag: `Sr='Z{s}'!P44/Настройки!D12`.
- Slider L3/L5/X3/X5: `Tr='S{s}'!M53/Настройки!D13`; `U:W` — aliases `T`.
- Front: `Xr='F{s}'!S38/Настройки!D14`.
- `Yr=INDEX(Rr:Xr,Gr)*(100+Настройки!D(20+s))/100`.
- `AAr=Yr*Zr*(100+Настройки!D19)/100`.
- `AA18=SUM(AA11:AA17)`.

Трасса каждого Engine Main transfer содержит источник конкретной позиции (`Q58`, `P44`, `M53`, `S38`), divisor, `D21:D27`, `Zrow`, `D19` и Excel формулу. Для Front slot 7 источник именно `F7!S38`.

## COMPLETE/PARTIAL

`PARTIAL` обязателен при неполном family calculation, неразрешимом обязательном расходнике, отсутствии snapshot Main settings или незакрытом transfer input; total тогда отсутствует. `COMPLETE` на уровне калькулятора означает, что его типизированные зависимости закрыты. До совпадающего Excel/engine all-seven fixture это не означает коммерчески подтверждённую эквивалентность: все 96 сравнений AA11:AA18 в PR_13D отчёте, где нет соответствующего Engine input, остаются `UNVERIFIED`.

## Доказательства и ограничения

- `tools/jv/capture-unified-order-all-seven-pr13d.ps1`: 12 свежих COM пересчётов, оригиналы открываются только через временные копии; 6 валидных сценариев в каждом профиле.
- `docs/jv/fixtures/unified-order-all-seven-pr13d-excel.json`: Main входы, формулы, `Value2`, `.Text`, `NumberFormat`, O5/O18/N12/N25, AB25:AB31, Front Y5/S38 и AA18.
- `tools/jv/compare-unified-order-all-seven-pr13d.mjs`: формирует статусный ledger; engine parity не имитируется.
- `docs/jv/UNIFIED_ORDER_ALL_SEVEN_PARITY.json`: все 12 Excel сценариев валидны, но 84 строки AA11:AA17 плюс 12 AA18 остаются UNVERIFIED.

Причина UNVERIFIED PR_13D заключалась в provenance: standalone fixtures семи калькуляторов не описывали тот же raw order, что Excel capture. PR_13E добавил новый общий manifest и закрыл этот разрыв для 12 контролируемых сценариев.

## PR_13E — результат all-seven проверки

`fixtures/unified-order-all-seven-inputs.json` задаёт первичные входы для обеих сред. Excel 16 на временных копиях и Engine использовали один и тот же сериализованный manifest; сохранённые Excel `Value2` применялись только как выходы для сравнения. Проверены все семь слотов, в том числе `F7!Y5 → ПРМ!AB31`, `F7!S38` и Main `AA17`.

Все 12 сценариев input-compatible. 96 обязательных итоговых сравнений: 1 EXACT, 38 NUMERICALLY_EQUIVALENT, 45 DISPLAY_MATCH, 0 MISMATCH, 0 UNVERIFIED. Для AA18: 3 NUMERICALLY_EQUIVALENT, 9 DISPLAY_MATCH, без mismatches/unverified. Ещё 216 сравнений источников цен, долей площади, упаковок и факторов: 25 EXACT, 87 NUMERICALLY_EQUIVALENT, 104 DISPLAY_MATCH, без mismatches/unverified. В display-only случаях exact numeric parity не утверждается. Размеры и selectors в manifest ограничены покрытыми сценариями; exhaustive coverage пока не заявлен. См. `PR_13E_RESULT.md` и `UNIFIED_ORDER_SCENARIO_INPUTS.md`.
