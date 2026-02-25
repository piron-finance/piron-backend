import { Injectable, Logger } from '@nestjs/common';
import { ethers } from 'ethers';
import { CONTRACT_ADDRESSES } from '../contracts/addresses';

import ManagerABI from '../contracts/abis/Manager.json';
import StableYieldManagerABI from '../contracts/abis/StableYieldManager.json';
import StableYieldEscrowABI from '../contracts/abis/StableYieldEscrow.json';
import LockedManagerABI from '../contracts/abis/LockedManager.json';
import LockedPoolEscrowABI from '../contracts/abis/LockedPoolEscrow.json';
import PoolRegistryABI from '../contracts/abis/PoolRegistry.json';
import LiquidityPoolABI from '../contracts/abis/LiquidityPool.json';
import StableYieldPoolABI from '../contracts/abis/StableYieldPool.json';
import LockedPoolABI from '../contracts/abis/LockedPool.json';
import PoolFactoryABI from '../contracts/abis/PoolFactory.json';
import ManagedPoolFactoryABI from '../contracts/abis/ManagedPoolFactory.json';
import AccessManagerABI from '../contracts/abis/AccessManager.json';
import FeeManagerABI from '../contracts/abis/FeeManager.json';
import YieldReserveEscrowABI from '../contracts/abis/YieldReserveEscrow.json';
import IERC20ABI from '../contracts/abis/IERC20.json';

export type PoolType = 'SINGLE_ASSET' | 'STABLE_YIELD' | 'LOCKED';

@Injectable()
export class BlockchainService {
  private readonly logger = new Logger(BlockchainService.name);
  private providers: Map<number, ethers.JsonRpcProvider>;
  private contracts: Map<string, ethers.Contract>;

  constructor() {
    this.providers = new Map();
    this.contracts = new Map();
    this.initializeProviders();
  }

  private initializeProviders() {
    const baseSepoliaRpc = process.env.BASE_SEPOLIA_RPC || 'https://sepolia.base.org';
    this.providers.set(84532, new ethers.JsonRpcProvider(baseSepoliaRpc));
    this.logger.log(`✅ Base Sepolia provider initialized: ${baseSepoliaRpc}`);

    if (process.env.BASE_MAINNET_RPC) {
      this.providers.set(8453, new ethers.JsonRpcProvider(process.env.BASE_MAINNET_RPC));
      this.logger.log(`✅ Base Mainnet provider initialized`);
    }
  }

  /**
   * Get provider for a specific chain
   */
  getProvider(chainId: number): ethers.JsonRpcProvider {
    const provider = this.providers.get(chainId);
    if (!provider) {
      throw new Error(`Provider not initialized for chainId ${chainId}`);
    }
    return provider;
  }

  /**
   * Get contract instance (cached)
   */
  getContract(chainId: number, address: string, abi: any): ethers.Contract {
    const key = `${chainId}-${address.toLowerCase()}`;

    if (!this.contracts.has(key)) {
      const provider = this.getProvider(chainId);
      const contract = new ethers.Contract(address, abi, provider);
      this.contracts.set(key, contract);
    }

    return this.contracts.get(key)!;
  }

  // ============================================================================
  // CORE CONTRACT GETTERS
  // ============================================================================

  /**
   * Get Manager contract (Single-Asset pools)
   */
  getManager(chainId: number): ethers.Contract {
    const address = CONTRACT_ADDRESSES[chainId]?.manager;
    if (!address) {
      throw new Error(`Manager address not configured for chainId ${chainId}`);
    }
    return this.getContract(chainId, address, ManagerABI);
  }

  /**
   * Get StableYieldManager contract
   */
  getStableYieldManager(chainId: number): ethers.Contract {
    const address = CONTRACT_ADDRESSES[chainId]?.stableYieldManager;
    if (!address) {
      throw new Error(`StableYieldManager address not configured for chainId ${chainId}`);
    }
    return this.getContract(chainId, address, StableYieldManagerABI);
  }

  /**
   * Get LockedPoolManager contract
   */
  getLockedPoolManager(chainId: number): ethers.Contract {
    const address = CONTRACT_ADDRESSES[chainId]?.lockedPoolManager;
    if (!address) {
      throw new Error(`LockedPoolManager address not configured for chainId ${chainId}`);
    }
    return this.getContract(chainId, address, LockedManagerABI);
  }

  /**
   * Get PoolRegistry contract
   */
  getPoolRegistry(chainId: number): ethers.Contract {
    const address = CONTRACT_ADDRESSES[chainId]?.poolRegistry;
    if (!address) {
      throw new Error(`PoolRegistry address not configured for chainId ${chainId}`);
    }
    return this.getContract(chainId, address, PoolRegistryABI);
  }

  /**
   * Get AccessManager contract
   */
  getAccessManager(chainId: number): ethers.Contract {
    const address = CONTRACT_ADDRESSES[chainId]?.accessManager;
    if (!address) {
      throw new Error(`AccessManager address not configured for chainId ${chainId}`);
    }
    return this.getContract(chainId, address, AccessManagerABI);
  }

  /**
   * Get FeeManager contract
   */
  getFeeManager(chainId: number): ethers.Contract {
    const address = CONTRACT_ADDRESSES[chainId]?.feeManager;
    if (!address) {
      throw new Error(`FeeManager address not configured for chainId ${chainId}`);
    }
    return this.getContract(chainId, address, FeeManagerABI);
  }

  /**
   * Get YieldReserveEscrow contract
   */
  getYieldReserveEscrow(chainId: number): ethers.Contract {
    const address = CONTRACT_ADDRESSES[chainId]?.yieldReserveEscrow;
    if (!address) {
      throw new Error(`YieldReserveEscrow address not configured for chainId ${chainId}`);
    }
    return this.getContract(chainId, address, YieldReserveEscrowABI);
  }

  /**
   * Get PoolFactory contract (Single-Asset)
   */
  getPoolFactory(chainId: number): ethers.Contract {
    const address = CONTRACT_ADDRESSES[chainId]?.poolFactory;
    if (!address) {
      throw new Error(`PoolFactory address not configured for chainId ${chainId}`);
    }
    return this.getContract(chainId, address, PoolFactoryABI);
  }

  /**
   * Get ManagedPoolFactory contract (Stable Yield & Locked pools)
   */
  getManagedPoolFactory(chainId: number): ethers.Contract {
    const address = CONTRACT_ADDRESSES[chainId]?.managedPoolFactory;
    if (!address) {
      throw new Error(`ManagedPoolFactory address not configured for chainId ${chainId}`);
    }
    return this.getContract(chainId, address, ManagedPoolFactoryABI);
  }

  // ============================================================================
  // POOL CONTRACT GETTERS
  // ============================================================================

  /**
   * Get pool contract instance based on pool type
   */
  getPool(chainId: number, poolAddress: string, poolType: PoolType): ethers.Contract {
    let abi: any;
    switch (poolType) {
      case 'STABLE_YIELD':
        abi = StableYieldPoolABI;
        break;
      case 'LOCKED':
        abi = LockedPoolABI;
        break;
      case 'SINGLE_ASSET':
      default:
        abi = LiquidityPoolABI;
        break;
    }
    return this.getContract(chainId, poolAddress, abi);
  }

  /**
   * Get LiquidityPool contract (Single-Asset)
   */
  getLiquidityPool(chainId: number, poolAddress: string): ethers.Contract {
    return this.getContract(chainId, poolAddress, LiquidityPoolABI);
  }

