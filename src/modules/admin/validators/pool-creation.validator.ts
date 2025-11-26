import { Injectable, BadRequestException } from '@nestjs/common';
import { BlockchainService } from '../../../blockchain/blockchain.service';
import { CreatePoolDto } from '../dtos/create-pool.dto';

@Injectable()
export class PoolCreationValidator {
  constructor(private blockchain: BlockchainService) {}

  async validate(dto: CreatePoolDto, chainId: number): Promise<void> {
    // 1. Validate asset is approved
    const isApproved = await this.blockchain.isAssetApproved(chainId, dto.asset);
    if (!isApproved) {
      throw new BadRequestException(
        `Asset ${dto.asset} is not approved in PoolRegistry. Please approve asset first.`,
      );
    }

    // 2. Type-specific validation (includes date validation for Single-Asset)
    if (dto.poolType === 'SINGLE_ASSET') {
      this.validateSingleAssetPool(dto);
    } else if (dto.poolType === 'STABLE_YIELD') {
      this.validateStableYieldPool(dto);
    }

    // 4. Validate minimum investment
    const minInvestment = parseFloat(dto.minInvestment);
    if (isNaN(minInvestment) || minInvestment <= 0) {
      throw new BadRequestException('Minimum investment must be greater than 0');
    }

    // 5. Validate target raise (if provided)
    if (dto.targetRaise) {
      const targetRaise = parseFloat(dto.targetRaise);
      if (isNaN(targetRaise) || targetRaise < 1000) {
        throw new BadRequestException('Target raise must be at least 1000');
      }
    }
  }

  private validateSingleAssetPool(dto: CreatePoolDto): void {
    // Must have epoch end time
    if (!dto.epochEndTime) {
      throw new BadRequestException('Epoch end time is required for Single-Asset pools');
    }

    // Must have maturity date
    if (!dto.maturityDate) {
      throw new BadRequestException('Maturity date is required for Single-Asset pools');
    }

    // Must have instrument type
    if (!dto.instrumentType) {
      throw new BadRequestException('Instrument type is required for Single-Asset pools');
    }

    // Must have target raise
    if (!dto.targetRaise) {
      throw new BadRequestException('Target raise is required for Single-Asset pools');
    }

    // Validate dates
    const now = new Date();
    const epochEndTime = new Date(dto.epochEndTime);
    const maturityDate = new Date(dto.maturityDate);

    if (epochEndTime <= now) {
      throw new BadRequestException('Epoch end time must be in the future');
    }

    if (maturityDate <= epochEndTime) {
      throw new BadRequestException('Maturity date must be after epoch end time');
    }

    // Validate discount rate for DISCOUNTED instruments
    if (dto.instrumentType === 'DISCOUNTED') {
      if (dto.discountRate === undefined || dto.discountRate === null) {
        throw new BadRequestException('Discount rate is required for DISCOUNTED instrument type');
      }
      if (dto.discountRate < 0 || dto.discountRate > 10000) {
        throw new BadRequestException('Discount rate must be between 0 and 10000 basis points');
      }
    }

    // Validate interest rate for INTEREST_BEARING instruments
    if (dto.instrumentType === 'INTEREST_BEARING') {
      // Interest rate validation can be added here if needed
    }
  }

  private validateStableYieldPool(dto: CreatePoolDto): void {
    // MUST have SPV address
    if (!dto.spvAddress) {
      throw new BadRequestException('SPV address is required for Stable Yield pools');
    }

    // Validate SPV address format (basic check)
    if (!/^0x[a-fA-F0-9]{40}$/.test(dto.spvAddress)) {
      throw new BadRequestException('Invalid SPV address format');
    }

    // Should NOT have maturity date
    if (dto.maturityDate) {
      throw new BadRequestException('Maturity date should not be provided for Stable Yield pools');
    }

    // Should NOT have discount rate
    if (dto.discountRate !== undefined && dto.discountRate !== null) {
      throw new BadRequestException('Discount rate should not be provided for Stable Yield pools');
    }

    // Should NOT have instrument type
    if (dto.instrumentType) {
      throw new BadRequestException(
        'Instrument type should not be provided for Stable Yield pools',
      );
    }

    // Should NOT have target raise (open-ended)
    if (dto.targetRaise) {
      throw new BadRequestException(
        'Target raise should not be provided for Stable Yield pools (open-ended)',
      );
    }
  }
}
