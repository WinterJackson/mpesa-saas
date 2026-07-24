-- AlterTable
ALTER TABLE "Invoice" ADD COLUMN     "etimsReference" TEXT,
ADD COLUMN     "vatAmountKes" INTEGER;

-- AlterTable
ALTER TABLE "Organization" ADD COLUMN     "billingContactEmail" TEXT,
ADD COLUMN     "billingMpesaPhone" TEXT,
ADD COLUMN     "kraPin" TEXT;

-- AlterTable
ALTER TABLE "Plan" DROP COLUMN "txCapMonthly",
DROP COLUMN "txFeeBps",
ADD COLUMN     "includedTransactions" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "overageFeeKes" INTEGER NOT NULL DEFAULT 0;