  /**
   * Get StableYieldPool contract
   */
  getStableYieldPool(chainId: number, poolAddress: string): ethers.Contract {
    return this.getContract(chainId, poolAddress, StableYieldPoolABI);
  }

  /**
   * Get StableYieldEscrow contract by escrow address
   */
  getStableYieldEscrow(chainId: number, escrowAddress: string): ethers.Contract {
    return this.getContract(chainId, escrowAddress, StableYieldEscrowABI);
  }

  /**
   * Get LockedPool contract
   */
  getLockedPool(chainId: number, poolAddress: string): ethers.Contract {
    return this.getContract(chainId, poolAddress, LockedPoolABI);
  }

  /**
   * Get LockedPoolEscrow contract by escrow address
   */
  getLockedPoolEscrow(chainId: number, escrowAddress: string): ethers.Contract {
    return this.getContract(chainId, escrowAddress, LockedPoolEscrowABI);
  }

  /**
   * Get ERC20 token contract
   */
  getERC20(chainId: number, tokenAddress: string): ethers.Contract {
    return this.getContract(chainId, tokenAddress, IERC20ABI);
  }

  // ============================================================================
  // POOL REGISTRY HELPERS
  // ============================================================================

  /**
   * Determine pool type from registry
   */
  async getPoolType(chainId: number, poolAddress: string): Promise<PoolType> {
    try {
      const registry = this.getPoolRegistry(chainId);

      // Check if it's a locked pool first
      const isLocked = await registry.isLockedPool(poolAddress);
      if (isLocked) return 'LOCKED';

      // Check if it's a stable yield pool
      const isStableYield = await registry.isStableYieldPool(poolAddress);
      if (isStableYield) return 'STABLE_YIELD';

      // Default to single asset
      return 'SINGLE_ASSET';
    } catch (error) {
      this.logger.warn(
        `Could not determine pool type for ${poolAddress}, defaulting to SINGLE_ASSET`,
      );
      return 'SINGLE_ASSET';
    }
  }

  // ============================================================================
  // READ METHODS - COMMON
  // ============================================================================

  async getPoolTotalAssets(
    chainId: number,
    poolAddress: string,
    poolType: PoolType = 'SINGLE_ASSET',
  ): Promise<bigint> {
    const pool = this.getPool(chainId, poolAddress, poolType);
    return await pool.totalAssets();
  }

  async getPoolTotalSupply(
    chainId: number,
    poolAddress: string,
    poolType: PoolType = 'SINGLE_ASSET',
  ): Promise<bigint> {
    const pool = this.getPool(chainId, poolAddress, poolType);
    return await pool.totalSupply();
  }

  /**
   * Get TVL for a pool based on pool type
   * - Single Asset: totalRaised from Manager.getPoolData()
   * - Stable Yield: NAV from StableYieldManager.calculatePoolNAV()
   * - Locked: totalPrincipal from LockedPoolManager.getPoolMetrics()
   */
  async getPoolTVL(
    chainId: number,
    poolAddress: string,
    poolType: PoolType,
  ): Promise<{ tvl: bigint; breakdown?: Record<string, bigint> }> {
    try {
      switch (poolType) {
        case 'STABLE_YIELD': {
          const manager = this.getStableYieldManager(chainId);
          const nav = await manager.calculatePoolNAV(poolAddress);
          return { tvl: nav };
        }

        case 'LOCKED': {
          const manager = this.getLockedPoolManager(chainId);
          const metrics = await manager.getPoolMetrics(poolAddress);
          return {
            tvl: metrics.totalPrincipal,
            breakdown: {
              totalPrincipal: metrics.totalPrincipal,
              activePositions: metrics.activePositions,
            },
          };
        }

        case 'SINGLE_ASSET':
        default: {
          const manager = this.getManager(chainId);
          const poolData = await manager.getPoolData(poolAddress);
          return {
            tvl: poolData.totalRaised,
            breakdown: {
              totalRaised: poolData.totalRaised,
            },
          };
        }
      }
    } catch (error) {
      this.logger.warn(`Error getting TVL for pool ${poolAddress}: ${error.message}`);
      // Fallback to totalAssets
      const pool = this.getPool(chainId, poolAddress, poolType);
      const totalAssets = await pool.totalAssets();
      return { tvl: totalAssets };
    }
  }

  /**
   * Get escrow data for a Stable Yield pool
   */
  async getEscrowData(
    chainId: number,
    escrowAddress: string,
  ): Promise<{
    poolReserves: bigint;
    cashBuffer: bigint;
    accruedFees: bigint;
    totalFeesCollected: bigint;
    totalBalance: bigint;
  }> {
    const escrow = this.getStableYieldEscrow(chainId, escrowAddress);
    const [poolReserves, cashBuffer, accruedFees, totalFeesCollected, totalBalance] =
      await Promise.all([
        escrow.getPoolReserves(),
        escrow.getCashBuffer(),
        escrow.getAccruedFees(),
        escrow.getTotalFeesCollected(),
        escrow.getTotalBalance(),
      ]);
    return {
      poolReserves,
      cashBuffer,
      accruedFees,
      totalFeesCollected,
      totalBalance,
    };
  }

  async getUserShares(
    chainId: number,
    poolAddress: string,
    userAddress: string,
    poolType: PoolType = 'SINGLE_ASSET',
  ): Promise<bigint> {
    const pool = this.getPool(chainId, poolAddress, poolType);
    return await pool.balanceOf(userAddress);
  }

  // ============================================================================
  // READ METHODS - STABLE YIELD
  // ============================================================================

  async getNAVPerShare(chainId: number, poolAddress: string): Promise<bigint> {
    const pool = this.getStableYieldPool(chainId, poolAddress);
    return await pool.getNAVPerShare();
  }

  async calculatePoolNAV(chainId: number, poolAddress: string): Promise<bigint> {
    const manager = this.getStableYieldManager(chainId);
    return await manager.calculatePoolNAV(poolAddress);
  }

  /**
   * Calculate reserve status for a Stable Yield pool
   * This replaces the non-existent getReserveStatus contract method
   */
  async getReserveStatus(
    chainId: number,
    poolAddress: string,
    escrowAddress: string,
    decimals: number,
  ): Promise<{
    currentReserve: bigint;
    targetReserve: bigint;
    reserveRatio: number; // in basis points
    rebalanceNeeded: boolean;
    cashBuffer: bigint;
    totalNAV: bigint;
    reserveConfig: { minAbsoluteReserve: bigint; reserveRatioBps: bigint };
  }> {
    const manager = this.getStableYieldManager(chainId);
    const escrow = this.getStableYieldEscrow(chainId, escrowAddress);

    // Fetch all data in parallel
    const [totalNAV, reserveConfig, cashBuffer, poolReserves] = await Promise.all([
      manager.calculatePoolNAV(poolAddress),
      manager.getPoolReserveConfig(poolAddress),
      escrow.getCashBuffer(),
      escrow.getPoolReserves(),
    ]);

    // Current reserve is the cash buffer (liquid funds available for withdrawals)
    const currentReserve = cashBuffer;

    // Target reserve = NAV * (reserveRatioBps / 10000)
    const reserveRatioBps = Number(reserveConfig.reserveRatioBps);
    const targetReserve = (totalNAV * BigInt(reserveRatioBps)) / BigInt(10000);

    // Calculate actual reserve ratio: (currentReserve / totalNAV) * 10000
    let reserveRatio = 0;
    if (totalNAV > BigInt(0)) {
      reserveRatio = Number((currentReserve * BigInt(10000)) / totalNAV);
    }

    // Rebalance needed if outside 8-12% range (800-1200 bps)
    const rebalanceNeeded = reserveRatio < 800 || reserveRatio > 1200;

    return {
      currentReserve,
      targetReserve,
      reserveRatio, // in basis points
      rebalanceNeeded,
      cashBuffer,
      totalNAV,
      reserveConfig,
    };
  }

