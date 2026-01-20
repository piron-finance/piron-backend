import { Injectable, Logger, BadRequestException } from '@nestjs/common';
import { ethers } from 'ethers';
import { BlockchainService, PoolType } from './blockchain.service';

export interface LockTierConfig {
  durationDays: number;      // 90, 180, 365
  apyBps: number;            // 500 = 5%
  earlyExitPenaltyBps: number; // 1000 = 10%
  minDeposit: string;        // In asset units
  isActive: boolean;
}

export interface PoolCreationParams {
  poolType: PoolType;
  asset: string;
  targetRaise?: string;      // In asset units (e.g., "1000000" for USDC) - Single-Asset only
  minInvestment: string;
  epochEndTime?: Date;       // Required for Single-Asset
  maturityDate?: Date;       // Required for Single-Asset
  discountRate?: number;     // Basis points - Single-Asset only
  instrumentType?: 'DISCOUNTED' | 'INTEREST_BEARING'; // Single-Asset only
  name: string;
  symbol?: string;           // Pool token symbol
  spvAddress: string;        // Required for all pool types
  // Locked Pool specific
  initialTiers?: LockTierConfig[];
}

export interface TransactionData {
  to: string;
  data: string;
  value: string;
  description: string;
}

@Injectable()
export class PoolBuilderService {
  private readonly logger = new Logger(PoolBuilderService.name);

  constructor(private blockchain: BlockchainService) {}

  /**
   * Build pool creation transaction based on type
   */
  async buildPoolCreationTx(chainId: number, params: PoolCreationParams): Promise<TransactionData> {
    switch (params.poolType) {
      case 'SINGLE_ASSET':
        return this.buildSingleAssetPoolTx(chainId, params);
      case 'STABLE_YIELD':
        return this.buildStableYieldPoolTx(chainId, params);
      case 'LOCKED':
        return this.buildLockedPoolTx(chainId, params);
      default:
        throw new BadRequestException(`Unknown pool type: ${params.poolType}`);
    }
  }

  /**
   * Build Single-Asset pool creation transaction
   */
  private async buildSingleAssetPoolTx(
    chainId: number,
    params: PoolCreationParams,
  ): Promise<TransactionData> {
    const factory = this.blockchain.getPoolFactory(chainId);

    // Validate Single-Asset specific params
    if (!params.epochEndTime) {
      throw new BadRequestException('Epoch end time required for Single-Asset pools');
    }
    if (!params.maturityDate) {
      throw new BadRequestException('Maturity date required for Single-Asset pools');
    }
    if (!params.instrumentType) {
      throw new BadRequestException('Instrument type required for Single-Asset pools');
    }
    if (params.instrumentType === 'DISCOUNTED' && !params.discountRate) {
      throw new BadRequestException('Discount rate required for DISCOUNTED instrument type');
    }
    if (!params.spvAddress || params.spvAddress === ethers.ZeroAddress) {
      throw new BadRequestException('SPV address is required for Single-Asset pools');
    }

    // Get asset decimals
    const assetContract = this.blockchain.getERC20(chainId, params.asset);
    const decimals = await assetContract.decimals();

    // Convert amounts to proper decimals
    const targetRaiseWei = ethers.parseUnits(params.targetRaise || '0', decimals);
    const minInvestmentWei = ethers.parseUnits(params.minInvestment, decimals);

    // Convert dates to Unix timestamps
    const epochEndTime = Math.floor(params.epochEndTime.getTime() / 1000);
    const maturityDate = Math.floor(params.maturityDate.getTime() / 1000);
    const epochDuration = maturityDate - epochEndTime;

    // Build PoolConfig struct
    const poolConfig = {
      asset: params.asset,
      instrumentType: params.instrumentType === 'DISCOUNTED' ? 0 : 1,
      instrumentName: params.name,
      targetRaise: targetRaiseWei,
      epochDuration: epochDuration,
      maturityDate: maturityDate,
      discountRate: params.discountRate || 0,
      spvAddress: ethers.getAddress(params.spvAddress),
      couponDates: [],
      couponRates: [],
      minimumFundingThreshold: minInvestmentWei,
      minInvestment: minInvestmentWei,
      withdrawalFeeBps: 0,
    };

    const data = factory.interface.encodeFunctionData('createPool', [poolConfig]);

    this.logger.log(
      `Built Single-Asset pool creation tx: asset=${params.asset}, targetRaise=${params.targetRaise}`,
    );

    return {
      to: await factory.getAddress(),
      data,
      value: '0',
      description: `Create Single-Asset pool: ${params.name}`,
    };
  }

