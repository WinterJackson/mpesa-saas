-- AlterTable
ALTER TABLE "OrganizationDarajaCredential" ADD COLUMN     "initiatorName" TEXT,
ADD COLUMN     "initiatorNameLive" TEXT,
ADD COLUMN     "initiatorPasswordEncrypted" TEXT,
ADD COLUMN     "initiatorPasswordLiveEncrypted" TEXT;
