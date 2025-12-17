# Stable Yield Pool Lifecycle - CORRECTED

## Core Principle: REVOLVING INVESTMENT CYCLE

Stable Yield pools are **revolving** - there's NO single "investment phase". SPV constantly:

- Pulls funds when reserves exceed 12%
- Returns funds when instruments mature
- Manages withdrawals from available reserves (8-12% range)

---

## Indexing Strategy for Event Monitoring

### Current Implementation: Polling (Every 15s)

**Purpose**: Capture unpredictable user deposits/withdrawals

- Scans blockchain blocks every 15 seconds
- Checks for Deposit/Withdrawal events
- Updates user positions and pool analytics

**Pros**:

- Simple to implement and maintain
- Reliable (no missed events if properly coded)
- Works in testnet/MVP environment

**Cons**:

- Wastes resources (checks even when idle)
- 15-second delay before users see updates
- Blockchain provider rate limits (Alchemy charges per request)
- Doesn't scale well with multiple pools/events

---

### Production Alternatives

#### Option 1: Alchemy Webhooks (Recommended for Piron)

**How it works**: Alchemy watches blockchain and sends HTTP POST to your API when events occur

**Setup**:

1. Create webhook on Alchemy dashboard
2. Configure to watch `Deposit`, `Withdraw`, `NAVUpdated` events
3. Point to your endpoint: `https://api.piron.com/webhooks/blockchain`
4. Alchemy sends event data when detected

**Pros**:

- Near real-time (1-2 second latency)
- Only pay for actual events (not idle checks)
- Alchemy handles reliability and retries
- Simple integration (just an HTTP endpoint)
- No persistent connections to manage

**Cons**:

- Requires paid Alchemy plan (Growth: $49/mo+)
- Webhook endpoint must be secure and validated
- Need fallback polling as safety net

**Best for**: Production apps wanting reliable, real-time updates without infrastructure complexity

**Cost**: ~$50-200/month depending on transaction volume

---

#### Option 2: The Graph (Decentralized Indexing)

**How it works**: Define a "subgraph" (GraphQL schema + event handlers), The Graph indexes blockchain for you

**Setup**:

1. Create subgraph with `schema.graphql` (define Pool, Deposit, Instrument entities)
2. Write event handlers in AssemblyScript
3. Deploy to The Graph network
4. Query via GraphQL: `query { deposits(where: { pool: "0x..." }) }`

**Pros**:

