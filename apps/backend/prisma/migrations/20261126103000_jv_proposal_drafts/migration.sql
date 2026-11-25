CREATE TABLE "JvProposalDraft" ("id" TEXT NOT NULL, "number" SERIAL NOT NULL, "orderId" TEXT NOT NULL, "snapshotId" TEXT NOT NULL, "authorId" TEXT NOT NULL, "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, "formatVersion" TEXT NOT NULL, "payload" JSONB NOT NULL, "contentSha256" TEXT NOT NULL, CONSTRAINT "JvProposalDraft_pkey" PRIMARY KEY ("id"));
CREATE UNIQUE INDEX "JvProposalDraft_number_key" ON "JvProposalDraft"("number");
CREATE INDEX "JvProposalDraft_orderId_createdAt_idx" ON "JvProposalDraft"("orderId", "createdAt");
ALTER TABLE "JvProposalDraft" ADD CONSTRAINT "JvProposalDraft_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "JvOrder"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "JvProposalDraft" ADD CONSTRAINT "JvProposalDraft_snapshotId_fkey" FOREIGN KEY ("snapshotId") REFERENCES "JvCalculationSnapshot"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
