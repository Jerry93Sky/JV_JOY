CREATE TABLE "JvInvoiceDraft" (
    "id" TEXT NOT NULL,
    "proposalId" TEXT NOT NULL,
    "dealId" TEXT NOT NULL,
    "authorId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "version" INTEGER NOT NULL DEFAULT 1,
    "status" TEXT NOT NULL DEFAULT 'DRAFT',
    "formatVersion" TEXT NOT NULL,
    "source" JSONB NOT NULL,
    "contentSha256" TEXT NOT NULL,
    "details" JSONB NOT NULL,

    CONSTRAINT "JvInvoiceDraft_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "JvInvoiceDraft_proposalId_fkey" FOREIGN KEY ("proposalId")
        REFERENCES "JvProposalIssue"("proposalId") ON DELETE RESTRICT ON UPDATE CASCADE
);

CREATE UNIQUE INDEX "JvInvoiceDraft_proposalId_key" ON "JvInvoiceDraft"("proposalId");
CREATE INDEX "JvInvoiceDraft_dealId_createdAt_id_idx" ON "JvInvoiceDraft"("dealId", "createdAt", "id");
