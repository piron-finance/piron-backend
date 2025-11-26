import { Injectable, NotFoundException, Logger } from '@nestjs/common';
import { PrismaService } from '../../prisma.service';
import { BlockchainService } from '../../blockchain/blockchain.service';
import { AllocateToSPVDto, AddInstrumentDto, MatureInstrumentDto } from './dtos/spv-operations.dto';
import { ethers } from 'ethers';
import StableYieldManagerABI from '../../contracts/abis/StableYieldManager.json';
import { CONTRACT_ADDRESSES } from '../../contracts/addresses';
import { OperationStatus } from '@prisma/client';

@Injectable()
export class SpvService {
  private readonly logger = new Logger(SpvService.name);

  constructor(
    private prisma: PrismaService,
    private blockchain: BlockchainService,
  ) {}

  async allocateToSPV(dto: AllocateToSPVDto, chainId = 84532) {
    const pool = await this.prisma.pool.findFirst({
      where: {
        poolAddress: dto.poolAddress.toLowerCase(),
        chainId,
      },
    });

    if (!pool) {
      throw new NotFoundException('Pool not found');
    }

    const stableYieldManager = this.blockchain.getStableYieldManager(chainId);
    const assetContract = this.blockchain.getERC20(chainId, pool.assetAddress);
    const decimals = await assetContract.decimals();
    const amountWei = ethers.parseUnits(dto.amount, decimals);

    const data = stableYieldManager.interface.encodeFunctionData('allocateToSPV', [
      dto.poolAddress,
      dto.spvAddress,
      amountWei,
    ]);

    const addresses = CONTRACT_ADDRESSES[chainId];

    await this.prisma.sPVOperation.create({
      data: {
        poolId: pool.id,
        operationType: 'WITHDRAW_FOR_INVESTMENT',
        amount: dto.amount,
        status: 'PENDING',
        initiatedBy: 'admin',
        notes: `Allocate ${dto.amount} ${pool.assetSymbol} to SPV`,
      },
    });

    return {
      transaction: {
        to: addresses.stableYieldManager,
        data,
        value: '0',
        description: `Allocate ${dto.amount} ${pool.assetSymbol} to SPV`,
      },
    };
  }

  async addInstrument(dto: AddInstrumentDto, chainId = 84532) {
    const pool = await this.prisma.pool.findFirst({
      where: {
        poolAddress: dto.poolAddress.toLowerCase(),
        chainId,
      },
    });

    if (!pool) {
      throw new NotFoundException('Pool not found');
    }

    const stableYieldManager = this.blockchain.getStableYieldManager(chainId);
    const assetContract = this.blockchain.getERC20(chainId, pool.assetAddress);
    const decimals = await assetContract.decimals();

    const purchasePriceWei = ethers.parseUnits(dto.purchasePrice, decimals);
    const faceValueWei = ethers.parseUnits(dto.faceValue, decimals);
    const maturityTimestamp = Math.floor(new Date(dto.maturityDate).getTime() / 1000);

    const data = stableYieldManager.interface.encodeFunctionData('addInstrument', [
      dto.poolAddress,
      dto.instrumentType === 'DISCOUNTED' ? 0 : 1,
      purchasePriceWei,
      faceValueWei,
      maturityTimestamp,
      dto.annualCouponRate || 0,
      dto.couponFrequency || 0,
    ]);

    const addresses = CONTRACT_ADDRESSES[chainId];

    const instrumentCount = await this.prisma.instrument.count({
      where: { poolId: pool.id },
    });

    await this.prisma.instrument.create({
      data: {
        poolId: pool.id,
        instrumentId: instrumentCount + 1,
        instrumentType: dto.instrumentType,
        purchasePrice: dto.purchasePrice,
        faceValue: dto.faceValue,
        purchaseDate: new Date(),
        maturityDate: new Date(dto.maturityDate),
        annualCouponRate: dto.annualCouponRate,
        couponFrequency: dto.couponFrequency,
        isActive: true,
      },
    });

    return {
      transaction: {
        to: addresses.stableYieldManager,
        data,
        value: '0',
        description: `Add ${dto.instrumentType} instrument to ${pool.name}`,
      },
    };
  }

  async matureInstrument(dto: MatureInstrumentDto, chainId = 84532) {
    const pool = await this.prisma.pool.findFirst({
      where: {
        poolAddress: dto.poolAddress.toLowerCase(),
        chainId,
      },
    });

    if (!pool) {
      throw new NotFoundException('Pool not found');
    }

    const instrument = await this.prisma.instrument.findUnique({
      where: { id: dto.instrumentId },
    });

    if (!instrument || instrument.poolId !== pool.id) {
      throw new NotFoundException('Instrument not found');
    }

    const stableYieldManager = this.blockchain.getStableYieldManager(chainId);

    const data = stableYieldManager.interface.encodeFunctionData('matureInstrument', [
      dto.poolAddress,
      dto.instrumentId,
    ]);

    const addresses = CONTRACT_ADDRESSES[chainId];

    await this.prisma.instrument.update({
      where: { id: dto.instrumentId },
      data: {
        isActive: false,
        maturedAt: new Date(),
      },
    });

    return {
      transaction: {
        to: addresses.stableYieldManager,
        data,
        value: '0',
        description: `Mature instrument in ${pool.name}`,
      },
    };
  }

