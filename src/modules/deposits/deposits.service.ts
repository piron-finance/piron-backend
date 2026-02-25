import { Injectable, NotFoundException, BadRequestException, Logger } from '@nestjs/common';
import { PrismaService } from '../../prisma.service';
import { BlockchainService } from '../../blockchain/blockchain.service';
import { PoolStatus } from '@prisma/client';
import { CreateDepositDto, CreateLockedDepositDto } from './dtos/deposit.dto';
import { ethers } from 'ethers';
import LiquidityPoolABI from '../../contracts/abis/LiquidityPool.json';
import StableYieldPoolABI from '../../contracts/abis/StableYieldPool.json';
import LockedPoolABI from '../../contracts/abis/LockedPool.json';

@Injectable()
export class DepositsService {
  private readonly logger = new Logger(DepositsService.name);

  constructor(private prisma: PrismaService, private blockchain: BlockchainService) {}

  /**
   * Build deposit transaction for Single-Asset or Stable Yield pools
   */
  async buildDepositTransaction(dto: CreateDepositDto, chainId = 84532) {
    this.logger.log(`Building deposit tx for pool ${dto.poolAddress}, amount ${dto.amount}`);

    const pool = await this.prisma.pool.findFirst({
      where: {
        poolAddress: dto.poolAddress.toLowerCase(),
        chainId,
      },
    });

    if (!pool) {
      throw new NotFoundException('Pool not found');
    }

    if (pool.isPaused) {
      throw new BadRequestException('Pool is currently paused');
    }

    if (pool.status === 'MATURED' || pool.status === 'WITHDRAWN' || pool.status === 'CANCELLED') {
      throw new BadRequestException(`Cannot deposit to pool with status: ${pool.status}`);
    }

    if (pool.poolType === 'LOCKED') {
      throw new BadRequestException('Use buildLockedDepositTransaction for LOCKED pools');
    }

    const amount = parseFloat(dto.amount);
    const minInvestment = parseFloat(pool.minInvestment.toString());

    if (amount < minInvestment) {
      throw new BadRequestException(`Amount must be at least ${minInvestment} ${pool.assetSymbol}`);
    }

    const amountWei = ethers.parseUnits(dto.amount, pool.assetDecimals);
    const receiverAddress = ethers.getAddress(dto.receiver);

    const poolABI = pool.poolType === 'STABLE_YIELD' ? StableYieldPoolABI : LiquidityPoolABI;
    const poolContract = this.blockchain.getContract(chainId, pool.poolAddress, poolABI);

    const data = poolContract.interface.encodeFunctionData('deposit', [amountWei, receiverAddress]);

    this.logger.log(
      `Built deposit tx: ${dto.amount} ${pool.assetSymbol} to ${pool.name} for ${dto.receiver}`,
    );

    return {
      transaction: {
        to: pool.poolAddress,
        data,
        value: '0',
        description: `Deposit ${dto.amount} ${pool.assetSymbol} to ${pool.name}`,
      },
      deposit: {
        amount: dto.amount,
        amountWei: amountWei.toString(),
        receiver: dto.receiver,
        poolAddress: pool.poolAddress,
        poolName: pool.name,
        poolType: pool.poolType,
        assetSymbol: pool.assetSymbol,
        assetAddress: pool.assetAddress,
      },
      approval: {
        required: true,
        spender: pool.poolAddress,
        token: pool.assetAddress,
        amount: amountWei.toString(),
      },
    };
  }

