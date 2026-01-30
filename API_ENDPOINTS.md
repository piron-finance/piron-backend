# API Endpoints Reference

**Base URL:** `http://localhost:3008/api/v1`

---

# 🟢 USER DASHBOARD

## Pools

### List All Pools

```
GET /api/v1/pools
```

**Query Parameters:**
| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `poolType` | string | No | Filter by type: `SINGLE_ASSET`, `STABLE_YIELD`, `LOCKED` |
| `status` | string | No | Filter by status: `PENDING`, `FUNDING`, `ACTIVE`, `CLOSED` |
| `region` | string | No | Filter by region |
| `page` | number | No | Page number (default: 1) |
| `limit` | number | No | Items per page (default: 20) |

---

### Get Featured Pools

```
GET /api/v1/pools/featured
```

**Parameters:** None

---

### Get Pool Details

```
GET /api/v1/pools/:poolAddress
```

**Path Parameters:**
| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `poolAddress` | string | Yes | Pool contract address |

---

### Get Pool Statistics

```
GET /api/v1/pools/:poolAddress/stats
```

**Path Parameters:**
| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `poolAddress` | string | Yes | Pool contract address |

---

### Get Lock Tiers (Locked Pools)

```
GET /api/v1/pools/:poolAddress/tiers
```

**Path Parameters:**
| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `poolAddress` | string | Yes | Locked pool address |

---

### Get Live Locked Pool Metrics

```
GET /api/v1/pools/:chainId/:poolAddress/locked-metrics
```

**Path Parameters:**
| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `chainId` | number | Yes | Chain ID (e.g., 84532 for Base Sepolia) |
| `poolAddress` | string | Yes | Locked pool address |

---

### Preview Locked Deposit

```
GET /api/v1/pools/:chainId/:poolAddress/preview-locked
```

**Path Parameters:**
| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `chainId` | number | Yes | Chain ID |
| `poolAddress` | string | Yes | Locked pool address |

**Query Parameters:**
| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `amount` | string | Yes | Deposit amount |
| `tierIndex` | number | Yes | Lock tier index (0, 1, 2...) |

---

## Positions

### Get All User Positions

```
GET /api/v1/users/:walletAddress/positions
```

**Path Parameters:**
| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `walletAddress` | string | Yes | User wallet address |

---

### Get User Position in Specific Pool

```
GET /api/v1/users/:walletAddress/positions/:poolAddress
```

**Path Parameters:**
| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `walletAddress` | string | Yes | User wallet address |
| `poolAddress` | string | Yes | Pool contract address |

---

### Get User Locked Positions

```
GET /api/v1/users/:walletAddress/locked-positions
```

**Path Parameters:**
| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `walletAddress` | string | Yes | User wallet address |

---

### Get Specific Locked Position

```
GET /api/v1/locked-positions/:positionId
```

**Path Parameters:**
| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `positionId` | number | Yes | Global position ID |

---

### Preview Early Exit

```
GET /api/v1/locked-positions/:positionId/preview-early-exit
```

**Path Parameters:**
| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `positionId` | number | Yes | Global position ID |

---

## Transactions

### Get User Transactions

```
GET /api/v1/users/:walletAddress/transactions
```

**Path Parameters:**
| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `walletAddress` | string | Yes | User wallet address |

**Query Parameters:**
| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `poolId` | string | No | Filter by pool ID |
| `type` | string | No | Filter by type: `DEPOSIT`, `WITHDRAWAL`, `CLAIM` |
| `status` | string | No | Filter by status: `PENDING`, `CONFIRMED`, `FAILED` |
| `page` | number | No | Page number (default: 1) |
| `limit` | number | No | Items per page (default: 20) |

---

### Get Transaction by Hash

```
GET /api/v1/transactions/:txHash
```

**Path Parameters:**
| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `txHash` | string | Yes | Transaction hash |

---

### Get Pool Transactions

```
GET /api/v1/pools/:poolAddress/transactions
```

