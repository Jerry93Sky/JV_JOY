# PR_03 result — implementation status

## Delivered
- Restored all requested PR_03 documents; verified each exists and is non-empty.
- Added machine-readable `LINE_GEOMETRY_RULES.json` and focused mapping for the sourced L1 parking/cut formulas.
- Implemented one source-exact independent rule: `L1!I27 = I25 - 2*D22`, through the existing dependency graph and BigInt decimal operations. It checks matching caller-supplied units, returns source-linked trace, and explicitly marks `EXCEL_PARITY_UNVERIFIED`.
- Added 2 tests for this rule (exact decimal result/trace and unit/number errors). Overall infrastructure tests: 8 passed.

## Build and compatibility
- Shared JV typecheck: pass.
- `pnpm --filter @bms/shared test:jv`: 8 pass, 0 fail.
- `pnpm --filter frontend build`: pass (existing Vite/Browserslist/chunk warnings).
- `pnpm --filter backend db:generate`: pass; no DB connection or migration.
- `pnpm --filter backend build`: fail on legacy Prisma/TypeScript mismatches: nullable Json, Deal update DTO relation types, DealStage enum mismatch, inferred include/spread types, OWNER role mismatch. The underlying routes/schema are from GlasS snapshot; original tsconfig also used rootDir `src` plus source path alias, so TS6059 was a transfer-independent config defect. RootDir was fixed without changing domain rules; remaining build failures predate JV geometry. No business status/JSON/API fixes were applied.
- Diff of legacy `/calculate`, `formulaEngine.ts`, and Prisma schema is empty.

## Scope limits
Only I27 is implemented. The broader L1 parking chain is not a complete geometry calculator. Excel gives no explicit unit labels on these dimensions; function accepts same explicit caller unit instead of assuming mm. I25 and I26 remain partial/blocked: I26 uses unresolved O15; settings and full upstream inputs require mapping. There are no fresh Excel golden results, so no parity is claimed. Zigzag/Slider/Front and the rest of Line remain unimplemented.

No production API integration, legacy calculation edits, database changes or Excel formula approximations were made.
