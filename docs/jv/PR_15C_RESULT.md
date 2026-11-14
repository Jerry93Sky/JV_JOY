# PR_15C result — in progress

Implemented semantic light/dark/system theme preference with pre-render initialization, OS change tracking in system mode, local persistence, a Settings selector and semantic sidebar/navigation surfaces. No DB/API or calculation changes.

Frontend production build passed; output JS 830.49 kB (220.24 kB gzip), CSS 31.90 kB (6.87 kB gzip). Existing PR_15B.1 Chrome test passed before the visual changes. Theme-specific browser cases, visual screenshots, full three-zone editor, command palette, undo/redo, broad all-page token conversion, mobile/tablet screenshots and controlled before/after performance capture remain incomplete. Existing general E2E was not rerun after this edit yet. Do not treat PR_15C as fully complete.

Prior PR_15B.1 benchmark is recorded in JV_RESULT_PERFORMANCE_R2.md; it is not a before/after measurement of this design work. This UI change has not established a performance improvement.

## PR_15C.2a — рабочая область JV

Добавлены список с выбором активной конструкции, форма одной позиции и панель расчёта. Мобильные вкладки показывают список, параметры или результат; на средних экранах список и форма стоят рядом, на широких добавляется третья колонка. Подробности BOM и трассировка располагаются ниже на широкой области. Перестановка меняет визуальный порядок, сохраняет Excel-слоты и инвалидирует результат. После редактирования, добавления и удаления результат также сбрасывается.

Проверены Chrome E2E (1440, 1024, 390 px, отсутствие переполнения, выбор, сохранение ввода, копирование, удаление, перестановка, семь семейств, Front, оба профиля, COMPLETE/PARTIAL и lazy trace), HTTP integration, frontend/backend builds, shared typecheck, 205 JV тестов, 14 API тестов, 53 fixtures и smoke. Ctrl+K, Undo/Redo, полная визуальная приёмка тем и измерения производительности остаются отдельными задачами; PR_15C остаётся Draft.
