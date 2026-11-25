ALTER TABLE "JvOrder" ADD COLUMN "creationKey" TEXT;
CREATE UNIQUE INDEX "JvOrder_authorId_creationKey_key" ON "JvOrder"("authorId", "creationKey");
CREATE TABLE "JvTemplate" ("id" TEXT NOT NULL, "name" TEXT NOT NULL, "authorId" TEXT NOT NULL, "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, "updatedAt" TIMESTAMP(3) NOT NULL, "draft" JSONB NOT NULL, CONSTRAINT "JvTemplate_pkey" PRIMARY KEY ("id"));
