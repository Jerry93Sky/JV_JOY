# PR_15 — work in progress

The branch `feature/jv-full-ui` starts at `727f67ce2282e0ce658a722659e4ed7493ebc473`. PR_15 is **not complete**.

PR_15A now has a real protected order editor and server calculation for seven families. A real Chrome browser E2E has passed locally; some selector choices remain restricted. See [PR_15A_RESULT.md](./PR_15A_RESULT.md) for scope and checks; PR_15 is not complete.

`apps/frontend/src/api/jv.ts` adds a typed client for the existing `/api/jv/orders/calculate-preview` endpoint, uses the existing authenticated Axios client, derives the seven position variants from the shared engine types, excludes the price snapshots supplied by the server, and supports request cancellation. The existing endpoint allows `OWNER` and `ADMIN`, and accepts at most seven positions.

`pnpm build:frontend` passed after this change. This build alone does not validate request compatibility or establish a working user interface.

The original WIP note above records the earlier client-only state. Full selector coverage, detailed BOM/trace views, persistent orders, and final PR_15 documentation remain outstanding. Browser coverage and its limitations are recorded in [JV_UI_BROWSER_E2E_REPORT.md](./JV_UI_BROWSER_E2E_REPORT.md).

R1 adds independent Excel comparisons and corrects a Front closer price index. A different formula in Front slot 7 blocks F28=2 until B26 is represented independently; the editor remains PARTIAL. See [PR_15A_PARITY_RESULT.md](./PR_15A_PARITY_RESULT.md).
