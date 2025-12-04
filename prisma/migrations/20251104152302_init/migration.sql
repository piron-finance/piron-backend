-- CreateEnum
CREATE TYPE "UserType" AS ENUM ('REGULAR_USER', 'ADMIN', 'SPV_MANAGER', 'OPERATOR', 'VERIFIER', 'SUPER_ADMIN');

-- CreateEnum
CREATE TYPE "KYCStatus" AS ENUM ('NOT_STARTED', 'PENDING', 'APPROVED', 'REJECTED', 'EXPIRED');

-- CreateEnum
CREATE TYPE "UserRegion" AS ENUM ('NIGERIA', 'GHANA', 'KENYA', 'SOUTH_AFRICA', 'UNITED_KINGDOM', 'UNITED_STATES', 'CANADA', 'EUROPE', 'OTHER');

-- CreateEnum
CREATE TYPE "RiskTolerance" AS ENUM ('LOW', 'MEDIUM', 'HIGH');

-- CreateEnum
CREATE TYPE "NetWorthRange" AS ENUM ('UNDER_10K', 'FROM_10K_TO_50K', 'FROM_50K_TO_100K', 'FROM_100K_TO_500K', 'FROM_500K_TO_1M', 'OVER_1M');

-- CreateEnum
CREATE TYPE "DocumentType" AS ENUM ('GOVERNMENT_ID', 'PASSPORT', 'DRIVERS_LICENSE', 'PROOF_OF_ADDRESS', 'BVN', 'GHANA_CARD', 'TAX_ID', 'INCORPORATION_CERT', 'OTHER');

-- CreateEnum
CREATE TYPE "DocumentStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED', 'EXPIRED');

-- CreateEnum
CREATE TYPE "PoolType" AS ENUM ('SINGLE_ASSET', 'STABLE_YIELD');

-- CreateEnum
CREATE TYPE "PoolStatus" AS ENUM ('FUNDING', 'FILLED', 'PENDING_INVESTMENT', 'INVESTED', 'MATURED', 'WITHDRAWN', 'EMERGENCY', 'CANCELLED');

-- CreateEnum
CREATE TYPE "InstrumentType" AS ENUM ('DISCOUNTED', 'INTEREST_BEARING');

-- CreateEnum
CREATE TYPE "TransactionType" AS ENUM ('DEPOSIT', 'WITHDRAWAL', 'COUPON_CLAIM', 'MATURITY_CLAIM', 'REFUND', 'EMERGENCY_WITHDRAWAL', 'TRANSFER');

-- CreateEnum
CREATE TYPE "TxStatus" AS ENUM ('PENDING', 'CONFIRMED', 'FAILED');

