/*
  Warnings:

  - Added the required column `updatedAt` to the `Subscription` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "Subscription" ADD COLUMN "createdAt" TIMESTAMP(3) DEFAULT CURRENT_TIMESTAMP;
ALTER TABLE "Subscription" ADD COLUMN "updatedAt" TIMESTAMP(3) DEFAULT CURRENT_TIMESTAMP;

-- Backfill createdAt from Organization
UPDATE "Subscription"
SET "createdAt" = "Organization"."createdAt"
FROM "Organization"
WHERE "Subscription"."organizationId" = "Organization"."id";

-- Make columns NOT NULL
ALTER TABLE "Subscription" ALTER COLUMN "createdAt" SET NOT NULL;
ALTER TABLE "Subscription" ALTER COLUMN "updatedAt" SET NOT NULL;
