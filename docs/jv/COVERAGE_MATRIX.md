# Матрица Excel → BMS

Статус `exact` не присваивается без пересчитанного контрольного входа с совпадающими BOM и деньгами. Текущие статусы описывают наличие похожего механизма/данных, не parity. Excel: 43 листа на книгу; 12 081 формула в комплектации и 12 082 в рознице. Полные формулы — `ВСЕ_ФОРМУЛЫ_РАЗВЕРНУТЫЕ.csv`.

| Область | Комплектация | Розница | BMS evidence | Статус | Что нужно доказать |
|---|---|---|---|---|---|
| Line L1–L7 геометрия/параметры | листы L1–L7 | L1–L7 | GlazingSystem/SystemParameter, systems calculate | partial | каждый input, предел, формула и контрольный BOM |
| Zigzag Z1–Z7 | Z1–Z7 | Z1–Z7 | система и параметры из systems-export | partial | ветвевые условия, допуски, разные стороны |
| Slider L3/L5/X3/X5 | S1–S7, прайсы Slider | то же с отдельными ценами | JV-Slider и SystemComponent | partial | раздельные 4 варианта, соответствие слотов 1..7 |
| Front F1–F7 | F1–F7, Прайс-Front | аналогично | JV-Front и параметры/компоненты | partial | двери, профили, ошибки сочетаний, BOM |
| Цена профиля/материала | Прайс-Line/Slider/Front | отдельные коэффициенты/цены | Product retail/wholesale | partial | таблица соответствия SKU, единиц и snapshot price |
| JV-Line D23/O15/I26 parking | L1!D23,O15,I26; ПД!D5:BA54,D61:BA110 | Формулы и обе матрицы побайтно одинаковы в исходных книгах | Реализовано в `packages/shared/src/jv/geometry/line.ts`, данные в `geometry/pd-catalog.ts` | Пересчитанные golden сценарии совпали 10/10 по двум книгам; общая parity не заявляется | сопоставить C23/C24/D6 со входами BMS и проверить дополнительные границы |
| JV-Line I25/I27 opening geometry | L1!I25,I27; Настройки!P4,P14,P15 | Формулы одинаковы в исходных книгах | `calculateLineOpeningLeafWidth`; exact decimal `ROUNDDOWN(...,0)` | golden geometry совпала на 10/10 runs | подтвердить подпись/источник unit Главная!C11 и входы формы BMS |
| JV-Line carrier cuts/material quantity | L1!C28:D32,O5; Настройки!P2/P6/P7,D7; Прайс-Line!B5:D5 | Формулы/ссылка на SKU сверены в обеих книгах | `packages/shared/src/jv/geometry/cutting.ts`; output LN-010, п.м без цены | Геометрия/раскрой совпали 10/10; O5 совпал точно 6/10, в 4 прогонах engine decimal больше Excel COM на 8.88e-16; см. `LINE_MATERIAL_PARITY.json` | исследовать Excel double semantics при утверждении требуемой parity политики |
| JV-Line material BOM | L1!L5:O44; Прайс-Line!B5:D45 (с пропуском B26) | 40 каталожных ссылок, значения формул O5:O44 захвачены на 10 пересчётах | `packages/shared/src/jv/bom-line.ts`; versioned catalog `catalog-line.ts` | Частично: 14 реализованных строк (LN-010 + 11 direct count/switch formulas + LN-210/LN-220 literal zero); 26 неподдержанных; 13 non-LN010 quantities exact 10/10, LN010 exact 6/10 | перенести и проверить ветви остальных 26 строк, ПД/зависимости и полную спецификацию |
| Стекло | Прайс-Стекло, системные входы | цены могут отличаться | GlassType/SystemGlass и endpoint glasses | partial | связь типов, override, обработки, площадь/цена |
| Покраска | настройки/прайсы | профиль розницы | Product paintingPricePerMeter/Deal extras | partial | длины окраски, режим и округление |
| Сборка/монтаж | Прайс-сб+монт, Настройки | свой профиль | DealService, install formulas | partial | включение, ставки, база расчёта |
| Аксессуары/доставка | Прайс-Аксессуары, ПРМ | отдельные значения | Deal extras / inventory | partial | правила количеств, доставки и единиц |
| CC / Клей+акт / discount | отдельные листы | отдельные листы | dealExtras, finance, discounts | partial | однозначный путь totals и отсутствие двойного начисления |
| Значения живых прайсов | книги содержат snapshot на 08.10.2026 | отдельный snapshot | отсутствуют актуальные DB snapshots | requires_live_data | read-only обезличенный export Product/Setting/GlassType |
| Ошибки Excel / кэш | формулы и сохранённые caches | то же | BMS возвращает значения/локальные fallback | absent | ошибки должны быть отдельным типизированным статусом |

«Partial» означает структурное сходство в BMS. Это не подтверждение расчёта по Excel. Семь вкладок/строк — раскладка книги; вход новой системы обязан принимать любое число независимых позиций.
