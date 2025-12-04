-- CreateEnum
CREATE TYPE "IndexerType" AS ENUM ('DEPOSIT', 'WITHDRAWAL', 'POOL_STATUS');

-- CreateTable
CREATE TABLE "IndexerState" (
    "id" TEXT NOT NULL,
    "chainId" INTEGER NOT NULL,
    "indexerType" "IndexerType" NOT NULL,
    "lastBlock" INTEGER NOT NULL DEFAULT 0,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "IndexerState_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "IndexerState_chainId_indexerType_idx" ON "IndexerState"("chainId", "indexerType");

-- CreateIndex
CREATE UNIQUE INDEX "IndexerState_chainId_indexerType_key" ON "IndexerState"("chainId", "indexerType");
