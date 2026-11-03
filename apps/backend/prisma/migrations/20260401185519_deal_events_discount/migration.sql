-- CreateEnum
CREATE TYPE "DealEventType" AS ENUM ('CREATED', 'STAGE_CHANGED', 'COMMENT_ADDED', 'ITEMS_UPDATED', 'ASSIGNEE_CHANGED', 'PAYMENT_RECEIVED');

-- AlterTable
ALTER TABLE "Company" ADD COLUMN     "manualDiscountPct" DECIMAL(5,2);

-- AlterTable
ALTER TABLE "Deal" ADD COLUMN     "manualDiscountPct" DECIMAL(5,2);

-- CreateTable
CREATE TABLE "DealEvent" (
    "id" TEXT NOT NULL,
    "dealId" TEXT NOT NULL,
    "type" "DealEventType" NOT NULL,
    "content" TEXT,
    "userId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "DealEvent_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "DealEvent" ADD CONSTRAINT "DealEvent_dealId_fkey" FOREIGN KEY ("dealId") REFERENCES "Deal"("id") ON DELETE CASCADE ON UPDATE CASCADE;
