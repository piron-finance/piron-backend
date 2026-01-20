# Backend Integration Guide

## Contract Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                     CORE INFRASTRUCTURE                          │
├─────────────────────────────────────────────────────────────────┤
│  PoolRegistry           - Central registry of all pools         │
│  PoolFactory            - Creates Single Asset pools            │
│  ManagedPoolFactory     - Creates StableYield & Locked pools    │
└─────────────────────────────────────────────────────────────────┘
                              │
┌─────────────────────────────────────────────────────────────────┐
│                      POOL MANAGERS                               │
├─────────────────────────────────────────────────────────────────┤
│  Manager                - Single Asset pool logic               │
│  StableYieldManager     - StableYield pool logic + NAV          │
│  LockedPoolManager      - Locked pool logic + positions         │
└─────────────────────────────────────────────────────────────────┘
                              │
┌─────────────────────────────────────────────────────────────────┐
│                    POOL CONTRACTS (per pool)                     │
├─────────────────────────────────────────────────────────────────┤
│  LiquidityPool / StableYieldPool / LockedPool  - User interface │
│  PoolEscrow / StableYieldEscrow / LockedPoolEscrow - Funds      │
└─────────────────────────────────────────────────────────────────┘
```

---

## Roles

| Role              | Permissions                                    |
| ----------------- | ---------------------------------------------- |
| DEFAULT_ADMIN     | Grant/revoke roles                             |
| OPERATOR_ROLE     | Pool operations, tier config, queue processing |
| SPV_ROLE          | Investment operations, allocations             |
| EMERGENCY_ROLE    | Pause, cancel pools                            |
| POOL_CREATOR_ROLE | Create pools                                   |

---

## Single Asset Pool

### Creation Flow

**Entry**: `PoolFactory.createPool(config)`
**Caller**: POOL_CREATOR_ROLE

```
PoolFactory.createPool(config)
    │
    ├──[1] Deploy PoolEscrow proxy
    │       └── PoolEscrow.initialize(asset, manager, spvAddress)
    │           ├── Sets asset, manager, spvAddress
    │           └── Grants roles to manager
    │
    ├──[2] Deploy LiquidityPool proxy
    │       └── LiquidityPool.initialize(asset, name, symbol, manager, escrow)
    │
    ├──[3] PoolRegistry.registerPool(pool, poolInfo)
    │       └── Stores: pool, manager, escrow, asset, type, targetRaise, maturityDate
    │
    ├──[4] Manager.initializePool(pool, poolConfig)
    │       ├── PoolEscrow.setPool(pool)
    │       ├── Stores pool config
    │       └── Sets status = FUNDING
    │
    └── Emit PoolCreated(pool, escrow, asset, targetRaise, maturityDate)

Returns: (poolAddress, escrowAddress)
```

**Config**:

```solidity
PoolConfig {
    address asset;
    address spvAddress;
    uint256 targetRaise;
    uint256 epochDuration;         // Funding window
    uint256 maturityDate;
    uint256 minInvestment;
    InstrumentType instrumentType; // DISCOUNTED or INTEREST_BEARING
    uint256 discountRate;          // For discounted
    uint256[] couponRates;         // For interest-bearing
    uint256[] couponDates;
    uint256 minimumFundingThreshold; // BPS (8000 = 80%)
    uint256 withdrawalFeeBps;
    string instrumentName;
}
```

### Lifecycle

```
FUNDING → FILLED → PENDING_INVESTMENT → INVESTED → MATURED → WITHDRAWN
    │
    └─→ EMERGENCY (underfunded)
```

**FUNDING**

```solidity
// Users deposit
LiquidityPool.deposit(assets, receiver)

// Target reached early - OPERATOR
Manager.handlePoolFilled(pool)

// Epoch ends - OPERATOR
Manager.closeEpoch(pool)
// → PENDING_INVESTMENT (if >= threshold)
// → EMERGENCY (if < threshold)
```

**PENDING_INVESTMENT**

```solidity
// SPV withdraws - SPV_ROLE
Manager.withdrawFundsForInvestment(pool, amount)

// Confirm investment - SPV_ROLE
Manager.processInvestment(pool, actualAmount, proofHash)
// → INVESTED
```

**INVESTED** (Interest-Bearing)

```solidity
// Coupon arrives - SPV_ROLE
Manager.processCouponPayment(pool, amount)

// Distribute - OPERATOR
Manager.distributeCouponPayment(pool)

