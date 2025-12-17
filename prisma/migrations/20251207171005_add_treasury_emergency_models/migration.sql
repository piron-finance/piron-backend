-- CreateEnum
CREATE TYPE "TreasuryTxType" AS ENUM ('FEE_COLLECTION', 'WITHDRAWAL', 'PROTOCOL_REVENUE');

-- CreateTable
CREATE TABLE "TreasuryTransaction" (
    "id" TEXT NOT NULL,
    "type" "TreasuryTxType" NOT NULL,
    "asset" TEXT NOT NULL,
    "amount" DECIMAL(18,6) NOT NULL,
    "recipient" TEXT,
    "txHash" TEXT,
    "executedBy" TEXT NOT NULL,
    "reason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TreasuryTransaction_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EmergencyAction" (
    "id" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "reason" TEXT NOT NULL,
    "poolAddress" TEXT,
    "executedBy" TEXT NOT NULL,
    "txHash" TEXT,
    "resolvedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "EmergencyAction_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "TreasuryTransaction_type_createdAt_idx" ON "TreasuryTransaction"("type", "createdAt");

-- CreateIndex
CREATE INDEX "TreasuryTransaction_asset_idx" ON "TreasuryTransaction"("asset");

-- CreateIndex
CREATE INDEX "EmergencyAction_createdAt_idx" ON "EmergencyAction"("createdAt");

-- CreateIndex
CREATE INDEX "EmergencyAction_poolAddress_idx" ON "EmergencyAction"("poolAddress");
