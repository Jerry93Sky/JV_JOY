-- ── Шаг 1: Создаём новый enum ────────────────────────────────────────────────
DO $$ BEGIN
  CREATE TYPE "DealStage_new" AS ENUM (
    'APPLICATION',
    'IN_PROGRESS',
    'INVOICE_SENT',
    'PAID',
    'ASSEMBLY',
    'PAINTING',
    'INSTALL_FIRST',
    'INSTALL_SECOND',
    'SHIPMENT',
    'DOCS',
    'COMPLETED',
    'FAILED'
  );
EXCEPTION WHEN duplicate_object THEN null;
END $$;

-- ── Шаг 2: Убираем DEFAULT чтобы можно было менять тип ───────────────────────
ALTER TABLE "Deal" ALTER COLUMN "stage" DROP DEFAULT;

-- ── Шаг 3: Меняем колонку на TEXT для обновления данных ──────────────────────
ALTER TABLE "Deal" ALTER COLUMN "stage" TYPE TEXT USING "stage"::TEXT;

-- ── Шаг 4: Мигрируем данные ───────────────────────────────────────────────────
UPDATE "Deal" SET "stage" = 'IN_PROGRESS'
  WHERE "isLead" = true AND "stage" IN ('CALCULATION', 'PROPOSAL', 'AWAITING_PAYMENT');

UPDATE "Deal" SET "stage" = 'INVOICE_SENT'
  WHERE "isLead" = false AND "stage" = 'AWAITING_PAYMENT';

UPDATE "Deal" SET "stage" = 'ASSEMBLY'
  WHERE "isLead" = false AND "stage" IN ('CALCULATION', 'PROPOSAL');

UPDATE "Deal" SET "stage" = 'SHIPMENT'
  WHERE "stage" = 'PREP_SHIPMENT';

UPDATE "Deal" SET "stage" = 'INSTALL_SECOND'
  WHERE "stage" = 'GLUING';

-- ── Шаг 5: Меняем тип колонки на новый enum ──────────────────────────────────
ALTER TABLE "Deal" ALTER COLUMN "stage" TYPE "DealStage_new"
  USING "stage"::"DealStage_new";

-- ── Шаг 6: Возвращаем DEFAULT ─────────────────────────────────────────────────
ALTER TABLE "Deal" ALTER COLUMN "stage" SET DEFAULT 'APPLICATION'::"DealStage_new";

-- ── Шаг 7: Удаляем старый enum и переименовываем новый ───────────────────────
DROP TYPE "DealStage";
ALTER TYPE "DealStage_new" RENAME TO "DealStage";

-- ── Шаг 8: Новые поля в DealItem ─────────────────────────────────────────────
ALTER TABLE "DealItem"
  ADD COLUMN IF NOT EXISTS "calcPrice"       DECIMAL(12,2),
  ADD COLUMN IF NOT EXISTS "calcQty"         DECIMAL(10,3),
  ADD COLUMN IF NOT EXISTS "priceOverridden" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS "qtyOverridden"   BOOLEAN NOT NULL DEFAULT false;

-- ── Шаг 9: Новые поля в Deal ──────────────────────────────────────────────────
ALTER TABLE "Deal"
  ADD COLUMN IF NOT EXISTS "invoiceSentAt"    TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "paidAt"           TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "assemblySheetUrl" TEXT,
  ADD COLUMN IF NOT EXISTS "paintingNoteUrl"  TEXT;

-- ── Шаг 10: InstallType enum ──────────────────────────────────────────────────
DO $$ BEGIN
  CREATE TYPE "InstallType" AS ENUM ('NONE', 'SINGLE', 'TWO_STAGE');
EXCEPTION WHEN duplicate_object THEN null;
END $$;

ALTER TABLE "Deal"
  ADD COLUMN IF NOT EXISTS "installType" "InstallType";

-- ── Шаг 11: Поставщики ────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS "VendorCategory" (
  "id"   TEXT NOT NULL,
  "name" TEXT NOT NULL,
  CONSTRAINT "VendorCategory_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX IF NOT EXISTS "VendorCategory_name_key" ON "VendorCategory"("name");

CREATE TABLE IF NOT EXISTS "Vendor" (
  "id"         TEXT NOT NULL,
  "name"       TEXT NOT NULL,
  "categoryId" TEXT NOT NULL,
  "phone"      TEXT,
  "email"      TEXT,
  "address"    TEXT,
  "comment"    TEXT,
  "isPainting" BOOLEAN NOT NULL DEFAULT false,
  "isDefault"  BOOLEAN NOT NULL DEFAULT false,
  "isActive"   BOOLEAN NOT NULL DEFAULT true,
  "createdAt"  TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "Vendor_pkey" PRIMARY KEY ("id")
);

DO $$ BEGIN
  ALTER TABLE "Vendor"
    ADD CONSTRAINT "Vendor_categoryId_fkey"
    FOREIGN KEY ("categoryId") REFERENCES "VendorCategory"("id")
    ON DELETE RESTRICT ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN null;
END $$;