// Users claim
LiquidityPool.claimCoupon()
```

**MATURED**

```solidity
// SPV returns principal - SPV_ROLE
Manager.processMaturity(pool, finalAmount)

// Users withdraw
LiquidityPool.withdraw(assets, receiver, owner)
LiquidityPool.redeem(shares, receiver, owner)

// Complete - OPERATOR
Manager.markPoolWithdrawn(pool)
```

---

## Stable Yield Pool

### Creation Flow

**Entry**: `ManagedPoolFactory.createStableYieldPool(config)`
**Caller**: POOL_CREATOR_ROLE

```
ManagedPoolFactory.createStableYieldPool(config)
    │
    ├──[1] Validate
    │       ├── spvAddress != 0
    │       └── Asset approved in registry
    │
    ├──[2] Deploy StableYieldEscrow (clone)
    │       └── StableYieldEscrow.initialize(asset, accessManager, poolName)
    │
    ├──[3] Deploy StableYieldPool (clone)
    │       └── StableYieldPool.initialize(asset, name, symbol, manager, escrow,
    │                                       accessMgr, holdingPeriod, depositFee,
    │                                       withdrawalFee, minInvestment)
    │
    ├──[4] Link escrow
    │       ├── StableYieldEscrow.setStableYieldPool(pool)
    │       └── StableYieldEscrow.setStableYieldManager(manager)
    │
    ├──[5] StableYieldManager.registerPool(pool, escrow, asset, name, minInvestment)
    │       ├── Validates asset decimals (6 or 18)
    │       ├── Creates PoolData storage
    │       ├── Creates empty WithdrawalQueue
    │       └── PoolRegistry.registerStableYieldPool(poolData)
    │
    └── Emit StableYieldPoolCreated(pool, escrow, asset, name, spv)

Returns: (poolAddress, escrowAddress)
```

**Config**:

```solidity
PoolDeploymentConfig {
    address asset;
    string poolName;
    string poolSymbol;
    address spvAddress;
    uint256 minInvestment;
    uint256 depositFeeBps;
    uint256 withdrawalFeeBps;
    uint256 holdingPeriodDays;
}
```

### Operations

**User Deposit**

```solidity
StableYieldPool.deposit(assets, receiver)
    │
    └── StableYieldManager.validateDeposit(pool, amount, receiver)
        ├── Calculate fee
        ├── Calculate shares at NAV
        ├── StableYieldEscrow.allocateDeposit(total, reserve, fee)
        └── Return shares to mint
```

**User Withdraw** (after holding period)

```solidity
StableYieldPool.withdraw(assets, receiver, owner)
    │
    └── StableYieldManager.validateWithdrawal(pool, assets, owner)
        ├── Check holding period
        ├── If reserves OK → StableYieldEscrow.withdraw(receiver, amount)
        └── If reserves low → Queue withdrawal
```

**SPV Allocation**

```solidity
// Step 1: Create allocation (valid 24h) - SPV_ROLE
bytes32 allocationId = StableYieldManager.createPendingAllocation(pool, spv, amount)

// Step 2: Add instrument - SPV_ROLE
StableYieldManager.addInstrument(pool, allocationId, faceValue, maturity, type,
                                  isDiscounted, discountRate, externalId)
// → Transfers funds to SPV
// → Creates InstrumentHolding

// Step 3a: Mature instrument - SPV_ROLE
// First: SPV approves escrow for amount
// Then:
StableYieldManager.matureInstrument(pool, instrumentId, maturityAmount)

// Step 3b: Return unused funds - SPV_ROLE
StableYieldManager.returnUnusedFunds(pool, amount)
```

**Queue Processing** - OPERATOR

```solidity
StableYieldManager.processWithdrawalQueue(pool, maxToProcess)
```

**NAV**

```solidity
StableYieldManager.calculatePoolNAV(pool)        // Total value
StableYieldManager.calculateNAVPerShare(pool)    // Per share
```

---

## Locked Pool

### Creation Flow

**Entry**: `ManagedPoolFactory.createLockedPool(config)`
**Caller**: POOL_CREATOR_ROLE

```
ManagedPoolFactory.createLockedPool(config)
    │
    ├──[1] Validate
    │       ├── spvAddress != 0
    │       └── Asset approved
    │
    ├──[2] Deploy LockedPoolEscrow (clone)
    │       └── LockedPoolEscrow.initialize(asset, accessManager, poolName)
    │
    ├──[3] Deploy LockedPool (clone)
    │       └── LockedPool.initialize(asset, name, symbol, manager, escrow,
    │                                  accessMgr, minInvestment, spv)
    │
    ├──[4] Link escrow
    │       ├── LockedPoolEscrow.setLockedPool(pool)
    │       └── LockedPoolEscrow.setLockedPoolManager(manager)
    │
    ├──[5] LockedPoolManager.registerPool(pool, escrow, asset, name, minInvestment)
    │       ├── Validates decimals (6 or 18)
    │       ├── Creates PoolConfig storage
    │       └── Maps poolEscrows[pool] = escrow
    │
    ├──[6] Configure tiers (loop)
    │       └── LockedPoolManager.configureLockTier(pool, tierIndex, tier)
    │
    ├──[7] PoolRegistry.registerLockedPool(pool, escrow, asset, name)
    │
    └── Emit LockedPoolCreated(pool, escrow, asset, name, spv)

