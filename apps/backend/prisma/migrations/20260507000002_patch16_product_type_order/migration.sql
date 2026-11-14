-- Добавляем поле порядка в ProductType
ALTER TABLE "ProductType" ADD COLUMN IF NOT EXISTS "order" INTEGER NOT NULL DEFAULT 0;

-- Инициализируем порядок по алфавиту (текущий порядок)
WITH ranked AS (
  SELECT id, ROW_NUMBER() OVER (ORDER BY name ASC) - 1 AS rn
  FROM "ProductType"
)
UPDATE "ProductType" pt SET "order" = r.rn FROM ranked r WHERE pt.id = r.id;
