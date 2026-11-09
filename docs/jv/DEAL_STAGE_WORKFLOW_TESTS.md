# Deal stage workflow tests — PR_14C

## Automated checks

Run `pnpm --filter backend test:deals` for the isolated service-level workflow tests in `apps/backend/test/deals/dealStageWorkflow.test.ts`.

| Case | Verification |
|---|---|
| Route authentication | Registered proposal, invoice, and payment routes return 401 without a valid token. The existing `requireAuth` policy accepts an authenticated `USER`; deal routes do not add an unrequested role gate. |
| Proposal creation and update | Creates versions 1 and 2 with deterministic URLs; leaves the `IN_PROGRESS` deal stage unchanged; disallows proposal creation from `ASSEMBLY` without creating a record. |
| First invoice | Requires at least one proposal; invokes reservation before stage update/event; advances to `INVOICE_SENT`; records `invoiceSentAt`. |
| Repeat invoice | Existing `INVOICE_SENT` is accepted; inventory reservation is skipped; existing invoice timestamp is preserved; invoice update/event callbacks still run. |
| Invoice after go-back | If the deal returns to `IN_PROGRESS` but retains the original `invoiceSentAt`, a later invoice call does not reserve stock a second time. |
| Invalid invoice | Missing proposal or a post-invoice/non-invoice stage returns a denied decision without reservation, invoice update, or event callbacks. |
| Payment | Partial payment leaves `INVOICE_SENT`; full payment advances to `PAID`; invalid payment stage is rejected. Existing route continues to persist payment status, paid amount, official-payment flag, paid timestamp, and payment/stage events. |

Result after the final code change: **6 tests passed, 0 failed**. The workflow tests exercise the same typed service functions called by the route handlers and record callback side effects. The actual Prisma database operations are not replaced by a fake database in these tests.

## Database and HTTP limits

No disposable isolated PostgreSQL database is configured for this run. Therefore the full authenticated deal mutation path was not executed against a database; production database access and migrations were not used. HTTP smoke on the built server confirmed that the deal endpoints reject unauthenticated requests. An authenticated `USER` was accepted by the unchanged `requireAuth` middleware in the Fastify test harness; the authenticated Prisma-backed mutation response remains **NOT_RUN** pending an isolated test database.

The tests do not certify transaction atomicity under concurrent invoice requests. The endpoint keeps the pre-existing sequential Prisma mutation pattern; race-safe reservation claiming would require a database-backed transaction/CAS change and a DB integration test.
