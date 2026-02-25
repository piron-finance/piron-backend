# Admin Dashboard - Backend Requirements for Production

**Last Updated:** 2026-01-23  
**Status:** Comprehensive Analysis for Live Deployment

---

## 📊 **Current Dashboard Components**

### **1. OverviewSection (Row 1 - Left)**

**Status:** ✅ Using Real Hook (`useAdminAnalytics`)

**Data Displayed:**

- Total Value Locked (TVL)
- Total Pools
- Active Pools
- Average APY
- Treasury Balance
- Protocol Fees

**Backend Endpoint:** `GET /api/v1/admin/analytics/overview`

**Required Response:**

```typescript
{
  overview: {
    totalPools: number;
    activePools: number;
    totalTVL: string;
    totalInvestors: number;
    totalTransactions: number;
    averageAPY: string;
  }
  treasury: {
    totalBalance: string;
    collectedFees: string;
    pendingFees: string;
    protocolRevenue: string;
  }
  poolsByStatus: {
    FUNDING: number;
    FILLED: number;
    INVESTED: number;
    MATURED: number;
  }
  poolsByType: {
    SINGLE_ASSET: number;
    STABLE_YIELD: number;
    LOCKED: number;
  }
}
```

**Status:** ✅ **IMPLEMENTED** - Endpoint exists and working

---

### **2. SystemAlerts (Row 1 - Right)**

**Status:** ⚠️ Using Mock Data

**Data Displayed:**

- Time (relative: "2m ago", "5h ago")
- Alert Message
- Pool Name
- Days Remaining
- Action Buttons
- Severity (critical, warning, info)

**Alert Types:**

1. **Epoch Closing** - Single Asset pools approaching end of epoch (7 days warning)
2. **APY Update** - End of month approaching, APY needs update
3. **Pool Filled** - Single Asset pool reached target early
4. **SPV Movement** - SPV added/returned liquidity
5. **Tier Review** - Locked tier conditions need review
   note: these are examples. you should modify and expandto include more alerts

**Required Backend Endpoint:** `GET /api/v1/admin/alerts`

**Required Response:**

```typescript
{
  alerts: Array<{
    id: string;
    type:
      | 'epoch_closing'
      | 'apy_update'
      | 'pool_filled'
      | 'spv_movement'
      | 'tier_review'
      | 'more and more';
    severity: 'critical' | 'warning' | 'info';
    message: string;
    timestamp: string; // ISO 8601
    poolId?: string;
    poolName?: string;
    poolAddress?: string;
    actionLabel?: string; // "Review & Close", "Update APY", etc.
    actionEndpoint?: string; // API endpoint to call for action
    daysRemaining?: number;
    metadata?: {
      spvAddress?: string;
      oldValue?: string;
      newValue?: string;
      [key: string]: any;
    };
  }>;
  summary: {
    critical: number;
    warning: number;
    info: number;
    total: number;
  }
}
```

**Additional Endpoints Needed:**

- `POST /api/v1/admin/alerts/{alertId}/acknowledge` - Dismiss alert
- `GET /api/v1/admin/alerts/config` - Get alert configuration (thresholds, etc.)

**Status:** ❌ **NOT IMPLEMENTED** - Needs new endpoint

---

### **3. PoolsTable (Row 2 - Full Width)**

**Status:** ✅ Using Real Hook (`useAdminPools`)

**Data Displayed:**

- Pool Name & Type (badge)
- Issuer
- Status (badge with color coding)
- TVL (formatted currency)
- APY (percentage)
- Maturity Date / Active Positions
- Action Buttons (View, Actions)
- Search & Filter functionality

**Backend Endpoint:** `GET /api/v1/admin/pools`

**Current Response:** ✅ Working

```typescript
{
  pools: Array<{
    id: string;
    name: string;
    poolType: 'SINGLE_ASSET' | 'STABLE_YIELD' | 'LOCKED';
    poolAddress: string;
    status: string;
    assetSymbol: string;
    issuer?: string;
    analytics?: {
      totalValueLocked: string;
      apy: string;
      uniqueInvestors: number;
      activePositions?: number;
    };
    maturityDate?: string;
    createdAt: string;
  }>;
}
```

**Status:** ✅ **IMPLEMENTED** - Endpoint exists and working

---

### **4. Fees & Pool Mix (Row 3 - Left)**

**Status:** ⚠️ Using Mock Data

**Data Displayed:**

- Total Fees Collected
- Realized Yield to Users
- Protocol Take Rate. we could ignore if we dont undertsand
- Unclaimed Fees
- Fees by Pool Type (Last 30d):
  - Type (Stable Yield, Locked, Single Asset)
  - Fees amount
- Action Buttons: "Collect Fees", "Fund Pool"
- both action buttons should trigger functions that collects fees from a particular pool(undderstand diff types of pools and when and where fees is collected)
  fund pool should call another endpoitnt that allows it to loan funds to a stable yield or locked pool. but this is not impl contract side yet. so leave it be

**Required Backend Endpoint:** `GET /api/v1/admin/fees`

