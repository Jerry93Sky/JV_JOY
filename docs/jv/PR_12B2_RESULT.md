# PR_12B2 — коммерческие компоненты JV-Front

База: PR_12B1, fef0ce9e46a321f8170d2bad14f2eb55e74cf265. Ветка feature/jv-front. Реализованы вычисляемые компоненты Front; полный коммерческий итог F1!S38 и передача в Главная!S11 относятся к PR_12B3.

## Исполняемый результат

- packages/shared/src/jv/front/glass-pricing.ts: calculateFrontGlassCosts, стекло F1!G28:G31, H28:H32, D35, S35; площади и суммы всех четырёх деталей, раздельные цены COMPLETATION/RETAIL, PARTIAL при отсутствующей активной цене либо Y5. Неподтверждённый отдельный режим «без стекла» также остаётся PARTIAL.
- packages/shared/src/jv/front/works-pricing.ts: calculateFrontWorks, сборка U5:U20, покраска W5:W24/S34, монтаж S37 и условная работа C25×Y5. Сборочный U20 не начисляется повторно к S36: исходная формула этого не делает.
- packages/shared/src/jv/front/consumables-pricing.ts: calculateFrontConsumables, доказанный нулевой вклад позиции Front в Клей+акт!L5/L18 и N5/N18 при селекторе 7; результат имеет область FRONT_POSITION_ONLY, а общие упаковки заказа не начисляются.
- packages/shared/src/jv/front/commercial-context.ts: calculateFrontY5, точная доля ПРМ!AB25 по исходным размерам и количествам всех семи строк Главная!11:17. Неполный контекст отклоняется.
- packages/shared/src/jv/front/commercial-components.ts: calculateFrontCommercialComponents соединяет S33, S34, S35 и условную C25×Y5 в F1!S36. Возвращает диагностику и трассу; S37 остаётся отдельным компонентом. Финальную S38 функция не публикует.
- Новые экспорты добавлены в packages/shared/src/jv/index.ts; legacy /calculate, Prisma, React и расчёты других семейств не изменялись. Все суммы считаются ExactRational без нового правила округления.

Формулы, ставки и включающие условия расписаны в FRONT_GLASS_PRICE_RULES.md, FRONT_WORKS_PRICE_RULES.md и FRONT_CONSUMABLES_RULES.md. Для каждого сравниваемого коммерческого выхода сохранён TraceStep с исходным адресом, выражением и версией ценового снимка.

## Независимая проверка Excel

tools/jv/capture-front-components.ps1 открыл временные копии двух XLSM с отключёнными макросами, задал входы и выполнил Excel 16 CalculateFullRebuild. Оригиналы не изменялись. Четыре сценария на профиль: base, wide, door_one, transom. Они включают разные размеры, типы стекла, количество Front, включённую и выключенную услугу S35, покраску, монтаж и дополнительную работу. Отдельная ветвь без стекла пока не доказана. tools/jv/capture-front-component-source-prices.py независимо извлёк литералы прайсов и SHA-256 исходных книг. tools/jv/compare-front-components.mjs пересчитал те же входы кодом JV.

Результат FRONT_COMMERCIAL_COMPONENTS_PARITY.json: **8 сценариев, 408 сравнений — 278 EXACT, 130 DISPLAY_MATCH, 0 NUMERICALLY_EQUIVALENT, 0 MISMATCH, 0 UNVERIFIED**. Включены G/H, U/W, D35, S34:S37 и Y5/AB25. Классификация DISPLAY_MATCH использует NumberFormat конкретной ячейки без произвольного epsilon. Сохранённые Value2 не служили входами движка. ПРМ!R25 записан в контрольном захвате, но исключён из матрицы реализованных выходов: это диагностическая, а не перенесённая формула.

ПРМ!R25 содержит #REF!, возвращает 0 через IFERROR и не входит в цепь AB25/Y5. В пересчитанных сценариях Y5 положителен при нулевом R25. Прямой граф R25→R32→R33→R34 не имеет обнаруженного потребителя в коммерческих формулах Front; подробности и предел доказательства — FRONT_REF_DEPENDENCY_ANALYSIS.md.

## Проверки и сохранившиеся исключения

| Проверка | Результат |
| --- | --- |
| pnpm test:jv | 181/181, включая 10 новых unit-тестов Front |
| pnpm typecheck:shared | успешно |
| pnpm build:frontend | успешно; предупреждения Vite/Browserslist не связаны с PR_12B2 |
| pnpm validate:jv-fixtures | 40 JSON fixtures |
| pnpm smoke:jv-line-lab | успешно |
| Front Geometry/BOM | 3120: 3022 EXACT, 98 DISPLAY_MATCH, 0 MISMATCH |
| Front Material Pricing | 342: 282 EXACT, 57 DISPLAY_MATCH, **3 MISMATCH** в неактивной F1!R13 розницы |
| JV-Line Price | 1600: 853 EXACT, 747 DISPLAY_MATCH, 0 MISMATCH |
| Zigzag Pricing, Mixed Order | успешно, 0 MISMATCH |
| Slider-L3/L5/X3/X5 commercial parity | скрипты завершились успешно; существующие UNVERIFIED для неохваченных ячеек сохранены |

Три расхождения F1!R13 — Excel Value2 557.3749999999999 против рационального 4459/8; количество строки нулевое, стоимость строки и S33 не меняются. Скрипт material parity закономерно возвращает код 1, и результат не переименован в успех. Отдельное исключение Slider-X5 S1!R10 сохранено: 765.6249999999999 в Excel отображается как 765.62, рациональное 765.625 как 765.63; в прежнем контрольном сценарии эта ветвь выключена и не влияет на M53. Глобальная арифметика не менялась.

## Граница PR_12B2

S36 и S37 проверены по Excel как независимые выходы. Для коммерчески полного Front в PR_12B3 требуется перенести и проверить условную F1!S38 = IF(I23="ОШИБКА!",I23,SUM(S36:S37)), её валидационную ветку I23, передачу в Главная и итог заказа. Общее распределение упаковок для смешанных систем не объявляется выполненным; нулевая норма Front не должна давать двойное начисление.
