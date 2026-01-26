import { Injectable, Logger } from '@nestjs/common';
import { ethers } from 'ethers';
import { CONTRACT_ADDRESSES } from '../contracts/addresses';

import ManagerABI from '../contracts/abis/Manager.json';
import StableYieldManagerABI from '../contracts/abis/StableYieldManager.json';
import StableYieldEscrowABI from '../contracts/abis/StableYieldEscrow.json';
import LockedManagerABI from '../contracts/abis/LockedManager.json';
import PoolRegistryABI from '../contracts/abis/PoolRegistry.json';
import LiquidityPoolABI from '../contracts/abis/LiquidityPool.json';
import StableYieldPoolABI from '../contracts/abis/StableYieldPool.json';
import LockedPoolABI from '../contracts/abis/LockedPool.json';
import PoolFactoryABI from '../contracts/abis/PoolFactory.json';
import ManagedPoolFactoryABI from '../contracts/abis/ManagedPoolFactory.json';
import AccessManagerABI from '../contracts/abis/AccessManager.json';
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
      this.logger.warn(`Could not determine pool type for ${poolAddress}, defaulting to SINGLE_ASSET`);
      return 'SINGLE_ASSET';
    }
  }

  // ============================================================================
  // READ METHODS - COMMON
  // ============================================================================

  async getPoolTotalAssets(chainId: number, poolAddress: string, poolType: PoolType = 'SINGLE_ASSET'): Promise<bigint> {
    const pool = this.getPool(chainId, poolAddress, poolType);
    return await pool.totalAssets();
  }

  async getPoolTotalSupply(chainId: number, poolAddress: string, poolType: PoolType = 'SINGLE_ASSET'): Promise<bigint> {
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
  async getEscrowData(chainId: number, escrowAddress: string): Promise<{
    poolReserves: bigint;
    cashBuffer: bigint;
    accruedFees: bigint;
    totalFeesCollected: bigint;
    totalBalance: bigint;
  }> {
    const escrow = this.getStableYieldEscrow(chainId, escrowAddress);
    const [poolReserves, cashBuffer, accruedFees, totalFeesCollected, totalBalance] = await Promise.all([
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

  async getUserShares(chainId: number, poolAddress: string, userAddress: string, poolType: PoolType = 'SINGLE_ASSET'): Promise<bigint> {
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
  async getUserLockedPositions(chainId: number, poolAddress: string, userAddress: string): Promise<bigint[]> {
    const pool = this.getLockedPool(chainId, poolAddress);
    return await pool.getUserPositions(userAddress);
  }

  /**
   * Calculate early exit payout for a position
   */
  async calculateEarlyExitPayout(chainId: number, positionId: number): Promise<{
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
}
