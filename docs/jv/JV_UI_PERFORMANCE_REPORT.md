# UI performance PR_15C

Current before/after interaction benchmark has not yet been run. The frontend build after theme token changes: JS 830.49 kB (220.24 kB gzip), CSS 31.90 kB (6.87 kB gzip). Vite still reports a chunk larger than 500 kB. Existing PR_15B.1 result-view memory measurement is unrelated and must not be presented as a PR_15C comparison.

Next measurement: use same Chrome version, device viewport, seven positions, result and trace search; capture performance trace, JS heap before/after forced GC where available, DOM node count, theme switching, cold/warm navigation and tab visibility. Compare branch base and this branch under identical settings. No worker or calculation changes.