  /**
   * Build Stable Yield pool creation transaction
   */
  private async buildStableYieldPoolTx(
    chainId: number,
    params: PoolCreationParams,
  ): Promise<TransactionData> {
    const factory = this.blockchain.getManagedPoolFactory(chainId);

    // Validate Stable Yield specific params
    if (!params.spvAddress || params.spvAddress === ethers.ZeroAddress) {
      throw new BadRequestException(
        'SPV address is required for Stable Yield pools and cannot be zero address',
      );
    }

    // Validate it's a proper Ethereum address
    try {
      ethers.getAddress(params.spvAddress);
    } catch (error) {
      throw new BadRequestException(`Invalid SPV address: ${params.spvAddress}`);
    }

    // Get asset decimals
    const assetContract = this.blockchain.getERC20(chainId, params.asset);
    const decimals = await assetContract.decimals();

    // Convert amounts to proper decimals
    const minInvestmentWei = ethers.parseUnits(params.minInvestment, decimals);

    // Build PoolDeploymentConfig struct for StableYield pool
    const poolConfig = {
      asset: params.asset,
      poolName: params.name,
      poolSymbol: params.symbol || `sy${params.name.substring(0, 10).replace(/\s/g, '')}`,
      spvAddress: ethers.getAddress(params.spvAddress),
      minInvestment: minInvestmentWei,
      depositFeeBps: 0,
      withdrawalFeeBps: 0,
      holdingPeriodDays: 0,
    };

    const data = factory.interface.encodeFunctionData('createStableYieldPool', [poolConfig]);

    this.logger.log(
      `Built Stable Yield pool creation tx: asset=${params.asset}, name=${params.name}`,
    );

    return {
      to: await factory.getAddress(),
      data,
      value: '0',
      description: `Create Stable Yield pool: ${params.name}`,
    };
  }

  /**
   * Build Locked pool creation transaction
   */
  private async buildLockedPoolTx(
    chainId: number,
    params: PoolCreationParams,
  ): Promise<TransactionData> {
    const factory = this.blockchain.getManagedPoolFactory(chainId);

    // Validate Locked pool specific params
    if (!params.spvAddress || params.spvAddress === ethers.ZeroAddress) {
      throw new BadRequestException(
        'SPV address is required for Locked pools and cannot be zero address',
      );
    }

    if (!params.initialTiers || params.initialTiers.length === 0) {
      throw new BadRequestException('At least one lock tier is required for Locked pools');
    }

    // Validate tiers
    for (let i = 0; i < params.initialTiers.length; i++) {
      const tier = params.initialTiers[i];
      if (tier.durationDays <= 0) {
        throw new BadRequestException(`Tier ${i}: Duration must be positive`);
      }
      if (tier.apyBps < 0 || tier.apyBps > 10000) {
        throw new BadRequestException(`Tier ${i}: APY must be between 0 and 10000 basis points`);
      }
      if (tier.earlyExitPenaltyBps < 0 || tier.earlyExitPenaltyBps > 10000) {
        throw new BadRequestException(`Tier ${i}: Early exit penalty must be between 0 and 10000 basis points`);
      }
    }

    // Get asset decimals
    const assetContract = this.blockchain.getERC20(chainId, params.asset);
    const decimals = await assetContract.decimals();

    // Convert amounts to proper decimals
    const minInvestmentWei = ethers.parseUnits(params.minInvestment, decimals);

    // Convert tier configs to contract format
    const tiersForContract = params.initialTiers.map(tier => ({
      durationDays: tier.durationDays,
      apyBps: tier.apyBps,
      earlyExitPenaltyBps: tier.earlyExitPenaltyBps,
      minDeposit: ethers.parseUnits(tier.minDeposit, decimals),
      isActive: tier.isActive,
    }));

    // Build LockedPoolDeploymentConfig struct
    const poolConfig = {
      asset: params.asset,
      poolName: params.name,
      poolSymbol: params.symbol || `lp${params.name.substring(0, 10).replace(/\s/g, '')}`,
      spvAddress: ethers.getAddress(params.spvAddress),
      minInvestment: minInvestmentWei,
      initialTiers: tiersForContract,
    };

    const data = factory.interface.encodeFunctionData('createLockedPool', [poolConfig]);

    this.logger.log(
      `Built Locked pool creation tx: asset=${params.asset}, name=${params.name}, tiers=${params.initialTiers.length}`,
    );

    return {
      to: await factory.getAddress(),
      data,
      value: '0',
      description: `Create Locked pool: ${params.name} with ${params.initialTiers.length} tier(s)`,
    };
  }

