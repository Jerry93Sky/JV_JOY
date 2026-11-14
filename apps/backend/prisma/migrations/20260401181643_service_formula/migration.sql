-- AlterTable
ALTER TABLE "Service" ADD COLUMN     "priceFormula" TEXT,
ADD COLUMN     "unit" TEXT NOT NULL DEFAULT 'шт',
ALTER COLUMN "price" DROP NOT NULL;