**Path Parameters:**
| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `poolAddress` | string | Yes | Pool contract address |

**Query Parameters:**
| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `page` | number | No | Page number (default: 1) |
| `limit` | number | No | Items per page (default: 20) |

---

## Platform

### Get Platform Metrics

```
GET /api/v1/platform/metrics
```

**Parameters:** None

---

# 🔵 SPV DASHBOARD

## Pool Management

### Get All SPV Pools

```
GET /api/v1/spv/pools
```

**Query Parameters:**
| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `includeInactive` | string | No | Include inactive pools: `true` or `false` |

---

### Get Pool Summary

```
GET /api/v1/spv/pools/:poolAddress
```

**Path Parameters:**
| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `poolAddress` | string | Yes | Pool contract address |

---

### Get Pool Detail (Main Dashboard)

```
GET /api/v1/spv/pools/:poolAddress/detail
```

**Path Parameters:**
| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `poolAddress` | string | Yes | Pool contract address |

**Query Parameters:**
| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `spvAddress` | string | Yes | SPV wallet address |

---

### Get Pool Instruments

```
GET /api/v1/spv/pools/:poolAddress/instruments
```

**Path Parameters:**
| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `poolAddress` | string | Yes | Pool contract address |

---

### Get Pool Liquidity Status

```
GET /api/v1/spv/pools/:poolAddress/liquidity-status
```

**Path Parameters:**
| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `poolAddress` | string | Yes | Pool contract address |

---

## Instruments

### Get All Instruments

```
GET /api/v1/spv/instruments
```

**Query Parameters:**
| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `status` | string | No | Filter by status |
| `poolId` | string | No | Filter by pool ID |
| `type` | string | No | Filter by type: `DISCOUNTED`, `COUPON` |
| `maturityRange` | string | No | Filter by maturity range |
| `sortBy` | string | No | Sort field |

---

### Add Instrument

```
POST /api/v1/spv/pools/:poolAddress/instruments/add
```

**Path Parameters:**
| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `poolAddress` | string | Yes | Pool contract address |

**Body:**

```json
{
  "poolAddress": "0x...",
  "instrumentType": "DISCOUNTED",
  "purchasePrice": "100000",
  "faceValue": "105000",
  "maturityDate": "2026-06-01",
  "annualCouponRate": 0,
  "couponFrequency": 0
}
```

---

### Mature Instrument

```
POST /api/v1/spv/pools/:poolAddress/instruments/:instrumentId/mature
```

**Path Parameters:**
| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `poolAddress` | string | Yes | Pool contract address |
| `instrumentId` | string | Yes | Instrument ID |

---

### Batch Mature Instruments

```
POST /api/v1/spv/instruments/batch-mature
```

**Body:**

```json
{
  "poolAddress": "0x...",
  "maturities": [{ "instrumentId": "1", "maturedAmount": "105000" }]
}
```

---

### Record Coupon Payment

```
POST /api/v1/spv/instruments/:instrumentId/record-coupon
```

**Path Parameters:**
| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `instrumentId` | string | Yes | Instrument ID |

**Body:**

```json
{
  "amount": "5000",
  "paymentDate": "2026-03-01"
}
```

---

## Investments

### Get Pending Investments

```
GET /api/v1/spv/investments/pending
```

**Parameters:** None

---

### Withdraw Funds for Investment

```
POST /api/v1/spv/pools/:poolAddress/withdraw-funds
```

**Path Parameters:**
| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `poolAddress` | string | Yes | Pool contract address |

**Body:**

```json
{
  "amount": "100000",
  "notes": "Investment in Treasury Bill"
}
```

---

### Confirm Off-chain Investment

```
POST /api/v1/spv/investments/confirm
```

**Body:**

```json
{
  "poolAddress": "0x...",
  "amount": "100000",
  "proofHash": "0x..."
}
```

---

### Confirm Single Asset Investment

```
POST /api/v1/spv/pools/:poolAddress/confirm-investment
```

**Path Parameters:**
| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `poolAddress` | string | Yes | Pool contract address |

