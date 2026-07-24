-- PaySwift subscription billing via M-Pesa STK + dunning (Stage D). Additive.
-- Invoice gains STK-collection + dunning state; Subscription gains a grace window.

-- AlterTable
ALTER TABLE "Invoice" ADD COLUMN     "attemptCount" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "failureReason" TEXT,
ADD COLUMN     "lastAttemptAt" TIMESTAMP(3),
ADD COLUMN     "mpesaCheckoutRequestId" TEXT,
ADD COLUMN     "mpesaReceipt" TEXT,
ADD COLUMN     "paidAt" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "Subscription" ADD COLUMN     "gracePeriodEnd" TIMESTAMP(3);

-- CreateIndex
CREATE UNIQUE INDEX "Invoice_mpesaCheckoutRequestId_key" ON "Invoice"("mpesaCheckoutRequestId");

-- CreateIndex
CREATE INDEX "Invoice_status_idx" ON "Invoice"("status");
