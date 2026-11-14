# Precision Workspace design system — PR_15C

## Tokens

`src/index.css` defines light defaults and `.dark` semantic tokens: background, foreground, card/surface, primary, secondary, muted, accent, destructive, border/input and focus ring, plus success/warning. Primary uses muted teal. Components should use Tailwind semantic classes (`bg-background`, `bg-card`, `text-foreground`, `border-border`) instead of fixed theme colors. Focus-visible has a high contrast outline; disabled buttons communicate state.

## Theme behavior

Preference `bms-theme` is local to this browser: `light`, `dark` or `system`. Missing/invalid means system. A small inline bootstrap in index.html applies dark class before React mounts; initializeTheme subscribes to system media changes only while system mode is selected. Settings exposes the selector. Theme is global, so it also applies on login. No server settings or DB migration.

## Current audit findings and limits

Layout sidebar and mobile navigation now use semantic surfaces instead of their unconditional dark gradients/blur. Many existing pages still contain fixed color utility classes, translucent status badges and gradients; theme coverage is therefore partial and needs page-by-page visual review. This PR does not claim complete visual normalization.

## PR_15C.2b

Ручной выбор хранится в памяти страницы даже при отказе localStorage, системное событие не заменяет его. Неизвестное сохранённое значение означает system в раннем HTML и React. В Chrome проверены light/dark/system, reload, изменения ОС и отказ доступа к хранилищу. Полная визуальная проверка всех страниц, цветов статусов и FOUC не завершена.

## PR_15C.2c

При заблокированной загрузке модуля React Chrome проверил, что неизвестное сохранённое значение выбирает системную тёмную тему в начальном DOM. Это не измерение первого кадра и не доказывает отсутствие FOUC во всех условиях. Автоматические изображения workspace создаются в test-results/jv-ux для трёх ширин и двух тем; полная визуальная проверка страниц ещё не проведена.

## PR_15C.2d

Ранние DOM-классы до запуска React проверены автоматически для light/dark/system light/system dark, отсутствующего и некорректного значения; отдельная проверка недоступного localStorage покрывает ручной выбор. Измерение первого визуального кадра и полная приёмка Login, Leads, Deals, Clients, Warehouse, Vendors, Systems, Finance, Settings, диалогов и уведомлений не выполнены. Из предыдущего набора визуально просмотрены JV workspace 1440 light, 390 dark и PARTIAL; прочие снимки существуют, но не объявляются проверенными.
