# PR_13D — результат реализации общего контекста заказа

## Итог

Реализован общий двухфазный контекст заказа для всех семи семейств JV в `calculateJVOrder`: Line, Zigzag, Slider-L3/L5/X3/X5 и Front. На первом проходе существующие семейные калькуляторы дают геометрию, BOM и потребность; общий граф собирает расходники и распределение площади; затем калькуляторы вызываются повторно с контекстом заказа. Общие расходники остаются единым ресурсным расчётом и не добавляются к BOM/цене второй раз.

Интеграционные тесты выполняют все семь семейств для COMPLETATION и RETAIL, проверяют общие ресурсы, Main transfer и AA18; отдельно проверяется переменное количество экземпляров и детерминированность. Исправлена ошибка адресации Front: для позиции в Main row 17 расчёт использует `ПРМ!AB31`, `F7!Y5` и источник цены `F7!S38`, а не ячейки первой позиции. Формулы адреса подтверждены свежим Excel COM на копии книги.

**PR_13D не закрывает независимую all-seven engine parity и поэтому не подтверждает математическую эквивалентность коммерческой цены смешанного заказа.** В движке есть полный Main transfer и сумма AA18, но доступные входы семейных fixtures не образуют provenance-matched входной набор к захваченным сценариям Excel. Значения Excel не используются как входы движка и не объявляются результатами parity. Подробности и статусы по каждой ячейке — в `UNIFIED_ORDER_ALL_SEVEN_PARITY.json`.

## Проверенные первоисточники и расчётные правила

- Обе оригинальные книги повторно пересчитаны Excel 16.0 COM методом `CalculateFullRebuild`; каждая проверка выполнялась на отдельной временной копии.
- Подтверждены формулы Main transfer: `Rrow=Lslot!Q58/D11`, `Srow=Zslot!P44/D12`, `Trow= Sslot!M53/D13` (U:W ссылаются на T), `Xrow=Fslot!S38/D14`, `Yrow=INDEX(Rrow:Xrow,Grow)*(100+D(20+slot))/100`, `AArow=Yrow*Zrow*(100+D19)/100`, `AA18=SUM(AA11:AA17)`.
- Общие расходы берутся из количества на конструкцию каждой семьи и `Главная!Z11:Z17`; семейные источники количества, упаковочные minima и area-share описаны в `UNIFIED_ORDER_SHARED_CONTEXT.md`.
- Свежий Excel all-seven capture содержит 12 валидных Excel-сценариев: шесть на каждый профиль, включая изменённые размеры и количества. У всех 12 Excel-значения AA11:AA18 числовые. Это проверяет работоспособность Excel-сценариев, но не заменяет сравнение с движком.

## Проверки

Последний полный прогон после изменений:

| Проверка | Результат |
|---|---|
| `pnpm test:jv` | 199 passed, 0 failed |
| `pnpm typecheck:shared` | passed |
| `pnpm build:frontend` | passed; присутствуют стандартные предупреждения Vite/CJS, Browserslist и размера чанка |
| `pnpm validate:jv-fixtures` | 43 JSON fixtures validated |
| `pnpm smoke:jv-line-lab` | passed |
| Resolver tests | 5 passed |
| Line Order parity | 12 сценариев; 77 EXACT, 41 DISPLAY_MATCH, 34 NUMERICALLY_EQUIVALENT, 0 MISMATCH, 0 UNVERIFIED |
| Zigzag geometry parity | 12 сценариев / 696 сравнений; 528 EXACT, 168 UNVERIFIED (ранее известные guard-error ветви), 0 MISMATCH |
| Zigzag order parity | 1,948 сравнений; 1,034 EXACT, 902 DISPLAY_MATCH, 12 UNVERIFIED (активная guard-error ветвь), 0 MISMATCH |
| Zigzag pricing parity | 300 сравнений; 130 EXACT, 170 DISPLAY_MATCH, 0 MISMATCH |
| Slider-L3 commercial parity | 8 сценариев; 307 EXACT, 141 DISPLAY_MATCH, 128 UNVERIFIED, 0 MISMATCH |
| Slider-L5 parity | 8 сценариев; 252 EXACT, 10 DISPLAY_MATCH, 112 UNVERIFIED, 0 MISMATCH |
| Slider-X3 parity | 10 сценариев; 342 EXACT, 18 DISPLAY_MATCH, 130 UNVERIFIED, 0 MISMATCH |
| Slider-X5 parity | 10 сценариев; 410 EXACT, 10 DISPLAY_MATCH, 130 UNVERIFIED, 0 MISMATCH |
| Slider-L5 commercial parity | 8 сценариев; 306 EXACT, 142 DISPLAY_MATCH, 128 UNVERIFIED, 0 MISMATCH |
| Slider-X3 commercial parity | 10 сценариев; 520 EXACT, 320 DISPLAY_MATCH, 160 UNVERIFIED, 0 MISMATCH |
| Slider-X5 commercial parity | 10 сценариев; 852 EXACT, 327 DISPLAY_MATCH, 1 NUMERICALLY_EQUIVALENT, 160 UNVERIFIED, 0 MISMATCH |
| Front geometry/BOM parity | 24 сценария / 3,120 сравнений; 3,022 EXACT, 98 DISPLAY_MATCH, 0 MISMATCH |
| Front material parity | 8 сценариев / 408 сравнений; 278 EXACT, 130 DISPLAY_MATCH, 0 MISMATCH |
| Front commercial parity | 56 сравнений; 8 EXACT, 48 DISPLAY_MATCH, 0 MISMATCH |
| Line+Zigzag mixed parity | 10 сценариев; 746 EXACT, 418 DISPLAY_MATCH, 374 NUMERICALLY_EQUIVALENT, 0 MISMATCH |
| Unified Line-only parity | 12 сценариев; 3 NUMERICALLY_EQUIVALENT и 9 DISPLAY_MATCH по итогу; 0 MISMATCH |
| All-seven engine parity | **не подтверждена**; 84 сравнения AA11:AA17 и 12 AA18 со статусом UNVERIFIED |

