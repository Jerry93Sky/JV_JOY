ALTER TYPE "Role" ADD VALUE 'ENGINEER' BEFORE 'USER';

CREATE TABLE "JvProposalIssue" (
    "proposalId" TEXT NOT NULL,
    "number" SERIAL NOT NULL,
    "issuedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "issuerId" TEXT NOT NULL,
    "issuerRole" "Role" NOT NULL,
    "formatVersion" TEXT NOT NULL,
    "proposalSha256" TEXT NOT NULL,
    "payload" JSONB NOT NULL,
    "contentSha256" TEXT NOT NULL,

    CONSTRAINT "JvProposalIssue_pkey" PRIMARY KEY ("proposalId"),
    CONSTRAINT "JvProposalIssue_proposalId_fkey" FOREIGN KEY ("proposalId")
        REFERENCES "JvProposalDraft"("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

CREATE UNIQUE INDEX "JvProposalIssue_number_key" ON "JvProposalIssue"("number");
