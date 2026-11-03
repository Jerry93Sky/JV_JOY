-- Добавляем поле отгруженного количества в DealItem
ALTER TABLE "DealItem"
  ADD COLUMN IF NOT EXISTS "shippedQty" DECIMAL(10,3) NOT NULL DEFAULT 0;
