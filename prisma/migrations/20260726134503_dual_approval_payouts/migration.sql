◇ injected env (37) from .env.local // tip: ⌘ override existing { override: true }
-- AlterTable
ALTER TABLE "Organization" ADD COLUMN     "payoutApprovalThresholdKes" INTEGER;

-- AlterTable
ALTER TABLE "Payout" ADD COLUMN     "approvalStatus" TEXT NOT NULL DEFAULT 'not_required',
ADD COLUMN     "approvedAt" TIMESTAMP(3),
ADD COLUMN     "approvedByUserId" TEXT,
ADD COLUMN     "initiatedByUserId" TEXT,
ADD COLUMN     "rejectedAt" TIMESTAMP(3),
ADD COLUMN     "rejectedByUserId" TEXT,
ADD COLUMN     "rejectionReason" TEXT,
ADD COLUMN     "requiresApproval" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE "Subscription" ALTER COLUMN "updatedAt" DROP DEFAULT;

