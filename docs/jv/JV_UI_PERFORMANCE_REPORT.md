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

## Сопоставимый JV-сценарий после исправления Login

Две независимые production-сборки PR_15B (`3dac4b5`) и PR_15C (`82b041d` + исправление Login); зависимости отдельно установлены по lockfile. Один и тот же локальный тестовый Fastify, случайный тестовый JWT, без производственной БД; Chrome 157.0.8103.78, Node 24.13.0, Windows, Ryzen 5 7500F, headless 1440×900, loopback без компрессии/троттлинга. Один прогрев и три измерения на ветку, новые browser contexts; задержки включают Playwright и планирование ОС. Код: `apps/frontend/scripts/benchmark-jv-workspace.mjs`; сырые данные и диапазоны — `JV_UI_WORKSPACE_BENCHMARK.json`. Запуск из apps/frontend: `node scripts/benchmark-jv-workspace.mjs <base-dist> <current-dist>`.

| Сценарий, медиана | PR_15B, мс | PR_15C, мс |
|---|---:|---:|
| Открытие JV до готовности | 81.5 | 85.8 |
| Добавление 7 позиций | 207.1 | 168.4 |
| Расчёт COMPLETE | 84.8 | 69.8 |
| Открытие BOM | 67.8 | 54.7 |
| Открытие trace | 363.5 | 357.0 |
| Поиск trace | 276.1 | 275.3 |
| Смена профиля | 36.6 | 25.2 |
| Изменение ширины | 6.3 | 5.2 |

Три прогона недостаточны для надёжного вывода о скорости, особенно при различиях разметки: PR_15B показывает семь форм одновременно, PR_15C — активную. Метрики включают автоматизацию; search/open trace включают debounce 250 мс. В конце сценария 8 запросов на каждую ветку, ошибок браузера не записано; long tasks не наблюдались в этих трёх прогонах. Повторные рендеры, warm navigation и полный профиль пользователей не измерены. Разделение маршрутов не внедрено: подтверждённый выигрыш от него отсутствует.

Повтор login после исправления: FCP медиана 56/56 мс, DOMContentLoaded 32.5/31.4 мс; свежие данные `JV_UI_LOGIN_BENCHMARK.json` заменяют значения предыдущего login-прогона. Сборки JS 829.47/836.45 kB, CSS 31.92/32.30 kB. Bootstrap DOM ещё не доказывает отсутствие FOUC на первом кадре.

PR_15C.2f не повторял benchmark по заданию. После CSS-правок сборка: JS 837.29 kB (222.70 kB gzip), CSS 34.37 kB (7.21 kB gzip). Предыдущие сравнения произведены до этих косметических правок и не доказывают скорость новой сборки.
