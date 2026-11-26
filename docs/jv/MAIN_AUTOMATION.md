# Проверки, Auto-merge и сборки main

**Последняя проверенная тестовая версия находится в `main`.** Обычная единица работы — короткая ветка от свежего `origin/main` и один PR в `main`. Draft используется, пока работу рано отдавать на проверку.

## Настройка владельцем на GitHub

При подготовке этой схемы репозиторий показывал `allow_auto_merge: false`, а `main` — `protected: false`. Коннектор GitHub может включать Auto-merge на отдельном PR, но не предоставляет запись общих настроек. Доступный браузер открывает Settings без авторизованной сессии. Следующие действия выполняются владельцем в GitHub.

1. Откройте **Settings → Rules → Rulesets → New branch ruleset**. Установите enforcement **Active**. Добавьте точную цель `main` или правило **Include default branch**, пока ветка по умолчанию — `main`. Оставьте **Bypass list** пустым.
2. Включите **Require a pull request before merging**, **Require review from Code Owners**, **Dismiss stale pull request approvals when new commits are pushed**, **Block force pushes** и **Restrict deletions**. Для обычных файлов достаточно **Required approvals = 0**. Для путей в [CODEOWNERS](../../.github/CODEOWNERS) применяется отдельное одобрение code owner. GitHub использует CODEOWNERS из базовой ветки. Первый PR с CI и самим CODEOWNERS требует отдельного ревью перед объединением вручную. Автор PR не может одобрить собственный PR. Если владелец указан автором, согласуйте независимого ответственного с правом записи. [Правила GitHub для репозитория](https://docs.github.com/en/repositories/configuring-branches-and-merges-in-your-repository/managing-rulesets/creating-rulesets-for-a-repository) · [Правила CODEOWNERS](https://docs.github.com/en/repositories/managing-your-repositorys-settings-and-features/customizing-your-repository/about-code-owners)
3. Включите **Require status checks to pass** и **Require branches to be up to date before merging**. Добавьте два точных имени из workflow **JV independent engine checks** — `jv` и `persistence`. Если доступен выбор источника, выберите GitHub Actions. На этой ветке нет других workflow с такими именами заданий. [Правила проверок GitHub](https://docs.github.com/en/repositories/configuring-branches-and-merges-in-your-repository/managing-rulesets/available-rules-for-rulesets)
4. Сохраните правила. Затем откройте **Settings → General → Pull Requests** и включите **Allow auto-merge**. Сохраните разрешение **Allow squash merging**, если хотите объединять каждый PR одним коммитом. Это стандартная функция GitHub для отдельных PR. [Настройки репозитория](https://github.com/Jerry93Sky/JV_JOY/settings) · [Инструкция GitHub по Auto-merge](https://docs.github.com/en/repositories/configuring-branches-and-merges-in-your-repository/configuring-pull-request-merges/managing-auto-merge-for-pull-requests-in-your-repository)

## Работа с PR

1. Выполните `git fetch origin main` и создайте новую ветку командой `git switch --no-track -c feature/имя-задачи origin/main`.
2. Реализуйте задачу и выполните затронутые проверки локально. Откройте PR в `main` и проверьте полный diff. Переведите Draft в Ready for review после завершения работы.
3. Проверьте, что актуальный HEAD PR проверяется с текущим `main`. При изменении HEAD или базы обновите ветку и дождитесь новых проверок. Старое зелёное выполнение другого коммита использовать нельзя.
4. Для готового PR с настроенной защитой можно выбрать **Enable auto-merge**, пока обязательная проверка ещё выполняется. GitHub объединит PR только после успеха обеих проверок и выполнения требований по ревью. Когда все требования уже выполнены, GitHub может показывать обычное объединение вместо переключателя Auto-merge. [Когда доступен переключатель](https://docs.github.com/en/pull-requests/how-tos/merge-and-close-pull-requests/automatically-merging-a-pull-request)
5. Изменения арифметики JV, коммерческих правил, авторизации, Prisma, CI и инфраструктуры требуют отдельного одобрения владельца или назначенного ответственного. CODEOWNERS задаёт известные критические пути. Если критическая логика затронута в другом файле, также дождитесь отдельного одобрения. После нового коммита проверьте актуальность одобрения.
6. После объединения проверьте событие **push** на `main` для точного SHA. Сообщите этот SHA, итог CI и ссылку на артефакт. Если обязательная проверка падает, выясните причину. Повтор того же задания допустим для подтверждённого сбоя инфраструктуры или нестабильного теста с зафиксированной причиной.

| Обязательное имя | Что проверяется |
| --- | --- |
| `jv` | JV Engine, сравнения по Excel fixtures, API, frontend/backend build, Shared TypeScript, роли, HTTP, Chrome E2E и упаковка сборки |
| `persistence` | Prisma migrate deploy на отдельной PostgreSQL, транзакции, версии, выпуск КП и проект счёта через Chrome |

## Сборка и определение версии

Откройте [запуски workflow по ветке main](https://github.com/Jerry93Sky/JV_JOY/actions/workflows/jv-ci.yml?query=branch%3Amain+event%3Apush). После успеха `jv` и `persistence` задание `publish-main` публикует `jv-main-<полный SHA>` на 30 дней. Сборки `jv-candidate-…` живут три дня и предназначены для CI. Для установки используйте проверенный архив `jv-main-…`. В корне архива есть `build-info.json` с SHA, временем UTC, ID запуска и отпечатками lockfile, схемы и миграций. `verification.json` фиксирует успех двух заданий для того же SHA. Список файлов и инструкция запуска приведены в [TESTING_LATEST.md](TESTING_LATEST.md). [Документация артефактов GitHub](https://docs.github.com/en/actions/tutorials/store-and-share-data)

Тестовый PR для проверки процесса меняет один пункт отчёта консолидации. После включения правил и объединения PR с настройкой workflow обновите тестовый PR от актуального `main`. Проверьте, что готовый PR проходит две обязательные проверки и что после разрешённого Auto-merge появился `push` на `main` с артефактом того же SHA.

## Восстановление

Если CI нового `main` падает, используйте предыдущий успешный SHA из списка запусков для тестирования. Для исправления `main` откройте PR с исправлением или `git revert` проблемного коммита. Сохраните обычные проверки и критическое ревью. Перезапись истории и принудительная отправка для восстановления не нужны.

Отдельно проверьте совместимость PostgreSQL по списку миграций и `prisma migrate status`. Если база уже получила более новую миграцию, проверяйте откат приложения на отдельной восстановленной копии. Сохраняйте новую рабочую базу и записи, появившиеся после резервной копии. Автоматического обновления демонстрационного Docker в workflow нет. Для него нужны отдельное согласование, проверенный бэкап, пробное применение миграций, проверка сохранности данных и статуса healthy.

## Правило для Codex

Начинайте каждую новую задачу от актуального `origin/main`. Создавайте обычный PR в `main`, когда реализация завершена. Проверяйте обязательные задания именно для актуального HEAD, затем применяйте стандартный Auto-merge только при действующей защите `main` и соблюдении правил ревью. При отсутствии административных настроек сообщайте владельцу точный блокер и сохраняйте работу в PR. Подтверждайте опубликованный SHA по push-проверке и артефакту. Обновление Docker или PostgreSQL относится к отдельному заданию.
