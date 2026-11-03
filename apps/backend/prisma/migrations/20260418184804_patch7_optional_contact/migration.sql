-- DropForeignKey
ALTER TABLE "Deal" DROP CONSTRAINT "Deal_contactId_fkey";

-- AlterTable
ALTER TABLE "Deal" ALTER COLUMN "contactId" DROP NOT NULL;

-- AddForeignKey
ALTER TABLE "Deal" ADD CONSTRAINT "Deal_contactId_fkey" FOREIGN KEY ("contactId") REFERENCES "Contact"("id") ON DELETE SET NULL ON UPDATE CASCADE;