**Body:**

```json
{
  "actualAmount": "100000",
  "proofHash": "0x..."
}
```

---

### Process Maturity Return

```
POST /api/v1/spv/pools/:poolAddress/process-maturity
```

**Path Parameters:**
| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `poolAddress` | string | Yes | Pool contract address |

**Body:**

```json
{
  "finalAmount": "105000"
}
```

---

### Receive SPV Maturity

```
POST /api/v1/spv/pools/:poolAddress/receive-maturity
```

**Path Parameters:**
| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `poolAddress` | string | Yes | Pool contract address |

**Body:**

```json
{
  "amount": "105000"
}
```

---

## Allocations

### Get SPV Allocations

```
GET /api/v1/spv/allocations
```

**Query Parameters:**
| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `spvAddress` | string | Yes | SPV wallet address |

---

### Return Unused Allocation Funds

```
POST /api/v1/spv/allocations/:allocationId/return-unused
```

**Path Parameters:**
| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `allocationId` | string | Yes | Allocation ID (bytes32) |

**Body:**

```json
{
  "returnAmount": "50000"
}
```

---

## Locked Pool Operations

### Mature Locked Allocation

```
POST /api/v1/spv/locked/allocations/:allocationId/mature
```

**Path Parameters:**
| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `allocationId` | string | Yes | Allocation ID |

**Body:**

```json
{
  "returnedAmount": "105000"
}
```

---

### Settle SPV Return for Position

```
POST /api/v1/spv/locked/positions/:positionId/settle
```

**Path Parameters:**
| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `positionId` | number | Yes | Position ID |

**Body:**

```json
{
  "returnedAmount": "10500"
}
```

---

## Coupons & Fees

### Get Coupon Schedule

```
GET /api/v1/spv/coupons/schedule
```

**Query Parameters:**
| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `poolId` | string | No | Filter by pool ID |
| `range` | string | No | Date range |
| `status` | string | No | Filter by status |

---

### Process Coupon Payment

```
POST /api/v1/spv/pools/:poolAddress/process-coupon
```

**Path Parameters:**
| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `poolAddress` | string | Yes | Pool contract address |

**Body:**

```json
{
  "amount": "5000"
}
```

---

### Get Collectible Fees

```
GET /api/v1/spv/fees/collectible
```

**Parameters:** None

---

### Collect Fees

```
POST /api/v1/spv/fees/collect
```

**Body:**

```json
{
  "poolAddress": "0x...",
  "feeType": "TRANSACTION"
}
```

---

## Analytics & Operations

### Get Analytics Overview

```
GET /api/v1/spv/analytics/overview
```

**Parameters:** None

---

### Get Enhanced Analytics

```
GET /api/v1/spv/analytics/enhanced
```

**Parameters:** None

---

### Get Upcoming Maturities

```
GET /api/v1/spv/analytics/maturities
```

**Query Parameters:**
| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `days` | number | No | Days ahead (default: 90) |

---

### Get SPV Operations

```
GET /api/v1/spv/operations
```

**Query Parameters:**
| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `page` | number | No | Page number (default: 1) |
| `limit` | number | No | Items per page (default: 20) |
| `status` | string | No | Filter by status |

---

### Trigger NAV Update

```
POST /api/v1/spv/pools/:poolAddress/trigger-nav-update
```

**Path Parameters:**
| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `poolAddress` | string | Yes | Pool contract address |

**Body:**

```json
{
  "reason": "Instrument matured"
}
```

---

## Preferences & Alerts

### Get SPV Preferences

```
GET /api/v1/spv/preferences
```

**Query Parameters:**
| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `spvAddress` | string | Yes | SPV wallet address |

---

### Set Investment Threshold

```
POST /api/v1/spv/preferences/investment-threshold
```

**Query Parameters:**
| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `spvAddress` | string | Yes | SPV wallet address |

**Body:**

```json
{
  "minimumAmount": "100000",
  "maximumAmount": "1000000"
}
```

