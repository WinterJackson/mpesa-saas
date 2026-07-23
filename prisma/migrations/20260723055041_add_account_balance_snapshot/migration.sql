-- CreateTable
CREATE TABLE "AccountBalanceSnapshot" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "environment" TEXT NOT NULL DEFAULT 'sandbox',
    "balanceRaw" TEXT NOT NULL,
    "workingBalance" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AccountBalanceSnapshot_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "AccountBalanceSnapshot_organizationId_createdAt_idx" ON "AccountBalanceSnapshot"("organizationId", "createdAt" DESC);

-- AddForeignKey
ALTER TABLE "AccountBalanceSnapshot" ADD CONSTRAINT "AccountBalanceSnapshot_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

