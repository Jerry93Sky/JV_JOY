-- AlterTable
ALTER TABLE "Deal" ADD COLUMN     "glassComment" TEXT,
ADD COLUMN     "glassExpectedDate" TIMESTAMP(3),
ADD COLUMN     "glassOrderDate" TIMESTAMP(3),
ADD COLUMN     "glassSupplier" TEXT;
