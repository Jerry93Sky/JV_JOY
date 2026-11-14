# Архитектура и дизайн системы

## Стек технологий

### Frontend
- **React 18** + **TypeScript** — UI
- **Vite** — сборщик
- **Zustand** — управление состоянием
- **React Query (TanStack Query)** — кэширование и синхронизация данных с сервером
- **React Router v6** — маршрутизация
- **Tailwind CSS** — стили
- **shadcn/ui** — компонентная библиотека (на базе Radix UI)
- **React Hook Form + Zod** — формы и валидация
- **@react-pdf/renderer** — генерация PDF на клиенте
- **date-fns** — работа с датами

### Backend
- **Node.js** + **TypeScript**
- **Fastify** — HTTP-фреймворк (быстрее Express, встроенная валидация)
- **Prisma ORM** — работа с базой данных
- **PostgreSQL** — основная БД
- **Redis** — сессии, кэш
- **Minio** (S3-совместимое хранилище) — хранение файлов (PDF, фото, накладные, чертежи)
- **JWT** — аутентификация (access + refresh токены)
- **node-cron** — фоновые задачи (проверка сроков покраски и т.д.)

### Инфраструктура
- **Docker + Docker Compose** — локальная разработка и деплой
- Монорепозиторий: `apps/frontend`, `apps/backend`, `packages/shared` (общие типы)

---

## Структура проекта

```
/
├── apps/
│   ├── frontend/          # React приложение
│   │   ├── src/
│   │   │   ├── pages/     # Страницы по модулям
│   │   │   ├── components/# Переиспользуемые компоненты
│   │   │   ├── modules/   # Модули (crm, warehouse, clients, finance, calculator)
│   │   │   ├── store/     # Zustand stores
│   │   │   ├── api/       # React Query хуки
│   │   │   └── lib/       # Утилиты, хелперы
│   └── backend/           # Fastify API
│       ├── src/
│       │   ├── modules/   # Модули (deals, clients, warehouse, finance, calculator, users)
│       │   ├── prisma/    # Схема и миграции
│       │   ├── plugins/   # Fastify плагины (auth, storage, etc.)
│       │   └── jobs/      # Фоновые задачи
└── packages/
    └── shared/            # Общие TypeScript типы и константы
```

---

## Модели данных (Prisma Schema)

### Пользователи

```prisma
model User {
  id          String   @id @default(cuid())
  login       String   @unique
  password    String   // bcrypt hash
  lastName    String
  firstName   String
  middleName  String?
  role        Role     @default(USER)
  createdAt   DateTime @default(now())

  createdDeals  Deal[] @relation("DealCreator")
  assignedDeals Deal[] @relation("DealAssignee")
}

enum Role {
  OWNER
  ADMIN
  USER
  GUEST
}
```

### Клиентская база

```prisma
model Contact {
  id          String   @id @default(cuid())
  lastName    String
  firstName   String
  middleName  String?
  phone       String
  email       String?
  position    String?
  createdAt   DateTime @default(now())

  companies   ContactCompany[]
  deals       Deal[]
}

model Company {
  id              String      @id @default(cuid())
  name            String
  type            CompanyType
  inn             String?
  ogrn            String?
  createdAt       DateTime    @default(now())

  bankAccounts    BankAccount[]
  contacts        ContactCompany[]
  relatedFrom     CompanyRelation[] @relation("CompanyFrom")
  relatedTo       CompanyRelation[] @relation("CompanyTo")
  files           CompanyFile[]
  deals           Deal[]
  discountRules   CompanyDiscount?
}

enum CompanyType {
  OOO
  IP
  AO
  SZ
  AGENT
}

model BankAccount {
  id          String  @id @default(cuid())
  companyId   String
  accountNum  String
  bik         String
  company     Company @relation(fields: [companyId], references: [id])
}

model ContactCompany {
  contactId   String
  companyId   String
  contact     Contact @relation(fields: [contactId], references: [id])
  company     Company @relation(fields: [companyId], references: [id])
  @@id([contactId, companyId])
}

model CompanyRelation {
  fromId  String
  toId    String
  from    Company @relation("CompanyFrom", fields: [fromId], references: [id])
  to      Company @relation("CompanyTo", fields: [toId], references: [id])
  @@id([fromId, toId])
}

model CompanyFile {
  id          String      @id @default(cuid())
  companyId   String
  type        CompanyFileType
  url         String
  company     Company @relation(fields: [companyId], references: [id])
}

enum CompanyFileType {
  PARTNER_CARD
  CONTRACT
  PERSONAL_DATA_CONSENT
}
```

### Сделки (CRM)

