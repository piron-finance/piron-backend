import { PoolType, PoolStatus } from '@prisma/client';

// Lock Tier DTO for Locked Pools
export class LockTierDto {
  id: string;
  tierIndex: number;
  durationDays: number;
  apyBps: number;           // 500 = 5%
  earlyExitPenaltyBps: number; // 1000 = 10%
  minDeposit: string;
  isActive: boolean;
}

// Analytics with locked pool specific fields
export class PoolAnalyticsDto {
  totalValueLocked: string;
  totalShares: string;
  navPerShare: string | null;
  uniqueInvestors: number;
  apy: string | null;

  // Locked pool specific
  totalPrincipalLocked?: string;
  totalInterestPaid?: string;
  totalPenaltiesCollected?: string;
  activePositions?: number;
}

export class PoolResponseDto {
  id: string;
  chainId: number;
  poolAddress: string;
  poolType: PoolType;
  name: string;
  description: string | null;

  assetSymbol: string;
  assetDecimals: number;
  minInvestment: string;

  status: PoolStatus;
  isActive: boolean;
  isFeatured: boolean;

  // Off-chain metadata
  country: string | null;
  region: string | null;
  issuer: string | null;
  issuerLogo: string | null;
  securityType: string | null;
  riskRating: string | null;

  // Single-asset specific
  targetRaise: string | null;
  epochEndTime: Date | null;
  maturityDate: Date | null;
  discountRate: number | null;

  // SPV address (for Stable Yield and Locked pools)
  spvAddress?: string | null;

  // Locked pool specific
  lockTiers?: LockTierDto[];

  // Analytics (if included)
  analytics?: PoolAnalyticsDto | null;

  // Live blockchain data
  liveData?: {
    totalAssets: string;
    totalShares: string;
    currentStatus: string;
  };

  createdAt: Date;
  updatedAt: Date;
}

export class PoolDetailDto extends PoolResponseDto {
  // Extended details
  managerAddress: string;
  escrowAddress: string;
  assetAddress: string;

  isPaused: boolean;
  tags: string[];

  cusip: string | null;
  isin: string | null;
  prospectusUrl: string | null;

  createdOnChain: Date;

  // Locked pool specific metrics (from blockchain)
  lockedPoolMetrics?: {
    totalPrincipal: string;
    totalInterestPaid: string;
    totalPenalties: string;
    activePositionCount: number;
    totalPositionCount: number;
  };
}

export class PaginatedPoolsDto {
  data: PoolResponseDto[];
  pagination: {
    total: number;
    page: number;
    limit: number;
    totalPages: number;
  };
}
