CREATE TYPE "JvProposalReviewStatus" AS ENUM ('IN_REVIEW', 'APPROVED', 'CHANGES_REQUESTED');

CREATE TABLE "JvProposalReviewEvent" (
    "proposalId" TEXT NOT NULL,
    "sequence" INTEGER NOT NULL,
    "status" "JvProposalReviewStatus" NOT NULL,
    "actorId" TEXT NOT NULL,
    "actorRole" "Role" NOT NULL,
    "comment" TEXT,
    "contentSha256" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "JvProposalReviewEvent_pkey" PRIMARY KEY ("proposalId", "sequence"),
    CONSTRAINT "JvProposalReviewEvent_proposalId_fkey" FOREIGN KEY ("proposalId")
        REFERENCES "JvProposalDraft"("id") ON DELETE CASCADE ON UPDATE CASCADE
);
