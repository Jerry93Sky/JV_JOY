/*
  Warnings:

  - You are about to drop the column `markup` on the `Product` table. All the data in the column will be lost.
  - You are about to drop the column `sellingPrice` on the `Product` table. All the data in the column will be lost.

*/
-- CreateEnum
CREATE TYPE "LeadStatus" AS ENUM ('NEW', 'IN_PROGRESS', 'CONVERTED', 'REJECTED');

-- CreateEnum
CREATE TYPE "LeadSource" AS ENUM ('CALL', 'WEBSITE', 'MANUAL', 'OTHER');

-- CreateEnum
CREATE TYPE "LeadEventType" AS ENUM ('CREATED', 'STATUS_CHANGED', 'COMMENT_ADDED', 'CALL_INBOUND', 'CALL_OUTBOUND', 'CONVERTED', 'REJECTED');

-- AlterTable
ALTER TABLE "Deal" ADD COLUMN     "isLead" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "leadRejectReason" TEXT,
ADD COLUMN     "leadSource" "LeadSource",
ADD COLUMN     "leadStatus" "LeadStatus";

-- AlterTable
ALTER TABLE "Product" DROP COLUMN "markup",
DROP COLUMN "sellingPrice",
ADD COLUMN     "markupRetail" DECIMAL(5,2) NOT NULL DEFAULT 0,
ADD COLUMN     "markupWholesale" DECIMAL(5,2) NOT NULL DEFAULT 0,
ADD COLUMN     "priceRetail" DECIMAL(12,2) NOT NULL DEFAULT 0,
ADD COLUMN     "priceWholesale" DECIMAL(12,2) NOT NULL DEFAULT 0;

-- AlterTable
ALTER TABLE "SystemParameter" ADD COLUMN     "categoryId" TEXT;

-- CreateTable
CREATE TABLE "LeadEvent" (
    "id" TEXT NOT NULL,
    "dealId" TEXT NOT NULL,
    "type" "LeadEventType" NOT NULL,
    "content" TEXT,
    "userId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "LeadEvent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SystemParamCategory" (
    "id" TEXT NOT NULL,
    "systemId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "order" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "SystemParamCategory_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "LeadEvent" ADD CONSTRAINT "LeadEvent_dealId_fkey" FOREIGN KEY ("dealId") REFERENCES "Deal"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SystemParamCategory" ADD CONSTRAINT "SystemParamCategory_systemId_fkey" FOREIGN KEY ("systemId") REFERENCES "GlazingSystem"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SystemParameter" ADD CONSTRAINT "SystemParameter_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "SystemParamCategory"("id") ON DELETE SET NULL ON UPDATE CASCADE;
