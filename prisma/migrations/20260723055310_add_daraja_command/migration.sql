-- CreateTable
CREATE TABLE "DarajaCommand" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "environment" TEXT NOT NULL DEFAULT 'sandbox',
    "originatorConversationId" TEXT NOT NULL,
    "conversationId" TEXT,
    "targetReceipt" TEXT,
    "targetPayoutId" TEXT,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "resultCode" INTEGER,
    "resultDesc" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DarajaCommand_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "DarajaCommand_originatorConversationId_key" ON "DarajaCommand"("originatorConversationId");

-- CreateIndex
CREATE INDEX "DarajaCommand_organizationId_createdAt_idx" ON "DarajaCommand"("organizationId", "createdAt" DESC);

-- AddForeignKey
ALTER TABLE "DarajaCommand" ADD CONSTRAINT "DarajaCommand_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