  /**
   * Get NAV per share for a Stable Yield pool (alias for getNAVPerShare)
   */
  async getStableYieldNAV(chainId: number, poolAddress: string): Promise<bigint> {
    return this.getNAVPerShare(chainId, poolAddress);
  }

  /**
   * Get user's position in the withdrawal queue for a Stable Yield pool
   */
  async getWithdrawalQueuePosition(
    chainId: number,
    poolAddress: string,
    userAddress: string,
  ): Promise<{
    hasPending: boolean;
    shares: bigint;
    assets: bigint;
    position: number | null;
  }> {
    const manager = this.getStableYieldManager(chainId);

    try {
      const userRequests = await manager.getUserWithdrawalRequests(poolAddress, userAddress);

      if (!userRequests || userRequests.length === 0) {
        return { hasPending: false, shares: BigInt(0), assets: BigInt(0), position: null };
      }

      const queueStatus = await manager.getWithdrawalQueueStatus(poolAddress);
      let totalShares = BigInt(0);
      let totalAssets = BigInt(0);
      let position: number | null = null;

      for (const requestId of userRequests) {
        const request = await manager.withdrawalRequests(poolAddress, requestId);
        if (!request.processed) {
          totalShares += request.shares;
          totalAssets += request.estimatedValue;
          if (position === null) {
            position = Number(requestId) - Number(queueStatus.head) + 1;
          }
        }
      }

      return {
        hasPending: totalShares > BigInt(0),
        shares: totalShares,
        assets: totalAssets,
        position,
      };
    } catch {
      return { hasPending: false, shares: BigInt(0), assets: BigInt(0), position: null };
    }
  }

  /**
   * Preview withdrawal - convert shares to expected assets
   */
  async previewWithdrawal(
    chainId: number,
    poolAddress: string,
    shares: bigint,
  ): Promise<{ assets: bigint }> {
    const pool = this.getLiquidityPool(chainId, poolAddress);
    const assets = await pool.previewRedeem(shares);
    return { assets };
  }

  // ============================================================================
  // READ METHODS - LOCKED POOLS
  // ============================================================================

  /**
   * Get lock tiers for a locked pool
   */
  async getPoolTiers(chainId: number, poolAddress: string): Promise<any[]> {
    const manager = this.getLockedPoolManager(chainId);
    return await manager.getPoolTiers(poolAddress);
  }

  /**
   * Get position details by ID
   */
  async getPosition(chainId: number, positionId: number): Promise<any> {
    const manager = this.getLockedPoolManager(chainId);
    return await manager.getPosition(positionId);
  }

  /**
   * Get position summary (computed fields)
   */
  async getPositionSummary(chainId: number, positionId: number): Promise<any> {
    const manager = this.getLockedPoolManager(chainId);
    return await manager.getPositionSummary(positionId);
  }

  /**
   * Get all position IDs for a user in a specific locked pool
   */
  async getUserLockedPositions(
    chainId: number,
    poolAddress: string,
    userAddress: string,
  ): Promise<bigint[]> {
    const pool = this.getLockedPool(chainId, poolAddress);
    return await pool.getUserPositions(userAddress);
  }

  /**
   * Calculate early exit payout for a position
   */
  async calculateEarlyExitPayout(
    chainId: number,
    positionId: number,
  ): Promise<{
    payout: bigint;
    penalty: bigint;
    proRataInterest: bigint;
    daysElapsed: bigint;
  }> {
    const manager = this.getLockedPoolManager(chainId);
    const result = await manager.calculateEarlyExitPayout(positionId);
    return {
      payout: result.payout,
      penalty: result.penalty,
      proRataInterest: result.proRataInterest,
      daysElapsed: result.daysElapsed,
    };
  }

  /**
   * Get pool metrics for a locked pool
   */
  async getLockedPoolMetrics(chainId: number, poolAddress: string): Promise<any> {
    const pool = this.getLockedPool(chainId, poolAddress);
    return await pool.getPoolMetrics();
  }

  /**
   * Preview interest for a locked deposit
   */
  async previewLockedInterest(
    chainId: number,
    poolAddress: string,
    amount: bigint,
    tierIndex: number,
  ): Promise<{
    interest: bigint;
    investedAmount: bigint;
    maturityPayout: bigint;
  }> {
    const pool = this.getLockedPool(chainId, poolAddress);
    const result = await pool.previewInterest(amount, tierIndex);
    return {
      interest: result[0],
      investedAmount: result[1],
      maturityPayout: result[2],
    };
  }

  /**
   * Check if a position can be matured
   */
  async canMaturePosition(chainId: number, positionId: number): Promise<boolean> {
    const manager = this.getLockedPoolManager(chainId);
    return await manager.canMaturePosition(positionId);
  }

  // ============================================================================
  // DEBT POSITION TRACKING
  // ============================================================================

  /**
   * Get a single debt position by position ID
   * Debt positions are created when early exit requires a loan from the YieldReserve
   */
  async getDebtPosition(
    chainId: number,
    positionId: number,
  ): Promise<{
    positionId: bigint;
    user: string;
    amountOwed: bigint;
    reserveLoan: bigint;
    pendingPenalty: bigint;
    exitTime: bigint;
    settled: boolean;
  }> {
    const manager = this.getLockedPoolManager(chainId);
    return await manager.getDebtPosition(positionId);
  }

  /**
   * Get all debt position IDs for a pool
   */
  async getPoolDebtPositions(chainId: number, poolAddress: string): Promise<bigint[]> {
    const manager = this.getLockedPoolManager(chainId);
    return await manager.getPoolDebtPositions(poolAddress);
  }

  /**
   * Get debt positions with full details for a pool
   */
  async getPoolDebtPositionDetails(
    chainId: number,
    poolAddress: string,
  ): Promise<
    Array<{
      positionId: bigint;
      user: string;
      amountOwed: bigint;
      reserveLoan: bigint;
      pendingPenalty: bigint;
      exitTime: bigint;
      settled: boolean;
    }>
  > {
    const manager = this.getLockedPoolManager(chainId);
    const positionIds = await manager.getPoolDebtPositions(poolAddress);

    const positions = await Promise.all(
      positionIds.map((id: bigint) => manager.getDebtPosition(id)),
    );

    return positions;
  }

  /**
   * Get user's unsettled debt positions across all pools
   */
  async getUserDebtSummary(
    chainId: number,
    poolAddress: string,
    userAddress: string,
  ): Promise<{
    totalDebt: bigint;
    unsettledCount: number;
    positions: Array<{
      positionId: bigint;
      amountOwed: bigint;
      reserveLoan: bigint;
      pendingPenalty: bigint;
    }>;
  }> {
    const manager = this.getLockedPoolManager(chainId);
    const positionIds = await manager.getPoolDebtPositions(poolAddress);

    const allPositions = await Promise.all(
      positionIds.map((id: bigint) => manager.getDebtPosition(id)),
    );

    const userPositions = allPositions.filter(
      (p) => p.user.toLowerCase() === userAddress.toLowerCase() && !p.settled,
    );

    const totalDebt = userPositions.reduce(
      (sum, p) => sum + p.amountOwed,
      BigInt(0),
    );

    return {
      totalDebt,
      unsettledCount: userPositions.length,
      positions: userPositions.map((p) => ({
        positionId: p.positionId,
        amountOwed: p.amountOwed,
        reserveLoan: p.reserveLoan,
        pendingPenalty: p.pendingPenalty,
      })),
    };
  }

