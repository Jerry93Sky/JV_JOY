# JV_JOY — актуальная тестовая версия

`main` — рекомендуемая ветка для тестирования BMS GlasS-light и JV. Включены **R5.7** со связью выпущенного КП и сделки и **R5.8** с проектом счёта на основании выпущенного КП.

**Тестовая сборка — не для самостоятельного коммерческого выпуска без контроля.** Полной Excel parity для всех комбинаций пока нет. Сценарии со статусом `PARTIAL` не дают подтверждённого итога и не проходят в выпуск КП. Проект счёта можно сохранить и распечатать. Автоматизированное выставление счёта, обработка оплаты и складские операции JV ещё разрабатываются. Этапы R6–R8 включают прайсы, эксплуатационную проверку и пилот.

## Что работает

- Рабочая область JV для Line, Zigzag, Slider L3/L5/X3/X5 и Front. Доступны адаптивный редактор до семи конструкций, BOM, трассировка, профили комплектации и розницы.
- Черновики заказов в PostgreSQL, ручное и автоматическое сохранение, история версий, шаблоны и связь со сделкой. Владелец и администратор работают в редакторе.
- Фиксация `COMPLETE`, черновик КП, сохранение условий и печать. Согласование выполняет владелец. Владелец и инженер выпускают КП и открывают его из исходной сделки.
- Проект счёта наследует подтверждённую сумму, состав и условия выпущенного КП. Сохранённые реквизиты выводятся в PDF с отметкой «ПРОЕКТ — НЕ ВЫСТАВЛЕН».
- Существующие модули BMS для лидов, сделок, клиентов, склада и расчёта систем работают рядом с JV.

Для первого запуска используйте [пошаговую инструкцию для тестирования](docs/jv/TESTING_LATEST.md). Ограничения собраны в [дорожной карте](ROADMAP.md) и [бэклоге UX](docs/jv/FINAL_UX_BACKLOG.md). Локальный демонстрационный Docker может использовать более раннюю версию.

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

## Быстрый запуск в PowerShell

Проверено с Node.js 24.13.0 и pnpm 11.25.0. Docker Compose поднимает отдельную PostgreSQL 16 с привязкой к локальному адресу. Backend и frontend запускаются на хосте.

```powershell
git clone --branch main https://github.com/Jerry93Sky/JV_JOY.git
cd JV_JOY
pnpm install --frozen-lockfile
$env:JV_TEST_DB_PORT = '55432'
$env:JV_TEST_DB_PASSWORD = [guid]::NewGuid().ToString('N')
docker compose -f compose.testing.yml up -d --wait
$env:DATABASE_URL = "postgresql://jvtester:$($env:JV_TEST_DB_PASSWORD)@127.0.0.1:$($env:JV_TEST_DB_PORT)/jvjoy_testing"
$env:JWT_SECRET = [guid]::NewGuid().ToString('N') + [guid]::NewGuid().ToString('N')
$env:ADMIN_INITIAL_PASSWORD = Read-Host 'Задайте пароль для тестового пользователя admin'
pnpm --filter backend db:generate
pnpm --filter backend exec prisma migrate deploy
pnpm db:seed
New-Item -ItemType Directory -Force apps/frontend/dist | Out-Null
pnpm dev:backend
```

Уже есть тестовый том PostgreSQL? Подставьте сохранённый пароль вместо генерации нового. При использовании отдельной PostgreSQL задайте её адрес в `DATABASE_URL`. Выполняйте миграции и seed только на тестовой базе.

В другом терминале из корня запустите `pnpm dev:frontend`. Откройте [JV Workspace](http://localhost:5173/jv/orders/new) и войдите под `admin` с заданным паролем. Seed создаёт владельца один раз. Vite перенаправляет `/api` на backend на порту 3001. Для проверки документного сценария JV дополнительных сервисов не требуется.

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

Тесты JV и API используют версионированные сценарии из репозитория. Результаты `EXACT`, `NUMERICALLY_EQUIVALENT`, `DISPLAY_MATCH`, `MISMATCH` и `UNVERIFIED` имеют разные значения: совпадение отображения не доказывает равенство внутренних чисел. Для транзакционных проверок Prisma используйте отдельную тестовую базу и команды задания persistence из CI. Исторические проверки приведены в [PR_14C_RESULT.md](docs/jv/PR_14C_RESULT.md), актуальные ограничения интерфейса — в [PR_15C_RESULT.md](docs/jv/PR_15C_RESULT.md).

## Excel и источники правил

Оригинальные книги `JV-комплектация 08.10.2026.xlsm` и `JV-розница 08.10.2026.xlsm` являются первоисточниками и хранятся вне Git. При необходимости укажите `JV_EXCEL_COMPLETION`, `JV_EXCEL_RETAIL` или `JV_EXCEL_SOURCE_DIR`. Для свежего пересчёта используются временные копии книг и Excel COM; сохранённый кэш не считается безусловным эталоном. JSON fixtures в Git предназначены для воспроизводимых проверок и не заменяют исходные книги.

Правила работы с источниками, чувствительными данными и расчётной логикой см. в [AGENTS.md](https://github.com/Jerry93Sky/JV_JOY/blob/main/AGENTS.md). Начальные документы движка: [контракт](https://github.com/Jerry93Sky/JV_JOY/blob/main/docs/jv/CONTRACT.md), [архитектура](https://github.com/Jerry93Sky/JV_JOY/blob/main/docs/jv/ARCHITECTURE.md), [результаты проверки этапа 0](https://github.com/Jerry93Sky/JV_JOY/blob/main/docs/jv/STAGE_0_VERIFICATION.md). Для последующих изменений используйте соответствующие `PR_*_RESULT.md` и отчёты parity.

## Известные ограничения

Коммерческие конфигурации Front и других систем доступны в подтверждённом диапазоне. Сверку по профилям и условиям включения стекла см. в [результатах parity](docs/jv/GLASS_OFF_PARITY_RESULT.md). Полный набор конфигураций Excel и нагрузочные ограничения ещё проверяются. Из старой стадии `ASSEMBLY` нельзя однозначно восстановить прежние `CALCULATION` и `PROPOSAL`. Сопоставление исторических стадий требует отдельного решения. См. [карту миграции стадий](docs/jv/DEAL_STAGE_MIGRATION_MAPPING.md).

Исходные XLSM, архивы GlasS, базы данных, секреты и локальные настройки авторизации не входят в репозиторий.

