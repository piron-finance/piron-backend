import { Injectable, Logger } from '@nestjs/common';
import { ethers } from 'ethers';
import { CONTRACT_ADDRESSES } from '../contracts/addresses';

import ManagerABI from '../contracts/abis/Manager.json';
import StableYieldManagerABI from '../contracts/abis/StableYieldManager.json';
import PoolRegistryABI from '../contracts/abis/PoolRegistry.json';
import LiquidityPoolABI from '../contracts/abis/LiquidityPool.json';
import StableYieldPoolABI from '../contracts/abis/StableYieldPool.json';
import PoolFactoryABI from '../contracts/abis/PoolFactory.json';
import ManagedPoolFactoryABI from '../contracts/abis/ManagedPoolFactory.json';
import AccessManagerABI from '../contracts/abis/AccessManager.json';
import IERC20ABI from '../contracts/abis/IERC20.json';

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
   * Get ManagedPoolFactory contract (Stable Yield)
   */
  getManagedPoolFactory(chainId: number): ethers.Contract {
    const address = CONTRACT_ADDRESSES[chainId]?.managedPoolFactory;
    if (!address) {
      throw new Error(`ManagedPoolFactory address not configured for chainId ${chainId}`);
    }
    return this.getContract(chainId, address, ManagedPoolFactoryABI);
  }

  /**
   * Get pool contract instance (auto-detect type)
   */
  getPool(chainId: number, poolAddress: string, isManagedPool = false): ethers.Contract {
    const abi = isManagedPool ? StableYieldPoolABI : LiquidityPoolABI;
    return this.getContract(chainId, poolAddress, abi);
  }

  /**
   * Get ERC20 token contract
   */
  getERC20(chainId: number, tokenAddress: string): ethers.Contract {
    return this.getContract(chainId, tokenAddress, IERC20ABI);
  }

  /**
   * Read Methods - Pool Data
   */

  async getPoolTotalAssets(chainId: number, poolAddress: string): Promise<bigint> {
    const pool = this.getPool(chainId, poolAddress);
    return await pool.totalAssets();
  }

  async getPoolTotalSupply(chainId: number, poolAddress: string): Promise<bigint> {
    const pool = this.getPool(chainId, poolAddress);
    return await pool.totalSupply();
  }

  async getUserShares(chainId: number, poolAddress: string, userAddress: string): Promise<bigint> {
    const pool = this.getPool(chainId, poolAddress);
    return await pool.balanceOf(userAddress);
  }

  async getNAVPerShare(chainId: number, poolAddress: string): Promise<bigint> {
    const pool = this.getPool(chainId, poolAddress, true); // Managed pool
    return await pool.getNAVPerShare();
  }

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
}