- Decentralized (no single point of failure)
- Rich querying (GraphQL with filters, pagination, aggregations)
- Historical data included (don't just get events, get indexed state)
- Used by major DeFi protocols (Uniswap, Aave, Curve)
- Can replace parts of your backend database

**Cons**:

- Steeper learning curve (AssemblyScript, GraphQL)
- Requires separate subgraph deployment and maintenance
- Indexing delay (5-30 seconds)
- Cost: ~$100-500/month for hosted service, or free on decentralized network (but slower)

**Best for**: Complex queries, analytics, or if you want decentralized infrastructure

**Cost**: $0 (decentralized) to $500/month (hosted)

---

#### Option 3: WebSockets (Real-time Streaming)

**How it works**: Maintain persistent connection to blockchain node, subscribe to events

**Setup**:

```typescript
const provider = new ethers.WebSocketProvider(ALCHEMY_WS_URL);
const poolContract = new ethers.Contract(address, abi, provider);

poolContract.on('Deposit', (user, amount, shares) => {
  // Update database immediately
});
```

**Pros**:

- True real-time (sub-second)
- Direct control over event handling
- No intermediary service needed

**Cons**:

- Requires persistent WebSocket connection management
- Connection drops need auto-reconnection logic
- More complex error handling
- Doesn't scale well (one connection per service instance)
- Provider rate limits still apply

**Best for**: Apps requiring absolute lowest latency (trading bots, arbitrage)

**Cost**: Included with Alchemy plan

---

### Recommended Hybrid Approach for Piron

**Phase 1 (MVP/Testnet)**: Current polling setup

- Keep current 15-second polling
- Simple, reliable, gets you to market

**Phase 2 (Production)**: Alchemy Webhooks + Safety Polling

1. **Alchemy Webhooks** for user events (90% of activity)

   - Deposit events → Update positions immediately
   - Withdrawal events → Update queue status
   - NAV updates → Refresh analytics

2. **Slow polling** (every 5 minutes) as safety net

   - Catches any missed webhooks
   - Handles edge cases (webhook service down)
   - Validates data consistency

3. **No indexing for admin actions**
   - Update DB directly in endpoints after tx confirms
   - You control these, so no need to "discover" them

**Phase 3 (Scale/Advanced)**: Add The Graph

- When you need complex analytics queries
- When you want to expose data to third parties
- When you want decentralized infrastructure

---

### Decision Matrix

| Need                  | Current Polling   | Alchemy Webhooks | The Graph  | WebSockets |
| --------------------- | ----------------- | ---------------- | ---------- | ---------- |
| **Real-time updates** | ❌ (15s delay)    | ✅ (1-2s)        | ⚠️ (5-30s) | ✅ (<1s)   |
| **Cost effective**    | ⚠️ (wastes calls) | ✅               | ⚠️         | ✅         |
| **Easy to implement** | ✅                | ✅               | ❌         | ⚠️         |
| **Reliability**       | ✅                | ✅               | ✅         | ⚠️         |
| **Scalability**       | ❌                | ✅               | ✅         | ❌         |
| **Complex queries**   | ❌                | ❌               | ✅         | ❌         |
| **Decentralized**     | ❌                | ❌               | ✅         | ❌         |

**Verdict**: Start with polling → Move to Alchemy Webhooks for production → Consider The Graph later for analytics/scale

---

## Phase 1: Pool Creation (Admin/Operator)

### Action: Create Pool with SPV Assignment

- **Endpoint**: `POST /api/v1/admin/pools/create`
- **Contract**: StableYieldManager.registerPool()
- **Requirements**:
  ```json
  {
    "poolType": "STABLE_YIELD",
    "asset": "0x... (USDC address)",
    "minInvestment": "100",
    "name": "Piron Treasury Fund",
    "spvAddress": "0x... (REQUIRED - set at creation)",
    "projectedAPY": "8.5"
  }
  ```
- **What Happens**:
  - Pool created with FUNDING status
  - SPV wallet address assigned permanently
  - Escrow contract deployed
  - Backend stores pool metadata with spvAddress
- **Status**: `FUNDING`

**Current Status**: ✅ COMPLETE

---

## Phase 2: Users Deposit (Continuous)

### Action: Users deposit into pool (anytime)

- **Endpoint**: `POST /api/v1/deposits`
- **Contract**: Pool.deposit()
- **What Happens**:
  - User deposits USDC
  - Mints shares based on current NAV
  - Funds go to escrow
  - Increases pool reserves
- **Effect**: Pool TVL grows, reserves increase
- **Status**: Remains `FUNDING` initially, then moves to `INVESTED`

**This happens CONTINUOUSLY** - users can deposit at any time, even when pool is actively invested.

**Current Status**: ✅ COMPLETE

---

## Phase 3: The Revolving Investment Cycle (Ongoing)

This is where the **revolving nature** happens. It's NOT a one-time flow - it repeats constantly.

### 3.1 SPV Monitors Reserve Levels

#### SPV Checks Pool Reserve Status

- **Endpoint**: `GET /api/v1/spv/pools/:poolAddress/liquidity-status`
- **Contract**: StableYieldManager.getReserveStatus()
- **What SPV Sees**:
  ```json
  {
    "currentReserve": "62000", // 12.4% of NAV
    "targetReserve": "50000", // 10% of NAV (RESERVE_RATIO)
    "minRequired": "40000", // 8% of NAV
    "maxAllowed": "60000", // 12% of NAV
    "availableToInvest": "22000", // Current - Target
    "status": "excess", // "critical"|"low"|"optimal"|"excess"
    "needsRebalance": true
  }
  ```

**Current Status**: ✅ COMPLETE

**NEW FEATURE NEEDED**: SPV should be able to set custom threshold to get alerted only when available > $X

---

### 3.2 Operator Allocates Excess Reserves to SPV

#### When: Reserves > 12% (excess cash)

**Action**: Operator allocates funds from pool to SPV wallet

- **Endpoint**: `POST /api/v1/admin/pools/:poolAddress/allocate-to-spv`
- **Contract**: StableYieldManager.allocateToSPV() (OPERATOR_ROLE required)
- **Request**:
  ```json
  {
    "poolAddress": "0x...",
    "spvAddress": "0x... (the pool's assigned SPV)",
    "amount": "22000"
  }
  ```
- **Validation**:
  - ✅ Checks reserve won't drop below 8% after allocation
  - ✅ Uses on-chain getReserveStatus() for validation
  - ✅ Updates pool status to `PENDING_INVESTMENT` (optional - might stay INVESTED)
  - ✅ Creates SPVOperation record (WITHDRAW_FOR_INVESTMENT)
- **Result**: USDC transferred from escrow to SPV wallet

**Current Status**: ✅ COMPLETE (just fixed)

---

### 3.3 SPV Purchases Instruments Off-Chain

#### SPV uses allocated funds to buy instruments (T-Bills, Bonds, etc.)

**Action 1**: SPV records instrument purchase

- **Endpoint**: `POST /api/v1/spv/pools/:poolAddress/instruments/add`
- **Contract**: StableYieldManager.addInstrument() (SPV_ROLE required)
- **Request**:
  ```json
  {
    "poolAddress": "0x...",
    "instrumentType": "DISCOUNTED",
    "purchasePrice": "98000",
    "faceValue": "100000",
    "maturityDate": "2025-06-01"
  }
  ```
- **What Happens**:
  - Creates Instrument record (status: ACTIVE)
  - Stores on-chain for transparency
  - Links to pool

**Current Status**: ✅ COMPLETE

---

**Action 2**: SPV confirms investment complete (optional)

- **Endpoint**: `POST /api/v1/spv/investments/confirm`
- **Backend**:
  - Updates SPVOperation status to COMPLETED
  - Updates pool status to `INVESTED`

**Current Status**: ✅ COMPLETE

---

### 3.4 Instruments Generate Returns (Ongoing)

#### A. Coupon Payments (Interest-Bearing Instruments)

**Action**: SPV receives coupon payment, returns to pool

- **Endpoint**: `POST /api/v1/spv/instruments/:instrumentId/record-coupon`
- **Contract**: StableYieldManager.recordCouponPayment() (SPV_ROLE)
- **Request**:
  ```json
  {
    "instrumentId": "123",
    "couponAmount": "1500"
  }
  ```
- **What Happens**:
  - Creates CouponPayment record
  - SPV transfers USDC back to escrow
  - Increases pool reserves
  - Triggers NAV update

**Effect**: Reserves increase, NAV per share increases, users see returns

**Current Status**: ✅ COMPLETE

---

#### B. Instrument Maturity

**Action**: Instrument matures, issuer returns principal + returns

- **Endpoint**: `POST /api/v1/spv/pools/:poolAddress/receive-maturity`
- **Contract**: StableYieldManager.receiveSPVMaturity() (SPV_ROLE)
- **Request**:
  ```json
  {
    "poolAddress": "0x...",
    "amount": "100000",
    "instrumentIds": [123, 124]
  }
  ```
- **What Happens**:
  - Updates Instrument(s) status to MATURED
  - Creates SPVOperation (RECORD_MATURITY)
  - SPV transfers matured funds back to escrow
  - Increases pool reserves significantly
  - Triggers NAV update

**Effect**: Large reserve increase - likely triggers rebalance (invest excess)

**Current Status**: ✅ COMPLETE (just added)

---

#### C. Batch Maturity Processing

**Action**: SPV matures multiple instruments at once

- **Endpoint**: `POST /api/v1/spv/instruments/batch-mature`
- **Contract**: StableYieldManager.batchMatureInstruments() (SPV_ROLE)

**Current Status**: ✅ COMPLETE

---

### 3.5 Reserve Rebalancing (Operator)

#### When: Reserves < 8% (insufficient) or > 12% (excess)

**Scenario A: Excess Reserves (> 12%)**

- **Action**: Operator rebalances to invest excess
- **Endpoint**: `POST /api/v1/admin/pools/:poolAddress/rebalance-reserves`
- **Request**:
  ```json
  {
    "poolAddress": "0x...",
    "action": 1, // 1 = invest excess
    "amount": "15000"
  }
  ```
- **Flow**:
  1. Operator calls rebalance
  2. Operator then calls allocateToSPV
  3. SPV purchases new instruments
  4. SPV confirms investment
  5. **CYCLE REPEATS**

**Scenario B: Insufficient Reserves (< 8%)**

- **Action**: Operator rebalances to liquidate instruments
- **Request**:
  ```json
  {
    "action": 0, // 0 = liquidate for cash
    "amount": "10000"
  }
  ```
- **Flow**:
  1. Operator calls rebalance (liquidate)
  2. SPV liquidates instruments off-chain (early maturity/sell)
  3. SPV returns funds via receiveSPVMaturity
  4. Reserves replenished
  5. Withdrawals can be processed

**Current Status**: ✅ COMPLETE (just added)

---

### 3.6 NAV Updates (SPV)

**Action**: SPV triggers NAV recalculation after material changes

- **Endpoint**: `POST /api/v1/spv/pools/:poolAddress/trigger-nav-update`
- **Contract**: Pool.getNAVPerShare(), totalAssets(), totalSupply()
- **When to Trigger**:
  - After instrument purchases
  - After coupon payments
  - After maturities
  - After fee collection
  - Periodically (e.g., daily)
- **What Happens**:
  - Fetches on-chain data
  - Calculates new NAV per share
  - Creates NAVHistory record
  - Updates PoolAnalytics
  - Users see updated share value

**Current Status**: ✅ COMPLETE

---

### 3.7 Fee Collection (SPV/Admin)

**Action**: Platform collects management/performance fees

- **Endpoint**: `POST /api/v1/spv/fees/collect`
- **Contract**: FeeManager.collectFees()
- **What Happens**:
  - Calculates collectible fees
  - Transfers fees from pool to treasury
  - Records TreasuryTransaction
  - Triggers NAV update (NAV decreases slightly)

**Current Status**: ✅ COMPLETE

---

## Phase 4: User Withdrawals (Continuous)

### 4.1 User Requests Withdrawal

**Action**: User wants to withdraw

- **Endpoint**: `POST /api/v1/withdrawals`
- **Contract**: Pool.requestWithdrawal()
- **Request**:
  ```json
  {
    "poolAddress": "0x...",
    "shares": "1000"
  }
  ```
- **What Happens**:
  - Creates WithdrawalRequest (status: QUEUED/PENDING)
  - Locks user shares
  - Adds to withdrawal queue
- **Important**: Fulfillment depends on available reserves

**Current Status**: ✅ COMPLETE

---

### 4.2 Admin Processes Withdrawal Queue

**Action**: Admin processes pending withdrawals

- **Endpoint**: `POST /api/v1/admin/withdrawal-queues/:queueId/process`
- **Contract**: Pool.processWithdrawal()
- **Logic**:
  ```
  IF (reserves after withdrawal >= 8% of NAV):
    ✅ Process withdrawal
    - Burns shares
    - Transfers USDC to user
    - Updates WithdrawalRequest status to COMPLETED
  ELSE:
    ❌ Cannot process yet
    - Withdrawal stays PENDING
    - Operator needs to rebalance (liquidate instruments)
  ```

**Current Status**: ✅ COMPLETE

---

### 4.3 Cancel Withdrawal

**Action**: User cancels pending withdrawal

- **Endpoint**: `POST /api/v1/withdrawals/:id/cancel`
- **What Happens**:
  - Unlocks shares
  - Cancels request
  - Removes from queue

**Current Status**: ✅ COMPLETE

---

## The Complete Revolving Cycle

```
┌─────────────────────────────────────────────────────────────┐
│                    THE REVOLVING CYCLE                       │
└─────────────────────────────────────────────────────────────┘

1. Users deposit continuously
   └─> Reserves increase

2. SPV monitors reserves
   └─> If > 12%: "Excess cash available"

3. Operator allocates to SPV
   └─> SPV wallet receives USDC

4. SPV purchases instruments (T-Bills, Bonds)
   └─> Reserves decrease, investments increase

5. Instruments generate returns
   ├─> Coupons paid → reserves increase
   └─> Maturities → reserves increase significantly

6. If reserves > 12%: Go back to step 3 (REINVEST) ♻️
   If reserves < 8%: Operator rebalances (liquidate)

7. Users can withdraw anytime (if reserves allow)
   └─> Reserves decrease

8. SPV triggers NAV updates regularly
   └─> Users see their share value increase

♻️ CYCLE REPEATS INDEFINITELY ♻️
```

---

## Status Summary

### ✅ COMPLETE Endpoints (Core Lifecycle):

1. ✅ Create Pool with SPV (Admin)
2. ✅ User Deposits
3. ✅ SPV Get Liquidity Status
4. ✅ Operator Allocates to SPV (with reserve validation)
5. ✅ SPV Add Instrument
6. ✅ SPV Confirm Investment
7. ✅ SPV Record Coupon
8. ✅ SPV Receive Maturity
9. ✅ SPV Batch Mature
10. ✅ Operator Rebalance Reserves
11. ✅ SPV Trigger NAV Update
12. ✅ SPV/Admin Collect Fees
13. ✅ User Request Withdrawal
14. ✅ Admin Process Withdrawal
15. ✅ User Cancel Withdrawal

### ⚠️ ENHANCEMENTS NEEDED:

1. **SPV Investment Threshold Feature** ❌

   - SPV can set: "Only alert me when available to invest > $10K"
   - Prevents noise from small amounts
   - Endpoints needed:
     - `POST /api/v1/spv/preferences/investment-threshold`
     - `GET /api/v1/spv/alerts`

2. **Enhanced Pool Detail Pages** ⚠️

   - SPV pool detail: comprehensive view of reserves, instruments, actions
   - Admin pool detail: health monitoring, SPV performance, operations

3. **Pool Close/Wind-Down** ❌
   - `POST /api/v1/admin/pools/:address/close`
   - Orderly shutdown (no new deposits, mature all instruments, pay out users)

---

## Key Differences from Single-Asset Pools

| Aspect                 | Single-Asset Pool                     | Stable Yield Pool               |
| ---------------------- | ------------------------------------- | ------------------------------- |
| **Investment**         | One-time at epoch close               | Continuous revolving            |
| **Withdrawals**        | After maturity                        | Anytime (reserve-dependent)     |
| **SPV Role**           | N/A                                   | Actively manages instruments    |
| **Maturity**           | Fixed date                            | No pool maturity                |
| **Status Flow**        | FUNDING → FILLED → INVESTED → MATURED | FUNDING → INVESTED (stays here) |
| **Epochs**             | Has epochs                            | NO epochs                       |
| **Reserve Management** | N/A                                   | Critical 8-12% range            |

---

## Critical Corrections from Previous Version

### ❌ WRONG (Previous):

- "Activate Pool" step → NO SUCH THING
- "Assign SPV" as separate step → SPV assigned at creation
- Linear flow with "end state" → It's a revolving cycle

### ✅ CORRECT (Now):

- SPV assigned during pool creation (required)
- No activation phase - revolving from day one
- SPV continuously monitors and acts based on reserves
- No end state - operates indefinitely until admin closes