---

### Get Investment Alerts

```
GET /api/v1/spv/alerts
```

**Query Parameters:**
| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `spvAddress` | string | Yes | SPV wallet address |

---

## Withdrawal Requests

### Get User Withdrawal Requests

```
GET /api/v1/spv/pools/:poolAddress/withdrawal-requests/:userAddress
```

**Path Parameters:**
| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `poolAddress` | string | Yes | Pool contract address |
| `userAddress` | string | Yes | User wallet address |

---

# 🔴 ADMIN DASHBOARD

## Pool Management

### Get All Pools

```
GET /api/v1/admin/pools
```

**Query Parameters:**
| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `includeInactive` | string | No | Include inactive: `true` or `false` |

---

### Get Pool by ID

```
GET /api/v1/admin/pools/:id
```

**Path Parameters:**
| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `id` | string | Yes | Pool UUID |

---

### Get Pool Detail (Main Dashboard)

```
GET /api/v1/admin/pools/:poolAddress/detail
```

**Path Parameters:**
| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `poolAddress` | string | Yes | Pool contract address |

---

### Create Pool

```
POST /api/v1/admin/pools/create
```

**Body (Single Asset):**

```json
{
  "poolType": "SINGLE_ASSET",
  "name": "Invoice Finance Pool",
  "description": "30-day invoice financing",
  "assetAddress": "0x...",
  "spvAddress": "0x...",
  "minInvestment": "1000",
  "instrumentType": "DISCOUNTED",
  "targetRaise": "1000000",
  "epochEndTime": "2026-03-01T00:00:00Z",
  "maturityDate": "2026-04-01T00:00:00Z",
  "discountRate": 1100,
  "withdrawalFeeBps": 50,
  "minimumFundingThreshold": 8000,
  "couponDates": [],
  "couponRates": []
}
```

**Body (Stable Yield):**

```json
{
  "poolType": "STABLE_YIELD",
  "name": "Treasury Pool",
  "description": "Revolving treasury pool",
  "assetAddress": "0x...",
  "spvAddress": "0x...",
  "minInvestment": "100"
}
```

**Body (Locked):**

```json
{
  "poolType": "LOCKED",
  "name": "Fixed Yield Pool",
  "description": "Fixed rate locked deposits",
  "assetAddress": "0x...",
  "spvAddress": "0x...",
  "minInvestment": "100",
  "initialTiers": [
    { "durationDays": 30, "apyBps": 500, "earlyExitPenaltyBps": 1000, "minDeposit": "100" },
    { "durationDays": 90, "apyBps": 800, "earlyExitPenaltyBps": 500, "minDeposit": "1000" }
  ]
}
```

---

### Confirm Pool Deployment

```
POST /api/v1/admin/pools/confirm-deployment
```

**Body:**

```json
{
  "poolId": "uuid",
  "txHash": "0x..."
}
```

---

### Update Pool Metadata

```
PATCH /api/v1/admin/pools/:id
```

**Path Parameters:**
| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `id` | string | Yes | Pool UUID |

**Body:**

```json
{
  "description": "Updated description",
  "tags": ["new", "tags"],
  "isFeatured": true
}
```

---

### Cancel Pending Pool

```
DELETE /api/v1/admin/pools/:id
```

**Path Parameters:**
| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `id` | string | Yes | Pool UUID |

---

### Pause Pool

```
POST /api/v1/admin/pools/pause
```

**Body:**

```json
{
  "poolAddress": "0x...",
  "reason": "Maintenance"
}
```

---

### Unpause Pool

```
POST /api/v1/admin/pools/:poolAddress/unpause
```

**Path Parameters:**
| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `poolAddress` | string | Yes | Pool contract address |

---

### Get Paused Pools

```
GET /api/v1/admin/pools/paused
```

**Parameters:** None

---

### Close Pool

```
POST /api/v1/admin/pools/:poolAddress/close
```

**Path Parameters:**
| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `poolAddress` | string | Yes | Pool contract address |

