import { BigInt } from '@graphprotocol/graph-ts';
import {
  Deposit,
  Withdraw,
  WithdrawalRequested,
  HoldingPeriodViolation,
  Paused,
  Unpaused,
} from '../../generated/templates/StableYieldPool/StableYieldPool';
import { Pool, Transaction } from '../../generated/schema';
import {
  TX_TYPE_DEPOSIT,
  TX_TYPE_WITHDRAWAL,
  TX_STATUS_CONFIRMED,
} from '../utils/constants';
import {
  getOrCreateUser,
  getOrCreatePosition,
  getOrCreateProtocolMetrics,
  getOrCreateDailySnapshot,
  toDecimal,
  updatePositionValue,
  createTransactionId,
} from '../utils/helpers';

/**
 * Handle Deposit event from StableYieldPool
 */
export function handleDeposit(event: Deposit): void {
  let poolId = event.address.toHexString();
  let pool = Pool.load(poolId);
  if (pool === null) return;

  let user = getOrCreateUser(event.params.owner, event.block.timestamp);
  let position = getOrCreatePosition(user, pool, event.block.timestamp);

  let assetsDecimal = toDecimal(event.params.assets, pool.assetDecimals);
  let sharesDecimal = toDecimal(event.params.shares, pool.assetDecimals);

  // Update position
  position.totalDeposited = position.totalDeposited.plus(assetsDecimal);
  position.totalShares = position.totalShares.plus(sharesDecimal);
  position.lastDepositAt = event.block.timestamp;
  if (position.firstDepositAt === null) {
    position.firstDepositAt = event.block.timestamp;
  }
  updatePositionValue(position, pool);
  position.save();

  // Update user
  user.totalDeposited = user.totalDeposited.plus(assetsDecimal);
  user.totalValueLocked = user.totalValueLocked.plus(assetsDecimal);
  user.save();

  // Update pool
  pool.totalValueLocked = pool.totalValueLocked.plus(assetsDecimal);
  pool.totalShares = pool.totalShares.plus(sharesDecimal);
  pool.totalDeposits = pool.totalDeposits.plus(assetsDecimal);
  pool.updatedAt = event.block.timestamp;
  pool.save();

  // Update daily snapshot
  let snapshot = getOrCreateDailySnapshot(pool, event.block.timestamp);
  snapshot.dailyDeposits = snapshot.dailyDeposits.plus(assetsDecimal);
  snapshot.dailyVolume = snapshot.dailyVolume.plus(assetsDecimal);
  snapshot.uniqueDepositors = snapshot.uniqueDepositors + 1;
  snapshot.totalValueLocked = pool.totalValueLocked;
  snapshot.totalShares = pool.totalShares;
  snapshot.navPerShare = pool.navPerShare;
  snapshot.save();

  // Update protocol metrics
  let protocol = getOrCreateProtocolMetrics();
  protocol.totalValueLocked = protocol.totalValueLocked.plus(assetsDecimal);
  protocol.totalDeposits = protocol.totalDeposits.plus(assetsDecimal);
  protocol.totalTransactions = protocol.totalTransactions + 1;
  protocol.updatedAt = event.block.timestamp;
  protocol.save();

  // Create transaction
  let tx = new Transaction(createTransactionId(event));
  tx.txHash = event.transaction.hash;
  tx.logIndex = event.logIndex;
  tx.user = user.id;
  tx.pool = pool.id;
  tx.type = TX_TYPE_DEPOSIT;
  tx.status = TX_STATUS_CONFIRMED;
  tx.amount = assetsDecimal;
  tx.shares = sharesDecimal;
  tx.timestamp = event.block.timestamp;
  tx.blockNumber = event.block.number;
  tx.save();
}

/**
 * Handle Withdraw event
 */
