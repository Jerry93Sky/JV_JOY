# PR_03 — техническое задание

1. Устранить backend TypeScript workspace/rootDir ошибку минимальной настройкой project references или declaration boundary, сохранить фактические runtime paths и поведение legacy API.
2. Добавить единый policy для запуска typecheck frontend/backend/shared; существующий backend baseline диагностировать отдельно.
3. Добавить dimensional quantity guard (совместимость units без автоматической конверсии) и закрепить currency/type invariants.
4. Уточнить registry interface для rules: immutable ID/version, dependency declarations, confirmed/unconfirmed flag; исключить user-supplied source strings.
5. Добавить tests для duplicate IDs, missing dependencies, cycle path diagnostics, failed rule error propagation, independent branches and stable trace ordering.
6. Подготовить fixture cases с `pending_excel_oracle`; не публиковать числовые бизнес-ожидания до fresh Excel recalculation.
7. Не переносить формулы семейств, не менять production `/calculate`, Prisma schema, live prices или существующие deals.
8. Acceptance: shared and frontend typecheck pass; backend diagnostics attributable/documented; all engine infra tests pass; frontend build unchanged; legacy routes diff empty.
