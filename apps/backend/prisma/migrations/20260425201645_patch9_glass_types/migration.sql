-- CreateTable
CREATE TABLE "GlassType" (
    "id" TEXT NOT NULL,
    "thickness" INTEGER NOT NULL,
    "coating" TEXT NOT NULL,
    "glassKind" TEXT NOT NULL,
    "pricePerSqm" DECIMAL(12,2) NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "GlassType_pkey" PRIMARY KEY ("id")
);