  async getPoolInstruments(poolAddress: string, chainId = 84532) {
    const pool = await this.prisma.pool.findFirst({
      where: {
        poolAddress: poolAddress.toLowerCase(),
        chainId,
      },
      include: {
        instruments: {
          orderBy: { maturityDate: 'asc' },
        },
      },
    });

    if (!pool) {
      throw new NotFoundException('Pool not found');
    }

    return {
      poolAddress: pool.poolAddress,
      poolName: pool.name,
      instruments: pool.instruments,
      summary: {
        total: pool.instruments.length,
        active: pool.instruments.filter((i) => i.isActive).length,
        matured: pool.instruments.filter((i) => !i.isActive && i.maturedAt).length,
      },
    };
  }

  async getOperations(page = 1, limit = 20, statusFilter?: string) {
    const skip = (page - 1) * limit;

    const where = statusFilter ? { status: statusFilter as OperationStatus } : {};

    const [operations, total] = await Promise.all([
      this.prisma.sPVOperation.findMany({
        where,
        skip,
        take: limit,
        orderBy: { initiatedAt: 'desc' },
        include: {
          pool: {
            select: {
              poolAddress: true,
              name: true,
              assetSymbol: true,
            },
          },
        },
      }),
      this.prisma.sPVOperation.count({ where }),
    ]);

    return {
      operations,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  async getAnalyticsOverview() {
    const [totalOperations, pendingOperations, totalInstruments, upcomingMaturities] =
      await Promise.all([
        this.prisma.sPVOperation.count(),
        this.prisma.sPVOperation.count({ where: { status: 'PENDING' } }),
        this.prisma.instrument.count({ where: { isActive: true } }),
        this.prisma.instrument.findMany({
          where: {
            isActive: true,
            maturityDate: {
              gte: new Date(),
              lte: new Date(Date.now() + 90 * 24 * 60 * 60 * 1000),
            },
          },
          orderBy: { maturityDate: 'asc' },
          take: 10,
          include: {
            pool: {
              select: {
                name: true,
                poolAddress: true,
                assetSymbol: true,
              },
            },
          },
        }),
      ]);

    const totalAllocated = await this.prisma.sPVOperation.aggregate({
      where: { operationType: 'WITHDRAW_FOR_INVESTMENT', status: 'COMPLETED' },
      _sum: { amount: true },
    });

    return {
      overview: {
        totalOperations,
        pendingOperations,
        totalInstruments,
        totalAllocated: totalAllocated._sum?.amount?.toString() || '0',
      },
      upcomingMaturities,
    };
  }

  async getMaturities(days = 90) {
    const endDate = new Date(Date.now() + days * 24 * 60 * 60 * 1000);

    const maturities = await this.prisma.instrument.findMany({
      where: {
        isActive: true,
        maturityDate: {
          gte: new Date(),
          lte: endDate,
        },
      },
      orderBy: { maturityDate: 'asc' },
      include: {
        pool: {
          select: {
            name: true,
            poolAddress: true,
            assetSymbol: true,
          },
        },
      },
    });

    const groupedByMonth = maturities.reduce((acc: any, instrument) => {
      const month = instrument.maturityDate.toISOString().substring(0, 7);
      if (!acc[month]) {
        acc[month] = [];
      }
      acc[month].push(instrument);
      return acc;
    }, {});

    const totalValue = maturities.reduce(
      (sum, i) => sum + parseFloat(i.faceValue.toString()),
      0,
    );

    return {
      maturities,
      groupedByMonth,
      summary: {
        total: maturities.length,
        totalValue: totalValue.toString(),
      },
    };
  }

  async getPools(includeInactive = false) {
    const pools = await this.prisma.pool.findMany({
      where: includeInactive ? {} : { isActive: true },
      include: {
        analytics: true,
        instruments: {
          where: { isActive: true },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    return pools;
  }

  async getPoolById(poolAddress: string, chainId = 84532) {
    const pool = await this.prisma.pool.findFirst({
      where: {
        poolAddress: poolAddress.toLowerCase(),
        chainId,
      },
      include: {
        analytics: true,
        instruments: {
          orderBy: { maturityDate: 'asc' },
        },
        spvOperations: {
          take: 20,
          orderBy: { initiatedAt: 'desc' },
        },
      },
    });

    if (!pool) {
      throw new NotFoundException('Pool not found');
    }

    return pool;
  }
}
