import { Address } from '@graphprotocol/graph-ts';
import { StableYieldPoolCreated } from '../../generated/ManagedPoolFactory/ManagedPoolFactory';
import { StableYieldPool as StableYieldPoolTemplate } from '../../generated/templates';
import { StableYieldPool } from '../../generated/ManagedPoolFactory/StableYieldPool';
import { Pool } from '../../generated/schema';
import { ZERO_BD, ONE_BD, POOL_TYPE_STABLE_YIELD, POOL_STATUS_FUNDING } from '../utils/constants';
import { getOrCreateProtocolMetrics, getTokenInfo } from '../utils/helpers';

/**
 * Handle Stable Yield Pool creation
 */
export function handleStableYieldPoolCreated(event: StableYieldPoolCreated): void {
  let poolAddress = event.params.poolAddress;
  let poolContract = StableYieldPool.bind(poolAddress);

  // Create pool entity
  let pool = new Pool(poolAddress.toHexString());
  pool.poolAddress = poolAddress;
  pool.poolType = POOL_TYPE_STABLE_YIELD;
  pool.asset = event.params.asset;
  pool.escrowAddress = event.params.escrowAddress;
  pool.spvAddress = event.params.spvAddress;

  // Get token info
  let tokenInfo = getTokenInfo(event.params.asset);
  pool.assetSymbol = tokenInfo.get('symbol')!;
  pool.assetDecimals = I32.parseInt(tokenInfo.get('decimals')!);

  // Get pool details from contract
  let nameResult = poolContract.try_name();
  let symbolResult = poolContract.try_symbol();
  let managerResult = poolContract.try_stableYieldManager();

  pool.name = nameResult.reverted ? event.params.poolName : nameResult.value;
  pool.symbol = symbolResult.reverted ? '' : symbolResult.value;
  pool.managerAddress = managerResult.reverted ? Address.zero() : managerResult.value;

  // Initialize NAV at 1.0
  pool.navPerShare = ONE_BD;
  pool.lastNAVUpdate = event.block.timestamp;

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
  protocol.totalStableYieldPools = protocol.totalStableYieldPools + 1;
  protocol.updatedAt = event.block.timestamp;
  protocol.save();

  // Create dynamic data source to track this pool's events
  StableYieldPoolTemplate.create(poolAddress);
}