  // ============================================================================
  // ASSET VALIDATION
  // ============================================================================

  /**
   * Check if asset is approved in PoolRegistry
   */
  async isAssetApproved(chainId: number, assetAddress: string): Promise<boolean> {
    try {
      this.logger.debug(`Checking asset approval for ${assetAddress} on chain ${chainId}`);
      const registry = this.getPoolRegistry(chainId);

      // Add timeout to RPC call (30 seconds)
      const timeoutPromise = new Promise<never>((_, reject) =>
        setTimeout(() => reject(new Error('RPC call timeout')), 30000),
      );

      const assetData = await Promise.race([registry.assetInfo(assetAddress), timeoutPromise]);

      this.logger.debug(`Asset ${assetAddress} approved: ${assetData.isApproved}`);
      return assetData.isApproved;
    } catch (error) {
      this.logger.error(`Error checking asset approval for ${assetAddress}: ${error.message}`);
      // For development: assume approved if RPC fails
      if (process.env.NODE_ENV === 'development') {
        this.logger.warn('Development mode: bypassing asset approval check');
        return true;
      }
      return false;
    }
  }

  // ============================================================================
  // UTILITY METHODS
  // ============================================================================

  /**
   * Get current block number
   */
  async getCurrentBlock(chainId: number): Promise<number> {
    const provider = this.getProvider(chainId);
    return await provider.getBlockNumber();
  }

  /**
   * Wait for transaction confirmation
   */
  async waitForTransaction(
    chainId: number,
    txHash: string,
    confirmations = 1,
  ): Promise<ethers.TransactionReceipt> {
    const provider = this.getProvider(chainId);
    const receipt = await provider.waitForTransaction(txHash, confirmations);
    if (!receipt) {
      throw new Error(`Transaction ${txHash} not found or failed`);
    }
    return receipt;
  }

  /**
   * Get transaction receipt
   */
  async getTransactionReceipt(
    chainId: number,
    txHash: string,
  ): Promise<ethers.TransactionReceipt | null> {
    const provider = this.getProvider(chainId);
    return await provider.getTransactionReceipt(txHash);
  }

  /**
   * Get block by number
   */
  async getBlock(chainId: number, blockNumber: number): Promise<ethers.Block | null> {
    const provider = this.getProvider(chainId);
    return await provider.getBlock(blockNumber);
  }

  // ============================================================================
  // COMPREHENSIVE ON-CHAIN DATA - SINGLE ASSET POOLS
  // ============================================================================

  /**
   * Get full Single-Asset pool data from Manager contract
   */
  async getSingleAssetPoolData(
    chainId: number,
    poolAddress: string,
  ): Promise<{
    config: {
      instrumentType: number;
      faceValue: bigint;
      purchasePrice: bigint;
      targetRaise: bigint;
      epochEndTime: bigint;
      maturityDate: bigint;
      couponDates: bigint[];
      couponRates: bigint[];
      discountRate: bigint;
      minimumFundingThreshold: bigint;
      minInvestment: bigint;
      withdrawalFeeBps: bigint;
    };
    status: number;
    totalRaised: bigint;
    actualInvested: bigint;
    totalDiscountEarned: bigint;
    totalCouponsReceived: bigint;
    totalCouponsDistributed: bigint;
    totalCouponsClaimed: bigint;
    fundsWithdrawnBySPV: bigint;
    fundsReturnedBySPV: bigint;
    totalFeesCollected: bigint;
  }> {
    const manager = this.getManager(chainId);
    const data = await manager.pools(poolAddress);
    return {
      config: {
        instrumentType: data.config.instrumentType,
        faceValue: data.config.faceValue,
        purchasePrice: data.config.purchasePrice,
        targetRaise: data.config.targetRaise,
        epochEndTime: data.config.epochEndTime,
        maturityDate: data.config.maturityDate,
        couponDates: data.config.couponDates,
        couponRates: data.config.couponRates,
        discountRate: data.config.discountRate,
        minimumFundingThreshold: data.config.minimumFundingThreshold,
        minInvestment: data.config.minInvestment,
        withdrawalFeeBps: data.config.withdrawalFeeBps,
      },
      status: data.status,
      totalRaised: data.totalRaised,
      actualInvested: data.actualInvested,
      totalDiscountEarned: data.totalDiscountEarned,
      totalCouponsReceived: data.totalCouponsReceived,
      totalCouponsDistributed: data.totalCouponsDistributed,
      totalCouponsClaimed: data.totalCouponsClaimed,
      fundsWithdrawnBySPV: data.fundsWithdrawnBySPV,
      fundsReturnedBySPV: data.fundsReturnedBySPV,
      totalFeesCollected: data.totalFeesCollected,
    };
  }

  /**
   * Get investment proof for Single-Asset pool
   */
  async getInvestmentProof(
    chainId: number,
    poolAddress: string,
  ): Promise<{
    documentHash: string;
    confirmedAt: bigint;
    confirmedBy: string;
  }> {
    const manager = this.getManager(chainId);
    return await manager.getInvestmentProof(poolAddress);
  }

  /**
   * Get unclaimed coupons for Single-Asset pool
   */
  async getUnclaimedCoupons(chainId: number, poolAddress: string): Promise<bigint> {
    const manager = this.getManager(chainId);
    return await manager.getUnclaimedCoupons(poolAddress);
  }

  // ============================================================================
  // COMPREHENSIVE ON-CHAIN DATA - STABLE YIELD POOLS
  // ============================================================================

  /**
   * Get full Stable Yield pool data from StableYieldManager
   */
  async getStableYieldPoolData(
    chainId: number,
    poolAddress: string,
  ): Promise<{
    poolAddress: string;
    escrowAddress: string;
    asset: string;
    name: string;
    minInvestment: bigint;
    isActive: boolean;
    createdAt: bigint;
  }> {
    const manager = this.getStableYieldManager(chainId);
    return await manager.getPoolData(poolAddress);
  }

  /**
   * Get all instruments for a Stable Yield pool
   */
  async getStableYieldInstruments(
    chainId: number,
    poolAddress: string,
  ): Promise<
    Array<{
      instrumentType: number;
      purchasePrice: bigint;
      faceValue: bigint;
      purchaseDate: bigint;
      maturityDate: bigint;
      annualCouponRate: bigint;
      couponFrequency: number;
      nextCouponDueDate: bigint;
      couponsPaid: number;
      isActive: boolean;
      allocationId: string;
    }>
  > {
    const manager = this.getStableYieldManager(chainId);
    return await manager.getPoolInstruments(poolAddress);
  }

  /**
   * Get pending allocations for a Stable Yield pool
   */
  async getStableYieldPendingAllocations(chainId: number, poolAddress: string): Promise<string[]> {
    const manager = this.getStableYieldManager(chainId);
    return await manager.getPoolPendingAllocations(poolAddress);
  }

  /**
   * Get allocation details
   */
  async getStableYieldAllocation(
    chainId: number,
    allocationId: string,
  ): Promise<{
    allocationId: string;
    pool: string;
    spv: string;
    amount: bigint;
    usedAmount: bigint;
    returnedAmount: bigint;
    createdAt: bigint;
    expiresAt: bigint;
    status: number;
  }> {
    const manager = this.getStableYieldManager(chainId);
    return await manager.getPendingAllocation(allocationId);
  }