export function handleWithdraw(event: Withdraw): void {
  let poolId = event.address.toHexString();
  let pool = Pool.load(poolId);
  if (pool === null) return;

  let user = getOrCreateUser(event.params.owner, event.block.timestamp);
  let position = getOrCreatePosition(user, pool, event.block.timestamp);

  let assetsDecimal = toDecimal(event.params.assets, pool.assetDecimals);
  let sharesDecimal = toDecimal(event.params.shares, pool.assetDecimals);

  // Update position
  position.totalWithdrawn = position.totalWithdrawn.plus(assetsDecimal);
  position.totalShares = position.totalShares.minus(sharesDecimal);
  position.realizedReturn = position.realizedReturn.plus(assetsDecimal.minus(position.totalDeposited));
  updatePositionValue(position, pool);
  
  // Mark as inactive if no shares left
  if (position.totalShares.equals(toDecimal(BigInt.fromI32(0), pool.assetDecimals))) {
    position.isActive = false;
  }
  position.save();

  // Update user
  user.totalWithdrawn = user.totalWithdrawn.plus(assetsDecimal);
  user.totalValueLocked = user.totalValueLocked.minus(assetsDecimal);
  user.save();

  // Update pool
  pool.totalValueLocked = pool.totalValueLocked.minus(assetsDecimal);
  pool.totalShares = pool.totalShares.minus(sharesDecimal);
  pool.totalWithdrawals = pool.totalWithdrawals.plus(assetsDecimal);
  pool.updatedAt = event.block.timestamp;
  pool.save();

  // Update daily snapshot
  let snapshot = getOrCreateDailySnapshot(pool, event.block.timestamp);
  snapshot.dailyWithdrawals = snapshot.dailyWithdrawals.plus(assetsDecimal);
  snapshot.dailyVolume = snapshot.dailyVolume.plus(assetsDecimal);
  snapshot.uniqueWithdrawers = snapshot.uniqueWithdrawers + 1;
  snapshot.totalValueLocked = pool.totalValueLocked;
  snapshot.totalShares = pool.totalShares;
  snapshot.navPerShare = pool.navPerShare;
  snapshot.save();

  // Update protocol metrics
  let protocol = getOrCreateProtocolMetrics();
  protocol.totalValueLocked = protocol.totalValueLocked.minus(assetsDecimal);
  protocol.totalWithdrawals = protocol.totalWithdrawals.plus(assetsDecimal);
  protocol.totalTransactions = protocol.totalTransactions + 1;
  protocol.updatedAt = event.block.timestamp;
  protocol.save();

  // Create transaction
  let tx = new Transaction(createTransactionId(event));
  tx.txHash = event.transaction.hash;
  tx.logIndex = event.logIndex;
  tx.user = user.id;
  tx.pool = pool.id;
  tx.type = TX_TYPE_WITHDRAWAL;
  tx.status = TX_STATUS_CONFIRMED;
  tx.amount = assetsDecimal;
  tx.shares = sharesDecimal;
  tx.timestamp = event.block.timestamp;
  tx.blockNumber = event.block.number;
  tx.save();
}

/**
 * Handle WithdrawalRequested event
 * Note: This is logged but actual processing happens in StableYieldManager
 */
export function handleWithdrawalRequested(event: WithdrawalRequested): void {
  let poolId = event.address.toHexString();
  let pool = Pool.load(poolId);
  if (pool === null) return;

  // Just update pool timestamp - withdrawal request entity created in manager handler
  pool.updatedAt = event.block.timestamp;
  pool.save();
}

/**
 * Handle HoldingPeriodViolation event
 * This is informational - user tried to withdraw too early
 */
export function handleHoldingPeriodViolation(event: HoldingPeriodViolation): void {
  // Could create a separate entity for violations if needed for analytics
  // For now, we just log it implicitly via the event being indexed
}

/**
 * Handle Paused event
 */
export function handlePaused(event: Paused): void {
  let poolId = event.address.toHexString();
  let pool = Pool.load(poolId);
  if (pool === null) return;

  pool.isPaused = true;
  pool.updatedAt = event.block.timestamp;
  pool.save();
}

/**
 * Handle Unpaused event
 */
export function handleUnpaused(event: Unpaused): void {
  let poolId = event.address.toHexString();
  let pool = Pool.load(poolId);
  if (pool === null) return;

  pool.isPaused = false;
  pool.updatedAt = event.block.timestamp;
  pool.save();
}

