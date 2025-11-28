import { Injectable, NotFoundException, BadRequestException, Logger } from '@nestjs/common';
import { PrismaService } from '../../prisma.service';
import { BlockchainService } from '../../blockchain/blockchain.service';
import { CreateDepositDto } from './dtos/deposit.dto';
import { ethers } from 'ethers';
import LiquidityPoolABI from '../../contracts/abis/LiquidityPool.json';
import StableYieldPoolABI from '../../contracts/abis/StableYieldPool.json';

@Injectable()
export class DepositsService {
  private readonly logger = new Logger(DepositsService.name);

  constructor(private prisma: PrismaService, private blockchain: BlockchainService) {}

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
}