```prisma
model Deal {
  id              String      @id @default(cuid())
  number          String      @unique // авто-генерируемый номер заказа
  stage           DealStage   @default(APPLICATION)
  direction       Direction
  creatorId       String
  assigneeId      String
  contactId       String
  companyId       String?
  comment         String?
  isAgentOrder    Boolean     @default(false)
  agentPercent    Decimal?
  glassSupply     GlassSupply @default(OURS)
  needPainting    Boolean     @default(false)
  paintAllOneColor Boolean    @default(true)
  paymentType     PaymentType?
  paymentStatus   PaymentStatus?
  paidAmount      Decimal?
  isOfficialPayment Boolean   @default(false)
  failReason      FailReason?
  paintingCompany String?
  paintingSentAt  DateTime?
  glassOrderStatus GlassOrderStatus @default(NOT_STARTED)
  glassDrawingUrl String?
  glassCostPrice  Decimal?
  createdAt       DateTime    @default(now())
  updatedAt       DateTime    @updatedAt

  creator         User        @relation("DealCreator", fields: [creatorId], references: [id])
  assignee        User        @relation("DealAssignee", fields: [assigneeId], references: [id])
  contact         Contact     @relation(fields: [contactId], references: [id])
  company         Company?    @relation(fields: [companyId], references: [id])

  isLead          Boolean    @default(false)
  leadStatus      LeadStatus?
  leadSource      LeadSource?
  leadRejectReason String?

  items           DealItem[]
  services        DealService[]
  files           DealFile[]
  proposals       CommercialProposal[]
  events          LeadEvent[]
  invoiceFile     String?
  assemblePdfUrl  String?
  paintingPdfUrl  String?
  gluingSchemaUrl String?
}

enum DealStage {
  APPLICATION        // 1.1
  CALCULATION        // 1.2
  PROPOSAL           // 1.3
  AWAITING_PAYMENT   // 1.4
  PAID               // 2.1
  ASSEMBLY           // 2.2
  PAINTING           // 2.3
  PREP_SHIPMENT      // 2.4
  INSTALL_FIRST      // 3.1
  GLUING             // 3.2
  INSTALL_SECOND     // 3.3
  SHIPMENT           // 4.1
  COMPLETED          // 4.2
  FAILED             // 4.3
}

enum Direction {
  PRIVATE
  DEALER
}

enum GlassSupply {
  OURS
  CLIENT
}

enum PaymentType {
  CASH
  BANK
}

enum PaymentStatus {
  FULL
  PARTIAL
}

enum FailReason {
  PRICE
  TECHNICAL
  COMPETITOR
  STOCK_SHORTAGE
}

enum GlassOrderStatus {
  NOT_STARTED
  IN_PROGRESS
  COMPLETED
}

model DealItem {
  id            String    @id @default(cuid())
  dealId        String
  productId     String
  systemId      String?   // если позиция из системы расчёта
  quantity      Decimal
  unitPrice     Decimal
  paintColor    String?   // RAL код
  deal          Deal      @relation(fields: [dealId], references: [id])
  product       Product   @relation(fields: [productId], references: [id])
}

model DealService {
  id          String    @id @default(cuid())
  dealId      String
  serviceId   String
  quantity    Int       @default(1)
  unitPrice   Decimal
  deal        Deal      @relation(fields: [dealId], references: [id])
  service     Service   @relation(fields: [serviceId], references: [id])
}

model DealFile {
  id        String      @id @default(cuid())
  dealId    String
  url       String
  name      String
  type      DealFileType
  deal      Deal        @relation(fields: [dealId], references: [id])
}

enum DealFileType {
  ATTACHMENT      // чертежи, фото объекта
  INVOICE         // счёт
  SHIPMENT_PHOTO  // фото комплектации
  SHIPMENT_DOC    // накладные
  GLASS_DRAWING   // чертежи стёкол
}

model CommercialProposal {
  id        String   @id @default(cuid())
  dealId    String
  version   Int
  url       String
  createdAt DateTime @default(now())
  deal      Deal     @relation(fields: [dealId], references: [id])
}
```

### Склад

