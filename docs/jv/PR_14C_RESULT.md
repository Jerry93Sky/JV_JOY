# PR_14C — deal-stage compatibility and backend build

## Result

The six deal-stage TypeScript diagnostics are resolved without restoring removed Prisma enum values, weakening TypeScript, changing the Prisma schema, or adding a migration. `pnpm --filter backend build` completed with exit code **0** after Prisma Client generation and the shared-package build.

The transition flow now uses existing document/payment state: proposal versions are recorded in `CommercialProposal`; the current deal stage remains unchanged while proposals are created; the first invoice changes `IN_PROGRESS` to `INVOICE_SENT`; a repeated invoice does not reserve stock again; partial payment leaves the invoice stage and full payment moves to `PAID`.

## Legacy stage evidence and remaining ambiguity

The original handlers and refactor migration are documented in [DEAL_STAGE_MIGRATION_MAPPING.md](./DEAL_STAGE_MIGRATION_MAPPING.md). The old `AWAITING_PAYMENT` non-lead state maps to `INVOICE_SENT`; the separate lead invoice handler already writes `INVOICE_SENT` and `invoiceSentAt`. No separate proposal-status field exists: proposal history is `CommercialProposal[]`.

The migration also maps old non-lead `CALCULATION` and `PROPOSAL` rows to `ASSEMBLY`, which is a live post-payment stage. The old distinction is irrecoverable from the new stage alone. PR_14C does not guess that `ASSEMBLY` means proposal. Current proposal creation is available at `IN_PROGRESS`; historical ambiguous `ASSEMBLY` deals may need owner-guided cleanup before proposal operations. This is a documented product/data limitation, not a compile blocker.

The six original TypeScript diagnostics were four `TS2367` comparisons in `apps/backend/src/routes/deals.ts` (the two legacy comparisons in the proposal guard and the two in the invoice guard) and two `TS2339` missing enum-member accesses (`DealStage.PROPOSAL` in the proposal update and `DealStage.AWAITING_PAYMENT` in the invoice update). All six are removed through typed transition rules and route changes; no cast hides a removed value.

## Files changed

- `apps/backend/src/domain/deals/stageWorkflow.ts` — typed proposal, invoice, and payment transition decisions and side-effect orchestration.
- `apps/backend/src/routes/deals.ts` — uses those decisions, removes writes to removed stages, uses `INVOICE_SENT`, persists invoice sent time, and keeps invoice retry from reserving inventory again.
- `apps/backend/test/deals/dealStageWorkflow.test.ts` — auth and service-level workflow tests.
- `apps/backend/package.json` — adds `test:deals`.
- `docs/jv/DEAL_STAGE_MIGRATION_MAPPING.md`, `DEAL_STAGE_WORKFLOW_TESTS.md`, and this result; prior backend build/runtime reports updated.

No JV calculation code, legacy `/calculate` implementation, public route paths, Prisma schema, migrations, database, or React workflow was changed. Proposal response shape is unchanged. Invoice response remains `{ ok: true }`; the first invoice now also fills the already-existing `invoiceSentAt` field used by the 5-day display timer. An invoice retried after go-back skips reservation if that original timestamp is still present.

## Verification after the final implementation

