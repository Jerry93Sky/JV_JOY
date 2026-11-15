CREATE TABLE "JvOrder" ("id" TEXT NOT NULL, "number" SERIAL NOT NULL, "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, "updatedAt" TIMESTAMP(3) NOT NULL, "authorId" TEXT NOT NULL, "version" INTEGER NOT NULL DEFAULT 1, "status" TEXT NOT NULL DEFAULT 'DRAFT', "profile" TEXT NOT NULL, "uiSchemaVersion" TEXT NOT NULL, "rulesVersion" TEXT NOT NULL, "contactId" TEXT, "dealId" TEXT, "draft" JSONB NOT NULL, CONSTRAINT "JvOrder_pkey" PRIMARY KEY ("id"));
CREATE UNIQUE INDEX "JvOrder_number_key" ON "JvOrder"("number");
CREATE TABLE "JvOrderRevision" ("id" TEXT NOT NULL, "orderId" TEXT NOT NULL, "version" INTEGER NOT NULL, "authorId" TEXT NOT NULL, "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, "snapshot" JSONB NOT NULL, CONSTRAINT "JvOrderRevision_pkey" PRIMARY KEY ("id"));
CREATE UNIQUE INDEX "JvOrderRevision_orderId_version_key" ON "JvOrderRevision"("orderId", "version");
CREATE INDEX "JvOrderRevision_orderId_createdAt_idx" ON "JvOrderRevision"("orderId", "createdAt");
ALTER TABLE "JvOrderRevision" ADD CONSTRAINT "JvOrderRevision_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "JvOrder"("id") ON DELETE CASCADE ON UPDATE CASCADE;
