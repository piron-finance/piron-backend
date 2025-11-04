import { Pool, PoolAnalytics, PoolType, PoolStatus } from '@prisma/client';

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

  // Analytics (if included)
  analytics?: {
    totalValueLocked: string;
    totalShares: string;
    navPerShare: string | null;
    uniqueInvestors: number;
    apy: string | null;
  } | null;

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
