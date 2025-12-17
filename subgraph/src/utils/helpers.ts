import { Address, BigDecimal, BigInt, Bytes, ethereum, TypedMap } from '@graphprotocol/graph-ts';
import { User, Pool, Position, ProtocolMetrics, PoolDailySnapshot } from '../../generated/schema';
import {
  ZERO_ADDRESS,
  ZERO_BI,
  ZERO_BD,
  PROTOCOL_ID,
  DEFAULT_DECIMALS,
  SECONDS_PER_DAY,
} from './constants';
import { IERC20 } from '../../generated/PoolFactory/IERC20';

/**
 * Convert BigInt to BigDecimal with decimals
 */
export function toDecimal(value: BigInt, decimals: number = DEFAULT_DECIMALS): BigDecimal {
  let precision = BigInt.fromI32(10)
    .pow(decimals as u8)
    .toBigDecimal();
  return value.toBigDecimal().div(precision);
}

/**
 * Get or create User entity
 */
export function getOrCreateUser(address: Address, timestamp: BigInt): User {
  let userId = address.toHexString();
  let user = User.load(userId);

  if (user === null) {
    user = new User(userId);
    user.walletAddress = address;
    user.totalDeposited = ZERO_BD;
    user.totalWithdrawn = ZERO_BD;
    user.totalValueLocked = ZERO_BD;
    user.poolCount = 0;
    user.firstInteractionAt = timestamp;
    user.lastInteractionAt = timestamp;
    user.save();

    // Update protocol metrics
    let protocol = getOrCreateProtocolMetrics();
    protocol.totalUsers = protocol.totalUsers + 1;
    protocol.updatedAt = timestamp;
    protocol.save();
  }

  user.lastInteractionAt = timestamp;
  user.save();

  return user;
}

/**
 * Get or create Position entity
 */
export function getOrCreatePosition(user: User, pool: Pool, timestamp: BigInt): Position {
  let positionId = user.id + '-' + pool.id;
  let position = Position.load(positionId);

  if (position === null) {
    position = new Position(positionId);
    position.user = user.id;
    position.pool = pool.id;
    position.totalDeposited = ZERO_BD;
    position.totalWithdrawn = ZERO_BD;
    position.totalShares = ZERO_BD;
    position.currentValue = ZERO_BD;
    position.unrealizedReturn = ZERO_BD;
    position.realizedReturn = ZERO_BD;
    position.totalCouponsClaimed = ZERO_BD;
    position.totalDiscountAccrued = ZERO_BD;
    position.isActive = true;
    position.createdAt = timestamp;
    position.updatedAt = timestamp;
    position.save();

    // Increment user's pool count
    user.poolCount = user.poolCount + 1;
    user.save();

    // Increment pool's unique investors
    pool.uniqueInvestors = pool.uniqueInvestors + 1;
    pool.save();
  }

  position.updatedAt = timestamp;
  position.save();

  return position;
}

/**
 * Get or create Protocol Metrics
 */
export function getOrCreateProtocolMetrics(): ProtocolMetrics {
  let protocol = ProtocolMetrics.load(PROTOCOL_ID);

  if (protocol === null) {
    protocol = new ProtocolMetrics(PROTOCOL_ID);
    protocol.totalValueLocked = ZERO_BD;
    protocol.totalPools = 0;
    protocol.totalUsers = 0;
    protocol.totalTransactions = 0;
    protocol.totalSingleAssetPools = 0;
    protocol.totalStableYieldPools = 0;
    protocol.totalDeposits = ZERO_BD;
    protocol.totalWithdrawals = ZERO_BD;
    protocol.updatedAt = ZERO_BI;
    protocol.save();
  }

  return protocol;
}

/**
 * Get or create daily snapshot
 */
export function getOrCreateDailySnapshot(pool: Pool, timestamp: BigInt): PoolDailySnapshot {
  let dayId = timestamp.toI32() / SECONDS_PER_DAY;
  let snapshotId = pool.id + '-' + dayId.toString();
  let snapshot = PoolDailySnapshot.load(snapshotId);

  if (snapshot === null) {
    snapshot = new PoolDailySnapshot(snapshotId);
    snapshot.pool = pool.id;
    snapshot.dayId = dayId;
    snapshot.totalValueLocked = pool.totalValueLocked;
    snapshot.totalShares = pool.totalShares;
    snapshot.navPerShare = pool.navPerShare;
    snapshot.dailyDeposits = ZERO_BD;
    snapshot.dailyWithdrawals = ZERO_BD;
    snapshot.dailyVolume = ZERO_BD;
    snapshot.uniqueDepositors = 0;
    snapshot.uniqueWithdrawers = 0;
    snapshot.cumulativeInvestors = pool.uniqueInvestors;
    snapshot.timestamp = timestamp;
    snapshot.save();
  }

  return snapshot;
}

/**
 * Get ERC20 token info
 */
export function getTokenInfo(tokenAddress: Address): TypedMap<string, string> {
  let token = IERC20.bind(tokenAddress);
  let info = new TypedMap<string, string>();

  let symbolResult = token.try_symbol();
  let decimalsResult = token.try_decimals();
  let nameResult = token.try_name();

  info.set('symbol', symbolResult.reverted ? 'UNKNOWN' : symbolResult.value);
  info.set(
    'decimals',
    decimalsResult.reverted ? DEFAULT_DECIMALS.toString() : decimalsResult.value.toString(),
  );
  info.set('name', nameResult.reverted ? 'Unknown Token' : nameResult.value);

  return info;
}

/**
 * Update position value based on shares and NAV
 */
export function updatePositionValue(position: Position, pool: Pool): void {
  if (pool.navPerShare !== null) {
    position.currentValue = position.totalShares.times(pool.navPerShare as BigDecimal);
  } else {
    position.currentValue = position.totalShares; // 1:1 for non-NAV pools
  }

  // Calculate unrealized return
  let totalInvested = position.totalDeposited.minus(position.totalWithdrawn);
  position.unrealizedReturn = position.currentValue.minus(totalInvested);

  position.save();
}

/**
 * Create transaction ID from event
 */
export function createTransactionId(event: ethereum.Event): string {
  return event.transaction.hash.toHexString() + '-' + event.logIndex.toString();
}

/**
 * Check if address is zero
 */
export function isZeroAddress(address: Address): boolean {
  return address.toHexString() == ZERO_ADDRESS;
}

/**
 * Get instrument type string from uint8
 */
export function getInstrumentTypeString(typeValue: i32): string {
  if (typeValue == 0) return 'TBILL';
  if (typeValue == 1) return 'BOND';
  if (typeValue == 2) return 'NOTE';
  return 'OTHER';
}
