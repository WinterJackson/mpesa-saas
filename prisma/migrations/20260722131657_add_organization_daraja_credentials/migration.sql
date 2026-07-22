-- CreateTable
CREATE TABLE "OrganizationDarajaCredential" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "consumerKeyEncrypted" TEXT NOT NULL,
    "consumerSecretEncrypted" TEXT NOT NULL,
    "shortcode" TEXT NOT NULL,
    "passkeyEncrypted" TEXT NOT NULL,
    "callbackUrl" TEXT NOT NULL,
    "isPooledSandbox" BOOLEAN NOT NULL DEFAULT true,
    "consumerKeyLiveEncrypted" TEXT,
    "consumerSecretLiveEncrypted" TEXT,
    "shortcodeLive" TEXT,
    "passkeyLiveEncrypted" TEXT,
    "callbackUrlLive" TEXT,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "OrganizationDarajaCredential_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "OrganizationDarajaCredential_organizationId_key" ON "OrganizationDarajaCredential"("organizationId");

-- AddForeignKey
ALTER TABLE "OrganizationDarajaCredential" ADD CONSTRAINT "OrganizationDarajaCredential_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
