import { Injectable, Logger, BadRequestException } from '@nestjs/common';
import { ethers } from 'ethers';
import { BlockchainService } from './blockchain.service';

export interface PoolCreationParams {
  poolType: 'SINGLE_ASSET' | 'STABLE_YIELD';
  asset: string;
  targetRaise: string; // In asset units (e.g., "1000000" for USDC)
  minInvestment: string;
  epochEndTime?: Date; // Required for Single-Asset, not for Stable Yield
  maturityDate?: Date;
  discountRate?: number; // Basis points
  instrumentType?: 'DISCOUNTED' | 'INTEREST_BEARING';
  name: string;
  spvAddress?: string; // Required for Stable Yield pools
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
    if (params.poolType === 'SINGLE_ASSET') {
      return this.buildSingleAssetPoolTx(chainId, params);
    } else {
      return this.buildStableYieldPoolTx(chainId, params);
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

    // Get asset decimals
    const assetContract = this.blockchain.getERC20(chainId, params.asset);
    const decimals = await assetContract.decimals();

    // Convert amounts to proper decimals
    const targetRaiseWei = ethers.parseUnits(params.targetRaise, decimals);
    const minInvestmentWei = ethers.parseUnits(params.minInvestment, decimals);

    // Convert dates to Unix timestamps
    const epochEndTime = Math.floor(params.epochEndTime.getTime() / 1000);
    const maturityDate = Math.floor(params.maturityDate.getTime() / 1000);
    const epochDuration = maturityDate - epochEndTime; // Duration from epoch end to maturity

    // Build PoolConfig struct
    const poolConfig = {
      asset: params.asset,
      instrumentType: params.instrumentType === 'DISCOUNTED' ? 0 : 1, // 0 = DISCOUNTED, 1 = INTEREST_BEARING
      instrumentName: params.name, // Use pool name as instrument name
      targetRaise: targetRaiseWei,
      epochDuration: epochDuration,
      maturityDate: maturityDate,
      discountRate: params.discountRate || 0,
      spvAddress: process.env.DEFAULT_SPV_ADDRESS || ethers.ZeroAddress,
      couponDates: [], // No coupons for now (used for interest-bearing bonds)
      couponRates: [], // No coupons for now
      minimumFundingThreshold: minInvestmentWei,
    };

    // Encode function call with struct parameter
    const data = factory.interface.encodeFunctionData('createPool', [poolConfig]);

    this.logger.log(
      `Built Single-Asset pool creation tx: asset=${params.asset}, targetRaise=${
        params.targetRaise
      }, maturity=${params.maturityDate.toISOString()}`,
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
      ethers.getAddress(params.spvAddress); // Will throw if invalid
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
      poolSymbol: `sy${params.name.substring(0, 10).replace(/\s/g, '')}`, // Generate symbol from name
      spvAddress: ethers.getAddress(params.spvAddress), // Use checksum address
      supportedTenors: [], // No fixed tenors for flexible yield
      minInvestment: minInvestmentWei,
      expenseRatio: 0, // 0 basis points for now
      underlyingPools: [], // Start with empty, admin can add later
    };

    // Encode function call with struct parameter
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
   * Parse PoolCreated event from transaction receipt
   */
  parsePoolCreatedEvent(
    receipt: ethers.TransactionReceipt,
    poolType: 'SINGLE_ASSET' | 'STABLE_YIELD',
  ): {
    poolAddress: string;
    escrowAddress: string;
    asset: string;
  } | null {
    try {
      // Get the appropriate factory interface
      const factory =
        poolType === 'SINGLE_ASSET'
          ? this.blockchain.getPoolFactory(84532) // chainId will be passed properly
          : this.blockchain.getManagedPoolFactory(84532);

      // Parse logs
      for (const log of receipt.logs) {
        try {
          const parsed = factory.interface.parseLog({
            topics: log.topics as string[],
            data: log.data,
          });

          // Check for different event names based on pool type
          const eventName = poolType === 'SINGLE_ASSET' ? 'PoolCreated' : 'StableYieldPoolCreated';

          if (parsed && parsed.name === eventName) {
            return {
              poolAddress: parsed.args.pool || parsed.args.poolAddress,
              escrowAddress: parsed.args.escrow || parsed.args.escrowAddress,
              asset: parsed.args.asset,
            };
          }
        } catch (e) {
          // Not a PoolCreated event from our factory, continue
          continue;
        }
      }

      return null;
    } catch (error) {
      this.logger.error(`Error parsing PoolCreated event: ${error.message}`);
      return null;
    }
  }
}
