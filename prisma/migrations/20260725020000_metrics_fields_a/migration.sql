-- Payment Links: conversion + hosted-checkout customization
ALTER TABLE "PaymentLink" ADD COLUMN "viewCount" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "PaymentLink" ADD COLUMN "redirectUrl" TEXT;
ALTER TABLE "PaymentLink" ADD COLUMN "successMessage" TEXT;
ALTER TABLE "PaymentLink" ADD COLUMN "collectContact" BOOLEAN NOT NULL DEFAULT false;

-- Transactions: merchant-only internal note (never customer-facing)
ALTER TABLE "Transaction" ADD COLUMN "internalNote" TEXT;
