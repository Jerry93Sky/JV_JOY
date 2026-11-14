# UI performance PR_15C

Current before/after interaction benchmark has not yet been run. The frontend build after theme token changes: JS 830.49 kB (220.24 kB gzip), CSS 31.90 kB (6.87 kB gzip). Vite still reports a chunk larger than 500 kB. Existing PR_15B.1 result-view memory measurement is unrelated and must not be presented as a PR_15C comparison.

Next measurement: use same Chrome version, device viewport, seven positions, result and trace search; capture performance trace, JS heap before/after forced GC where available, DOM node count, theme switching, cold/warm navigation and tab visibility. Compare branch base and this branch under identical settings. No worker or calculation changes.

## PR_15C.2c

Производственная сборка текущей ветки: JS 836.44 kB (222.53 kB gzip), CSS 32.34 kB (6.95 kB gzip); предупреждение Vite о чанке более 500 kB сохраняется. Последний однократный Chrome E2E для all-seven: heap до 18,59 MB, после 35,01 MB, DOM 3277; сценарий не контролирует GC и не является сравнением скорости. Сопоставимый прогон базовой ветки и замеры first paint/long tasks/времени действий не выполнены. Разделение по маршрутам не внедрено без измерения его влияния.
