-- CreateTable
CREATE TABLE "DealSystem" (
    "id" TEXT NOT NULL,
    "dealId" TEXT NOT NULL,
    "systemId" TEXT NOT NULL,
    "systemName" TEXT NOT NULL,
    "inputParams" JSONB NOT NULL,
    "calcParams" JSONB,

    CONSTRAINT "DealSystem_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "DealSystem" ADD CONSTRAINT "DealSystem_dealId_fkey" FOREIGN KEY ("dealId") REFERENCES "Deal"("id") ON DELETE CASCADE ON UPDATE CASCADE;