  /**
   * Get withdrawal queue status for Stable Yield pool
   */
  async getStableYieldWithdrawalQueue(
    chainId: number,
    poolAddress: string,
  ): Promise<{
    head: bigint;
    tail: bigint;
    pending: bigint;
    totalPendingValue: bigint;
  }> {
    const manager = this.getStableYieldManager(chainId);
    return await manager.getWithdrawalQueueStatus(poolAddress);
  }

  /**
   * Check if pool is ready for allocation
   */
  async isReadyForAllocation(
    chainId: number,
    poolAddress: string,
  ): Promise<{
    ready: boolean;
    availableAmount: bigint;
  }> {
    const manager = this.getStableYieldManager(chainId);
    return await manager.isReadyForAllocation(poolAddress);
  }

  // ============================================================================
  // SPV ALLOCATION DATA
  // ============================================================================

  /**
   * Get total allocation for an SPV across all Stable Yield pools
   */
  async getStableYieldTotalSPVAllocation(chainId: number, spvAddress: string): Promise<bigint> {
    const manager = this.getStableYieldManager(chainId);
    return await manager.getTotalSPVAllocation(spvAddress);
  }

  /**
   * Get allocation amount for a specific pool-SPV pair (Stable Yield)
   */
  async getStableYieldPoolToSPVAllocation(
    chainId: number,
    poolAddress: string,
    spvAddress: string,
  ): Promise<bigint> {
    const manager = this.getStableYieldManager(chainId);
    return await manager.getPoolToSPVAllocation(poolAddress, spvAddress);
  }

  /**
   * Get total allocation for an SPV across all Locked pools
   */
  async getLockedTotalSPVAllocation(chainId: number, spvAddress: string): Promise<bigint> {
    const manager = this.getLockedPoolManager(chainId);
    return await manager.getTotalSPVAllocation(spvAddress);
  }

  /**
   * Get allocation amount for a specific pool-SPV pair (Locked)
   */
  async getLockedPoolToSPVAllocation(
    chainId: number,
    poolAddress: string,
    spvAddress: string,
  ): Promise<bigint> {
    const manager = this.getLockedPoolManager(chainId);
    return await manager.getPoolToSPVAllocation(poolAddress, spvAddress);
  }

  /**
   * Get all allocation IDs for an SPV on a locked pool
   */
  async getLockedPoolAllocationIds(chainId: number, poolAddress: string): Promise<string[]> {
    const manager = this.getLockedPoolManager(chainId);
    const allocationIds: string[] = [];
    try {
      // Loop through allocation IDs until we get an error
      for (let i = 0; i < 100; i++) {
        const allocId = await manager.poolAllocationIds(poolAddress, i);
        if (
          allocId &&
          allocId !== '0x0000000000000000000000000000000000000000000000000000000000000000'
        ) {
          allocationIds.push(allocId);
        } else {
          break;
        }
      }
    } catch {
      // End of array
    }
    return allocationIds;
  }

  /**
   * Get locked pool SPV allocation details
   */
  async getLockedSPVAllocation(
    chainId: number,
    allocationId: string,
  ): Promise<{
    poolAddress: string;
    spvAddress: string;
    amount: bigint;
    returnedAmount: bigint;
    createdAt: bigint;
    status: number;
  }> {
    const manager = this.getLockedPoolManager(chainId);
    return await manager.spvAllocations(allocationId);
  }

  /**
   * Build create allocation transaction for Stable Yield
   */
  buildCreateStableYieldAllocationTx(
    chainId: number,
    poolAddress: string,
    spvAddress: string,
    amount: bigint,
  ): { to: string; data: string } {
    const manager = this.getStableYieldManager(chainId);
    const data = manager.interface.encodeFunctionData('createPendingAllocation', [
      poolAddress,
      spvAddress,
      amount,
    ]);
    return { to: manager.target as string, data };
  }

  /**
   * Build create allocation transaction for Locked Pool
   */
  buildCreateLockedAllocationTx(
    chainId: number,
    poolAddress: string,
    spvAddress: string,
    amount: bigint,
  ): { to: string; data: string } {
    const manager = this.getLockedPoolManager(chainId);
    const data = manager.interface.encodeFunctionData('createPendingAllocation', [
      poolAddress,
      spvAddress,
      amount,
    ]);
    return { to: manager.target as string, data };
  }

  // ============================================================================
  // COMPREHENSIVE ON-CHAIN DATA - LOCKED POOLS
  // ============================================================================

  /**
   * Get locked pool config from LockedPoolManager
   */
  async getLockedPoolConfig(
    chainId: number,
    poolAddress: string,
  ): Promise<{
    asset: string;
    name: string;
    minInvestment: bigint;
    isActive: boolean;
    createdAt: bigint;
  }> {
    const manager = this.getLockedPoolManager(chainId);
    return await manager.getPoolConfig(poolAddress);
  }

  /**
   * Get pool metrics from LockedPoolManager
   */
  async getLockedPoolMetricsFromManager(
    chainId: number,
    poolAddress: string,
  ): Promise<{
    totalPrincipalLocked: bigint;
    totalInterestCommitted: bigint;
    totalInterestPaidUpfront: bigint;
    totalInterestPendingMaturity: bigint;
    totalInvestedAmount: bigint;
    totalExpectedMaturityPayout: bigint;
    activePositions: bigint;
    totalPositions: bigint;
  }> {
    const manager = this.getLockedPoolManager(chainId);
    return await manager.getPoolMetrics(poolAddress);
  }

  /**
   * Get protocol accounting for locked pool
   */
  async getLockedPoolAccounting(
    chainId: number,
    poolAddress: string,
  ): Promise<{
    totalYieldEarned: bigint;
    totalPenaltiesEarned: bigint;
    totalLossesAbsorbed: bigint;
    reserveLoansOutstanding: bigint;
  }> {
    const manager = this.getLockedPoolManager(chainId);
    return await manager.getPoolAccounting(poolAddress);
  }

  /**
   * Get all debt position IDs for a locked pool
   */
  async getLockedPoolDebtPositionIds(chainId: number, poolAddress: string): Promise<bigint[]> {
    const manager = this.getLockedPoolManager(chainId);
    return await manager.getPoolDebtPositions(poolAddress);
  }

  /**
   * Get all lock tiers for a locked pool from manager
   */
  async getLockedPoolTiersFromManager(
    chainId: number,
    poolAddress: string,
  ): Promise<
    Array<{
      durationDays: bigint;
      apyBps: bigint;
      earlyExitPenaltyBps: bigint;
      minDeposit: bigint;
      isActive: boolean;
    }>
  > {
    const manager = this.getLockedPoolManager(chainId);
    return await manager.getPoolTiers(poolAddress);
  }

  // ============================================================================
  // SINGLE ASSET POOL - VIEW METHODS
  // ============================================================================

  /**
   * Get user's available coupon amount
   */
  async getUserAvailableCoupon(
    chainId: number,
    poolAddress: string,
    userAddress: string,
  ): Promise<bigint> {
    const manager = this.getManager(chainId);
    return await manager.getUserAvailableCoupon(poolAddress, userAddress);
  }

  /**
   * Get undistributed coupons for a pool
   */
  async getUndistributedCoupons(chainId: number, poolAddress: string): Promise<bigint> {
    const manager = this.getManager(chainId);
    return await manager.getUndistributedCoupons(poolAddress);
  }

  /**
   * Calculate user's discount entitlement
   */
  async calculateUserDiscount(
    chainId: number,
    poolAddress: string,
    userAddress: string,
  ): Promise<bigint> {
    const manager = this.getManager(chainId);
    // Note: This may need pool context depending on contract implementation
    return await manager.calculateUserDiscount(userAddress);
  }

