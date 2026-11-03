-- AlterTable: add new columns with defaults, migrate data from pricePerSqm, then drop old column
ALTER TABLE "GlassType"
ADD COLUMN "costPricePerSqm" DECIMAL(12,2) NOT NULL DEFAULT 0,
ADD COLUMN "sellingPricePerSqm" DECIMAL(12,2) NOT NULL DEFAULT 0,
ADD COLUMN "deliveryCostFixed" DECIMAL(12,2) NOT NULL DEFAULT 0,
ADD COLUMN "surchargeWithCuts" DECIMAL(5,2) NOT NULL DEFAULT 0,
ADD COLUMN "surchargeWithHoles" DECIMAL(5,2) NOT NULL DEFAULT 0;

-- Migrate existing pricePerSqm to both cost and selling
UPDATE "GlassType" SET "costPricePerSqm" = "pricePerSqm", "sellingPricePerSqm" = "pricePerSqm";

-- Drop old column
ALTER TABLE "GlassType" DROP COLUMN "pricePerSqm";
