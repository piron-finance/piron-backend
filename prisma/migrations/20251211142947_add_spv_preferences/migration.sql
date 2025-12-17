-- CreateTable
CREATE TABLE "SPVPreference" (
    "id" TEXT NOT NULL,
    "spvAddress" TEXT NOT NULL,
    "poolId" TEXT,
    "investmentThresholdEnabled" BOOLEAN NOT NULL DEFAULT false,
    "minimumAmountToInvest" DECIMAL(18,6) NOT NULL DEFAULT 0,
    "notificationsEnabled" BOOLEAN NOT NULL DEFAULT true,
    "emailNotifications" BOOLEAN NOT NULL DEFAULT true,
    "pushNotifications" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SPVPreference_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "SPVPreference_poolId_key" ON "SPVPreference"("poolId");

-- CreateIndex
CREATE INDEX "SPVPreference_spvAddress_idx" ON "SPVPreference"("spvAddress");

-- CreateIndex
CREATE INDEX "SPVPreference_spvAddress_poolId_idx" ON "SPVPreference"("spvAddress", "poolId");

-- CreateIndex
CREATE INDEX "SPVPreference_investmentThresholdEnabled_idx" ON "SPVPreference"("investmentThresholdEnabled");

-- AddForeignKey
ALTER TABLE "SPVPreference" ADD CONSTRAINT "SPVPreference_poolId_fkey" FOREIGN KEY ("poolId") REFERENCES "Pool"("id") ON DELETE CASCADE ON UPDATE CASCADE;
