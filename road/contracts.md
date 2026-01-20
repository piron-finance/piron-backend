# Contract Addresses & ABIs

## Testnet Deployment (Latest)

> **Network:** Local/Testnet
> **Deployment Date:** See deployment logs

### Governance Contracts

| Contract           | Proxy Address                                | Implementation |
| ------------------ | -------------------------------------------- | -------------- |
| AccessManager      | `0xD247a5455569C4b8b9914566092cf30DBD46c98d` | -              |
| TimelockController | `0x2c98f4BcB2e61b07240018aB199A0Be6d9749C10` | -              |
| UpgradeGuardian    | `0xcf279bb0a6D8E108978aF5472537F11Cb10F757e` | -              |

### Core Infrastructure

| Contract     | Proxy Address                                | Implementation                               |
| ------------ | -------------------------------------------- | -------------------------------------------- |
| PoolRegistry | `0xb295a7c89044Cfd884bA89F10D2bdD0Bb2093015` | `0x85e4D9651a3F3F050aC54dD8223b014393eB1dc8` |
| PoolFactory  | `0x8846aDa6da5ABADcedb1Be69BCF4cf2D7c2487A5` | `0x9e9b279E90725894b7D3CDF29ADd7533f0958b25` |
| Manager      | `0x4035f114754010A17f10B492463a6a3Bf52b9449` | `0xe37D19857C8eE5a42C06Ab427A4469fB08d863dC` |

### Stable Yield Contracts

| Contract           | Proxy Address                                | Implementation                               |
| ------------------ | -------------------------------------------- | -------------------------------------------- |
| StableYieldManager | `0x057C47B36aCCbe6ED96c1BbEBAB34e406c706c97` | `0xfbd8f737801BBe75AC3Bc42726c642690023CB50` |
| ManagedPoolFactory | `0x04F02918D73360efD9f2fFEB6a3f8d278396b728` | `0x8f74F572b48856BD222854873CC366754bd1b9f8` |

### Locked Pool Contracts

| Contract          | Proxy Address                                | Implementation                               |
| ----------------- | -------------------------------------------- | -------------------------------------------- |
| LockedPoolManager | `0xAC9C38942A3991679733DA970810Bb21BA6Cc34F` | `0xF7313e94EbA4E4eC46a170Bf7dC0f5ECBb7c2C3C` |

### Pool Implementations (Used for Clones)

| Contract          | Address                                      |
| ----------------- | -------------------------------------------- |
| LiquidityPool     | `0xEB0b6e576C40641e3d4Db55963BA640EfD775Fd3` |
| PoolEscrow        | `0x0f137AF600502DDbd80fa9Ba07D56d656a638b09` |
| StableYieldPool   | `0x36ef01Df01742886133Bc837de7B57cCafE1cF81` |
| StableYieldEscrow | `0x49E8d33B9b6a14ab09e03a75fd4C9ba4deE9207c` |
| LockedPool        | `0xE65d2C2b3c576b87201BFB22Fa28d4F8eB669C44` |
| LockedPoolEscrow  | `0xA33FeE27dc20E8F998Fd1CeA1462D69d7187A5c4` |

### Test Tokens

| Token            | Address                                      |
| ---------------- | -------------------------------------------- |
| MockERC20 (USDC) | `0x517E901cAe0c557029309A11e400a5bCc3BB65C0` |

---

## ABI Locations

ABIs are generated during compilation and located in:

```
out/<ContractName>.sol/<ContractName>.json
```

### Key ABIs for Frontend

| Contract           | ABI Path                                             |
| ------------------ | ---------------------------------------------------- |
| StableYieldPool    | `out/StableYieldPool.sol/StableYieldPool.json`       |
| StableYieldManager | `out/StableYieldManager.sol/StableYieldManager.json` |
| LockedPool         | `out/LockedPool.sol/LockedPool.json`                 |
| LockedPoolManager  | `out/LockedPoolManager.sol/LockedPoolManager.json`   |
| LiquidityPool      | `out/LiquidityPool.sol/LiquidityPool.json`           |
| Manager            | `out/Manager.sol/Manager.json`                       |
| PoolRegistry       | `out/PoolRegistry.sol/PoolRegistry.json`             |
| AccessManager      | `out/AccessManager.sol/AccessManager.json`           |
| ERC20              | `out/MockERC20.sol/MockERC20.json`                   |

### Extract ABI Only

To extract just the ABI from compiled output:

```bash
cat out/StableYieldPool.sol/StableYieldPool.json | jq '.abi' > StableYieldPool.abi.json
```

---

## Frontend Integration

### Primary Contracts to Interact With

**For Users:**

- `StableYieldPool` - Deposit/withdraw stable yield
- `LockedPool` - Deposit/withdraw/exit locked positions
- `LiquidityPool` - Deposit/withdraw single asset pools

