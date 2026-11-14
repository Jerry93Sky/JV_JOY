/*
  Warnings:

  - You are about to drop the column `surchargeWithCuts` on the `GlassType` table. All the data in the column will be lost.
  - You are about to drop the column `surchargeWithHoles` on the `GlassType` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE "GlassType" DROP COLUMN "surchargeWithCuts",
DROP COLUMN "surchargeWithHoles",
ADD COLUMN     "costPriceWithCuts" DECIMAL(12,2),
ADD COLUMN     "costPriceWithHoles" DECIMAL(12,2),
ADD COLUMN     "sellingPriceWithCuts" DECIMAL(12,2),
ADD COLUMN     "sellingPriceWithHoles" DECIMAL(12,2),
ADD COLUMN     "surchargeWithCutsPct" DECIMAL(5,2),
ADD COLUMN     "surchargeWithHolesPct" DECIMAL(5,2);