```prisma
model Product {
  id              String    @id @default(cuid())
  sku             String    @unique
  name            String
  typeId          String
  unit            String
  isPaintable     Boolean   @default(false)
  markupRetail    Decimal     @default(0) @db.Decimal(5, 2)  // розничная наценка
  markupWholesale Decimal   @default(0) @db.Decimal(5, 2)  // оптовая наценка
  priceRetail     Decimal   @default(0) @db.Decimal(12, 2) // розничная цена
  priceWholesale  Decimal   @default(0) @db.Decimal(12, 2) // оптовая цена
  quantity        Decimal   @default(0)
  reservedQty     Decimal   @default(0)
  isActive        Boolean   @default(true)
  createdAt       DateTime  @default(now())

  type            ProductType @relation(fields: [typeId], references: [id])
  receipts        ReceiptItem[]
  writeoffItems   WriteoffItem[]
  dealItems       DealItem[]
  systemComponents SystemComponent[]
}

model ProductType {
  id        String    @id @default(cuid())
  name      String    @unique
  products  Product[]
}

model Supplier {
  id        String    @id @default(cuid())
  name      String
  receipts  Receipt[]
}

model Receipt {
  id          String        @id @default(cuid())
  supplierId  String
  date        DateTime      @default(now())
  photoUrl    String?
  createdAt   DateTime      @default(now())
  editableUntil DateTime
  supplier    Supplier      @relation(fields: [supplierId], references: [id])
  items       ReceiptItem[]
}

model ReceiptItem {
  id          String   @id @default(cuid())
  receiptId   String
  productId   String
  quantity    Decimal
  costPrice   Decimal
  receipt     Receipt  @relation(fields: [receiptId], references: [id])
  product     Product  @relation(fields: [productId], references: [id])
}

model Writeoff {
  id          String         @id @default(cuid())
  reason      WriteoffReason
  comment     String
  date        DateTime       @default(now())
  createdAt   DateTime       @default(now())
  editableUntil DateTime
  items       WriteoffItem[]
}

enum WriteoffReason {
  INVENTORY
  DEFECT
}

model WriteoffItem {
  id          String   @id @default(cuid())
  writeoffId  String
  productId   String
  quantity    Decimal
  writeoff    Writeoff @relation(fields: [writeoffId], references: [id])
  product     Product  @relation(fields: [productId], references: [id])
}
```

### Модуль расчёта систем

```prisma
model GlazingSystem {
  id          String    @id @default(cuid())
  name        String
  isActive    Boolean   @default(true)
  createdAt   DateTime  @default(now())

  parameters  SystemParameter[]
  components  SystemComponent[]
}

model SystemParameter {
  id            String          @id @default(cuid())
  systemId      String
  name          String          // отображаемое название (рус)
  variable      String          // имя переменной (eng)
  type          ParamType
  paramKind     ParamKind
  options       Json?           // для выпадающих списков: [{label, value}]
  formula       String?         // для рассчитываемых параметров
  defaultValue  String?
  showInProposal Boolean        @default(false)
  showInAssembly Boolean        @default(false)
  categoryId     String?
  category       SystemParamCategory? @relation(fields: [categoryId], references: [id])
  system        GlazingSystem   @relation(fields: [systemId], references: [id])
  limits        SystemLimit[]
}

model SystemParamCategory {
  id        String            @id @default(cuid())
  systemId  String
  name      String
  order     Int               @default(0)
  system    GlazingSystem     @relation(fields: [systemId], references: [id], onDelete: Cascade)
  parameters SystemParameter[]
}

enum ParamType {
  NUMBER
  SELECT
  BOOLEAN
}

enum ParamKind {
  INPUT       // вводной
  CALCULATED  // рассчитываемый
  CONSTANT    // константа
}

model SystemLimit {
  id          String          @id @default(cuid())
  parameterId String
  minValue    Decimal?
  maxValue    Decimal?
  parameter   SystemParameter @relation(fields: [parameterId], references: [id])
}

model SystemComponent {
  id          String        @id @default(cuid())
  systemId    String
  productId   String
  formula     String        // формула расчёта количества
  system      GlazingSystem @relation(fields: [systemId], references: [id])
  product     Product       @relation(fields: [productId], references: [id])
}
```

### Лиды

```prisma
// ─── LEADS ───────────────────────────────────────────────────────────────────

model LeadEvent {
  id        String        @id @default(cuid())
  dealId    String
  type      LeadEventType
  content   String?
  userId    String?
  createdAt DateTime      @default(now())
  deal      Deal          @relation(fields: [dealId], references: [id], onDelete: Cascade)
}

enum LeadEventType {
  CREATED
  STATUS_CHANGED
  COMMENT_ADDED
  CALL_INBOUND
  CALL_OUTBOUND
  CONVERTED
  REJECTED
}

enum LeadStatus {
  NEW
  IN_PROGRESS
  CONVERTED
  REJECTED
}

enum LeadSource {
  CALL
  WEBSITE
  MANUAL
  OTHER
}
```

### Финансы