  /**
   * Calculate user's expected return
   */
  async calculateUserReturn(
    chainId: number,
    poolAddress: string,
    userAddress: string,
  ): Promise<bigint> {
    const manager = this.getManager(chainId);
    return await manager.calculateUserReturn(userAddress);
  }

  /**
   * Get pool's coupon tracking data
   */
  async getPoolCouponData(
    chainId: number,
    poolAddress: string,
  ): Promise<{
    totalCouponsReceived: bigint;
    totalCouponsDistributed: bigint;
    totalCouponsClaimed: bigint;
    undistributed: bigint;
  }> {
    const manager = this.getManager(chainId);
    const poolData = await manager.pools(poolAddress);
    const undistributed = await manager.getUndistributedCoupons(poolAddress);
    return {
      totalCouponsReceived: poolData.totalCouponsReceived,
      totalCouponsDistributed: poolData.totalCouponsDistributed,
      totalCouponsClaimed: poolData.totalCouponsClaimed,
      undistributed,
    };
  }

  // ============================================================================
  // STABLE YIELD - VIEW METHODS
  // ============================================================================

  /**
   * Get user's withdrawal requests for a pool
   */
  async getUserWithdrawalRequests(
    chainId: number,
    poolAddress: string,
    userAddress: string,
  ): Promise<bigint[]> {
    const manager = this.getStableYieldManager(chainId);
    return await manager.getUserWithdrawalRequests(poolAddress, userAddress);
  }

  /**
   * Get withdrawal request details
   */
  async getWithdrawalRequest(
    chainId: number,
    poolAddress: string,
    requestId: number,
  ): Promise<{
    user: string;
    shares: bigint;
    requestTime: bigint;
    estimatedValue: bigint;
    processed: boolean;
    processedTime: bigint;
  }> {
    const manager = this.getStableYieldManager(chainId);
    return await manager.withdrawalRequests(poolAddress, requestId);
  }

  // ============================================================================
  // TRANSACTION BUILDERS - SINGLE ASSET
  // ============================================================================

  /**
   * Build extend maturity transaction
   */
  buildExtendMaturityTx(
    chainId: number,
    poolAddress: string,
    newMaturityDate: number,
  ): { to: string; data: string } {
    const manager = this.getManager(chainId);
    const data = manager.interface.encodeFunctionData('extendMaturity', [
      poolAddress,
      newMaturityDate,
    ]);
    return { to: manager.target as string, data };
  }

  /**
   * Build process investment transaction (SPV confirms investment)
   */
  buildProcessInvestmentTx(
    chainId: number,
    poolAddress: string,
    actualAmount: bigint,
    proofHash: string,
  ): { to: string; data: string } {
    const manager = this.getManager(chainId);
    const data = manager.interface.encodeFunctionData('processInvestment', [
      poolAddress,
      actualAmount,
      proofHash,
    ]);
    return { to: manager.target as string, data };
  }

  /**
   * Build process maturity transaction (SPV returns maturity funds)
   */
  buildProcessMaturityTx(
    chainId: number,
    poolAddress: string,
    finalAmount: bigint,
  ): { to: string; data: string } {
    const manager = this.getManager(chainId);
    const data = manager.interface.encodeFunctionData('processMaturity', [
      poolAddress,
      finalAmount,
    ]);
    return { to: manager.target as string, data };
  }

  /**
   * Build process coupon payment transaction
   */
  buildProcessCouponPaymentTx(
    chainId: number,
    poolAddress: string,
    amount: bigint,
  ): { to: string; data: string } {
    const manager = this.getManager(chainId);
    const data = manager.interface.encodeFunctionData('processCouponPayment', [
      poolAddress,
      amount,
    ]);
    return { to: manager.target as string, data };
  }

  // ============================================================================
  // TRANSACTION BUILDERS - STABLE YIELD
  // ============================================================================

  /**
   * Build cancel pending allocation transaction
   */
  buildCancelAllocationTx(chainId: number, allocationId: string): { to: string; data: string } {
    const manager = this.getStableYieldManager(chainId);
    const data = manager.interface.encodeFunctionData('cancelPendingAllocation', [allocationId]);
    return { to: manager.target as string, data };
  }

  /**
   * Build return unused funds transaction
   */
  buildReturnUnusedFundsTx(
    chainId: number,
    allocationId: string,
    returnAmount: bigint,
  ): { to: string; data: string } {
    const manager = this.getStableYieldManager(chainId);
    const data = manager.interface.encodeFunctionData('returnUnusedFunds', [
      allocationId,
      returnAmount,
    ]);
    return { to: manager.target as string, data };
  }

  /**
   * Build set pool transaction fee transaction
   */
  buildSetPoolTransactionFeeTx(
    chainId: number,
    poolAddress: string,
    feeBps: number,
  ): { to: string; data: string } {
    const manager = this.getStableYieldManager(chainId);
    const data = manager.interface.encodeFunctionData('setPoolTransactionFee', [
      poolAddress,
      feeBps,
    ]);
    return { to: manager.target as string, data };
  }

  /**
   * Build set pool reserve config transaction
   */
  buildSetPoolReserveConfigTx(
    chainId: number,
    poolAddress: string,
    minAbsoluteReserve: bigint,
    reserveRatioBps: number,
  ): { to: string; data: string } {
    const manager = this.getStableYieldManager(chainId);
    const data = manager.interface.encodeFunctionData('setPoolReserveConfig', [
      poolAddress,
      minAbsoluteReserve,
      reserveRatioBps,
    ]);
    return { to: manager.target as string, data };
  }

  /**
   * Build trigger NAV update transaction
   */
  buildTriggerNAVUpdateTx(
    chainId: number,
    poolAddress: string,
    reason: string,
  ): { to: string; data: string } {
    const manager = this.getStableYieldManager(chainId);
    const data = manager.interface.encodeFunctionData('triggerNAVUpdate', [poolAddress, reason]);
    return { to: manager.target as string, data };
  }

  /**
   * Build deactivate pool transaction (Stable Yield)
   */
  buildDeactivateStableYieldPoolTx(
    chainId: number,
    poolAddress: string,
  ): { to: string; data: string } {
    const manager = this.getStableYieldManager(chainId);
    const data = manager.interface.encodeFunctionData('deactivatePool', [poolAddress]);
    return { to: manager.target as string, data };
  }

  // ============================================================================
  // TRANSACTION BUILDERS - LOCKED POOL
  // ============================================================================

  /**
   * Build batch mature positions transaction
   */
  buildBatchMaturePositionsTx(
    chainId: number,
    positionIds: number[],
  ): { to: string; data: string } {
    const manager = this.getLockedPoolManager(chainId);
    const data = manager.interface.encodeFunctionData('batchMaturePositions', [positionIds]);
    return { to: manager.target as string, data };
  }

  /**
   * Build batch execute rollovers transaction
   */
  buildBatchExecuteRolloversTx(
    chainId: number,
    positionIds: number[],
  ): { to: string; data: string } {
    const manager = this.getLockedPoolManager(chainId);
    const data = manager.interface.encodeFunctionData('batchExecuteRollovers', [positionIds]);
    return { to: manager.target as string, data };
  }

  /**
   * Build mature allocation transaction (Locked Pool SPV)
   */
  buildMatureLockedAllocationTx(
    chainId: number,
    allocationId: string,
    returnedAmount: bigint,
  ): { to: string; data: string } {
    const manager = this.getLockedPoolManager(chainId);
    const data = manager.interface.encodeFunctionData('matureAllocation', [
      allocationId,
      returnedAmount,
    ]);
    return { to: manager.target as string, data };
  }

