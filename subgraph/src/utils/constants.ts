import { BigDecimal, BigInt } from '@graphprotocol/graph-ts';

export const ZERO_ADDRESS = '0x0000000000000000000000000000000000000000';
export const ZERO_BI = BigInt.fromI32(0);
export const ONE_BI = BigInt.fromI32(1);
export const ZERO_BD = BigDecimal.fromString('0');
export const ONE_BD = BigDecimal.fromString('1');
export const SECONDS_PER_DAY = 86400;

// Protocol ID
export const PROTOCOL_ID = 'protocol';

// Default decimals
export const DEFAULT_DECIMALS = 6;

// Pool Types
export const POOL_TYPE_SINGLE_ASSET = 'SINGLE_ASSET';
export const POOL_TYPE_STABLE_YIELD = 'STABLE_YIELD';

// Pool Status
export const POOL_STATUS_PENDING_DEPLOYMENT = 'PENDING_DEPLOYMENT';
export const POOL_STATUS_FUNDING = 'FUNDING';
export const POOL_STATUS_FUNDED = 'FUNDED';
export const POOL_STATUS_ACTIVE = 'ACTIVE';
export const POOL_STATUS_MATURED = 'MATURED';
export const POOL_STATUS_CLOSED = 'CLOSED';
export const POOL_STATUS_EMERGENCY = 'EMERGENCY';
export const POOL_STATUS_CANCELLED = 'CANCELLED';

// Transaction Types
export const TX_TYPE_DEPOSIT = 'DEPOSIT';
export const TX_TYPE_WITHDRAWAL = 'WITHDRAWAL';
export const TX_TYPE_COUPON_CLAIM = 'COUPON_CLAIM';
export const TX_TYPE_MATURITY_CLAIM = 'MATURITY_CLAIM';
export const TX_TYPE_REFUND = 'REFUND';
export const TX_TYPE_EMERGENCY_WITHDRAWAL = 'EMERGENCY_WITHDRAWAL';

// Transaction Status
export const TX_STATUS_CONFIRMED = 'CONFIRMED';

// Instrument Types
export const INSTRUMENT_TYPE_TBILL = 'TBILL';
export const INSTRUMENT_TYPE_BOND = 'BOND';
export const INSTRUMENT_TYPE_NOTE = 'NOTE';
export const INSTRUMENT_TYPE_OTHER = 'OTHER';

// Emergency Event Types
export const EMERGENCY_EVENT_PAUSE = 'PAUSE';
export const EMERGENCY_EVENT_UNPAUSE = 'UNPAUSE';
export const EMERGENCY_EVENT_EMERGENCY_STATE = 'EMERGENCY_STATE';
export const EMERGENCY_EVENT_CANCELLATION = 'CANCELLATION';
export const EMERGENCY_EVENT_EMERGENCY_EXIT = 'EMERGENCY_EXIT';