---

### Cancel Pool

```
POST /api/v1/admin/pools/:poolAddress/cancel
```

**Path Parameters:**
| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `poolAddress` | string | Yes | Pool contract address |

**Body:**

```json
{
  "reason": "Insufficient funding"
}
```

---

## Single Asset Pool Operations

### Close Epoch

```
POST /api/v1/admin/pools/:poolAddress/close-epoch
```

**Path Parameters:**
| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `poolAddress` | string | Yes | Pool contract address |

---

### Distribute Coupons

```
POST /api/v1/admin/pools/:poolAddress/distribute-coupons
```

**Path Parameters:**
| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `poolAddress` | string | Yes | Pool contract address |

**Body:**

```json
{
  "couponId": 0,
  "amount": "50000"
}
```

---

### Extend Maturity

```
POST /api/v1/admin/pools/:poolAddress/extend-maturity
```

**Path Parameters:**
| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `poolAddress` | string | Yes | Pool contract address |

**Body:**

```json
{
  "newMaturityDate": "2026-05-01T00:00:00Z"
}
```

---

### Get Coupon Data

```
GET /api/v1/admin/pools/:poolAddress/coupons
```

**Path Parameters:**
| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `poolAddress` | string | Yes | Pool contract address |

---

## Stable Yield Pool Operations

### Set Transaction Fee

```
PUT /api/v1/admin/stable-yield/:poolAddress/fee
```

**Path Parameters:**
| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `poolAddress` | string | Yes | Pool contract address |

**Body:**

```json
{
  "feeBps": 50
}
```

---

### Set Reserve Configuration

```
PUT /api/v1/admin/stable-yield/:poolAddress/reserve-config
```

**Path Parameters:**
| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `poolAddress` | string | Yes | Pool contract address |

**Body:**

```json
{
  "minAbsoluteReserve": "10000",
  "reserveRatioBps": 1000
}
```

---

### Trigger NAV Update

```
POST /api/v1/admin/stable-yield/:poolAddress/trigger-nav-update
```

**Path Parameters:**
| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `poolAddress` | string | Yes | Pool contract address |

**Body:**

```json
{
  "reason": "Instrument matured"
}
```

---

### Deactivate Stable Yield Pool

```
POST /api/v1/admin/stable-yield/:poolAddress/deactivate
```

**Path Parameters:**
| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `poolAddress` | string | Yes | Pool contract address |

---

## Locked Pool Operations

### Get Locked Pool Detail

```
GET /api/v1/admin/locked-pools/:poolAddress
```

**Path Parameters:**
| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `poolAddress` | string | Yes | Pool contract address |

---

### Get Locked Pool Positions

```
GET /api/v1/admin/locked-pools/:poolAddress/positions
```

**Path Parameters:**
| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `poolAddress` | string | Yes | Pool contract address |

---

### Get Maturity-Ready Positions

```
GET /api/v1/admin/locked-pools/positions/maturity-ready
```

**Query Parameters:**
| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `poolAddress` | string | No | Filter by pool address |

---

### Get Rollover-Ready Positions

```
GET /api/v1/admin/locked-pools/positions/rollover-ready
```

**Query Parameters:**
| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `poolAddress` | string | No | Filter by pool address |

---

### Check Position Maturity

```
GET /api/v1/admin/locked-pools/positions/:positionId/can-mature
```

**Path Parameters:**
| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `positionId` | number | Yes | Position ID |

---

### Batch Mature Positions

```
POST /api/v1/admin/locked-pools/positions/batch-mature
```

**Body:**

```json
{
  "positionIds": [1, 2, 3, 4, 5]
}
```

---

### Batch Execute Rollovers

```
POST /api/v1/admin/locked-pools/positions/batch-rollover
```

**Body:**

```json
{
  "positionIds": [1, 2, 3]
}
```

---

### Add Lock Tier

```
POST /api/v1/admin/locked-pools/:poolAddress/tiers
```

**Path Parameters:**
| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `poolAddress` | string | Yes | Pool contract address |

