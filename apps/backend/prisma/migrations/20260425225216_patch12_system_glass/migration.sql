-- CreateEnum
CREATE TYPE "GlassComplexity" AS ENUM ('PLAIN', 'CUTS', 'HOLES');

-- CreateTable
CREATE TABLE "SystemGlass" (
    "id" TEXT NOT NULL,
    "systemId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "widthFormula" TEXT NOT NULL,
    "heightFormula" TEXT NOT NULL,
    "quantityFormula" TEXT NOT NULL DEFAULT '1',
    "complexity" "GlassComplexity" NOT NULL DEFAULT 'PLAIN',
    "glassTypeId" TEXT,
    "order" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "SystemGlass_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "SystemGlass" ADD CONSTRAINT "SystemGlass_systemId_fkey" FOREIGN KEY ("systemId") REFERENCES "GlazingSystem"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SystemGlass" ADD CONSTRAINT "SystemGlass_glassTypeId_fkey" FOREIGN KEY ("glassTypeId") REFERENCES "GlassType"("id") ON DELETE SET NULL ON UPDATE CASCADE;
