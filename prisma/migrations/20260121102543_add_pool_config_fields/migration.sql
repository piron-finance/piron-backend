-- AlterTable
ALTER TABLE "Pool" ADD COLUMN     "couponDates" INTEGER[],
ADD COLUMN     "couponRates" INTEGER[],
ADD COLUMN     "minimumFundingThreshold" INTEGER,
ADD COLUMN     "withdrawalFeeBps" INTEGER;