**Body:**

```json
{
  "durationDays": 180,
  "apyBps": 1000,
  "earlyExitPenaltyBps": 300,
  "minDeposit": "5000"
}
```

---

### Update Lock Tier

```
PATCH /api/v1/admin/locked-pools/:poolAddress/tiers/:tierIndex
```

**Path Parameters:**
| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `poolAddress` | string | Yes | Pool contract address |
| `tierIndex` | number | Yes | Tier index (0, 1, 2...) |

**Body:**

```json
{
  "apyBps": 1100,
  "earlyExitPenaltyBps": 250
}
```

---

### Set Tier Active Status

```
PUT /api/v1/admin/locked-pools/:poolAddress/tiers/:tierIndex/active
```

**Path Parameters:**
| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `poolAddress` | string | Yes | Pool contract address |
| `tierIndex` | number | Yes | Tier index |

**Body:**

```json
{
  "isActive": false
}
```

---

### Update Tier APY

```
PUT /api/v1/admin/locked-pools/:poolAddress/tiers/:tierIndex/apy
```

**Path Parameters:**
| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `poolAddress` | string | Yes | Pool contract address |
| `tierIndex` | number | Yes | Tier index |

**Body:**

```json
{
  "newApyBps": 1200
}
```

---

### Activate Locked Pool

```
POST /api/v1/admin/locked-pools/:poolAddress/activate
```

**Path Parameters:**
| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `poolAddress` | string | Yes | Pool contract address |

---

### Deactivate Locked Pool

```
POST /api/v1/admin/locked-pools/:poolAddress/deactivate
```

**Path Parameters:**
| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `poolAddress` | string | Yes | Pool contract address |

---

## SPV Allocations

### Get All SPV Allocations

```
GET /api/v1/admin/spv/allocations
```

**Parameters:** None

---

### Create SPV Allocation

```
POST /api/v1/admin/spv/allocations
```

**Body:**

```json
{
  "poolAddress": "0x...",
  "spvAddress": "0x...",
  "amount": "100000"
}
```

---

### Allocate Funds to SPV

```
POST /api/v1/admin/pools/:poolAddress/allocate-to-spv
```

**Path Parameters:**
| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `poolAddress` | string | Yes | Pool contract address |

**Body:**

```json
{
  "spvAddress": "0x...",
  "amount": "100000"
}
```

---

### Cancel Allocation

```
POST /api/v1/admin/allocations/:allocationId/cancel
```

**Path Parameters:**
| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `allocationId` | string | Yes | Allocation ID (bytes32) |

---

### Rebalance Pool Reserves

```
POST /api/v1/admin/pools/:poolAddress/rebalance-reserves
```

**Path Parameters:**
| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `poolAddress` | string | Yes | Pool contract address |

**Body:**

```json
{
  "action": 0,
  "amount": "50000"
}
```

_Note: action `0` = increase reserves, `1` = decrease reserves_

---

## Withdrawal Queues

### Get Withdrawal Queues

```
GET /api/v1/admin/withdrawal-queues
```

**Query Parameters:**
| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `poolId` | string | No | Filter by pool ID |
| `status` | string | No | Filter by status |

---

### Process Withdrawal Queue

```
POST /api/v1/admin/withdrawal-queues/:poolAddress/process
```

**Path Parameters:**
| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `poolAddress` | string | Yes | Pool contract address |

**Body:**

```json
{
  "maxRequests": 10
}
```

---

## Assets Management

### Get All Assets

```
GET /api/v1/admin/assets
```

**Query Parameters:**
| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `status` | string | No | Filter by status |
| `region` | string | No | Filter by region |

---

### Create Asset

```
POST /api/v1/admin/assets
```

**Body:**

```json
{
  "name": "Mock USDC",
  "symbol": "mUSDC",
  "address": "0x...",
  "chainId": 84532,
  "decimals": 6
}
```

---

### Approve Asset

```
POST /api/v1/admin/assets/approve
```

