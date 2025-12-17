export class PortfolioAnalyticsDto {
  totalValue: string;
  totalValueFormatted: string;
  totalDeposited: string;
  totalReturn: string;
  totalReturnPercentage: string;
  unrealizedReturn: string;
  realizedReturn: string;
  activePositions: number;
  averageAPY: string;
}

export class PoolInfoDto {
  id: string;
  name: string;
  poolType: string;
  poolAddress: string;
  assetSymbol: string;
  status: string;
  apy: string | null;
  navPerShare: string | null;
  maturityDate: Date | null;
  country: string | null;
  issuer: string | null;
}

export class UserPositionDto {
  id: string;
  poolId: string;
  pool: PoolInfoDto;
  totalShares: string;
  totalDeposited: string;
  totalWithdrawn: string;
  currentValue: string;
  totalReturn: string;
  totalReturnPercentage: string;
  unrealizedReturn: string;
  realizedReturn: string;
  firstDepositTime: Date | null;
  lastDepositTime: Date | null;
  daysHeld: number;
  lastActivityDate: Date | null;
  lastActivityType: string | null;
  isActive: boolean;
}

export class PortfolioResponseDto {
  analytics: PortfolioAnalyticsDto;
  positions: UserPositionDto[];
}

export class DetailedPositionDto extends UserPositionDto {
  userId: string;
  couponsClaimed: string;
  pendingRefund: string;
  discountAccrued: string;
  lastWithdrawalTime: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

