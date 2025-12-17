import { Address, BigInt } from '@graphprotocol/graph-ts';
import { PoolCreated } from '../../generated/PoolFactory/PoolFactory';
import { LiquidityPool as LiquidityPoolTemplate } from '../../generated/templates';
import { LiquidityPool } from '../../generated/PoolFactory/LiquidityPool';
import { Pool } from '../../generated/schema';
import {
  ZERO_BD,
  POOL_TYPE_SINGLE_ASSET,
  POOL_STATUS_FUNDING,
} from '../utils/constants';
import { getOrCreateProtocolMetrics, getTokenInfo, toDecimal } from '../utils/helpers';

/**
 * Handle Single-Asset Pool creation
 */
export function handlePoolCreated(event: PoolCreated): void {
  let poolAddress = event.params.pool;
  let poolContract = LiquidityPool.bind(poolAddress);

  // Create pool entity
  let pool = new Pool(poolAddress.toHexString());
  pool.poolAddress = poolAddress;
  pool.poolType = POOL_TYPE_SINGLE_ASSET;
  pool.asset = event.params.asset;
  pool.managerAddress = event.params.manager;

  // Get token info
  let tokenInfo = getTokenInfo(event.params.asset);
  pool.assetSymbol = tokenInfo.get('symbol')!;
  pool.assetDecimals = I32.parseInt(tokenInfo.get('decimals')!);

  // Get pool details from contract
  let nameResult = poolContract.try_name();
  let symbolResult = poolContract.try_symbol();
  let escrowResult = poolContract.try_escrow();

  pool.name = nameResult.reverted ? event.params.instrumentName : nameResult.value;
  pool.symbol = symbolResult.reverted ? '' : symbolResult.value;
  pool.escrowAddress = escrowResult.reverted ? Address.zero() : escrowResult.value;

  // Set pool parameters
  pool.targetRaise = toDecimal(event.params.targetRaise, pool.assetDecimals);
  pool.maturityDate = event.params.maturityDate;
  pool.instrumentType = event.params.instrumentName;

  // Initialize status and metrics
  pool.status = POOL_STATUS_FUNDING;
  pool.isActive = true;
  pool.isPaused = false;
  pool.totalValueLocked = ZERO_BD;
  pool.totalShares = ZERO_BD;
  pool.uniqueInvestors = 0;
  pool.totalDeposits = ZERO_BD;
  pool.totalWithdrawals = ZERO_BD;
  pool.totalCouponsDistributed = ZERO_BD;
  pool.totalDiscountEarned = ZERO_BD;

  // Timestamps
  pool.createdAt = event.block.timestamp;
  pool.createdAtBlock = event.block.number;
  pool.updatedAt = event.block.timestamp;

  pool.save();

  // Update protocol metrics
  let protocol = getOrCreateProtocolMetrics();
  protocol.totalPools = protocol.totalPools + 1;
  protocol.totalSingleAssetPools = protocol.totalSingleAssetPools + 1;
  protocol.updatedAt = event.block.timestamp;
  protocol.save();

  // Create dynamic data source to track this pool's events
  LiquidityPoolTemplate.create(poolAddress);
}