  /**
   * Build deposit transaction for Locked pools with tier and interest payment selection
   */
  async buildLockedDepositTransaction(dto: CreateLockedDepositDto, chainId = 84532) {
    this.logger.log(
      `Building locked deposit tx for pool ${dto.poolAddress}, amount ${dto.amount}, tier ${dto.tierIndex}`,
    );

    const pool = await this.prisma.pool.findFirst({
      where: {
        poolAddress: dto.poolAddress.toLowerCase(),
        chainId,
      },
      include: {
        lockTiers: {
          where: { tierIndex: dto.tierIndex },
        },
      },
    });

    if (!pool) {
      throw new NotFoundException('Pool not found');
    }

    if (pool.poolType !== 'LOCKED') {
      throw new BadRequestException('Pool is not a Locked pool. Use buildDepositTransaction instead.');
    }

    if (pool.isPaused) {
      throw new BadRequestException('Pool is currently paused');
    }

    if (pool.status !== PoolStatus.FUNDING && pool.status !== PoolStatus.INVESTED) {
      throw new BadRequestException(`Cannot deposit to pool with status: ${pool.status}`);
    }

    const tier = pool.lockTiers[0];
    if (!tier) {
      throw new NotFoundException(`Tier ${dto.tierIndex} not found for this pool`);
    }

    if (!tier.isActive) {
      throw new BadRequestException(`Tier ${dto.tierIndex} is not active`);
    }

    const amount = parseFloat(dto.amount);
    const minInvestment = parseFloat(pool.minInvestment.toString());
    const tierMinDeposit = parseFloat(tier.minDeposit.toString());

    if (amount < minInvestment) {
      throw new BadRequestException(`Amount must be at least ${minInvestment} ${pool.assetSymbol}`);
    }

    if (amount < tierMinDeposit) {
      throw new BadRequestException(
        `Amount must be at least ${tierMinDeposit} ${pool.assetSymbol} for tier ${dto.tierIndex}`,
      );
    }

    const amountWei = ethers.parseUnits(dto.amount, pool.assetDecimals);
    const interestPayment = dto.interestPayment || 'AT_MATURITY';
    const interestPaymentEnum = interestPayment === 'UPFRONT' ? 0 : 1;

    const poolContract = this.blockchain.getContract(chainId, pool.poolAddress, LockedPoolABI);
    const data = poolContract.interface.encodeFunctionData('depositLocked', [
      amountWei,
      dto.tierIndex,
      interestPaymentEnum,
    ]);

    const preview = await this.blockchain.previewLockedInterest(
      chainId,
      pool.poolAddress,
      amountWei,
      dto.tierIndex,
    );

    const lockEndDate = new Date(Date.now() + tier.durationDays * 24 * 60 * 60 * 1000);

    this.logger.log(
      `Built locked deposit tx: ${dto.amount} ${pool.assetSymbol} to ${pool.name} tier ${dto.tierIndex}`,
    );

    return {
      transaction: {
        to: pool.poolAddress,
        data,
        value: '0',
        description: `Lock ${dto.amount} ${pool.assetSymbol} in ${pool.name} for ${tier.durationDays} days`,
      },
      deposit: {
        amount: dto.amount,
        amountWei: amountWei.toString(),
        depositor: dto.depositor,
        poolAddress: pool.poolAddress,
        poolName: pool.name,
        poolType: 'LOCKED',
        assetSymbol: pool.assetSymbol,
        assetAddress: pool.assetAddress,
        tierIndex: dto.tierIndex,
        interestPayment,
      },
      tier: {
        tierIndex: dto.tierIndex,
        durationDays: tier.durationDays,
        apyBps: tier.apyBps,
        apyPercent: (tier.apyBps / 100).toFixed(2),
        earlyExitPenaltyBps: tier.earlyExitPenaltyBps,
        earlyExitPenaltyPercent: (tier.earlyExitPenaltyBps / 100).toFixed(2),
        minDeposit: tier.minDeposit.toString(),
      },
      projection: {
        interest: (Number(preview.interest) / 10 ** pool.assetDecimals).toString(),
        investedAmount: (Number(preview.investedAmount) / 10 ** pool.assetDecimals).toString(),
        maturityPayout: (Number(preview.maturityPayout) / 10 ** pool.assetDecimals).toString(),
        lockEndDate: lockEndDate.toISOString(),
        interestPaymentTiming: interestPayment,
      },
      approval: {
        required: true,
        spender: pool.poolAddress,
        token: pool.assetAddress,
        amount: amountWei.toString(),
      },
    };
  }

  /**
   * Get available lock tiers for a pool
   */
  async getPoolLockTiers(poolAddress: string, chainId = 84532) {
    const pool = await this.prisma.pool.findFirst({
      where: {
        poolAddress: poolAddress.toLowerCase(),
        chainId,
      },
      include: {
        lockTiers: {
          orderBy: { tierIndex: 'asc' },
        },
      },
    });

    if (!pool) {
      throw new NotFoundException('Pool not found');
    }

    if (pool.poolType !== 'LOCKED') {
      return { tiers: [], message: 'Pool is not a Locked pool' };
    }

    return {
      poolAddress: pool.poolAddress,
      poolName: pool.name,
      assetSymbol: pool.assetSymbol,
      minInvestment: pool.minInvestment.toString(),
      tiers: pool.lockTiers.map((tier) => ({
        tierIndex: tier.tierIndex,
        durationDays: tier.durationDays,
        apyBps: tier.apyBps,
        apyPercent: (tier.apyBps / 100).toFixed(2),
        earlyExitPenaltyBps: tier.earlyExitPenaltyBps,
        earlyExitPenaltyPercent: (tier.earlyExitPenaltyBps / 100).toFixed(2),
        minDeposit: tier.minDeposit.toString(),
        isActive: tier.isActive,
      })),
    };
  }
}