**For Reading Data:**

- `StableYieldManager` - Pool NAV, instruments, queue status
- `LockedPoolManager` - Position details, tier info, metrics
- `PoolRegistry` - List all pools, pool info

### Common Read Functions

#### StableYieldPool

```solidity
function totalAssets() returns (uint256)           // Total pool value
function convertToShares(uint256 assets) returns (uint256)  // Preview deposit
function convertToAssets(uint256 shares) returns (uint256)  // Preview withdrawal
function balanceOf(address) returns (uint256)      // User's shares
```

#### StableYieldManager

```solidity
function calculatePoolNAV(address pool) returns (uint256)
function calculateNAVPerShare(address pool) returns (uint256)
function getPoolInstruments(address pool) returns (InstrumentHolding[])
function getWithdrawalQueue(address pool) returns (WithdrawalRequest[])
```

#### LockedPool

```solidity
function getUserPositions(address user) returns (uint256[])
function previewInterest(uint256 amount, uint8 tier) returns (uint256, uint256, uint256)
function getPoolMetrics() returns (PoolMetrics)
```

#### LockedPoolManager

```solidity
function getPosition(uint256 positionId) returns (UserPosition)
function getPositionSummary(uint256 positionId) returns (PositionSummary)
function getPoolTiers(address pool) returns (LockTier[])
function calculateEarlyExitPayout(uint256 positionId) returns (EarlyExitCalculation)
```

### Common Write Functions

#### StableYieldPool

```solidity
function deposit(uint256 assets, address receiver) returns (uint256 shares)
function withdraw(uint256 assets, address receiver, address owner) returns (uint256 shares)
function redeem(uint256 shares, address receiver, address owner) returns (uint256 assets)
```

#### LockedPool

```solidity
function depositLocked(uint256 amount, uint8 tierIndex, InterestPayment choice) returns (uint256 positionId, uint256 shares)
function redeemPosition(uint256 positionId) returns (uint256 payout)
function earlyExitPosition(uint256 positionId) returns (uint256 payout, uint256 penalty)
function setAutoRollover(uint256 positionId, bool enabled)
```

---

## Events to Index

### StableYieldPool

```solidity
event Deposit(address indexed sender, address indexed owner, uint256 assets, uint256 shares)
event Withdraw(address indexed sender, address indexed receiver, address indexed owner, uint256 assets, uint256 shares)
```

### StableYieldManager

```solidity
event NAVUpdated(address indexed pool, uint256 newNAV, uint256 navPerShare)
event WithdrawalQueued(address indexed pool, address indexed user, uint256 requestId, uint256 shares, uint256 assets)
event QueuedWithdrawalProcessed(address indexed pool, address indexed user, uint256 requestId, uint256 amount)
event InstrumentAdded(address indexed pool, bytes32 indexed instrumentId, uint256 faceValue)
event InstrumentMatured(address indexed pool, bytes32 indexed instrumentId, uint256 maturityAmount)
```

### LockedPoolManager

```solidity
event PositionCreated(address indexed pool, address indexed user, uint256 positionId, uint256 principal, uint256 interest, InterestPayment choice, uint256 lockEnd)
event PositionRedeemed(address indexed pool, address indexed user, uint256 positionId, uint256 payout)
event EarlyExitProcessed(address indexed pool, address indexed user, uint256 positionId, uint256 payout, uint256 penalty, uint256 interestEarned)
event InterestPaidUpfront(address indexed pool, address indexed user, uint256 positionId, uint256 amount)
event AutoRolloverSet(uint256 indexed positionId, address indexed user, bool enabled)
event PositionRolledOver(address indexed pool, address indexed user, uint256 oldPositionId, uint256 newPositionId, uint256 principal, uint256 interestHandled)
```

---

## Type Definitions

### InterestPayment (LockedPool)

```solidity
enum InterestPayment {
    UPFRONT,      // 0 - Interest paid immediately
    AT_MATURITY   // 1 - Interest paid at lock end
}
```

### PositionStatus (LockedPool)

```solidity
enum PositionStatus {
    ACTIVE,       // 0 - Position is locked
    MATURED,      // 1 - Ready for redemption
    REDEEMED,     // 2 - User collected funds
    EARLY_EXIT,   // 3 - User exited early with penalty
    ROLLED_OVER   // 4 - Position rolled into new one
}
```

### PoolStatus (SingleAsset/StableYield)

```solidity
enum PoolStatus {
    FUNDING,            // 0 - Accepting deposits
    FILLED,             // 1 - Target reached
    PENDING_INVESTMENT, // 2 - Ready for SPV
    INVESTED,           // 3 - Funds deployed
    MATURED,            // 4 - Returns available
    EMERGENCY,          // 5 - Problem occurred
    WITHDRAWN           // 6 - Fully exited
}
```