**Required Response:**

```typescript
{
  summary: {
    totalFeesCollected: string;
    realizedYieldToUsers: string;
    unclaimedFees: string;
    lastUpdated: string;
  }
  byPoolType: Array<{
    poolType: 'STABLE_YIELD' | 'LOCKED' | 'SINGLE_ASSET';
    totalFees: string;
    sharePercentage: string;
    poolCount: number;
  }>;
  byPool: Array<{
    poolId: string;
    poolName: string;
    poolType: string;
    totalFees: string;
    unclaimedFees: string;
    lastCollection: string;
  }>;
  timeframe: {
    period: '7d' | '30d' | '90d' | 'all';
    startDate: string;
    endDate: string;
  }
}
```

**Action Endpoints:**

- `POST /api/v1/admin/fees/collect` - Collect protocol fees

  ```typescript
  Request: { poolAddress?: string } // If null, collect from all pools
  Response: {
    transaction: {
      to: string;
      data: string;
      value: string;
      description: string;
    };
    fees: Array<{
      poolAddress: string;
      amount: string;
      feeType: string;
    }>;
  }
  ```

- `POST /api/v1/admin/pools/fund` - Fund a pool
  ```typescript
  Request: {
    poolAddress: string;
    amount: string;
  }
  Response: {
    transaction: {
      to, data, value, description;
    }
  }
  ```

**Status:** ❌ **NOT IMPLEMENTED** - Needs new endpoint

---

### **5. Activity Log (Row 3 - Right)**

**Status:** ✅ Using Real Hook (`useAdminActivity`)

**Data Displayed:**

- Time (relative: "2m ago", "1h ago")
- Action (method name with color coding)
- Target (pool name or ID)
- Actor (known address mapping or truncated)
- Filter: All, Pools, Roles, Assets, Emergency

**Backend Endpoint:** `GET /api/v1/admin/activity`

**Current Response:** ✅ Working

```typescript
{
  activities: Array<{
    id: string;
    action: string; // e.g., "closeEpoch", "updateAPY", "grantRole. basicsally, the name of the contract method called"
    entity: string; //target
    entityId: string;
    changes?: Record<string, any>;
    success: boolean;
    user: {
      walletAddress: string;
      email?: string;
    };
    createdAt: string;
  }>;
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  }
}
```

**Enhancement Needed:**
Add these fields to the activity response:

```typescript
{
  target?: string; // Pool name or resource name
  poolName?: string;
  category?: "pools" | "roles" | "assets" | "emergency";
}
```

**Status:** ✅ **not IMPLEMENTED** - Works but needs enhancement for better UX

---

### **6. System Management / Role & Emergency (Row 4 - Left)**

**Status:** ⚠️ Using Mock Data

#### **6a. Role Management Section**

**Data Displayed:**

- List of granted roles
- Address, Role Name, Granted Date
- Grant Role / Revoke Role buttons

**Required Endpoints:**

1. **Get Roles:** `GET /api/v1/admin/roles`

```typescript
Response: {
  roles: Array<{
    id: string;
    address: string;
    role: 'ADMIN' | 'OPERATOR' | 'TREASURY' | 'AUDITOR' | 'SPV_MANAGER';
    grantedAt: string;
    grantedBy: string;
    isActive: boolean;
  }>;
  summary: {
    totalAdmins: number;
    totalOperators: number;
    totalSPVManagers: number;
    totalAuditors: number;
  }
}
```

2. **Grant Role:** `POST /api/v1/admin/roles/grant`

```typescript
Request: {
  address: string;
  role: string;
}
Response: {
  transaction: {
    to, data, value, description;
  }
  role: {
    address: string;
    role: string;
    status: 'pending' | 'granted';
  }
}
```

3. **Revoke Role:** `POST /api/v1/admin/roles/revoke`

```typescript
Request: {
  address: string;
  role: string;
}
Response: {
  transaction: {
    to, data, value, description;
  }
}
```

#### **6b. Emergency Controls Section**

**Data Displayed:**

- Pause Pool / Unpause Pool buttons
- List of paused pools

**Required Endpoints:**

1. **Pause Pool:** `POST /api/v1/admin/pools/pause`

```typescript
Request: {
  poolAddress: string;
  reason: string;
}
Response: {
  transaction: {
    to, data, value, description;
  }
  pool: {
    address: string;
    name: string;
    pausedAt: string;
    reason: string;
  }
}
```

2. **Unpause Pool:** `POST /api/v1/admin/pools/unpause`

```typescript
Request: {
  poolAddress: string;
}
Response: {
  transaction: {
    to, data, value, description;
  }
}
```

3. **Get Paused Pools:** `GET /api/v1/admin/pools/paused`

```typescript
Response: {
  pools: Array<{
    poolId: string;
    poolName: string;
    poolAddress: string;
    pausedAt: string;
    reason: string;
    pausedBy: string;
  }>;
}
```

#### **6c. Asset Management Section**

**Data Displayed:**