```prisma
model Expense {
  id          String          @id @default(cuid())
  categoryId  String
  amount      Decimal
  comment     String?
  dealId      String?         // если расход привязан к заказу
  date        DateTime        @default(now())
  createdAt   DateTime        @default(now())
  category    ExpenseCategory @relation(fields: [categoryId], references: [id])
}

model ExpenseCategory {
  id        String    @id @default(cuid())
  name      String    @unique
  expenses  Expense[]
}
```

### Настройки

```prisma
model DiscountThreshold {
  id            String  @id @default(cuid())
  minTurnover   Decimal
  discountPct   Decimal
}

model Settings {
  id              String  @id @default(cuid())
  key             String  @unique
  value           String
}
// Используется для: наценка на стекло, и прочие глобальные настройки
```

---

## API — структура эндпоинтов

```
POST   /auth/login
POST   /auth/refresh
POST   /auth/logout

GET    /users
POST   /users
PATCH  /users/:id
DELETE /users/:id

GET    /deals
POST   /deals
GET    /deals/:id
PATCH  /deals/:id
POST   /deals/:id/stage          // переход на следующий этап
POST   /deals/:id/proposal       // генерация КП
POST   /deals/:id/invoice        // загрузка счёта
POST   /deals/:id/payment        // оплата
POST   /deals/:id/assemble       // сборка и комплектование
POST   /deals/:id/painting       // в покраску
POST   /deals/:id/painting-done  // пришёл с покраски
POST   /deals/:id/glass-order    // заказ стекла
POST   /deals/:id/gluing         // на склейку
POST   /deals/:id/install-1      // монтаж 1
POST   /deals/:id/install-2      // монтаж 2
POST   /deals/:id/ship           // отгрузка
POST   /deals/:id/complete       // завершить
POST   /deals/:id/fail           // провалить

GET    /contacts
POST   /contacts
GET    /contacts/:id
PATCH  /contacts/:id
DELETE /contacts/:id

GET    /companies
POST   /companies
GET    /companies/:id
PATCH  /companies/:id
DELETE /companies/:id

GET    /products
POST   /products
GET    /products/:id
PATCH  /products/:id

GET    /receipts
POST   /receipts
GET    /receipts/:id
PATCH  /receipts/:id

GET    /writeoffs
POST   /writeoffs
GET    /writeoffs/:id
PATCH  /writeoffs/:id

GET    /suppliers
POST   /suppliers

GET    /systems
POST   /systems
GET    /systems/:id
PATCH  /systems/:id
DELETE /systems/:id
POST   /systems/:id/calculate    // расчёт системы по параметрам

GET    /finance/summary          // сводка за период
GET    /finance/expenses
POST   /finance/expenses
GET    /finance/analytics        // статистика

GET    /settings
PATCH  /settings
GET    /settings/discount-thresholds
POST   /settings/discount-thresholds
PATCH  /settings/discount-thresholds/:id
DELETE /settings/discount-thresholds/:id
```

---

## Логика переходов между этапами

Переходы контролируются на бэкенде в сервисе `DealStageService`. Каждый переход проверяет:
1. Текущий этап сделки
2. Выполнение условий (наличие файлов, заполненность полей)
3. Права пользователя

При переходе на этап 1.4 (Ожидание оплаты) — резервирование комплектующих.
При переходе на этап 2.2 (Сборка) — окончательное списание со склада.
При переходе на этап 4.3 (Провал) — снятие резервов.

Параллельный процесс {P} (Заказ стекла) хранится как отдельное поле `glassOrderStatus` в сделке и управляется независимо от основного этапа.

---

## Генерация PDF

PDF генерируется на бэкенде с помощью библиотеки `pdf-lib` или `puppeteer` (HTML → PDF).
Файлы сохраняются в Minio, в БД хранится только URL.

Шаблоны PDF:
- `proposal.template` — коммерческое предложение
- `assembly.template` — комплектация для сборки
- `painting.template` — покрасочная накладная
- `gluing.template` — схема склейки

---

## Фоновые задачи (node-cron)

- Каждые 30 минут: проверка заказов на этапе 2.3 (Покраска), у которых `paintingSentAt` + 10 дней < now → пометить флагом `paintingOverdue`
- Ежедневно в 00:00: пересчёт скидок компаний по обороту за прошлый год

---

## Безопасность

- Пароли хранятся в виде bcrypt-хэша
- JWT access token: 15 минут, refresh token: 30 дней (хранится в httpOnly cookie)
- Все эндпоинты защищены middleware проверки роли
- Файлы доступны только через подписанные URL (Minio presigned URLs)
- Редактирование документов прихода/списания: проверка `editableUntil` на бэкенде