  /**
   * Build settle SPV return transaction
   */
  buildSettleSPVReturnTx(
    chainId: number,
    positionId: number,
    returnedAmount: bigint,
  ): { to: string; data: string } {
    const manager = this.getLockedPoolManager(chainId);
    const data = manager.interface.encodeFunctionData('settleSPVReturn', [
      positionId,
      returnedAmount,
    ]);
    return { to: manager.target as string, data };
  }

  /**
   * Build set tier active transaction
   */
  buildSetTierActiveTx(
    chainId: number,
    poolAddress: string,
    tierIndex: number,
    isActive: boolean,
  ): { to: string; data: string } {
    const manager = this.getLockedPoolManager(chainId);
    const data = manager.interface.encodeFunctionData('setTierActive', [
      poolAddress,
      tierIndex,
      isActive,
    ]);
    return { to: manager.target as string, data };
  }

  /**
   * Build update tier APY transaction
   */
  buildUpdateTierAPYTx(
    chainId: number,
    poolAddress: string,
    tierIndex: number,
    newApyBps: number,
  ): { to: string; data: string } {
    const manager = this.getLockedPoolManager(chainId);
    const data = manager.interface.encodeFunctionData('updateTierAPY', [
      poolAddress,
      tierIndex,
      newApyBps,
    ]);
    return { to: manager.target as string, data };
  }

  /**
   * Build activate pool transaction (Locked)
   */
  buildActivateLockedPoolTx(chainId: number, poolAddress: string): { to: string; data: string } {
    const manager = this.getLockedPoolManager(chainId);
    const data = manager.interface.encodeFunctionData('activatePool', [poolAddress]);
    return { to: manager.target as string, data };
  }

  /**
   * Build deactivate pool transaction (Locked)
   */
  buildDeactivateLockedPoolTx(chainId: number, poolAddress: string): { to: string; data: string } {
    const manager = this.getLockedPoolManager(chainId);
    const data = manager.interface.encodeFunctionData('deactivatePool', [poolAddress]);
    return { to: manager.target as string, data };
  }

  /**
   * Build configure lock tier transaction
   */
  buildConfigureLockTierTx(
    chainId: number,
    poolAddress: string,
    tierIndex: number,
    tier: {
      durationDays: number;
      apyBps: number;
      earlyExitPenaltyBps: number;
      minDeposit: bigint;
      isActive: boolean;
    },
  ): { to: string; data: string } {
    const manager = this.getLockedPoolManager(chainId);
    const data = manager.interface.encodeFunctionData('configureLockTier', [
      poolAddress,
      tierIndex,
      tier,
    ]);
    return { to: manager.target as string, data };
  }

  // ============================================================================
  // FEE MANAGER - READ METHODS
  // ============================================================================

  /**
   * Get fee split configuration for a fee type
   */
  async getFeeSplit(
    chainId: number,
    feeType: number,
  ): Promise<{
    treasuryBps: bigint;
    reserveBps: bigint;
    opsBps: bigint;
    active: boolean;
  }> {
    const feeManager = this.getFeeManager(chainId);
    return await feeManager.getFeeSplit(feeType);
  }

  /**
   * Get protocol fees summary across all assets
   */
  async getProtocolFeesSummary(chainId: number): Promise<{
    totalCollectedAllTime: bigint;
    pendingDistribution: bigint;
    distributedToTreasury: bigint;
    distributedToReserve: bigint;
    distributedToOps: bigint;
    assetCount: bigint;
  }> {
    const feeManager = this.getFeeManager(chainId);
    return await feeManager.getProtocolFeesSummary();
  }

  /**
   * Get asset-specific fee statistics
   */
  async getFeeAssetStats(
    chainId: number,
    assetAddress: string,
  ): Promise<{
    totalCollected: bigint;
    totalDistributed: bigint;
    treasuryCollected: bigint;
    reserveCollected: bigint;
    opsCollected: bigint;
  }> {
    const feeManager = this.getFeeManager(chainId);
    return await feeManager.getAssetStats(assetAddress);
  }

  /**
   * Get pool-specific fee statistics
   */
  async getPoolFeeStats(
    chainId: number,
    poolAddress: string,
    assetAddress: string,
  ): Promise<{
    totalCollected: bigint;
    byFeeType: bigint[];
  }> {
    const feeManager = this.getFeeManager(chainId);
    return await feeManager.getPoolFeeStats(poolAddress, assetAddress);
  }

  /**
   * Get pending distributions for an asset
   */
  async getPendingDistributions(
    chainId: number,
    assetAddress: string,
  ): Promise<{
    treasuryPending: bigint;
    reservePending: bigint;
    opsPending: bigint;
  }> {
    const feeManager = this.getFeeManager(chainId);
    return await feeManager.getPendingDistributions(assetAddress);
  }

  /**
   * Get all tracked assets in fee manager
   */
  async getFeeTrackedAssets(chainId: number): Promise<string[]> {
    const feeManager = this.getFeeManager(chainId);
    return await feeManager.getTrackedAssets();
  }

  // ============================================================================
  // POOL DEPOSIT FEES
  // ============================================================================

  /**
   * Get effective deposit fee for a locked pool
   */
  async getLockedPoolEffectiveDepositFee(
    chainId: number,
    poolAddress: string,
  ): Promise<bigint> {
    const manager = this.getLockedPoolManager(chainId);
    return await manager.getEffectiveDepositFee(poolAddress);
  }

  /**
   * Get effective deposit fee for a single-asset pool
   */
  async getSingleAssetDepositFee(
    chainId: number,
    poolAddress: string,
  ): Promise<bigint> {
    const manager = this.getManager(chainId);
    return await manager.getEffectiveDepositFee(poolAddress);
  }

  /**
   * Get effective deposit fee for a Stable Yield pool
   * Note: Stable Yield may not have pool-specific fees, returns 0 if not configured
   */
  async getStableYieldEffectiveDepositFee(
    chainId: number,
    poolAddress: string,
  ): Promise<bigint> {
    try {
      const manager = this.getStableYieldManager(chainId);
      return await manager.getEffectiveDepositFee(poolAddress);
    } catch {
      return BigInt(0);
    }
  }

  // ============================================================================
  // YIELD RESERVE ESCROW - READ METHODS
  // ============================================================================

  /**
   * Get yield reserve statistics
   */
  async getYieldReserveStats(chainId: number): Promise<{
    balance: bigint;
    loaned: bigint;
    invested: bigint;
    yieldReceived: bigint;
    sentToTreasury: bigint;
    lossesAbsorbed: bigint;
  }> {
    const reserve = this.getYieldReserveEscrow(chainId);
    return await reserve.getReserveStats();
  }

  /**
   * Get protocol funds snapshot across all pools
   */
  async getProtocolFundsSnapshot(chainId: number): Promise<{
    reserveBalance: bigint;
    totalDeployedViaReserve: bigint;
    totalDirectDeposits: bigint;
    totalEarlyExitLoans: bigint;
    grandTotal: bigint;
    poolCount: bigint;
  }> {
    const reserve = this.getYieldReserveEscrow(chainId);
    return await reserve.getProtocolFundsSnapshot();
  }

  /**
   * Get protocol funds for a specific pool
   */
  async getYieldReservePoolFunds(
    chainId: number,
    poolAddress: string,
  ): Promise<{
    fromReserve: bigint;
    directDeposit: bigint;
    earlyExitLoan: bigint;
    total: bigint;
  }> {
    const reserve = this.getYieldReserveEscrow(chainId);
    return await reserve.getPoolProtocolFunds(poolAddress);
  }

