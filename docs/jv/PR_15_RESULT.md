# PR_15 — work in progress

The branch `feature/jv-full-ui` starts at `727f67ce2282e0ce658a722659e4ed7493ebc473`. PR_15 is **not complete**.

`apps/frontend/src/api/jv.ts` adds a typed client for the existing `/api/jv/orders/calculate-preview` endpoint, uses the existing authenticated Axios client, derives the seven position variants from the shared engine types, excludes the price snapshots supplied by the server, and supports request cancellation. The existing endpoint allows `OWNER` and `ADMIN`, and accepts at most seven positions.

`pnpm build:frontend` passed after this change. This build alone does not validate request compatibility or establish a working user interface.

Still to implement and verify: navigation and guarded route, seven complete input forms, multi-position editor, validation and request handling, stale response protection, COMPLETE/PARTIAL result rendering, BOM and trace views, 12 golden cases through the UI or client layer, UI and API-integrated tests, remaining requested regression, and the user/architecture/test documentation. The new client is not yet connected to a page. No PR_15 completion or end-to-end behavior is claimed.
