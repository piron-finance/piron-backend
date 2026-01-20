# Piron Pools - Pool Types Overview

## Three Pool Types

Piron Pools offers three distinct pool types, each designed for different investment scenarios and user needs.

---

## 1. Single Asset Pools (Non-Revolving)

**Purpose:** Fixed-term, single-deal investments with a defined maturity date.

**Use Cases:**

- Invoice financing
- Corporate debt
- Trade finance
- Any deal with a specific end date

**How It Works:**

1. **Funding Phase:** Pool opens for deposits until target is reached or epoch ends
2. **Investment Phase:** SPV deploys capital to the underlying instrument
3. **Maturity Phase:** Instrument matures, funds return, users withdraw

**Key Features:**

- Single tenor per pool (e.g., 90-day invoice)
- Non-revolving (funds locked until maturity)
- Supports both discounted instruments (T-bills style) and interest-bearing (coupon payments)
- Emergency exit available if pool fails to meet minimum funding threshold

**User Flow:**

```
Deposit → Wait for Maturity → Withdraw Principal + Returns
```

**Contracts:**

- `LiquidityPool` - ERC4626 vault for user deposits
- `PoolEscrow` - Holds funds securely
- `Manager` - Business logic and lifecycle management

---

## 2. Stable Yield Pools (Revolving)

**Purpose:** Continuous yield generation with flexible deposits/withdrawals.

**Use Cases:**

- Treasury bill funds
- Money market funds
- Stable yield products
- Liquidity optimization

**How It Works:**

1. **Always Open:** Users can deposit anytime (subject to holding period)
2. **Rolling Investments:** Manager continuously allocates to short-term instruments
3. **NAV Growth:** Share price (NAV) increases as instruments earn yield
4. **Flexible Exit:** Withdraw after minimum holding period (queued if reserves low)

**Key Features:**

- Multi-instrument support (portfolio of T-bills, etc.)
- NAV-based share pricing (like mutual funds)
- Minimum 7-day holding period to prevent arbitrage
- Withdrawal queue when reserves insufficient
- Transaction fees on deposit/withdrawal (not time-based management fees)

**User Flow:**

```
Deposit → Receive Shares → NAV Grows → Redeem Shares for Principal + Yield
```

**NAV Calculation:**

```
NAV = Pool Reserves + Sum of Instrument Values
NAV per Share = Total NAV / Total Shares
```

**Contracts:**

- `StableYieldPool` - ERC4626 vault with NAV pricing
- `StableYieldEscrow` - Holds reserves and tracks allocations
- `StableYieldManager` - Instrument management and NAV updates

---

## 3. Locked Pools (Fixed-Term Deposits)

**Purpose:** Fixed-rate, tiered deposits with guaranteed returns.

**Use Cases:**

- Fixed deposits (like bank FDs)
- Savings products
- Predictable yield products

**How It Works:**

1. **Choose Tier:** Select lock duration (e.g., 3, 6, or 12 months)
2. **Choose Interest Payment:** Upfront or at maturity
3. **Lock Funds:** Principal locked for chosen duration
4. **Collect Returns:** Redeem principal + interest at maturity

**Key Features:**

- Multiple tiers per pool (different durations/APYs)
- Interest payment choice:
  - **Upfront:** Receive interest immediately, principal at maturity
  - **At Maturity:** Receive principal + interest together at end
- Early exit allowed with penalty (applied to principal only)
- Auto-rollover option for continuous compounding
- Per-position tracking (each deposit is a separate position)

**Tier Example:**
| Tier | Duration | APY | Early Exit Penalty |
|------|----------|-----|-------------------|
| 0 | 90 days | 5% | 10% |
| 1 | 180 days | 7% | 15% |
| 2 | 365 days | 10% | 20% |

**Interest Calculation:**

```
Interest = Principal × APY × Days / 365
```

**Upfront Payment Flow:**

```
Deposit 10,000 → Receive 123 interest immediately → At maturity receive 10,000
```

**Maturity Payment Flow:**

```
Deposit 10,000 → At maturity receive 10,123 (principal + interest)
```

**Early Exit:**

```
Exit before maturity → Receive Principal - Penalty
(Interest forfeited for upfront, pro-rata for maturity choice)
```

**Contracts:**

- `LockedPool` - ERC4626 vault for deposits
- `LockedPoolEscrow` - Holds principal and pays interest
- `LockedPoolManager` - Position and tier management

---

## Comparison Table

| Feature           | Single Asset   | Stable Yield         | Locked              |
| ----------------- | -------------- | -------------------- | ------------------- |
| Revolving         | ❌             | ✅                   | ❌                  |
| Fixed Rate        | ❌             | ❌                   | ✅                  |
| Multiple Tenors   | ❌             | N/A                  | ✅                  |
| Early Exit        | Emergency only | After holding period | With penalty        |
| Interest Payment  | At maturity    | NAV growth           | Choice              |
| Position Tracking | Per user       | Per user (shares)    | Per deposit         |
| Ideal For         | Specific deals | Yield optimization   | Predictable savings |

---

## Fee Structure

### Single Asset Pools

- Withdrawal fee (configurable, max 5%)

### Stable Yield Pools

- Deposit fee (configurable)
- Withdrawal fee (configurable)
- No management fee (transaction-only model)

### Locked Pools

- No deposit/withdrawal fees
- Early exit penalty (tier-specific, applied to principal)

---

## Security Features

All pools share common security measures:

1. **Access Control:** Role-based permissions via AccessManager
2. **Upgradeable:** UUPS proxy pattern with 72-hour timelock
3. **Emergency Guardian:** Can pause operations if needed
4. **Multi-sig:** Critical operations require multiple signatures
5. **Escrow Separation:** User funds isolated from protocol operations

---

## Integration Notes

### Deposit Flow (All Pool Types)

1. Approve token transfer to pool contract
2. Call deposit function with amount
3. Receive shares (ERC4626 standard)

### Withdrawal Flow

- **Single Asset:** Call `withdraw` after maturity
- **Stable Yield:** Call `withdraw` after holding period (may queue)
- **Locked:** Call `redeemPosition` at maturity or `earlyExitPosition` before

### Events to Monitor

- `Deposit` / `Withdraw` - User actions
- `PositionCreated` / `PositionRedeemed` - Locked pool positions
- `NAVUpdated` - Stable yield NAV changes
- `InstrumentAdded` / `InstrumentMatured` - Investment lifecycle
