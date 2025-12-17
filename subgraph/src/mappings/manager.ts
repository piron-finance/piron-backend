import { BigInt } from '@graphprotocol/graph-ts';
import {
  Deposit as ManagerDeposit,
  CouponPaymentReceived,
  CouponDistributed,
  CouponClaimed as ManagerCouponClaimed,
  InvestmentConfirmed,
  MaturityProcessed,
  PoolFilled,
  PoolCancelled,
  EmergencyStateChanged,
  PoolPaused,
  PoolUnpaused,
  SPVFundsWithdrawn,
  SPVFundsReturned,
} from '../../generated/Manager/Manager';
import { Pool, CouponPayment, EmergencyEvent } from '../../generated/schema';
import {
  POOL_STATUS_FUNDED,
  POOL_STATUS_ACTIVE,
  POOL_STATUS_EMERGENCY,
  POOL_STATUS_CANCELLED,
  POOL_STATUS_MATURED,
  EMERGENCY_EVENT_PAUSE,
  EMERGENCY_EVENT_UNPAUSE,
  EMERGENCY_EVENT_EMERGENCY_STATE,
  EMERGENCY_EVENT_CANCELLATION,
} from '../utils/constants';
import { toDecimal } from '../utils/helpers';

/**
 * Handle Deposit from Manager (informational - already handled in pool)
 */
export function handleManagerDeposit(event: ManagerDeposit): void {
  // This event is emitted by Manager but already processed in pool handler
  // We can use it for cross-validation or additional logic if needed
}

/**
 * Handle CouponPaymentReceived - SPV sent coupon payment to manager
 */
export function handleCouponPaymentReceived(event: CouponPaymentReceived): void {
  let poolId = event.params.pool.toHexString();
  let pool = Pool.load(poolId);
  if (pool === null) return;

  let amountDecimal = toDecimal(event.params.amount, pool.assetDecimals);

  // Create coupon payment record
  let couponId = poolId + '-coupon-' + event.block.timestamp.toString();
  let coupon = new CouponPayment(couponId);
  coupon.pool = pool.id;
  coupon.instrument = null; // Manager level, not instrument specific
  coupon.amount = amountDecimal;
  coupon.couponNumber = 0; // Manager doesn't specify which coupon
  coupon.timestamp = event.block.timestamp;
  coupon.blockNumber = event.block.number;
  coupon.txHash = event.transaction.hash;
  coupon.save();

  pool.updatedAt = event.block.timestamp;
  pool.save();
}

/**
 * Handle CouponDistributed - Manager distributed coupons to pool contract
 */
export function handleCouponDistributed(event: CouponDistributed): void {
  let poolId = event.params.liquidityPool.toHexString();
  let pool = Pool.load(poolId);
  if (pool === null) return;

  let amountDecimal = toDecimal(event.params.amount, pool.assetDecimals);

  pool.totalCouponsDistributed = pool.totalCouponsDistributed.plus(amountDecimal);
  pool.updatedAt = event.block.timestamp;
  pool.save();
}

/**
 * Handle CouponClaimed from Manager level
 */
export function handleCouponClaimed(event: ManagerCouponClaimed): void {
  let poolId = event.params.pool.toHexString();
  let pool = Pool.load(poolId);
  if (pool === null) return;

  // Already handled in pool level, this is just for consistency
  pool.updatedAt = event.block.timestamp;
  pool.save();
}

/**
 * Handle InvestmentConfirmed - SPV confirmed off-chain purchase
 */
export function handleInvestmentConfirmed(event: InvestmentConfirmed): void {
  // This is at manager level, affects specific pool via context
  // Could track proof hashes if needed for audit trail
}

/**
 * Handle MaturityProcessed - Pool matured, final settlement
 */
export function handleMaturityProcessed(event: MaturityProcessed): void {
  // Need to determine which pool this affects - event doesn't include pool address
  // This would need to be tracked via transaction context
}

/**
 * Handle PoolFilled - Pool reached target, moved to FUNDED status
 */
export function handlePoolFilled(event: PoolFilled): void {
  let poolId = event.params.pool.toHexString();
  let pool = Pool.load(poolId);
  if (pool === null) return;

  pool.status = POOL_STATUS_FUNDED;
  pool.updatedAt = event.block.timestamp;
  pool.save();
}

/**
 * Handle PoolCancelled - Pool was cancelled before funding completed
 */
