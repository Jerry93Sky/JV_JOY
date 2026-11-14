-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "LeadEventType" ADD VALUE 'TASK_CREATED';
ALTER TYPE "LeadEventType" ADD VALUE 'TASK_DONE';

-- AlterEnum
ALTER TYPE "ParamType" ADD VALUE 'TEXT';

-- AlterTable
ALTER TABLE "Deal" ADD COLUMN     "address" TEXT;

-- AlterTable
ALTER TABLE "Product" ADD COLUMN     "affectedByDiscount" BOOLEAN NOT NULL DEFAULT true;

-- AlterTable
ALTER TABLE "Service" ADD COLUMN     "affectedByDiscount" BOOLEAN NOT NULL DEFAULT true;

-- AlterTable
ALTER TABLE "SystemParameter" ADD COLUMN     "proposalPriority" INTEGER NOT NULL DEFAULT 0;

-- CreateTable
CREATE TABLE "LeadTask" (
    "id" TEXT NOT NULL,
    "dealId" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "scheduledAt" TIMESTAMP(3) NOT NULL,
    "doneAt" TIMESTAMP(3),
    "doneComment" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "LeadTask_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "LeadTask" ADD CONSTRAINT "LeadTask_dealId_fkey" FOREIGN KEY ("dealId") REFERENCES "Deal"("id") ON DELETE CASCADE ON UPDATE CASCADE;
