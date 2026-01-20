-- CreateEnum
CREATE TYPE "InterestPayment" AS ENUM ('UPFRONT', 'AT_MATURITY');

-- CreateEnum
CREATE TYPE "LockedPositionStatus" AS ENUM ('ACTIVE', 'MATURED', 'REDEEMED', 'EARLY_EXIT', 'ROLLED_OVER');

-- AlterEnum
ALTER TYPE "IndexerType" ADD VALUE 'LOCKED_POSITION';

-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "NotificationType" ADD VALUE 'POSITION_CREATED';
ALTER TYPE "NotificationType" ADD VALUE 'POSITION_MATURED';
ALTER TYPE "NotificationType" ADD VALUE 'POSITION_REDEEMED';
ALTER TYPE "NotificationType" ADD VALUE 'EARLY_EXIT_PROCESSED';
ALTER TYPE "NotificationType" ADD VALUE 'INTEREST_PAID';
ALTER TYPE "NotificationType" ADD VALUE 'ROLLOVER_EXECUTED';
ALTER TYPE "NotificationType" ADD VALUE 'ROLLOVER_REMINDER';

-- AlterEnum
ALTER TYPE "PoolType" ADD VALUE 'LOCKED';

-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "TransactionType" ADD VALUE 'POSITION_CREATED';
ALTER TYPE "TransactionType" ADD VALUE 'POSITION_REDEEMED';
ALTER TYPE "TransactionType" ADD VALUE 'EARLY_EXIT';
ALTER TYPE "TransactionType" ADD VALUE 'ROLLOVER';
ALTER TYPE "TransactionType" ADD VALUE 'INTEREST_PAYMENT';

-- AlterEnum
ALTER TYPE "TreasuryTxType" ADD VALUE 'PENALTY_COLLECTION';

-- AlterTable
ALTER TABLE "PoolAnalytics" ADD COLUMN     "activePositions" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "totalInterestPaid" DECIMAL(18,6) NOT NULL DEFAULT 0,
ADD COLUMN     "totalPenaltiesCollected" DECIMAL(18,6) NOT NULL DEFAULT 0,
ADD COLUMN     "totalPrincipalLocked" DECIMAL(18,6) NOT NULL DEFAULT 0;

-- AlterTable
ALTER TABLE "Transaction" ADD COLUMN     "lockedPositionId" INTEGER;

-- CreateTable
CREATE TABLE "LockTier" (
    "id" TEXT NOT NULL,
    "poolId" TEXT NOT NULL,
    "tierIndex" INTEGER NOT NULL,
    "durationDays" INTEGER NOT NULL,
    "apyBps" INTEGER NOT NULL,
    "earlyExitPenaltyBps" INTEGER NOT NULL,
    "minDeposit" DECIMAL(18,6) NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "LockTier_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LockedPosition" (
    "id" TEXT NOT NULL,
    "positionId" INTEGER NOT NULL,
    "userId" TEXT NOT NULL,
    "poolId" TEXT NOT NULL,
    "tierId" TEXT NOT NULL,
    "principal" DECIMAL(18,6) NOT NULL,
    "investedAmount" DECIMAL(18,6) NOT NULL,
    "interest" DECIMAL(18,6) NOT NULL,
    "interestPayment" "InterestPayment" NOT NULL,
    "expectedMaturityPayout" DECIMAL(18,6) NOT NULL,
    "depositTime" TIMESTAMP(3) NOT NULL,
    "lockEndTime" TIMESTAMP(3) NOT NULL,
    "status" "LockedPositionStatus" NOT NULL DEFAULT 'ACTIVE',
    "autoRollover" BOOLEAN NOT NULL DEFAULT false,
    "depositTxHash" TEXT,
    "actualPayout" DECIMAL(18,6),
    "penaltyPaid" DECIMAL(18,6),
    "proRataInterest" DECIMAL(18,6),
    "exitTime" TIMESTAMP(3),
    "exitTxHash" TEXT,
    "rolledFromPositionId" INTEGER,
    "rolledToPositionId" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "LockedPosition_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "LockTier_poolId_isActive_idx" ON "LockTier"("poolId", "isActive");

-- CreateIndex
CREATE UNIQUE INDEX "LockTier_poolId_tierIndex_key" ON "LockTier"("poolId", "tierIndex");

-- CreateIndex
CREATE UNIQUE INDEX "LockedPosition_positionId_key" ON "LockedPosition"("positionId");

-- CreateIndex
CREATE INDEX "LockedPosition_userId_status_idx" ON "LockedPosition"("userId", "status");

-- CreateIndex
CREATE INDEX "LockedPosition_poolId_status_idx" ON "LockedPosition"("poolId", "status");

-- CreateIndex
CREATE INDEX "LockedPosition_lockEndTime_status_idx" ON "LockedPosition"("lockEndTime", "status");

-- CreateIndex
CREATE INDEX "LockedPosition_positionId_idx" ON "LockedPosition"("positionId");

-- CreateIndex
CREATE INDEX "LockedPosition_depositTxHash_idx" ON "LockedPosition"("depositTxHash");

-- CreateIndex
CREATE INDEX "Transaction_lockedPositionId_idx" ON "Transaction"("lockedPositionId");

-- AddForeignKey
ALTER TABLE "LockTier" ADD CONSTRAINT "LockTier_poolId_fkey" FOREIGN KEY ("poolId") REFERENCES "Pool"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LockedPosition" ADD CONSTRAINT "LockedPosition_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LockedPosition" ADD CONSTRAINT "LockedPosition_poolId_fkey" FOREIGN KEY ("poolId") REFERENCES "Pool"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LockedPosition" ADD CONSTRAINT "LockedPosition_tierId_fkey" FOREIGN KEY ("tierId") REFERENCES "LockTier"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
