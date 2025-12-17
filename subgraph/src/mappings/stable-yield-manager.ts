import { BigInt } from '@graphprotocol/graph-ts';
import {
  PoolRegistered,
  DepositValidated,
  WithdrawalValidated,
  WithdrawalQueued,
  WithdrawalProcessed,
  InstrumentPurchased,
  InstrumentMatured,
  CouponPaymentReceived as StableYieldCouponPayment,
  NAVUpdated,
  ReservesRebalanced,
  PoolDeactivated,
} from '../../generated/StableYieldManager/StableYieldManager';
import {
  Pool,
  Instrument,
  WithdrawalRequest,
  NAVSnapshot,
  CouponPayment,
} from '../../generated/schema';
import { POOL_STATUS_ACTIVE, POOL_STATUS_CLOSED } from '../utils/constants';
import { toDecimal, getInstrumentTypeString } from '../utils/helpers';

/**
 * Handle PoolRegistered - Stable Yield pool registered with manager
 */
export function handlePoolRegistered(event: PoolRegistered): void {
  let poolId = event.params.poolAddress.toHexString();
  let pool = Pool.load(poolId);
  if (pool === null) return;

  // Pool was already created by factory, this confirms registration
  pool.updatedAt = event.block.timestamp;
  pool.save();
}

/**
 * Handle DepositValidated - Manager validated deposit (already processed in pool)
 */
export function handleDepositValidated(event: DepositValidated): void {
  // Deposit already handled in pool contract
  // This is confirmation from manager side
}

/**
 * Handle WithdrawalValidated - Manager validated withdrawal
 */
export function handleWithdrawalValidated(event: WithdrawalValidated): void {
  // Withdrawal already handled in pool contract
  // event.params.immediate tells us if it was instant or queued
}

/**
 * Handle WithdrawalQueued - Withdrawal request added to queue
 */
export function handleWithdrawalQueued(event: WithdrawalQueued): void {
  let poolId = event.params.poolAddress.toHexString();
  let pool = Pool.load(poolId);
  if (pool === null) return;

  let sharesDecimal = toDecimal(event.params.shares, pool.assetDecimals);
  let estimatedValueDecimal = toDecimal(event.params.estimatedValue, pool.assetDecimals);

  // Create withdrawal request
  let requestId = poolId + '-' + event.params.requestId.toString();
  let request = new WithdrawalRequest(requestId);
  request.pool = pool.id;
  request.user = event.params.user.toHexString();
  request.requestId = event.params.requestId;
  request.shares = sharesDecimal;
  request.estimatedValue = estimatedValueDecimal;
  request.requestTime = event.block.timestamp;
  request.processed = false;
  request.txHash = event.transaction.hash;
  request.save();

  pool.updatedAt = event.block.timestamp;
  pool.save();
}

/**
 * Handle WithdrawalProcessed - Withdrawal request fulfilled
 */
export function handleWithdrawalProcessed(event: WithdrawalProcessed): void {
  let poolId = event.params.poolAddress.toHexString();
  let pool = Pool.load(poolId);
  if (pool === null) return;

  let actualValueDecimal = toDecimal(event.params.actualValue, pool.assetDecimals);
  let penaltyDecimal = toDecimal(event.params.penaltyDeducted, pool.assetDecimals);

  // Update withdrawal request
  let requestId = poolId + '-' + event.params.requestId.toString();
  let request = WithdrawalRequest.load(requestId);
  if (request !== null) {
    request.processed = true;
    request.processedTime = event.block.timestamp;
    request.actualValue = actualValueDecimal;
    request.penaltyDeducted = penaltyDecimal;
    request.save();
  }

  pool.updatedAt = event.block.timestamp;
  pool.save();
}

/**
 * Handle InstrumentPurchased - SPV purchased a new instrument
 */
export function handleInstrumentPurchased(event: InstrumentPurchased): void {
  let poolId = event.params.poolAddress.toHexString();
  let pool = Pool.load(poolId);
  if (pool === null) return;

  let purchasePriceDecimal = toDecimal(event.params.purchasePrice, pool.assetDecimals);
  let faceValueDecimal = toDecimal(event.params.faceValue, pool.assetDecimals);

  // Create instrument
  let instrumentId = poolId + '-' + event.params.instrumentId.toString();
  let instrument = new Instrument(instrumentId);
  instrument.pool = pool.id;
  instrument.instrumentId = event.params.instrumentId;
  instrument.instrumentType = getInstrumentTypeString(event.params.instrumentType);
  instrument.purchasePrice = purchasePriceDecimal;
  instrument.faceValue = faceValueDecimal;
  instrument.purchaseDate = event.block.timestamp;
  instrument.maturityDate = event.params.maturityDate;
  instrument.annualCouponRate = BigInt.fromI32(0); // Not in event, set later if needed
  instrument.couponFrequency = 0;
  instrument.couponsPaid = 0;
  instrument.isActive = true;
  instrument.createdAt = event.block.timestamp;
  instrument.save();

  pool.updatedAt = event.block.timestamp;
  pool.save();
}