  /**
   * Parse PoolCreated event from transaction receipt
   */
  parsePoolCreatedEvent(
    receipt: ethers.TransactionReceipt,
    poolType: PoolType,
    chainId: number = 84532,
  ): {
    poolAddress: string;
    escrowAddress: string;
    asset: string;
  } | null {
    try {
      let factory: ethers.Contract;
      let eventName: string;

      switch (poolType) {
        case 'SINGLE_ASSET':
          factory = this.blockchain.getPoolFactory(chainId);
          eventName = 'PoolCreated';
          break;
        case 'STABLE_YIELD':
          factory = this.blockchain.getManagedPoolFactory(chainId);
          eventName = 'StableYieldPoolCreated';
          break;
        case 'LOCKED':
          factory = this.blockchain.getManagedPoolFactory(chainId);
          eventName = 'LockedPoolCreated';
          break;
        default:
          throw new Error(`Unknown pool type: ${poolType}`);
      }

      // Parse logs
      for (const log of receipt.logs) {
        try {
          const parsed = factory.interface.parseLog({
            topics: log.topics as string[],
            data: log.data,
          });

          if (parsed && parsed.name === eventName) {
            return {
              poolAddress: parsed.args.pool || parsed.args.poolAddress,
              escrowAddress: parsed.args.escrow || parsed.args.escrowAddress,
              asset: parsed.args.asset,
            };
          }
        } catch (e) {
          // Not our event, continue
          continue;
        }
      }

      return null;
    } catch (error) {
      this.logger.error(`Error parsing PoolCreated event: ${error.message}`);
      return null;
    }
  }

  /**
   * Parse lock tiers from LockedPoolCreated event or manager state
   */
  async parseLockedPoolTiers(
    chainId: number,
    poolAddress: string,
  ): Promise<{
    tierIndex: number;
    durationDays: number;
    apyBps: number;
    earlyExitPenaltyBps: number;
    minDeposit: bigint;
    isActive: boolean;
  }[]> {
    try {
      const manager = this.blockchain.getLockedPoolManager(chainId);
      const tiers = await manager.getPoolTiers(poolAddress);

      return tiers.map((tier: any, index: number) => ({
        tierIndex: index,
        durationDays: Number(tier.durationDays),
        apyBps: Number(tier.apyBps),
        earlyExitPenaltyBps: Number(tier.earlyExitPenaltyBps),
        minDeposit: tier.minDeposit,
        isActive: tier.isActive,
      }));
    } catch (error) {
      this.logger.error(`Error fetching lock tiers for ${poolAddress}: ${error.message}`);
      return [];
    }
  }
}
