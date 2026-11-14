# PR_15C result — in progress

Implemented semantic light/dark/system theme preference with pre-render initialization, OS change tracking in system mode, local persistence, a Settings selector and semantic sidebar/navigation surfaces. No DB/API or calculation changes.

Historical first theme build: output JS 830.49 kB (220.24 kB gzip), CSS 31.90 kB (6.87 kB gzip). Existing PR_15B.1 Chrome test passed before the visual changes. At that point workspace and theme-specific browser coverage were incomplete; later results appear below. Do not treat PR_15C as fully complete.

Prior PR_15B.1 benchmark is recorded in JV_RESULT_PERFORMANCE_R2.md; it is not a before/after measurement of this design work. This UI change has not established a performance improvement.

## PR_15C.2a — рабочая область JV

Добавлены список с выбором активной конструкции, форма одной позиции и панель расчёта. Мобильные вкладки показывают список, параметры или результат; на средних экранах список и форма стоят рядом, на широких добавляется третья колонка. Подробности BOM и трассировка располагаются ниже на широкой области. Перестановка меняет визуальный порядок, сохраняет Excel-слоты и инвалидирует результат. После редактирования, добавления и удаления результат также сбрасывается.

Проверены Chrome E2E (1440, 1024, 390 px, отсутствие переполнения, выбор, сохранение ввода, копирование, удаление, перестановка, семь семейств, Front, оба профиля, COMPLETE/PARTIAL и lazy trace), HTTP integration, frontend/backend builds, shared typecheck, 205 JV тестов, 14 API тестов, 53 fixtures и smoke. Полная визуальная приёмка тем и измерения производительности остаются отдельными задачами; PR_15C остаётся Draft.

## PR_15C.2b

Добавлены командная палитра и ограниченная история черновика; исправлен ручной выбор темы при недоступном localStorage и ранний bootstrap для неизвестного значения. Chrome E2E проверил роли палитры, поиск, Escape и стрелку, отмену/повтор ширины и удаления, три режима темы, сохранение после перезагрузки, системные события и недоступный localStorage. Прошли frontend/backend build, shared typecheck, 205 JV, 14 API, UI HTTP integration, browser E2E, 53 fixtures и smoke.

Эти проверки не покрывают все сочетания истории, Enter/возврат фокуса палитры, системный bootstrap до React и все страницы/диалоги визуально. Скриншоты и сравнительное профилирование не выполнены; PR остаётся Draft.

## PR_15C.2c — дополнительные проверки

Chrome E2E проверил Ctrl+K/Cmd+K, поиск, пустой результат, стрелки, Escape, возврат фокуса, Enter и переход мышью; для USER JV-команда скрыта. Поисковое поле связано с listbox и активным option; после перехода фокус переносится в main, при Escape возвращается к сохранившемуся элементу. Проверено восстановление COMPLETATION/RETAIL с ожиданием метаданных, очистка Redo, ширина и высота; полный перечень крайних случаев истории, медленного API и 50 состояний ещё не покрыт.

Chrome получил 8 снимков тестовых данных в test-results/jv-ux: workspace для 1440/1024/390 в light/dark и состояния result-complete/result-partial. Визуально просмотрены 1440 light, 390 dark и result-partial. Скриншоты отправляются в GitHub Actions artifact на 7 дней. Полный просмотр всех ключевых страниц и состояний не проведён. Проверено раннее значение DOM для некорректного значения темы при заблокированном модуле React; это не полное доказательство отсутствия FOUC.

Регрессия: backend/frontend build, shared typecheck, 205 JV, 14 API, HTTP integration, Chrome E2E, 53 fixtures и smoke прошли. Сравнимый benchmark двух веток и визуальная приёмка всех страниц не проведены; PR остаётся Draft и не рекомендуется к переводу в Ready до завершения этих проверок.