/**
 * Handle InstrumentMatured - Instrument reached maturity
 */
export function handleInstrumentMatured(event: InstrumentMatured): void {
  let poolId = event.params.poolAddress.toHexString();
  let pool = Pool.load(poolId);
  if (pool === null) return;

  let faceValueDecimal = toDecimal(event.params.faceValue, pool.assetDecimals);
  let realizedYieldDecimal = toDecimal(event.params.realizedYield, pool.assetDecimals);

  // Update instrument
  let instrumentId = poolId + '-' + event.params.instrumentId.toString();
  let instrument = Instrument.load(instrumentId);
  if (instrument !== null) {
    instrument.isActive = false;
    instrument.realizedYield = realizedYieldDecimal;
    instrument.maturedAt = event.block.timestamp;
    instrument.save();
  }

  pool.updatedAt = event.block.timestamp;
  pool.save();
}

/**
 * Handle CouponPaymentReceived - Coupon received for specific instrument
 */
export function handleStableYieldCouponPayment(event: StableYieldCouponPayment): void {
  let poolId = event.params.poolAddress.toHexString();
  let pool = Pool.load(poolId);
  if (pool === null) return;

  let couponAmountDecimal = toDecimal(event.params.couponAmount, pool.assetDecimals);

  // Create coupon payment record
  let couponId =
    poolId +
    '-instrument-' +
    event.params.instrumentId.toString() +
    '-coupon-' +
    event.params.couponNumber.toString();
  let coupon = new CouponPayment(couponId);
  coupon.pool = pool.id;

  let instrumentId = poolId + '-' + event.params.instrumentId.toString();
  coupon.instrument = instrumentId;

  coupon.amount = couponAmountDecimal;
  coupon.couponNumber = event.params.couponNumber.toI32();
  coupon.timestamp = event.block.timestamp;
  coupon.blockNumber = event.block.number;
  coupon.txHash = event.transaction.hash;
  coupon.save();

  // Update instrument coupon count
  let instrument = Instrument.load(instrumentId);
  if (instrument !== null) {
    instrument.couponsPaid = instrument.couponsPaid + 1;
    instrument.save();
  }

  pool.totalCouponsDistributed = pool.totalCouponsDistributed.plus(couponAmountDecimal);
  pool.updatedAt = event.block.timestamp;
  pool.save();
}

/**
 * Handle NAVUpdated - Critical for Stable Yield pools
 */
export function handleNAVUpdated(event: NAVUpdated): void {
  let poolId = event.params.poolAddress.toHexString();
  let pool = Pool.load(poolId);
  if (pool === null) return;

  let totalNAVDecimal = toDecimal(event.params.totalNAV, pool.assetDecimals);
  let navPerShareDecimal = toDecimal(event.params.navPerShare, pool.assetDecimals);

  // Calculate totalShares from totalNAV / navPerShare if navPerShare > 0
  let totalSharesDecimal = pool.totalShares; // Keep existing value
  if (!navPerShareDecimal.equals(toDecimal(BigInt.fromI32(0), pool.assetDecimals))) {
    totalSharesDecimal = totalNAVDecimal.div(navPerShareDecimal);
  }

  // Update pool NAV
  pool.navPerShare = navPerShareDecimal;
  pool.lastNAVUpdate = event.block.timestamp;
  pool.totalValueLocked = totalNAVDecimal;
  pool.totalShares = totalSharesDecimal;
  pool.updatedAt = event.block.timestamp;
  pool.save();

  // Create NAV snapshot
  let snapshotId = poolId + '-nav-' + event.block.timestamp.toString();
  let snapshot = new NAVSnapshot(snapshotId);
  snapshot.pool = pool.id;
  snapshot.totalNAV = totalNAVDecimal;
  snapshot.navPerShare = navPerShareDecimal;
  snapshot.totalShares = totalSharesDecimal;
  snapshot.reason = event.params.reason;
  snapshot.timestamp = event.block.timestamp;
  snapshot.blockNumber = event.block.number;
  snapshot.save();
}

/**
 * Handle ReservesRebalanced - Liquidity management
 */
export function handleReservesRebalanced(event: ReservesRebalanced): void {
  let poolId = event.params.poolAddress.toHexString();
  let pool = Pool.load(poolId);
  if (pool === null) return;

  // Could track reserve ratios over time if needed
  pool.updatedAt = event.block.timestamp;
  pool.save();
}

/**
 * Handle PoolDeactivated - Pool no longer accepting deposits
 */
export function handlePoolDeactivated(event: PoolDeactivated): void {
  let poolId = event.params.poolAddress.toHexString();
  let pool = Pool.load(poolId);
  if (pool === null) return;

  pool.status = POOL_STATUS_CLOSED;
  pool.isActive = false;
  pool.updatedAt = event.block.timestamp;
  pool.save();
}
