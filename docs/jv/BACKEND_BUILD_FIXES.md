# Backend build diagnostics and repairs — PR_14B

## Captured baseline

The untouched PR_14A tree produced **275 TypeScript diagnostics** from `pnpm --filter backend build`. The complete captured output is [PR_14B_BASELINE_BACKEND_BUILD.log](./build-logs/PR_14B_BASELINE_BACKEND_BUILD.log). Prisma Client generation from the committed schema completed successfully without connecting to a database and reproduced the same incompatibilities.

| Diagnostic | Count | Source / cause | Action |
|---|---:|---|---|
| TS5097 | 236 | Backend `paths` pointed `@bms/shared` at `.ts` source files containing explicit relative `.ts` specifiers; the CommonJS backend compiler could not emit this source package. | Built `@bms/shared` as a separate workspace package with JS/declaration outputs and TypeScript 5.7 import rewriting; removed the backend source alias and made builds run shared first. All 236 cleared. |
| TS2322 | 8 | Nullable JSON input, Deal update DTO, finance stage literals. | Used explicit Prisma JSON null/value mapping, typed update DTO fields, and post-migration stage enums. All cleared. |
| TS2345 | 8 | Prisma-generated Role enum passed to auth middleware typed with the distinct shared Role enum. | Middleware accepts the union of the generated Prisma and shared role enums; runtime role check is unchanged. All cleared. |
| TS2339 | 9 | Finance relation result inference collapsed after invalid stage filters; missing old DealStage members. | Valid stage filters restore the include result type; old members remain only in the deal transition routes. All finance errors cleared; two deal enum-member errors remain. |
| TS7006 | 8 | Finance callbacks became implicit `any` after invalid Prisma query overload selection. | Corrected the filter to current generated enum values; all cleared. |
| TS2367 | 4 | Comparisons between current Prisma `DealStage` and removed `CALCULATION` / `PROPOSAL`. | Left visible; mapping these stages to current states changes the business state machine. |
| TS2698 | 2 | Object spreads over `never` in SystemParameter/SystemGlass update DTOs. | Constructed explicit `Prisma.*UncheckedUpdateInput` objects while preserving null/undefined behavior. All cleared. |

Counts sum to 275. The final captured output is [PR_14B_FINAL_BACKEND_BUILD.log](./build-logs/PR_14B_FINAL_BACKEND_BUILD.log): **six diagnostics remain**, all in the proposal/invoice stage flow.

## Specific source fixes

- `packages/shared/package.json`, `packages/shared/tsconfig.build.json`: proper JS and declaration entrypoints for the shared package. `packages/shared/dist` is ignored build output.
- `apps/backend/package.json`, `apps/backend/tsconfig.json`, root `package.json`: shared-first backend build/dev/test order; backend resolves published package declarations instead of compiling shared sources into its CommonJS output.
- `apps/backend/src/lib/auth.ts`: allows both existing generated Prisma and shared role enums; no role names or authorization behavior changed.
- `apps/backend/src/lib/prismaJson.ts`, `apps/backend/src/prisma/add-glass-params.ts`, `apps/backend/src/routes/systems.ts`: explicit JSON input validation and SQL-null sentinel; update DTOs use generated Prisma types. Null clears optional relations and undefined/empty IDs remain omitted. Static glass options retain their prior serialized-string shape.
- `apps/backend/src/routes/deals.ts`: request `deliveryType` and update data use generated Prisma types; no transition code was rewritten.
- `apps/backend/src/routes/finance.ts`: stage values now belong to the generated enum. The mapping follows migration `20260507000000_patch14_refactor_stages_vendors/migration.sql`: waiting-for-payment is now `INVOICE_SENT`. Existing `paymentStatus` and `isLead` filters remain intact.

The stage migration also collapses non-lead `CALCULATION`/`PROPOSAL` into `ASSEMBLY`. The finance summary still requires a non-null `paymentStatus`, but the analytics query has no payment-status guard; those migrated rows cannot be distinguished from later assembly-stage rows. The finance code now compiles against persisted stages, but this historical analytics classification needs a separate data/business review before claiming identical pre/post-migration revenue semantics. No stored finance values or money formula changed here.

## Unresolved deal lifecycle mismatch

The old route uses these values:

- `/:id/proposal`: allows `CALCULATION` and `PROPOSAL`, then writes `PROPOSAL`.
- `/:id/invoice`: allows `PROPOSAL` and `AWAITING_PAYMENT`, reserves inventory from the proposal state, then writes `AWAITING_PAYMENT`.

The current Prisma enum has none of these values. Migration `20260507000000_patch14_refactor_stages_vendors` converts old non-lead `CALCULATION` and `PROPOSAL` rows to `ASSEMBLY`, and old non-lead `AWAITING_PAYMENT` rows to `INVOICE_SENT`. Because the migration collapses calculation/proposal into a stage also used later in production, there is no lossless transition mapping for the legacy route. Neither restoring stages in the schema nor inventing a new mapping is safe in a build-only PR. This requires a deliberate deal lifecycle/API decision and, if the old states are to persist, a separately planned schema migration.

## PR_14C resolution

The former status above records the PR_14B baseline. PR_14C resolved its six diagnostics through current typed transition decisions in `apps/backend/src/domain/deals/stageWorkflow.ts`: proposal versions remain in `CommercialProposal`, first invoice maps to `INVOICE_SENT`, repeated invoice skips stock reservation, and payment uses current `paymentStatus`/stages. The build now exits 0. No enum or database migration was added. The non-lead `ASSEMBLY` ambiguity remains a product/data question and is documented with source evidence in [DEAL_STAGE_MIGRATION_MAPPING.md](./DEAL_STAGE_MIGRATION_MAPPING.md).
