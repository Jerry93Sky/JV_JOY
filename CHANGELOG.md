# BMS Changelog

## Формат записей
Каждое изменение логируется с датой, описанием и затронутыми файлами.
Миграции БД помечаются отдельно — они требуют применения на сервере.

---

## [2026-04-18] — Сессия 1: Лиды, расчёт, навигация

### Миграции БД
- `patch7_optional_contact` — поле `contactId` в `Deal` стало опциональным (для лидов без контакта)

### Новые функции
- **Изменение количества комплектующих в системах сделки** — inline-редактирование по клику
  - `apps/backend/src/routes/deals.ts` — новый endpoint `PATCH /deals/:id/items/:itemId/quantity`
  - `apps/frontend/src/api/deals.ts` — мутация `useUpdateItemQuantity`
  - `apps/frontend/src/modules/deals/DealItemsPanel.tsx` — UI редактирования

- **Расчёт в лиде** — полный функционал как в сделке
  - `apps/backend/src/routes/leads.ts` — роуты для систем, комплектующих, услуг, extras
  - `apps/frontend/src/api/leads.ts` — мутации для систем/items/services/extras лида
  - `apps/frontend/src/modules/leads/LeadDetail.tsx` — панели DealItemsPanel и DealExtrasPanel

- **Два пути создания лида**: из контакта и из расчёта
  - `apps/frontend/src/pages/LeadsPage.tsx` — кнопки "Из контакта" / "Из расчёта"
  - `apps/frontend/src/modules/leads/CreateLeadDialog.tsx` — проп `calcMode`

- **Возврат к списку при клике на пункт меню**
  - `apps/frontend/src/components/Layout.tsx` — `handleNavClick` с `e.preventDefault()` и `state: { reset }`
  - `apps/frontend/src/pages/SystemsPage.tsx` — обработка `location.state?.reset`

---

## [2026-04-25] — Сессия 2: Стекло, монтаж, настройки

### Миграции БД
- `patch8_param_show_in_deal` — поле `showInDeal` в `SystemParameter`
- `patch9_glass_types` — новая модель `GlassType`
- `patch10_glass_type_prices` — поля `costPricePerSqm`, `sellingPricePerSqm`, `deliveryCostFixed` в `GlassType`
- `patch11_glass_complexity_prices` — поля для вырезов/отверстий в `GlassType`
- `patch12_system_glass` — новая модель `SystemGlass`, enum `GlassComplexity`
- `patch13_install_cost_formula` — поле `installCostFormula` в `GlazingSystem`

### Новые функции

- **Справочник типов стекла** (Настройки → Типы стекла)
  - `apps/backend/src/routes/glass.ts` — CRUD роуты
  - `apps/backend/src/routes/index.ts` — регистрация `/api/glass-types`
  - `apps/frontend/src/api/glass.ts` — API хуки
  - `apps/frontend/src/modules/settings/GlassTypesTab.tsx` — UI с поддержкой фикс. цены и % надбавки
  - `apps/frontend/src/pages/SettingsPage.tsx` — добавлена вкладка "Типы стекла"

- **Стёкла в системах** (Системы → вкладка "Стёкла")
  - `apps/backend/src/routes/systems.ts` — роуты `/systems/:id/glasses`
  - `apps/frontend/src/api/systems.ts` — мутации `useCreateSystemGlass`, `useUpdateSystemGlass`, `useDeleteSystemGlass`
  - `apps/frontend/src/modules/systems/GlassPanel.tsx` — UI настройки стёкол системы
  - `apps/frontend/src/modules/systems/SystemEditor.tsx` — добавлена вкладка "Стёкла"

- **Расчёт стёкол при добавлении системы в сделку**
  - `apps/backend/src/routes/systems.ts` — endpoint `/calculate` расширен: возвращает `glasses` и `install`
  - `apps/frontend/src/modules/deals/AddSystemDialog.tsx` — отображение стёкол, выбор типа, сохранение в `calcParams.__glasses__`

- **Отображение стёкол в карточке сделки**
  - `apps/frontend/src/modules/deals/DealItemsPanel.tsx` — синяя секция "Стёкла" при раскрытии системы

- **Стёкла в итогах сделки**
  - `apps/frontend/src/modules/deals/DealDetail.tsx` — строка "Стекло" в блоке итогов, `totalGlass` в сумме

- **Стёкла в КП**
  - `apps/frontend/src/pages/ProposalViewPage.tsx` — строки стёкол в таблице состава, размеры в описании систем

- **Стёкла в финаналитике**
  - `apps/backend/src/routes/finance.ts` — `glassRevenue` и `glassCost` из `calcParams.__glasses__`

- **Монтаж: себестоимость**
  - `apps/backend/src/routes/systems.ts` — `installCostFormula` в расчёте
  - `apps/frontend/src/modules/systems/SystemFormulaTab.tsx` — два поля: цена клиента + себестоимость
  - `apps/frontend/src/modules/deals/AddSystemDialog.tsx` — блок монтажа в результатах
  - `apps/frontend/src/modules/deals/DealItemsPanel.tsx` — зелёная секция "Монтаж"
  - `apps/frontend/src/modules/deals/DealDetail.tsx` — строка "Монтаж" в итогах
  - `apps/frontend/src/pages/ProposalViewPage.tsx` — монтаж в КП
  - `apps/backend/src/routes/finance.ts` — `installRevenue` и `installCost` в финаналитике

- **Параметры: drag-and-drop приоритета**
  - `apps/backend/src/routes/systems.ts` — endpoint `POST /systems/:id/parameters/reorder`
  - `apps/frontend/src/api/systems.ts` — мутация `useReorderParameters`
  - `apps/frontend/src/modules/systems/ParametersPanel.tsx` — HTML5 DnD для строк таблицы

- **Параметр "Отображать в карточке сделки"**
  - `apps/frontend/src/modules/systems/ParameterDialog.tsx` — чекбокс `showInDeal`

- **Убраны PDF кнопки КП** — только веб-форма
  - `apps/frontend/src/modules/deals/DealStageActions.tsx`
  - `apps/frontend/src/modules/deals/DealDetail.tsx`

- **Статус оплаты** — показывается только после выставления счёта
  - `apps/frontend/src/modules/deals/DealDetail.tsx`

- **Кнопка "вся сумма" при доплате**
  - `apps/frontend/src/modules/deals/DealStageActions.tsx`

- **Стекло/покраска в лиде** (DealExtrasPanel)
  - `apps/frontend/src/modules/deals/DealExtrasPanel.tsx` — чекбоксы для лидов

---

## Правила логирования на будущее

При каждом изменении добавлять запись в этот файл:

```
## [ДАТА] — Краткое описание

### Миграции БД (если есть)
- `имя_миграции` — что изменилось в схеме

### Изменения
- **Название фичи** — описание
  - `путь/к/файлу` — что изменилось
```

**Важно перед деплоем:**
1. Проверить что все миграции применены на сервере
2. Убедиться что данные не будут потеряны (особенно при DROP COLUMN)
3. Сделать бэкап БД перед применением миграций
4. Обновить этот файл с описанием изменений

**При работе с разных компьютеров:**
- Всегда проверять `CHANGELOG.md` чтобы понять что изменилось
- Смотреть список миграций: `apps/backend/prisma/migrations/`
- Применять миграции: `npx prisma migrate dev` (локально) или `npx prisma migrate deploy` (сервер)
- Подробнее: см. `DEPLOY.md`