Returns: (poolAddress, escrowAddress)
```

**Config**:

```solidity
LockedPoolDeploymentConfig {
    address asset;
    string poolName;
    string poolSymbol;
    address spvAddress;
    uint256 minInvestment;
    LockTier[] initialTiers;
}

LockTier {
    uint256 durationDays;        // 90, 180, 365
    uint256 apyBps;              // 500 = 5%
    uint256 earlyExitPenaltyBps; // 1000 = 10%
    uint256 minDeposit;
    bool isActive;
}
```

### Operations

**Tier Management** - OPERATOR

```solidity
// Add/update tier (must be sequential: 0, then 1, then 2...)
LockedPoolManager.configureLockTier(pool, tierIndex, tier)

// Update APY (affects new deposits only)
LockedPoolManager.updateTierAPY(pool, tierIndex, newApyBps)

// Deactivate tier
LockedPoolManager.setTierActive(pool, tierIndex, false)
```

**User Deposit**

```solidity
LockedPool.depositLocked(amount, tierIndex, InterestPayment.UPFRONT)
    │
    ├── Transfer asset to escrow
    │
    └── LockedPoolManager.processDeposit(pool, amount, user, tierIndex, paymentChoice)
        │
        ├── Calculate interest
        │   interest = amount × apyBps × durationDays / (365 × 10000)
        │
        ├── UPFRONT:
        │   ├── investedAmount = amount - interest
        │   ├── Pay interest immediately
        │   └── expectedMaturityPayout = amount
        │
        ├── AT_MATURITY:
        │   ├── investedAmount = amount
        │   └── expectedMaturityPayout = amount + interest
        │
        └── Create UserPosition (positionId = global counter)

Returns: (positionId, shares)
```

**Redeem at Maturity**

```solidity
LockedPool.redeemPosition(positionId)
    │
    └── LockedPoolManager.redeem(pool, positionId, caller)
        ├── Validate: caller == owner
        ├── Validate: matured
        ├── LockedPoolEscrow.withdraw(user, expectedPayout)
        └── status = REDEEMED

Returns: payout
```

**Early Exit**

```solidity
LockedPool.earlyExitPosition(positionId)
    │
    └── LockedPoolManager.earlyWithdraw(pool, positionId, caller)
        │
        ├── penalty = principal × penaltyBps / 10000
        │
        ├── UPFRONT:
        │   payout = principal - penalty
        │
        ├── AT_MATURITY:
        │   proRataInterest = interest × daysElapsed / durationDays
        │   payout = principal - penalty + proRataInterest
        │
        ├── LockedPoolEscrow.withdraw(user, payout)
        ├── LockedPoolEscrow.recordPenalty(penalty)
        └── status = EARLY_EXIT

Returns: (payout, penalty)
```

**Auto-Rollover**

```solidity
// User enables
LockedPool.setAutoRollover(positionId, true)

// Operator executes at maturity - OPERATOR
LockedPoolManager.executeRollover(positionId)

// Batch - OPERATOR
LockedPoolManager.batchExecuteRollovers(positionIds)
```

**SPV Operations**

```solidity
// Create allocation - SPV_ROLE
allocationId = LockedPoolManager.createPendingAllocation(pool, spv, amount)

// Settle return per position - SPV_ROLE
LockedPoolManager.settleSPVReturn(pool, positionId, returnedAmount)

// Mature allocation - SPV_ROLE
LockedPoolManager.matureAllocation(pool, allocationId, returnedAmount)
```

### Position States

```
ACTIVE → MATURED → REDEEMED
   │         │
   │         └→ ROLLED_OVER
   │
   └→ EARLY_EXIT
