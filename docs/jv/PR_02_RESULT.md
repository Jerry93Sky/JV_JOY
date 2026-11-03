# PR_02 — результат

Перенесена BMS GlasS-light в монорепозиторий (`apps/backend`, `apps/frontend`, `packages/shared`, pnpm workspace). Исключены secrets/env, uploads, generated dependencies/builds и systems export. Существующие JV контракты сохранены и расширены exact decimal BigInt operations, typed engine errors, dependency graph с unknown/cycle checks, deterministic topological execution и provenance trace. Никакие Excel формулы не реализованы.

## Проверки
- `pnpm install --frozen-lockfile` успешно.
- `pnpm --filter backend db:generate` успешно, без подключения к БД.
- `pnpm --filter @bms/shared test:jv`: 6 passed.
- `pnpm --filter frontend exec tsc -p ../../packages/shared/tsconfig.jv.json`: успешно.
- `pnpm --filter frontend build`: успешно; имеются Vite CJS, Browserslist и chunk size warnings.
- `pnpm --filter backend build`: блокирован текущим `rootDir: ./src` при alias на shared package; вывод также содержит legacy TS ошибки. Prisma Client сгенерирован, миграции не запускались.
- Lint script отсутствует в исходном package manifests.

Legacy calculation, `/calculate`, Prisma schema, database, React code and existing API behavior were not modified. Проверка parity не проводилась. Decimal operations exact-only: non-terminating division throws; округление не навязывается. `Unit` пока контрактное поле без конверсии.

Следующий этап PR_03: изолированно исправить workspace typing/build с сохранением runtime layout; затем специфицировать и тестировать Excel-compatible primitive semantics только при наличии свежих oracle fixtures для конкретной ветки. Не переключать endpoint и не внедрять семейные формулы.
