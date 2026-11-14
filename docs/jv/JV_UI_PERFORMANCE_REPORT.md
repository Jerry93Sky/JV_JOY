# UI performance PR_15C

Current before/after interaction benchmark has not yet been run. The frontend build after theme token changes: JS 830.49 kB (220.24 kB gzip), CSS 31.90 kB (6.87 kB gzip). Vite still reports a chunk larger than 500 kB. Existing PR_15B.1 result-view memory measurement is unrelated and must not be presented as a PR_15C comparison.

Next measurement: use same Chrome version, device viewport, seven positions, result and trace search; capture performance trace, JS heap before/after forced GC where available, DOM node count, theme switching, cold/warm navigation and tab visibility. Compare branch base and this branch under identical settings. No worker or calculation changes.

## PR_15C.2c

Производственная сборка текущей ветки: JS 836.44 kB (222.53 kB gzip), CSS 32.34 kB (6.95 kB gzip); предупреждение Vite о чанке более 500 kB сохраняется. Последний однократный Chrome E2E для all-seven: heap до 18,59 MB, после 35,01 MB, DOM 3277; сценарий не контролирует GC и не является сравнением скорости. Сопоставимый прогон базовой ветки и замеры first paint/long tasks/времени действий не выполнены. Разделение по маршрутам не внедрено без измерения его влияния.

## PR_15C.2d — частичное сравнение login

Два независимых worktree: base commit 3dac4b5 (ветка PR_15B), current 8fd4eda + изменения только тестов. `pnpm install --frozen-lockfile` отдельно и `pnpm build:frontend` в каждом. Chrome 157.0.8103.78, Node 24.13.0, Windows x64, Ryzen 5 7500F, headless 1440×900; loopback HTTP без компрессии и backend, новый context на каждый запуск, один прогрев и пять измерений. Повтор: из apps/frontend выполнить `node scripts/benchmark-jv-login.mjs <base-dist> <current-dist>`. Сырые данные: JV_UI_LOGIN_BENCHMARK.json.

| Login, 5 измерений | PR_15B медиана (диапазон) | PR_15C медиана (диапазон) |
|---|---:|---:|
| FCP, мс | 56 (52–60) | 56 (52–56) |
| DOMContentLoaded, мс | 31.1 (30–33) | 30.4 (28.5–31.5) |
| networkidle + доступность поля, мс | 550 (544–552) | 552 (549–555) |
| JS heap, байт | 4 206 410 | 4 237 617 |
| DOM nodes | 28 | 29 |
| Запросы | 3 | 3 |
| Long tasks | 0/5 | 0/5 |
| JS сборка, kB | 829.47 | 836.44 |
| CSS сборка, kB | 31.92 | 32.34 |

`networkidle` включает обязательное ожидание Playwright около 500 мс; это не время интерактивности. Выполнялись только холодные контексты login, не JV, не warm navigation и не production SLO. Разница не доказывает ускорение. Исходный App.tsx статически импортирует маршруты, каждый login загружает один основной JS и один CSS; Vite продолжает предупреждать о JS >500 kB. Маршрутное разделение не внедрено: его эффект не измерен.
