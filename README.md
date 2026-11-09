# JV_JOY — GlasS-light и расчёты JV

> Полные отслеживаемые исходники находятся в ветке [feature/jv-full-ui](https://github.com/Jerry93Sky/JV_JOY/tree/feature/jv-full-ui). Разработка пользовательского интерфейса продолжается в [Draft PR #5](https://github.com/Jerry93Sky/JV_JOY/pull/5). Ветка `main` пока содержит публикационную документацию, **не релизный код**.

## Дорожная карта релиза

**[Открыть ROADMAP.md — этапы разработки, критерии пилота и коммерческого релиза](./ROADMAP.md).**

Документ содержит статус по состоянию на 9 ноября 2026 года, оставшиеся работы, известные риски и решения владельца продукта.

Монорепозиторий BMS GlasS-light и разрабатываемого расчётного движка JV. Приложение содержит интерфейс для работы с лидами, сделками, клиентами, складом и системами остекления. Новый JV Engine рассчитывает конструкции и многопозиционные заказы по правилам, исследованным в двух исходных Excel-книгах комплектации и розницы.

## Текущее состояние

- Существующий расчёт BMS доступен через `POST /api/systems/:id/calculate` и работает отдельно от JV Engine.
- JV Engine поддерживает Line, Zigzag, Slider L3/L5/X3/X5 и Front, включая единый расчёт заказа с несколькими семействами. Результат может быть `COMPLETE` или `PARTIAL`; при неполном расчёте итоговая цена не подтверждается.
- Backend предоставляет `POST /api/jv/orders/calculate-preview`. Маршрут доступен ролям `OWNER` и `ADMIN`, использует серверные снимки цен и не сохраняет заказ в БД.
- `/jv-line-lab` — диагностическая страница Line. Рабочий редактор семи семейств с реальным API, COMPLETE/PARTIAL и Chrome E2E реализован в [Draft PR #5](https://github.com/Jerry93Sky/JV_JOY/pull/5); PR_15A остаётся PARTIAL из-за непроверенных коммерческих конфигураций. Полная BOM/trace-визуализация и сохранение заказов ещё не завершены.
- Сопоставления Excel и движка имеют ограничения: отдельные результаты классифицированы как `DISPLAY_MATCH` или `UNVERIFIED`; известны расхождения Retail `F1!R13`. Область проверок и оставшиеся вопросы описаны в [BACKEND_BUILD_REGRESSION.md](https://github.com/Jerry93Sky/JV_JOY/blob/feature/jv-full-ui/docs/jv/BACKEND_BUILD_REGRESSION.md) и отчётах `docs/jv`.

## Структура

| Путь | Назначение |
| --- | --- |
| `apps/frontend` | React, TypeScript, Vite, маршруты и компоненты BMS |
| `apps/backend` | Fastify API, авторизация, Prisma и маршруты BMS/JV |
| `packages/shared/src/jv` | Независимое ядро JV, точная рациональная арифметика, правила, спецификация и trace |
| `apps/backend/src/domain/jv` | Адаптер API JV и серверные снимки справочников |
| `apps/backend/prisma` | Схема Prisma и история миграций PostgreSQL |
| `docs/jv` | Контракты, отчёты, карты формул, сценарии и результаты сравнений |
| `tools/jv` | Инструменты проверки источников, fixtures и Excel parity |

## Подготовка окружения

Для разработки нужны Node.js с поддержкой `--experimental-strip-types` (проверено с Node 24.13.0), pnpm (проверено с 11.25.0) и PostgreSQL. Для загрузки файлов может понадобиться MinIO. Сначала настройте отдельную локальную базу: команды миграции и seed изменяют данные указанной базы.

```powershell
pnpm install --frozen-lockfile
Copy-Item apps/backend/.env.example apps/backend/.env
```

Заполните локальный `apps/backend/.env`: `DATABASE_URL`, уникальные `JWT_SECRET` и `ADMIN_INITIAL_PASSWORD`, а также параметры MinIO, если используется файловое хранилище. Пример содержит только заглушки. Файл с реальными значениями не помещайте в Git.

Для новой локальной базы:

```powershell
pnpm --filter backend db:generate
pnpm db:migrate
pnpm db:seed
```

Seed создаёт пользователя `admin` с ролью `OWNER`, если он ещё отсутствует; пароль берётся из `ADMIN_INITIAL_PASSWORD`. Существующего пользователя seed не перезаписывает. Не направляйте эти команды на рабочую базу без отдельного плана миграции.

## Запуск и сборка

Запустите backend и frontend в отдельных терминалах из корня репозитория:

```powershell
pnpm dev:backend
pnpm dev:frontend
```

Vite по умолчанию слушает порт `5173`, backend — `3001`; прокси Vite пересылает `/api` в backend. Вход выполняется через существующую страницу авторизации BMS.

```powershell
pnpm build:shared
pnpm build:backend
pnpm build:frontend
pnpm --filter backend start
```

Backend build предварительно собирает пакет `@bms/shared`. Собранный backend раздаёт frontend из `apps/frontend/dist` и загруженные файлы из `apps/backend/uploads` при запуске командой пакета backend.

## Проверки

```powershell
pnpm --filter backend build
pnpm test:jv
pnpm typecheck:shared
pnpm build:frontend
pnpm validate:jv-fixtures
pnpm smoke:jv-line-lab
pnpm --filter backend test:jv-api
pnpm --filter backend test:deals
pnpm parity:jv-order
```

Тесты JV и API используют версионированные сценарии из репозитория. Результаты `EXACT`, `NUMERICALLY_EQUIVALENT`, `DISPLAY_MATCH`, `MISMATCH` и `UNVERIFIED` имеют разные значения: совпадение отображения не доказывает равенство внутренних чисел. Сценарии с Prisma требуют отдельной тестовой базы; сервисные тесты не подтверждают работу транзакций с PostgreSQL. Последняя зафиксированная регрессия и ограничения приведены в [PR_14C_RESULT.md](https://github.com/Jerry93Sky/JV_JOY/blob/feature/jv-full-ui/docs/jv/PR_14C_RESULT.md).

## Excel и источники правил

Оригинальные книги `JV-комплектация 08.10.2026.xlsm` и `JV-розница 08.10.2026.xlsm` являются первоисточниками и хранятся вне Git. При необходимости укажите `JV_EXCEL_COMPLETION`, `JV_EXCEL_RETAIL` или `JV_EXCEL_SOURCE_DIR`. Для свежего пересчёта используются временные копии книг и Excel COM; сохранённый кэш не считается безусловным эталоном. JSON fixtures в Git предназначены для воспроизводимых проверок и не заменяют исходные книги.

Правила работы с источниками, чувствительными данными и расчётной логикой см. в [AGENTS.md](https://github.com/Jerry93Sky/JV_JOY/blob/feature/jv-full-ui/AGENTS.md). Начальные документы движка: [контракт](https://github.com/Jerry93Sky/JV_JOY/blob/feature/jv-full-ui/docs/jv/CONTRACT.md), [архитектура](https://github.com/Jerry93Sky/JV_JOY/blob/feature/jv-full-ui/docs/jv/ARCHITECTURE.md), [результаты проверки этапа 0](https://github.com/Jerry93Sky/JV_JOY/blob/feature/jv-full-ui/docs/jv/STAGE_0_VERIFICATION.md). Для последующих изменений используйте соответствующие `PR_*_RESULT.md` и отчёты parity.

## Известные ограничения

Редактор семи семейств находится в открытом Draft PR #5 и ещё не вошёл в рабочую базовую ветку; часть коммерческих конфигураций ограничена, подробные BOM/trace-представления и постоянное хранение JV-заказов ещё не завершены. При миграции стадий сделки старые непереведённые `CALCULATION` и `PROPOSAL` могли попасть в `ASSEMBLY`; текущая стадия сама по себе не позволяет восстановить прежнее состояние. Автоматическая классификация таких сделок требует отдельного решения; см. [DEAL_STAGE_MIGRATION_MAPPING.md](https://github.com/Jerry93Sky/JV_JOY/blob/feature/jv-full-ui/docs/jv/DEAL_STAGE_MIGRATION_MAPPING.md).

Исходные XLSM, архивы GlasS, базы данных, секреты и локальные настройки авторизации не входят в репозиторий.