  /**
   * Get loan amount for a pool
   */
  async getPoolLoan(chainId: number, poolAddress: string): Promise<bigint> {
    const reserve = this.getYieldReserveEscrow(chainId);
    return await reserve.getPoolLoan(poolAddress);
  }

  /**
   * Get loan amount for a specific position
   */
  async getPositionLoan(chainId: number, positionId: number): Promise<bigint> {
    const reserve = this.getYieldReserveEscrow(chainId);
    return await reserve.getPositionLoan(positionId);
  }

  /**
   * Get available balance for loans
   */
  async getAvailableForLoan(chainId: number): Promise<bigint> {
    const reserve = this.getYieldReserveEscrow(chainId);
    return await reserve.getAvailableForLoan();
  }

  /**
   * Get all tracked pools in yield reserve
   */
  async getYieldReserveTrackedPools(chainId: number): Promise<string[]> {
    const reserve = this.getYieldReserveEscrow(chainId);
    return await reserve.getTrackedPools();
  }

  /**
   * Get reserve investment details
   */
  async getReserveInvestment(
    chainId: number,
    investmentId: number,
  ): Promise<{
    pool: string;
    positionId: bigint;
    amount: bigint;
    expectedReturn: bigint;
    investedAt: bigint;
    active: boolean;
  }> {
    const reserve = this.getYieldReserveEscrow(chainId);
    return await reserve.getInvestment(investmentId);
  }

  // ============================================================================
  // LOCKED POOL ESCROW - READ METHODS
  // ============================================================================

  /**
   * Get locked pool escrow data
   */
  async getLockedPoolEscrowData(
    chainId: number,
    escrowAddress: string,
  ): Promise<{
    principalHeld: bigint;
    interestPaidOut: bigint;
    penaltiesCollected: bigint;
    protocolFundsFromReserve: bigint;
    protocolFundsDirectDeposit: bigint;
    totalBalance: bigint;
    depositFeesCollected: bigint;
    withdrawalFeesCollected: bigint;
  }> {
    const escrow = this.getLockedPoolEscrow(chainId, escrowAddress);
    const [
      principalHeld,
      interestPaidOut,
      penaltiesCollected,
      protocolFundsFromReserve,
      protocolFundsDirectDeposit,
      totalBalance,
      depositFeesCollected,
      withdrawalFeesCollected,
    ] = await Promise.all([
      escrow.getPrincipalHeld(),
      escrow.getInterestPaidOut(),
      escrow.getPenaltiesCollected(),
      escrow.getProtocolFundsFromReserve(),
      escrow.getProtocolFundsDirectDeposit(),
      escrow.getTotalBalance(),
      escrow.getDepositFeesCollected(),
      escrow.getWithdrawalFeesCollected(),
    ]);
    return {
      principalHeld,
      interestPaidOut,
      penaltiesCollected,
      protocolFundsFromReserve,
      protocolFundsDirectDeposit,
      totalBalance,
      depositFeesCollected,
      withdrawalFeesCollected,
    };
  }

  // ============================================================================
  // LOCKED POOL - USER TRANSACTION BUILDERS
  // ============================================================================

  /**
   * Build locked deposit transaction
   */
  buildLockedDepositTx(
    chainId: number,
    poolAddress: string,
    amount: bigint,
    tierIndex: number,
    interestPayment: 'UPFRONT' | 'AT_MATURITY',
  ): { to: string; data: string } {
    const pool = this.getLockedPool(chainId, poolAddress);
    const paymentEnum = interestPayment === 'UPFRONT' ? 0 : 1;
    const data = pool.interface.encodeFunctionData('depositLocked', [amount, tierIndex, paymentEnum]);
    return { to: pool.target as string, data };
  }

  /**
   * Build early exit transaction for locked position
   */
  buildEarlyExitTx(chainId: number, poolAddress: string, positionId: number): { to: string; data: string } {
    const pool = this.getLockedPool(chainId, poolAddress);
    const data = pool.interface.encodeFunctionData('earlyExitPosition', [positionId]);
    return { to: pool.target as string, data };
  }

  /**
   * Build redeem transaction for matured locked position
   */
  buildRedeemPositionTx(chainId: number, poolAddress: string, positionId: number): { to: string; data: string } {
    const pool = this.getLockedPool(chainId, poolAddress);
    const data = pool.interface.encodeFunctionData('redeemPosition', [positionId]);
    return { to: pool.target as string, data };
  }

  /**
   * Build set auto-rollover transaction
   */
  buildSetAutoRolloverTx(
    chainId: number,
    poolAddress: string,
    positionId: number,
    enabled: boolean,
  ): { to: string; data: string } {
    const pool = this.getLockedPool(chainId, poolAddress);
    const data = pool.interface.encodeFunctionData('setAutoRollover', [positionId, enabled]);
    return { to: pool.target as string, data };
  }

  /**
   * Build transfer position transaction
   */
  buildTransferPositionTx(
    chainId: number,
    poolAddress: string,
    positionId: number,
    newOwner: string,
  ): { to: string; data: string } {
    const pool = this.getLockedPool(chainId, poolAddress);
    const data = pool.interface.encodeFunctionData('transferPosition', [positionId, newOwner]);
    return { to: pool.target as string, data };
  }

  // ============================================================================
  // STABLE YIELD POOL - USER TRANSACTION BUILDERS
  // ============================================================================

  /**
   * Build deposit transaction for stable yield pool
   */
  buildStableYieldDepositTx(
    chainId: number,
    poolAddress: string,
    amount: bigint,
    receiver: string,
  ): { to: string; data: string } {
    const pool = this.getStableYieldPool(chainId, poolAddress);
    const data = pool.interface.encodeFunctionData('deposit', [amount, receiver]);
    return { to: pool.target as string, data };
  }

  /**
   * Build withdrawal transaction for stable yield pool
   */
  buildStableYieldWithdrawTx(
    chainId: number,
    poolAddress: string,
    shares: bigint,
    receiver: string,
    owner: string,
  ): { to: string; data: string } {
    const pool = this.getStableYieldPool(chainId, poolAddress);
    const data = pool.interface.encodeFunctionData('withdraw', [shares, receiver, owner]);
    return { to: pool.target as string, data };
  }

  // ============================================================================
  // SINGLE ASSET POOL - USER TRANSACTION BUILDERS
  // ============================================================================

  /**
   * Build deposit transaction for single asset (liquidity) pool
   */
  buildSingleAssetDepositTx(
    chainId: number,
    poolAddress: string,
    amount: bigint,
    receiver: string,
  ): { to: string; data: string } {
    const pool = this.getLiquidityPool(chainId, poolAddress);
    const data = pool.interface.encodeFunctionData('deposit', [amount, receiver]);
    return { to: pool.target as string, data };
  }

  /**
   * Build withdrawal transaction for single asset pool
   */
  buildSingleAssetWithdrawTx(
    chainId: number,
    poolAddress: string,
    shares: bigint,
    receiver: string,
    owner: string,
  ): { to: string; data: string } {
    const pool = this.getLiquidityPool(chainId, poolAddress);
    const data = pool.interface.encodeFunctionData('redeem', [shares, receiver, owner]);
    return { to: pool.target as string, data };
  }

  /**
   * Build claim coupon transaction for single asset pool
   */
  buildClaimCouponTx(chainId: number, poolAddress: string): { to: string; data: string } {
    const pool = this.getLiquidityPool(chainId, poolAddress);
    const data = pool.interface.encodeFunctionData('claimCoupon', []);
    return { to: pool.target as string, data };
  }
}