- List of approved assets
- Symbol, Address, Status (active/pending)
- Add Asset / Approve / Remove buttons

**Required Endpoints:**

1. **Get Assets:** `GET /api/v1/admin/assets` ✅ Exists

```typescript
Response: {
  assets: Array<{
    id: string;
    address: string;
    symbol: string;
    name: string;
    decimals: number;
    isApproved: boolean;
    status: 'active' | 'pending';
    addedAt: string;
  }>;
  summary: {
    total: number;
    active: number;
    pending: number;
  }
}
```

2. **Add Asset:** `POST /api/v1/admin/assets/add`

```typescript
Request: {
  address: string;
  symbol: string;
  name: string;
  decimals: number;
}
Response: {
  transaction: {
    to, data, value, description;
  }
  asset: {
    id: string;
    address: string;
    symbol: string;
    status: 'pending';
  }
}
```

3. **Approve Asset:** `POST /api/v1/admin/assets/approve`

```typescript
Request: {
  assetAddress: string;
}
Response: {
  transaction: {
    to, data, value, description;
  }
}
```

4. **Remove Asset:** `POST /api/v1/admin/assets/remove`

```typescript
Request: {
  assetAddress: string;
}
Response: {
  transaction: {
    to, data, value, description;
  }
}
```

**Status:** ❌ **PARTIALLY IMPLEMENTED** - Assets endpoint exists, but role and emergency endpoints missing

---

## 🔄 **Cross-Component Requirements**

### **Known Address Mapping**

Multiple components need to display friendly names for known addresses:

- ActivityLog (Actor column)
- SystemAlerts (SPV movements)
- RoleManagement (Role holders)

**Required Endpoint:** `GET /api/v1/admin/addresses/known`

```typescript
Response: {
  addresses: Record<
    string,
    {
      name: string;
      type: 'admin' | 'operator' | 'spv' | 'treasury' | 'contract';
      description?: string;
    }
  >;
}
```

Example:

```json
{
  "addresses": {
    "0xfeed...": { "name": "Admin Wallet", "type": "admin" },
    "0xbeef...": { "name": "Operator 1", "type": "operator" },
    "0xdead...": { "name": "Treasury", "type": "treasury" }
  }
}
```

---

## 📋 **Summary: Backend Implementation Status**

### ✅ **Fully Implemented (Working)**

1. **Overview Analytics** - `GET /api/v1/admin/analytics/overview`
2. **Pools List** - `GET /api/v1/admin/pools`
3. **Activity Log** - `GET /api/v1/admin/activity`
4. **Assets List** - `GET /api/v1/admin/assets`
5. **Pool Creation** - `POST /api/v1/admin/pools/create`

### ⚠️ **Partially Implemented (Needs Enhancement)**

1. **Activity Log** - Add `target`, `poolName`, `category` fields
2. **Assets Management** - Add approve/remove endpoints

### ❌ **Not Implemented (Needs New Endpoints)**

#### **High Priority (Critical for Dashboard)**

1. **System Alerts** - `GET /api/v1/admin/alerts`
2. **Fees Analytics** - `GET /api/v1/admin/fees`
3. **Collect Fees** - `POST /api/v1/admin/fees/collect`
4. **Known Addresses** - `GET /api/v1/admin/addresses/known`

#### **Medium Priority (Core Management Features)**

5. **Roles Management**

   - `GET /api/v1/admin/roles`
   - `POST /api/v1/admin/roles/grant`
   - `POST /api/v1/admin/roles/revoke`

6. **Emergency Controls**

   - `POST /api/v1/admin/pools/pause`
   - `POST /api/v1/admin/pools/unpause`
   - `GET /api/v1/admin/pools/paused`

7. **Asset Management**
   - `POST /api/v1/admin/assets/add`
   - `POST /api/v1/admin/assets/approve`
   - `POST /api/v1/admin/assets/remove`

#### **Lower Priority (Nice to Have)**

8. **Alert Management**

   - `POST /api/v1/admin/alerts/{id}/acknowledge`
   - `GET /api/v1/admin/alerts/config`

9. **Fund Pool** - `POST /api/v1/admin/pools/fund`

---

## 🚀 **Recommended Implementation Order**

### **Phase 1: Critical Dashboard Data (Week 1)**

1. System Alerts endpoint
2. Fees Analytics endpoint
3. Known Addresses mapping
4. Activity Log enhancements

**Result:** Dashboard fully functional with real data

### **Phase 2: Core Admin Actions (Week 2)**

1. Roles Management endpoints
2. Emergency Controls endpoints
3. Collect Fees action

**Result:** Admin can perform all critical actions

### **Phase 3: Asset Management (Week 3)**

1. Add Asset endpoint
2. Approve Asset endpoint
3. Remove Asset endpoint

**Result:** Complete asset lifecycle management

### **Phase 4: Polish & Optimization (Week 4)**

1. Alert configuration and acknowledgment
2. Fund Pool action
3. Performance optimizations
4. Caching strategies

**Result:** Production-ready admin dashboard

---