| Check | Result |
|---|---|
| `pnpm --filter backend exec prisma generate` | PASS; generated from committed schema only; no database access. |
| `pnpm --filter @bms/shared build` | PASS |
| `pnpm --filter backend build` | PASS, exit 0 |
| `pnpm --filter backend test:deals` | PASS, 6 passed |
| `pnpm --filter backend test:jv-api` | PASS, 8 passed; all 12 PR_13E golden order cases remain exercised. |
| `pnpm test:jv` | PASS, 202 passed |
| `pnpm typecheck:shared` | PASS |
| `pnpm build:frontend` | PASS; existing Vite CJS/Browserslist/chunk-size warnings. |
| `pnpm validate:jv-fixtures` | PASS, 45 fixtures |
| `pnpm smoke:jv-line-lab` | PASS |
| `pnpm parity:jv-order` | PASS: 12 cases; 77 EXACT, 34 NUMERICALLY_EQUIVALENT, 41 DISPLAY_MATCH, no mismatches/unverified. |
| Resolver tests | PASS, 5 passed |
| All-seven parity | PASS: 12 scenarios, 96 comparisons; no mismatch/unverified; AA18: 3 NUMERICALLY_EQUIVALENT, 9 DISPLAY_MATCH. |
| Mixed Order parity | PASS: 10 scenarios; 746 EXACT, 374 NUMERICALLY_EQUIVALENT, 418 DISPLAY_MATCH; no mismatch/unverified. |
| Zigzag geometry | 12 scenarios; 528 EXACT, 168 UNVERIFIED; no mismatch. |
| Zigzag order | 1,948 comparisons; 1,034 EXACT, 902 DISPLAY_MATCH, 12 UNVERIFIED (active-glass guard branch); no mismatch. |
| Zigzag pricing | 300 comparisons; 130 EXACT, 170 DISPLAY_MATCH; no mismatch/unverified. |
| Slider-L3 geometry/BOM/commercial | 36 EXACT geometry; BOM 210 EXACT, 14 DISPLAY_MATCH, 112 NOT_APPLICABLE; commercial 307 EXACT, 141 DISPLAY_MATCH, 128 UNVERIFIED. |
| Slider-L5 geometry/BOM/commercial | 252 EXACT, 10 DISPLAY_MATCH, 112 UNVERIFIED; commercial 306 EXACT, 142 DISPLAY_MATCH, 128 UNVERIFIED. |
| Slider-X3 geometry/BOM/commercial | 342 EXACT, 18 DISPLAY_MATCH, 130 UNVERIFIED; commercial 520 EXACT, 320 DISPLAY_MATCH, 160 UNVERIFIED. |
| Slider-X5 geometry/BOM/commercial | 410 EXACT, 10 DISPLAY_MATCH, 130 UNVERIFIED; commercial 852 EXACT, 1 NUMERICALLY_EQUIVALENT, 327 DISPLAY_MATCH, 160 UNVERIFIED. |
| Front geometry/BOM and components | 3,022 EXACT, 98 DISPLAY_MATCH; components 278 EXACT, 130 DISPLAY_MATCH; no mismatch/unverified. |
| Front material prices | Existing result reproduced: 282 EXACT, 57 DISPLAY_MATCH, 3 Retail `F1!R13` mismatches. |
| Front S38 commercial | 56 comparisons; 8 EXACT, 48 DISPLAY_MATCH; no mismatch/unverified. |
| Compiled backend runtime smoke | PASS: emitted server starts; JV preview, legacy `/calculate`, and proposal/invoice/payment endpoints return 401 without credentials. Authenticated JV calculation is covered by the real registered-route API tests. |
| Authenticated deal mutation via HTTP/Prisma | NOT_RUN; no isolated disposable database was available. Service-level workflows and auth guard behavior are tested; see [DEAL_STAGE_WORKFLOW_TESTS.md](./DEAL_STAGE_WORKFLOW_TESTS.md). |

Parity warnings retained: front Retail `F1!R13`; Slider-L5/X3/X5 and Slider-L3 commercial `UNVERIFIED` cells; Zigzag active-glass guard branch; source `ПРМ!R25` `#REF!`; and the known line-cutting comparator blocker requiring its temporary Excel result JSON. These are not represented as passes.

## Database and runtime safety

The `build` and `prisma generate` commands did not connect to or mutate a database. No migration, schema edit, production `.env`, XLSM, or BMS archive is included. Runtime smoke requests were made without credentials and therefore did not enter Prisma-backed route handlers. JV API tests use the repository's registered Fastify route tree and test data; the deal workflow tests use typed service callbacks in isolation.