```

### Interest Math

```
Interest = Principal × APY × Days / (365 × 10000)

Example: 10,000 USDC, 5% APY, 90 days
Interest = 10,000 × 500 × 90 / (365 × 10000) = 123.29 USDC
```

| Payment     | Deposit | Receive Now | At Maturity | Invested |
| ----------- | ------- | ----------- | ----------- | -------- |
| UPFRONT     | 10,000  | 123.29      | 10,000      | 9,876.71 |
| AT_MATURITY | 10,000  | 0           | 10,123.29   | 10,000   |

**Early Exit** (day 45 of 90, 10% penalty)
| Payment | Principal | Penalty | Pro-rata Interest | Payout |
|---------|-----------|---------|-------------------|--------|
| UPFRONT | 10,000 | 1,000 | 0 | 9,000 |
| AT_MATURITY | 10,000 | 1,000 | 61.64 | 9,061.64 |

---

## Key Read Functions

### PoolRegistry

```solidity
isRegisteredPool(address) → bool
isActivePool(address) → bool
getPoolInfo(address) → PoolInfo
getAllPools() → address[]
isApprovedAsset(address) → bool
isManagedPool(address) → bool
isLockedPool(address) → bool
```

### StableYieldManager

```solidity
calculatePoolNAV(pool) → uint256
calculateNAVPerShare(pool) → uint256
getPoolInstruments(pool) → InstrumentHolding[]
getWithdrawalQueue(pool) → WithdrawalRequest[]
isReadyForAllocation(pool) → (bool, uint256)
pools(pool) → PoolData
pendingAllocations(allocationId) → PendingAllocation
```

### LockedPoolManager

```solidity
getPosition(positionId) → UserPosition
getUserPositions(pool, user) → uint256[]
getPositionSummary(positionId) → PositionSummary
getPoolTiers(pool) → LockTier[]
getPoolMetrics(pool) → PoolMetrics
calculateEarlyExitPayout(positionId) → EarlyExitCalculation
canMaturePosition(positionId) → bool
poolConfigs(pool) → PoolConfig
poolEscrows(pool) → address
```

---

## Events

### Single Asset

```solidity
PoolCreated(pool, escrow, asset, targetRaise, maturityDate)
StatusChanged(oldStatus, newStatus)
DepositProcessed(pool, user, amount, shares)
WithdrawalProcessed(pool, user, amount, shares)
CouponDistributed(pool, totalAmount)
MaturityProcessed(pool, finalAmount)
```

### Stable Yield

```solidity
StableYieldPoolCreated(pool, escrow, asset, name, spv)
PoolRegistered(pool, escrow, asset, name)
NAVUpdated(pool, newNAV, navPerShare)
InstrumentAdded(pool, instrumentId, faceValue, maturityDate)
InstrumentMatured(pool, instrumentId, maturityAmount)
AllocationCreated(pool, spv, allocationId, amount)
WithdrawalQueued(pool, user, requestId, shares, assets)
QueuedWithdrawalProcessed(pool, user, requestId, amount)
```

### Locked Pool

```solidity
LockedPoolCreated(pool, escrow, asset, name, spv)
PoolRegistered(pool, escrow, asset, name)
LockTierConfigured(pool, tierIndex, duration, apy, penalty)
PositionCreated(pool, user, positionId, principal, interest, paymentChoice, lockEnd)
PositionRedeemed(pool, user, positionId, payout)
EarlyExitProcessed(pool, user, positionId, payout, penalty, interestEarned)
InterestPaidUpfront(pool, user, positionId, amount)
PositionMatured(pool, user, positionId, lockEnd)
AutoRolloverSet(positionId, user, enabled)
PositionRolledOver(pool, user, oldPositionId, newPositionId, principal, interestHandled)
AllocationCreated(pool, spv, allocationId, amount)
SPVReturnSettled(pool, positionId, returnedAmount, protocolYield)
```

---

## Key Notes

1. **Position IDs are GLOBAL** - Single counter across all locked pools
2. **SPV required** for StableYield and Locked pools
3. **Assets must be approved** in PoolRegistry first
4. **Holding period** only for StableYield (days after deposit before withdraw)
5. **Allocations expire** after 24 hours
6. **Shares = Principal** in Locked pools
7. **Tiers must be sequential** (0, then 1, then 2...)
8. **NAV excludes fees** (collected at transaction time)