-- CreateEnum
CREATE TYPE "WithdrawalStatus" AS ENUM ('QUEUED', 'PROCESSING', 'COMPLETED', 'FAILED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "SPVOpType" AS ENUM ('WITHDRAW_FOR_INVESTMENT', 'PURCHASE_INSTRUMENT', 'RECORD_MATURITY', 'PAY_COUPON', 'RETURN_FUNDS', 'LIQUIDATE_INSTRUMENT');

-- CreateEnum
CREATE TYPE "OperationStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED', 'COMPLETED', 'FAILED');

-- CreateEnum
CREATE TYPE "DistributionStatus" AS ENUM ('RECEIVED', 'DISTRIBUTED', 'CLAIMED');

-- CreateEnum
CREATE TYPE "NotificationType" AS ENUM ('DEPOSIT_CONFIRMED', 'WITHDRAWAL_COMPLETED', 'COUPON_AVAILABLE', 'COUPON_CLAIMED', 'POOL_MATURED', 'POOL_FILLED', 'POOL_EMERGENCY', 'KYC_APPROVED', 'KYC_REJECTED', 'WITHDRAWAL_QUEUED', 'WITHDRAWAL_PROCESSED', 'EMERGENCY_ALERT', 'FIAT_DEPOSIT_COMPLETED', 'FIAT_WITHDRAWAL_COMPLETED', 'SYSTEM_ANNOUNCEMENT');

-- CreateEnum
CREATE TYPE "NotificationPriority" AS ENUM ('LOW', 'NORMAL', 'HIGH', 'URGENT');

-- CreateEnum
CREATE TYPE "FiatTxType" AS ENUM ('DEPOSIT', 'WITHDRAWAL');

-- CreateEnum
CREATE TYPE "FiatTxStatus" AS ENUM ('PENDING', 'PROCESSING', 'COMPLETED', 'FAILED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "IndexerStatus" AS ENUM ('STOPPED', 'RUNNING', 'SYNCING', 'ERROR');

-- CreateEnum
CREATE TYPE "ComplianceAlertType" AS ENUM ('LARGE_TRANSACTION', 'SUSPICIOUS_ACTIVITY', 'RAPID_DEPOSITS', 'RAPID_WITHDRAWALS', 'KYC_MISMATCH', 'SANCTIONS_LIST', 'PEP_DETECTED');

-- CreateEnum
CREATE TYPE "Severity" AS ENUM ('LOW', 'MEDIUM', 'HIGH', 'CRITICAL');

-- CreateEnum
CREATE TYPE "AlertStatus" AS ENUM ('OPEN', 'INVESTIGATING', 'RESOLVED', 'FALSE_POSITIVE');

-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "walletAddress" TEXT NOT NULL,
    "email" TEXT,
    "userType" "UserType" NOT NULL DEFAULT 'REGULAR_USER',
    "kycStatus" "KYCStatus" NOT NULL DEFAULT 'NOT_STARTED',
    "region" "UserRegion",
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "isBanned" BOOLEAN NOT NULL DEFAULT false,
    "banReason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "lastLoginAt" TIMESTAMP(3),

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "UserProfile" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "firstName" TEXT,
    "lastName" TEXT,
    "dateOfBirth" TIMESTAMP(3),
    "phoneNumber" TEXT,
    "country" TEXT,
    "city" TEXT,
    "state" TEXT,
    "postalCode" TEXT,
    "addressLine1" TEXT,
    "addressLine2" TEXT,
    "riskTolerance" "RiskTolerance",
    "investmentGoals" JSONB,
    "preferredAssets" TEXT[],
    "netWorth" "NetWorthRange",
    "occupation" TEXT,
    "emailNotifications" BOOLEAN NOT NULL DEFAULT true,
    "smsNotifications" BOOLEAN NOT NULL DEFAULT false,
    "marketingEmails" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "UserProfile_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "KYCDocument" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "documentType" "DocumentType" NOT NULL,
    "documentUrl" TEXT NOT NULL,
    "documentHash" TEXT,
    "status" "DocumentStatus" NOT NULL DEFAULT 'PENDING',
    "rejectionReason" TEXT,
    "verifiedBy" TEXT,
    "verifiedAt" TIMESTAMP(3),
    "expiresAt" TIMESTAMP(3),
    "fileSize" INTEGER,
    "mimeType" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "KYCDocument_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BankAccount" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "accountName" TEXT NOT NULL,
    "accountNumber" TEXT NOT NULL,
    "bankName" TEXT NOT NULL,
    "bankCode" TEXT NOT NULL,
    "currency" TEXT NOT NULL,
    "isPrimary" BOOLEAN NOT NULL DEFAULT false,
    "isVerified" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "BankAccount_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Network" (
    "id" TEXT NOT NULL,
    "chainId" INTEGER NOT NULL,
    "name" TEXT NOT NULL,
    "rpcUrl" TEXT NOT NULL,
    "explorerUrl" TEXT NOT NULL,
    "isTestnet" BOOLEAN NOT NULL DEFAULT false,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "lastIndexedBlock" BIGINT NOT NULL DEFAULT 0,
    "indexerStatus" "IndexerStatus" NOT NULL DEFAULT 'STOPPED',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Network_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Asset" (
    "id" TEXT NOT NULL,
    "chainId" INTEGER NOT NULL,
    "address" TEXT NOT NULL,
    "symbol" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "decimals" INTEGER NOT NULL,
    "country" TEXT,
    "region" TEXT,
    "isStablecoin" BOOLEAN NOT NULL DEFAULT true,
    "isApproved" BOOLEAN NOT NULL DEFAULT true,
    "logoUrl" TEXT,
    "currentPrice" DECIMAL(18,6) NOT NULL DEFAULT 1.0,
    "lastPriceUpdate" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Asset_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Pool" (
    "id" TEXT NOT NULL,
    "chainId" INTEGER NOT NULL,
    "poolAddress" TEXT NOT NULL,
    "poolType" "PoolType" NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "managerAddress" TEXT NOT NULL,
    "escrowAddress" TEXT NOT NULL,
    "assetAddress" TEXT NOT NULL,
    "assetSymbol" TEXT NOT NULL,
    "assetDecimals" INTEGER NOT NULL,
    "minInvestment" DECIMAL(18,6) NOT NULL,
    "instrumentType" "InstrumentType",
    "targetRaise" DECIMAL(18,6),
    "epochEndTime" TIMESTAMP(3),
    "maturityDate" TIMESTAMP(3),
    "discountRate" INTEGER,
    "status" "PoolStatus" NOT NULL DEFAULT 'FUNDING',
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "isFeatured" BOOLEAN NOT NULL DEFAULT false,
    "isPaused" BOOLEAN NOT NULL DEFAULT false,
    "country" TEXT,
    "region" TEXT,
    "issuer" TEXT,
    "issuerLogo" TEXT,
    "securityType" TEXT,
    "cusip" TEXT,
    "isin" TEXT,
    "prospectusUrl" TEXT,
    "riskRating" TEXT,
    "minimumKYCLevel" "KYCStatus" NOT NULL DEFAULT 'APPROVED',
    "displayOrder" INTEGER,
    "tags" TEXT[],
    "createdOnChain" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Pool_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PoolPosition" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "poolId" TEXT NOT NULL,
    "totalShares" DECIMAL(18,6) NOT NULL DEFAULT 0,
    "totalDeposited" DECIMAL(18,6) NOT NULL DEFAULT 0,
    "totalWithdrawn" DECIMAL(18,6) NOT NULL DEFAULT 0,
    "couponsClaimed" DECIMAL(18,6) NOT NULL DEFAULT 0,
    "pendingRefund" DECIMAL(18,6) NOT NULL DEFAULT 0,
    "discountAccrued" DECIMAL(18,6) NOT NULL DEFAULT 0,
    "lastCouponClaimTime" TIMESTAMP(3),
    "firstDepositTime" TIMESTAMP(3),
    "lastDepositTime" TIMESTAMP(3),
    "lastWithdrawalTime" TIMESTAMP(3),
    "currentValue" DECIMAL(18,6) NOT NULL DEFAULT 0,
    "realizedReturn" DECIMAL(18,6) NOT NULL DEFAULT 0,
    "unrealizedReturn" DECIMAL(18,6) NOT NULL DEFAULT 0,
    "totalReturn" DECIMAL(18,6) NOT NULL DEFAULT 0,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PoolPosition_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Transaction" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "poolId" TEXT,
    "type" "TransactionType" NOT NULL,
    "txHash" TEXT NOT NULL,
    "chainId" INTEGER NOT NULL,
    "amount" DECIMAL(18,6) NOT NULL,
    "shares" DECIMAL(18,6),
    "fee" DECIMAL(18,6),
    "from" TEXT,
    "to" TEXT,
    "blockNumber" BIGINT NOT NULL,
    "blockHash" TEXT,
    "gasUsed" BIGINT,
    "gasPrice" BIGINT,
    "status" "TxStatus" NOT NULL DEFAULT 'PENDING',
    "failureReason" TEXT,
    "timestamp" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Transaction_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Instrument" (
    "id" TEXT NOT NULL,
    "poolId" TEXT NOT NULL,
    "instrumentId" INTEGER NOT NULL,
    "instrumentType" "InstrumentType" NOT NULL,
    "purchasePrice" DECIMAL(18,6) NOT NULL,
    "faceValue" DECIMAL(18,6) NOT NULL,
    "purchaseDate" TIMESTAMP(3) NOT NULL,
    "maturityDate" TIMESTAMP(3) NOT NULL,
    "annualCouponRate" INTEGER,
    "couponFrequency" INTEGER,
    "nextCouponDueDate" TIMESTAMP(3),
    "couponsPaid" INTEGER NOT NULL DEFAULT 0,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "maturedAt" TIMESTAMP(3),
    "realizedYield" DECIMAL(18,6),
    "issuer" TEXT,
    "cusip" TEXT,
    "isin" TEXT,
    "documentUrl" TEXT,
    "rating" TEXT,
    "purchasedBy" TEXT,
    "proofHash" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Instrument_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CouponPayment" (
    "id" TEXT NOT NULL,
    "poolId" TEXT NOT NULL,
    "instrumentId" TEXT,
    "amount" DECIMAL(18,6) NOT NULL,
    "couponNumber" INTEGER NOT NULL,
    "dueDate" TIMESTAMP(3) NOT NULL,
    "paidDate" TIMESTAMP(3) NOT NULL,
    "totalDistributed" DECIMAL(18,6) NOT NULL DEFAULT 0,
    "totalClaimed" DECIMAL(18,6) NOT NULL DEFAULT 0,
    "distributionStatus" "DistributionStatus" NOT NULL DEFAULT 'RECEIVED',
    "receivedBy" TEXT,
    "txHash" TEXT,
    "proofHash" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CouponPayment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WithdrawalRequest" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "poolId" TEXT NOT NULL,
    "requestId" INTEGER NOT NULL,
    "shares" DECIMAL(18,6) NOT NULL,
    "estimatedValue" DECIMAL(18,6) NOT NULL,
    "status" "WithdrawalStatus" NOT NULL DEFAULT 'QUEUED',
    "requestTime" TIMESTAMP(3) NOT NULL,
    "processedTime" TIMESTAMP(3),
    "actualValue" DECIMAL(18,6),
    "processedBy" TEXT,
    "txHash" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "WithdrawalRequest_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SPVOperation" (
    "id" TEXT NOT NULL,
    "poolId" TEXT NOT NULL,
    "operationType" "SPVOpType" NOT NULL,
    "amount" DECIMAL(18,6) NOT NULL,
    "txHash" TEXT,
    "transferId" TEXT,
    "status" "OperationStatus" NOT NULL DEFAULT 'PENDING',
    "initiatedBy" TEXT NOT NULL,
    "approvedBy" TEXT,
    "notes" TEXT,
    "proofHash" TEXT,
    "initiatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "approvedAt" TIMESTAMP(3),
    "completedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SPVOperation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PoolAnalytics" (
    "id" TEXT NOT NULL,
    "poolId" TEXT NOT NULL,
    "totalValueLocked" DECIMAL(18,6) NOT NULL DEFAULT 0,
    "totalShares" DECIMAL(18,6) NOT NULL DEFAULT 0,
    "navPerShare" DECIMAL(18,6),
    "uniqueInvestors" INTEGER NOT NULL DEFAULT 0,
    "activeInvestors" INTEGER NOT NULL DEFAULT 0,
    "totalDeposits" DECIMAL(18,6) NOT NULL DEFAULT 0,
    "totalWithdrawals" DECIMAL(18,6) NOT NULL DEFAULT 0,
    "netFlow" DECIMAL(18,6) NOT NULL DEFAULT 0,
    "apy" DECIMAL(8,4),
    "totalReturn" DECIMAL(18,6),
    "volume24h" DECIMAL(18,6) NOT NULL DEFAULT 0,
    "depositors24h" INTEGER NOT NULL DEFAULT 0,
    "withdrawals24h" INTEGER NOT NULL DEFAULT 0,
    "volume7d" DECIMAL(18,6) NOT NULL DEFAULT 0,
    "newInvestors7d" INTEGER NOT NULL DEFAULT 0,
    "volume30d" DECIMAL(18,6) NOT NULL DEFAULT 0,
    "newInvestors30d" INTEGER NOT NULL DEFAULT 0,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PoolAnalytics_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PoolSnapshot" (
    "id" TEXT NOT NULL,
    "poolId" TEXT NOT NULL,
    "timestamp" TIMESTAMP(3) NOT NULL,
    "totalValueLocked" DECIMAL(18,6) NOT NULL,
    "totalShares" DECIMAL(18,6) NOT NULL,
    "navPerShare" DECIMAL(18,6),
    "uniqueInvestors" INTEGER NOT NULL,
    "volume24h" DECIMAL(18,6) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PoolSnapshot_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "NAVHistory" (
    "id" TEXT NOT NULL,
    "poolId" TEXT NOT NULL,
    "navPerShare" DECIMAL(18,6) NOT NULL,
    "totalNAV" DECIMAL(18,6) NOT NULL,
    "totalShares" DECIMAL(18,6) NOT NULL,
    "cashReserves" DECIMAL(18,6) NOT NULL,
    "instrumentValue" DECIMAL(18,6) NOT NULL,
    "accruedFees" DECIMAL(18,6) NOT NULL,
    "timestamp" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "NAVHistory_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PlatformMetrics" (
    "id" TEXT NOT NULL,
    "date" TIMESTAMP(3) NOT NULL,
    "totalValueLocked" DECIMAL(18,6) NOT NULL,
    "tvlChange24h" DECIMAL(18,6) NOT NULL,
    "totalUsers" INTEGER NOT NULL,
    "activeUsers" INTEGER NOT NULL,
    "newUsers" INTEGER NOT NULL,
    "totalPools" INTEGER NOT NULL,
    "activePools" INTEGER NOT NULL,
    "newPools" INTEGER NOT NULL,
    "totalTransactions" INTEGER NOT NULL,
    "volume24h" DECIMAL(18,6) NOT NULL,
    "protocolRevenue" DECIMAL(18,6) NOT NULL,
    "transactionFees" DECIMAL(18,6) NOT NULL,
    "expenseRatios" DECIMAL(18,6) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PlatformMetrics_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Notification" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "type" "NotificationType" NOT NULL,
    "title" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "isRead" BOOLEAN NOT NULL DEFAULT false,
    "readAt" TIMESTAMP(3),
    "poolId" TEXT,
    "txHash" TEXT,
    "metadata" JSONB,
    "priority" "NotificationPriority" NOT NULL DEFAULT 'NORMAL',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Notification_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FiatTransaction" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "type" "FiatTxType" NOT NULL,
    "reference" TEXT NOT NULL,
    "fiatAmount" DECIMAL(18,2) NOT NULL,
    "fiatCurrency" TEXT NOT NULL,
    "cryptoAmount" DECIMAL(18,6),
    "cryptoAsset" TEXT,
    "exchangeRate" DECIMAL(18,6),
    "provider" TEXT NOT NULL DEFAULT 'BLOCKRADAR',
    "providerTxId" TEXT,
    "providerFee" DECIMAL(18,2),
    "bankAccountId" TEXT,
    "status" "FiatTxStatus" NOT NULL DEFAULT 'PENDING',
    "failureReason" TEXT,
    "metadata" JSONB,
    "initiatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "FiatTransaction_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AuditLog" (
    "id" TEXT NOT NULL,
    "userId" TEXT,
    "action" TEXT NOT NULL,
    "entity" TEXT NOT NULL,
    "entityId" TEXT NOT NULL,
    "changes" JSONB,
    "ipAddress" TEXT,
    "userAgent" TEXT,
    "success" BOOLEAN NOT NULL DEFAULT true,
    "errorMessage" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AuditLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ComplianceAlert" (
    "id" TEXT NOT NULL,
    "userId" TEXT,
    "alertType" "ComplianceAlertType" NOT NULL,
    "severity" "Severity" NOT NULL,
    "description" TEXT NOT NULL,
    "metadata" JSONB,
    "status" "AlertStatus" NOT NULL DEFAULT 'OPEN',
    "resolvedBy" TEXT,
    "resolvedAt" TIMESTAMP(3),
    "resolution" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ComplianceAlert_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_walletAddress_key" ON "User"("walletAddress");

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE INDEX "User_walletAddress_idx" ON "User"("walletAddress");

-- CreateIndex
CREATE INDEX "User_email_idx" ON "User"("email");

-- CreateIndex
CREATE INDEX "User_userType_isActive_idx" ON "User"("userType", "isActive");

-- CreateIndex
CREATE INDEX "User_kycStatus_idx" ON "User"("kycStatus");

-- CreateIndex
CREATE UNIQUE INDEX "UserProfile_userId_key" ON "UserProfile"("userId");

-- CreateIndex
CREATE INDEX "UserProfile_country_idx" ON "UserProfile"("country");

-- CreateIndex
CREATE INDEX "KYCDocument_userId_status_idx" ON "KYCDocument"("userId", "status");

-- CreateIndex
CREATE INDEX "KYCDocument_status_createdAt_idx" ON "KYCDocument"("status", "createdAt");

-- CreateIndex
CREATE INDEX "BankAccount_userId_idx" ON "BankAccount"("userId");

-- CreateIndex
CREATE INDEX "BankAccount_userId_isPrimary_idx" ON "BankAccount"("userId", "isPrimary");

-- CreateIndex
CREATE UNIQUE INDEX "Network_chainId_key" ON "Network"("chainId");

-- CreateIndex
CREATE UNIQUE INDEX "Network_name_key" ON "Network"("name");

-- CreateIndex
CREATE INDEX "Network_isActive_idx" ON "Network"("isActive");

-- CreateIndex
CREATE INDEX "Asset_symbol_isApproved_idx" ON "Asset"("symbol", "isApproved");

-- CreateIndex
CREATE INDEX "Asset_chainId_isApproved_idx" ON "Asset"("chainId", "isApproved");

-- CreateIndex
CREATE UNIQUE INDEX "Asset_chainId_address_key" ON "Asset"("chainId", "address");

-- CreateIndex
CREATE INDEX "Pool_poolType_status_idx" ON "Pool"("poolType", "status");

-- CreateIndex
CREATE INDEX "Pool_isActive_isFeatured_idx" ON "Pool"("isActive", "isFeatured");

-- CreateIndex
CREATE INDEX "Pool_chainId_status_idx" ON "Pool"("chainId", "status");

-- CreateIndex
CREATE INDEX "Pool_country_region_idx" ON "Pool"("country", "region");

-- CreateIndex
CREATE INDEX "Pool_status_maturityDate_idx" ON "Pool"("status", "maturityDate");

-- CreateIndex
CREATE UNIQUE INDEX "Pool_chainId_poolAddress_key" ON "Pool"("chainId", "poolAddress");

-- CreateIndex
CREATE INDEX "PoolPosition_userId_idx" ON "PoolPosition"("userId");

-- CreateIndex
CREATE INDEX "PoolPosition_poolId_idx" ON "PoolPosition"("poolId");

-- CreateIndex
CREATE INDEX "PoolPosition_poolId_isActive_idx" ON "PoolPosition"("poolId", "isActive");

-- CreateIndex
CREATE INDEX "PoolPosition_userId_isActive_currentValue_idx" ON "PoolPosition"("userId", "isActive", "currentValue");

-- CreateIndex
CREATE UNIQUE INDEX "PoolPosition_userId_poolId_key" ON "PoolPosition"("userId", "poolId");

-- CreateIndex
CREATE UNIQUE INDEX "Transaction_txHash_key" ON "Transaction"("txHash");

-- CreateIndex
CREATE INDEX "Transaction_userId_type_idx" ON "Transaction"("userId", "type");

-- CreateIndex
CREATE INDEX "Transaction_poolId_type_idx" ON "Transaction"("poolId", "type");

-- CreateIndex
CREATE INDEX "Transaction_txHash_idx" ON "Transaction"("txHash");

-- CreateIndex
CREATE INDEX "Transaction_chainId_blockNumber_idx" ON "Transaction"("chainId", "blockNumber");

-- CreateIndex
CREATE INDEX "Transaction_status_createdAt_idx" ON "Transaction"("status", "createdAt");

-- CreateIndex
CREATE INDEX "Instrument_poolId_isActive_idx" ON "Instrument"("poolId", "isActive");

-- CreateIndex
CREATE INDEX "Instrument_maturityDate_isActive_idx" ON "Instrument"("maturityDate", "isActive");

-- CreateIndex
CREATE INDEX "Instrument_nextCouponDueDate_isActive_idx" ON "Instrument"("nextCouponDueDate", "isActive");

-- CreateIndex
CREATE UNIQUE INDEX "Instrument_poolId_instrumentId_key" ON "Instrument"("poolId", "instrumentId");

-- CreateIndex
CREATE INDEX "CouponPayment_poolId_dueDate_idx" ON "CouponPayment"("poolId", "dueDate");

-- CreateIndex
CREATE INDEX "CouponPayment_distributionStatus_idx" ON "CouponPayment"("distributionStatus");

-- CreateIndex
CREATE INDEX "WithdrawalRequest_userId_status_idx" ON "WithdrawalRequest"("userId", "status");

-- CreateIndex
CREATE INDEX "WithdrawalRequest_poolId_status_idx" ON "WithdrawalRequest"("poolId", "status");

-- CreateIndex
CREATE INDEX "WithdrawalRequest_status_requestTime_idx" ON "WithdrawalRequest"("status", "requestTime");

-- CreateIndex
CREATE UNIQUE INDEX "WithdrawalRequest_poolId_requestId_key" ON "WithdrawalRequest"("poolId", "requestId");

-- CreateIndex
CREATE INDEX "SPVOperation_poolId_operationType_idx" ON "SPVOperation"("poolId", "operationType");

-- CreateIndex
CREATE INDEX "SPVOperation_status_initiatedAt_idx" ON "SPVOperation"("status", "initiatedAt");

-- CreateIndex
CREATE INDEX "SPVOperation_initiatedBy_idx" ON "SPVOperation"("initiatedBy");

-- CreateIndex
CREATE UNIQUE INDEX "PoolAnalytics_poolId_key" ON "PoolAnalytics"("poolId");

-- CreateIndex
CREATE INDEX "PoolAnalytics_totalValueLocked_idx" ON "PoolAnalytics"("totalValueLocked");

-- CreateIndex
CREATE INDEX "PoolAnalytics_apy_idx" ON "PoolAnalytics"("apy");

-- CreateIndex
CREATE INDEX "PoolSnapshot_poolId_timestamp_idx" ON "PoolSnapshot"("poolId", "timestamp");

-- CreateIndex
CREATE INDEX "PoolSnapshot_timestamp_idx" ON "PoolSnapshot"("timestamp");

-- CreateIndex
CREATE INDEX "NAVHistory_poolId_timestamp_idx" ON "NAVHistory"("poolId", "timestamp");

-- CreateIndex
CREATE UNIQUE INDEX "PlatformMetrics_date_key" ON "PlatformMetrics"("date");

-- CreateIndex
CREATE INDEX "PlatformMetrics_date_idx" ON "PlatformMetrics"("date");

-- CreateIndex
CREATE INDEX "Notification_userId_isRead_idx" ON "Notification"("userId", "isRead");

-- CreateIndex
CREATE INDEX "Notification_userId_createdAt_idx" ON "Notification"("userId", "createdAt");

-- CreateIndex
CREATE INDEX "Notification_type_createdAt_idx" ON "Notification"("type", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "FiatTransaction_reference_key" ON "FiatTransaction"("reference");

-- CreateIndex
CREATE INDEX "FiatTransaction_userId_type_idx" ON "FiatTransaction"("userId", "type");

-- CreateIndex
CREATE INDEX "FiatTransaction_reference_idx" ON "FiatTransaction"("reference");

-- CreateIndex
CREATE INDEX "FiatTransaction_status_initiatedAt_idx" ON "FiatTransaction"("status", "initiatedAt");

-- CreateIndex
CREATE INDEX "AuditLog_userId_createdAt_idx" ON "AuditLog"("userId", "createdAt");

-- CreateIndex
CREATE INDEX "AuditLog_entity_entityId_idx" ON "AuditLog"("entity", "entityId");

-- CreateIndex
CREATE INDEX "AuditLog_action_createdAt_idx" ON "AuditLog"("action", "createdAt");

-- CreateIndex
CREATE INDEX "ComplianceAlert_status_severity_idx" ON "ComplianceAlert"("status", "severity");

-- CreateIndex
CREATE INDEX "ComplianceAlert_alertType_createdAt_idx" ON "ComplianceAlert"("alertType", "createdAt");

-- AddForeignKey
ALTER TABLE "UserProfile" ADD CONSTRAINT "UserProfile_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "KYCDocument" ADD CONSTRAINT "KYCDocument_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BankAccount" ADD CONSTRAINT "BankAccount_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Pool" ADD CONSTRAINT "Pool_chainId_fkey" FOREIGN KEY ("chainId") REFERENCES "Network"("chainId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PoolPosition" ADD CONSTRAINT "PoolPosition_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PoolPosition" ADD CONSTRAINT "PoolPosition_poolId_fkey" FOREIGN KEY ("poolId") REFERENCES "Pool"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Transaction" ADD CONSTRAINT "Transaction_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Transaction" ADD CONSTRAINT "Transaction_poolId_fkey" FOREIGN KEY ("poolId") REFERENCES "Pool"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Transaction" ADD CONSTRAINT "Transaction_chainId_fkey" FOREIGN KEY ("chainId") REFERENCES "Network"("chainId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Instrument" ADD CONSTRAINT "Instrument_poolId_fkey" FOREIGN KEY ("poolId") REFERENCES "Pool"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CouponPayment" ADD CONSTRAINT "CouponPayment_poolId_fkey" FOREIGN KEY ("poolId") REFERENCES "Pool"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CouponPayment" ADD CONSTRAINT "CouponPayment_instrumentId_fkey" FOREIGN KEY ("instrumentId") REFERENCES "Instrument"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WithdrawalRequest" ADD CONSTRAINT "WithdrawalRequest_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WithdrawalRequest" ADD CONSTRAINT "WithdrawalRequest_poolId_fkey" FOREIGN KEY ("poolId") REFERENCES "Pool"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SPVOperation" ADD CONSTRAINT "SPVOperation_poolId_fkey" FOREIGN KEY ("poolId") REFERENCES "Pool"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PoolAnalytics" ADD CONSTRAINT "PoolAnalytics_poolId_fkey" FOREIGN KEY ("poolId") REFERENCES "Pool"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PoolSnapshot" ADD CONSTRAINT "PoolSnapshot_poolId_fkey" FOREIGN KEY ("poolId") REFERENCES "Pool"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "NAVHistory" ADD CONSTRAINT "NAVHistory_poolId_fkey" FOREIGN KEY ("poolId") REFERENCES "Pool"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Notification" ADD CONSTRAINT "Notification_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FiatTransaction" ADD CONSTRAINT "FiatTransaction_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AuditLog" ADD CONSTRAINT "AuditLog_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