**Body:**

```json
{
  "address": "0x...",
  "chainId": 84532
}
```

---

### Update Asset

```
PATCH /api/v1/admin/assets/:assetId
```

**Path Parameters:**
| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `assetId` | string | Yes | Asset UUID |

**Body:**

```json
{
  "name": "Updated Name"
}
```

---

### Delete Asset

```
DELETE /api/v1/admin/assets/:assetId
```

**Path Parameters:**
| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `assetId` | string | Yes | Asset UUID |

---

## Role Management

### Get All Roles

```
GET /api/v1/admin/roles
```

**Parameters:** None

---

### Get Role Metrics

```
GET /api/v1/admin/roles/metrics
```

**Parameters:** None

---

### Get Pools for Role

```
GET /api/v1/admin/roles/:roleName/pools
```

**Path Parameters:**
| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `roleName` | string | Yes | Role name: `ADMIN`, `OPERATOR`, `SPV_MANAGER` |

**Query Parameters:**
| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `status` | string | No | Filter by status |
| `needsAction` | string | No | Filter pools needing action |

---

### Grant Role

```
POST /api/v1/admin/roles/grant
```

**Body:**

```json
{
  "address": "0x...",
  "role": "SPV_MANAGER"
}
```

---

### Revoke Role

```
POST /api/v1/admin/roles/revoke
```

**Body:**

```json
{
  "address": "0x...",
  "role": "SPV_MANAGER"
}
```

---

## Fees & Treasury

### Get Fee Stats

```
GET /api/v1/admin/fees
```

**Parameters:** None

---

### Collect Fees

```
POST /api/v1/admin/fees/collect
```

**Body:**

```json
{
  "poolAddress": "0x..."
}
```

---

### Update Fee Config

```
PATCH /api/v1/admin/fees/config
```

**Body:**

```json
{
  "poolAddress": "0x...",
  "feeBps": 100
}
```

---

### Get Treasury Overview

```
GET /api/v1/admin/treasury
```

**Parameters:** None

---

### Withdraw from Treasury

```
POST /api/v1/admin/treasury/withdraw
```

**Body:**

```json
{
  "amount": "10000",
  "recipient": "0x...",
  "assetAddress": "0x..."
}
```

---

## Emergency Operations

### Pause Protocol

```
POST /api/v1/admin/emergency/pause-protocol
```

**Body:**

```json
{
  "reason": "Security incident"
}
```

---

### Unpause Protocol

```
POST /api/v1/admin/emergency/unpause-protocol
```

**Body:**

```json
{
  "reason": "Issue resolved"
}
```

---

### Force Close Epoch

```
POST /api/v1/admin/emergency/force-close-epoch
```

**Body:**

```json
{
  "poolAddress": "0x...",
  "reason": "Emergency closure"
}
```

---

## System & Monitoring

### Get Analytics Overview

```
GET /api/v1/admin/analytics/overview
```

**Parameters:** None

---

### Get Activity Log

```
GET /api/v1/admin/activity
```

**Query Parameters:**
| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `page` | number | No | Page number (default: 1) |
| `limit` | number | No | Items per page (default: 20) |
| `filter` | string | No | Filter category: `pools`, `roles`, `fees`, `deposits` |

---

### Get System Alerts

```
GET /api/v1/admin/alerts
```

**Parameters:** None

---

### Acknowledge Alert

```
POST /api/v1/admin/alerts/:alertId/acknowledge
```

**Path Parameters:**
| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `alertId` | string | Yes | Alert ID |

**Body:**

```json
{
  "userId": "user-uuid"
}
```

---

### Get System Status

```
GET /api/v1/admin/system/status
```

**Parameters:** None

---

### Get Known Addresses

```
GET /api/v1/admin/addresses/known
```

**Parameters:** None

---

# Summary

| Dashboard | Total Endpoints |
| --------- | --------------- |
| **User**  | 17              |
| **SPV**   | 33              |
| **Admin** | 65              |
| **Total** | **115**         |
