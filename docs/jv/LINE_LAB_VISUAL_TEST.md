# JV-Line Lab — UI smoke test

## Runtime diagnosis

The page is routed in `apps/frontend/src/App.tsx` at `/jv-line-lab` under `PrivateRoute`; an unauthenticated browser must be redirected to `/login`. The route is not a public test bypass and the production auth guard remains unchanged.

The page originally imported the entire `@bms/shared` entrypoint. Vite's alias resolved it to `packages/shared/src/index.ts`, which re-exported legacy CommonJS `.js` files from `packages/shared/src/types/`. An isolated Vite SSR evaluation of the JV-Line page reproduced `ReferenceError: exports is not defined` while evaluating `types/deal.js`; the component could not mount from that import graph.

The import now uses the package's dedicated `@bms/shared/jv` export, and `apps/frontend/vite.config.ts` maps that subpath to `packages/shared/src/jv/index.ts`. The same Vite SSR evaluation now succeeds and renders 15,649 HTML characters, including the Lab title, form, calculation button, and initial empty state. This is the automated `pnpm smoke:jv-line-lab` check.

The Lab's leaf-count input is now explicitly labelled as the raw `Главная!L11` selector and is passed as `mainLeavesSelector`; the existing engine applies the sourced `Главная!M11 = CEILING(L11,1)` before geometry and BOM. This closes a form-to-source mismatch without introducing a new rounding rule.

## Browser result

| Check | Result |
|---|---|
| Vite dev server | Started; initial command accidentally bound only to `::1`; corrected invocation `pnpm --filter frontend dev --host 0.0.0.0` bound the network interfaces |
| Browser page before import fix | Blank content/empty accessibility tree observed; the runtime import failure above was independently reproduced in SSR |
| Browser page after import fix | **UNVERIFIED**: the supported browser session could not be reattached (`browser.user unavailable`), and Windows Computer Use had stopped on URL detection. No claim of a successful visual run is made |
| Authenticated form interaction | **UNVERIFIED**; production auth was not disabled or bypassed |
| Input edits and profile switching | **UNVERIFIED** |
| Engine invocation, geometry, BOM, glass, paint, price, trace | Component output can be SSR-rendered; interactive browser behavior remains **UNVERIFIED** |
| Invalid data behavior | Engine unit tests cover existing rule validation; form-level browser behavior remains **UNVERIFIED** |

## Repeatable non-browser check

Run `pnpm smoke:jv-line-lab`. It creates a Vite middleware server, loads the real page module through the Vite resolver, renders it with React SSR, and checks for the page's initial visible controls. It makes no API calls and uses no DB. This catches unresolved imports and render-time errors, but it does not replace browser authentication or visual testing.

## Remaining visual test steps

Use a designated non-production authenticated test account/session once browser connectivity is available. Open `/jv-line-lab`, confirm the page after authentication, change dimensions and an option, run the calculator, switch completion/retail profiles, and inspect geometry/cutting, BOM, glass, paint, Q52–Q58, diagnostics, trace, and a sourced invalid-input case. Preserve the normal auth flow; do not access production deals or disable auth.