export function handlePoolCancelled(event: PoolCancelled): void {
  let poolId = event.params.poolAddress.toHexString();
  let pool = Pool.load(poolId);
  if (pool === null) return;

  pool.status = POOL_STATUS_CANCELLED;
  pool.isActive = false;
  pool.updatedAt = event.block.timestamp;
  pool.save();

  // Create emergency event record
  let emergencyId = poolId + '-cancelled-' + event.block.timestamp.toString();
  let emergency = new EmergencyEvent(emergencyId);
  emergency.pool = pool.id;
  emergency.eventType = EMERGENCY_EVENT_CANCELLATION;
  emergency.trigger = 'Pool cancelled';
  emergency.caller = event.params.cancelledBy;
  emergency.timestamp = event.block.timestamp;
  emergency.blockNumber = event.block.number;
  emergency.txHash = event.transaction.hash;
  emergency.save();
}

/**
 * Handle EmergencyStateChanged - Pool entered emergency mode
 */
export function handleEmergencyStateChanged(event: EmergencyStateChanged): void {
  let poolId = event.params.poolAddress.toHexString();
  let pool = Pool.load(poolId);
  if (pool === null) return;

  pool.status = POOL_STATUS_EMERGENCY;
  pool.updatedAt = event.block.timestamp;
  pool.save();

  let totalAmountDecimal = toDecimal(event.params.totalAmount, pool.assetDecimals);
  let totalSharesDecimal = toDecimal(event.params.totalShares, pool.assetDecimals);

  // Create emergency event record
  let emergencyId = poolId + '-emergency-' + event.block.timestamp.toString();
  let emergency = new EmergencyEvent(emergencyId);
  emergency.pool = pool.id;
  emergency.eventType = EMERGENCY_EVENT_EMERGENCY_STATE;
  emergency.trigger = event.params.trigger;
  emergency.totalAmount = totalAmountDecimal;
  emergency.totalShares = totalSharesDecimal;
  emergency.timestamp = event.block.timestamp;
  emergency.blockNumber = event.block.number;
  emergency.txHash = event.transaction.hash;
  emergency.save();
}

/**
 * Handle PoolPaused
 */
export function handlePoolPaused(event: PoolPaused): void {
  let poolId = event.params.pool.toHexString();
  let pool = Pool.load(poolId);
  if (pool === null) return;

  pool.isPaused = true;
  pool.updatedAt = event.block.timestamp;
  pool.save();

  // Create emergency event record
  let emergencyId = poolId + '-pause-' + event.block.timestamp.toString();
  let emergency = new EmergencyEvent(emergencyId);
  emergency.pool = pool.id;
  emergency.eventType = EMERGENCY_EVENT_PAUSE;
  emergency.timestamp = event.block.timestamp;
  emergency.blockNumber = event.block.number;
  emergency.txHash = event.transaction.hash;
  emergency.save();
}

/**
 * Handle PoolUnpaused
 */
export function handlePoolUnpaused(event: PoolUnpaused): void {
  let poolId = event.params.pool.toHexString();
  let pool = Pool.load(poolId);
  if (pool === null) return;

  pool.isPaused = false;
  pool.updatedAt = event.block.timestamp;
  pool.save();

  // Create emergency event record
  let emergencyId = poolId + '-unpause-' + event.block.timestamp.toString();
  let emergency = new EmergencyEvent(emergencyId);
  emergency.pool = pool.id;
  emergency.eventType = EMERGENCY_EVENT_UNPAUSE;
  emergency.timestamp = event.block.timestamp;
  emergency.blockNumber = event.block.number;
  emergency.txHash = event.transaction.hash;
  emergency.save();
}

/**
 * Handle SPVFundsWithdrawn - SPV withdrew funds to purchase instruments
 */
export function handleSPVFundsWithdrawn(event: SPVFundsWithdrawn): void {
  let poolId = event.params.pool.toHexString();
  let pool = Pool.load(poolId);
  if (pool === null) return;

  // Pool is now in ACTIVE state (funds deployed)
  if (pool.status == POOL_STATUS_FUNDED) {
    pool.status = POOL_STATUS_ACTIVE;
  }
  
  pool.updatedAt = event.block.timestamp;
  pool.save();
}

/**
 * Handle SPVFundsReturned - SPV returned funds (maturity or coupon)
 */
export function handleSPVFundsReturned(event: SPVFundsReturned): void {
  let poolId = event.params.pool.toHexString();
  let pool = Pool.load(poolId);
  if (pool === null) return;

  let amountDecimal = toDecimal(event.params.amount, pool.assetDecimals);
  
  // Check if this is maturity (large amount suggests full principal return)
  // Could set to MATURED status if appropriate
  
  pool.updatedAt = event.block.timestamp;
  pool.save();
}

