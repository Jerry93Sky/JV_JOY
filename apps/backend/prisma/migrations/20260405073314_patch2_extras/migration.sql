-- CreateEnum
CREATE TYPE "DeliveryType" AS ENUM ('SELF_PICKUP', 'LOCAL', 'TERMINAL');

-- AlterTable
ALTER TABLE "Deal" ADD COLUMN     "actualInstallPrice" DECIMAL(12,2),
ADD COLUMN     "calcGlassPrice" DECIMAL(12,2),
ADD COLUMN     "calcInstallPrice" DECIMAL(12,2),
ADD COLUMN     "calcPaintingPrice" DECIMAL(12,2),
ADD COLUMN     "calcTransportPrice" DECIMAL(12,2),
ADD COLUMN     "deliveryType" "DeliveryType" NOT NULL DEFAULT 'SELF_PICKUP',
ADD COLUMN     "includeInstall" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "includeTransport" BOOLEAN NOT NULL DEFAULT false;
