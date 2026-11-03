-- AlterTable
ALTER TABLE "Deal" ADD COLUMN     "agentIsOfficial" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE "GlazingSystem" ADD COLUMN     "glassFormula" TEXT,
ADD COLUMN     "installFormula" TEXT;
