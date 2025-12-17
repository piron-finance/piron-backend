import { BigInt } from '@graphprotocol/graph-ts';
import {
  Deposit,
  Withdraw,
  CouponClaimed,
  DiscountAccrued,
  EmergencyWithdrawal,
  RefundClaimed,
  Paused,
  Unpaused,
} from '../../generated/templates/LiquidityPool/LiquidityPool';
import { Pool, Transaction } from '../../generated/schema';
import {
  TX_TYPE_DEPOSIT,
  TX_TYPE_WITHDRAWAL,
  TX_TYPE_COUPON_CLAIM,
  TX_TYPE_REFUND,
  TX_TYPE_EMERGENCY_WITHDRAWAL,
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
 * Handle Deposit event from LiquidityPool
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
  position.realizedReturn = position.realizedReturn.plus(
    assetsDecimal.minus(position.totalDeposited),
  );
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
 * Handle CouponClaimed event
 */
export function handleCouponClaimed(event: CouponClaimed): void {
  let poolId = event.address.toHexString();
  let pool = Pool.load(poolId);
  if (pool === null) return;

  let user = getOrCreateUser(event.params.user, event.block.timestamp);
  let position = getOrCreatePosition(user, pool, event.block.timestamp);

  let amountDecimal = toDecimal(event.params.amount, pool.assetDecimals);

  // Update position
  position.totalCouponsClaimed = position.totalCouponsClaimed.plus(amountDecimal);
  position.realizedReturn = position.realizedReturn.plus(amountDecimal);
  position.save();

  // Update pool
  pool.totalCouponsDistributed = pool.totalCouponsDistributed.plus(amountDecimal);
  pool.updatedAt = event.block.timestamp;
  pool.save();

  // Create transaction
  let tx = new Transaction(createTransactionId(event));
  tx.txHash = event.transaction.hash;
  tx.logIndex = event.logIndex;
  tx.user = user.id;
  tx.pool = pool.id;
  tx.type = TX_TYPE_COUPON_CLAIM;
  tx.status = TX_STATUS_CONFIRMED;
  tx.amount = amountDecimal;
  tx.shares = toDecimal(BigInt.fromI32(0), pool.assetDecimals);
  tx.timestamp = event.block.timestamp;
  tx.blockNumber = event.block.number;
  tx.save();

  // Update protocol
  let protocol = getOrCreateProtocolMetrics();
  protocol.totalTransactions = protocol.totalTransactions + 1;
  protocol.updatedAt = event.block.timestamp;
  protocol.save();
}

/**
 * Handle DiscountAccrued event
 */
export function handleDiscountAccrued(event: DiscountAccrued): void {
  let poolId = event.address.toHexString();
  let pool = Pool.load(poolId);
  if (pool === null) return;

  let user = getOrCreateUser(event.params.user, event.block.timestamp);
  let position = getOrCreatePosition(user, pool, event.block.timestamp);

  let amountDecimal = toDecimal(event.params.amount, pool.assetDecimals);

  // Update position
  position.totalDiscountAccrued = position.totalDiscountAccrued.plus(amountDecimal);
  position.save();

  // Update pool
  pool.totalDiscountEarned = pool.totalDiscountEarned.plus(amountDecimal);
  pool.updatedAt = event.block.timestamp;
  pool.save();
}

/**
 * Handle EmergencyWithdrawal event
 */
export function handleEmergencyWithdrawal(event: EmergencyWithdrawal): void {
  let poolId = event.address.toHexString();
  let pool = Pool.load(poolId);
  if (pool === null) return;

  let user = getOrCreateUser(event.params.user, event.block.timestamp);
  let position = getOrCreatePosition(user, pool, event.block.timestamp);

  let refundDecimal = toDecimal(event.params.refundAmount, pool.assetDecimals);
  let sharesDecimal = toDecimal(event.params.sharesBurned, pool.assetDecimals);

  // Update position
  position.totalWithdrawn = position.totalWithdrawn.plus(refundDecimal);
  position.totalShares = position.totalShares.minus(sharesDecimal);
  position.isActive = false;
  position.save();

  // Update pool
  pool.totalValueLocked = pool.totalValueLocked.minus(refundDecimal);
  pool.totalShares = pool.totalShares.minus(sharesDecimal);
  pool.updatedAt = event.block.timestamp;
  pool.save();

  // Create transaction
  let tx = new Transaction(createTransactionId(event));
  tx.txHash = event.transaction.hash;
  tx.logIndex = event.logIndex;
  tx.user = user.id;
  tx.pool = pool.id;
  tx.type = TX_TYPE_EMERGENCY_WITHDRAWAL;
  tx.status = TX_STATUS_CONFIRMED;
  tx.amount = refundDecimal;
  tx.shares = sharesDecimal;
  tx.timestamp = event.block.timestamp;
  tx.blockNumber = event.block.number;
  tx.save();

  // Update protocol
  let protocol = getOrCreateProtocolMetrics();
  protocol.totalTransactions = protocol.totalTransactions + 1;
  protocol.updatedAt = event.block.timestamp;
  protocol.save();
}

/**
 * Handle RefundClaimed event
 */
export function handleRefundClaimed(event: RefundClaimed): void {
  let poolId = event.address.toHexString();
  let pool = Pool.load(poolId);
  if (pool === null) return;

  let user = getOrCreateUser(event.params.user, event.block.timestamp);

  let amountDecimal = toDecimal(event.params.amount, pool.assetDecimals);

  // Create transaction
  let tx = new Transaction(createTransactionId(event));
  tx.txHash = event.transaction.hash;
  tx.logIndex = event.logIndex;
  tx.user = user.id;
  tx.pool = pool.id;
  tx.type = TX_TYPE_REFUND;
  tx.status = TX_STATUS_CONFIRMED;
  tx.amount = amountDecimal;
  tx.shares = toDecimal(BigInt.fromI32(0), pool.assetDecimals);
  tx.timestamp = event.block.timestamp;
  tx.blockNumber = event.block.number;
  tx.save();

  // Update protocol
  let protocol = getOrCreateProtocolMetrics();
  protocol.totalTransactions = protocol.totalTransactions + 1;
  protocol.updatedAt = event.block.timestamp;
  protocol.save();
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