Все перечисленные parity-классификации сохраняют исходные ограничения: DISPLAY_MATCH — совпадение отображения, а не внутреннего числа; `NUMERICALLY_EQUIVALENT` использует точное сравнение с бинарным Excel Value2 без произвольного epsilon.

## Известные исключения и ограничения

- `F1!R13`: три ранее зарегистрированных MISMATCH неактивной розничной ветви Front.
- `S1!R10`: ранее зарегистрированное денежное расхождение отображения.
- Zigzag: 12 UNVERIFIED сравнений активной guard-error ветви.
- `ПРМ!R25`: исходная Excel-формула с `#REF!`; не нормализована.
- Семейные parity-сценарии Slider содержат прежние UNVERIFIED количества; новые изменения их не скрывают.
- Main all-seven формула и 12 свежих Excel-сценариев проверены, но коммерческий `COMPLETE` пока означает, что текущие движковые зависимости закрыты; он не является доказательством Excel parity. До подбора одинаковых первичных входов нельзя принимать all-seven цену как подтверждённую.

## Изменения и совместимость

Обновлены типизированный `UnifiedOrderContext`, передача shared O5/O18 и area allocation в Line/Zigzag/Slider/Front, адресация слота Front, Main price trace и интеграционные тесты. Legacy `/calculate`, Prisma schema, база данных и интерфейсный поток пользователя не менялись. Оригинальные XLSM открывались только для чтения через временные копии; изменения в Excel, архивы и секреты в PR не включаются.

## Следующий шаг

Сформировать сериализуемый provenance-backed fixture: исходные Main значения плюс фактические входные ячейки всех семи семейных листов; затем теми же входами вычислить движок, сравнить активные выходы семейств, AA11:AA17 и AA18 отдельно в COMPLETATION и RETAIL, исправить первую подтверждённую расходящуюся зависимость и повторить регрессию. Этот следующий шаг был завершён PR_13E для 12 manifest-сценариев; см. ниже.

## PR_13E follow-up (2026-11-08)

`fixtures/unified-order-all-seven-inputs.json` — общий входной manifest; `fixtures/unified-order-all-seven-excel-pr13e.json` — свежий COM capture временных копий; `UNIFIED_ORDER_ALL_SEVEN_PARITY.json` — обновлённый ledger. Все 12 входных наборов совместимы. Из 96 AA11:AA18 сравнений 1 EXACT, 38 NUMERICALLY_EQUIVALENT, 45 DISPLAY_MATCH, 0 MISMATCH, 0 UNVERIFIED; AA18 отдельно: 3 numeric-equivalent и 9 display-only совпадений. Эти результаты заменяют статус PR_13D UNVERIFIED только для 12 manifest cases, не для всех возможных размеров и настроек. Подробности: `PR_13E_RESULT.md`.
