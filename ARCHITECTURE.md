# Piron Finance Backend - Architecture

## Overview

Backend API for Piron Finance - a DeFi platform for tokenized real-world assets (RWAs). Built with NestJS, PostgreSQL (Prisma ORM), and ethers.js for blockchain integration.

## Tech Stack

- **Framework**: NestJS (modular Node.js framework)
- **Database**: PostgreSQL via Supabase
- **ORM**: Prisma (type-safe database client)
- **Blockchain**: ethers.js v6 (Base Sepolia testnet)
- **Validation**: class-validator + class-transformer
- **API**: RESTful with global prefix `/api/v1`

## Project Structure

```
src/
├── main.ts                    # App entry point, CORS, validation setup
├── app.module.ts             # Root module - imports all feature modules
├── prisma.service.ts         # Prisma singleton service
│
├── blockchain/               # Blockchain integration layer
│   ├── blockchain.service.ts          # Core: providers, contract instances
│   ├── pool-builder.service.ts        # Build unsigned pool creation txs
│   └── pool-creation-watcher.service  # Watch for PoolCreated events (TODO)
│
├── contracts/               # Smart contract ABIs & addresses
│   ├── abis/               # JSON ABIs for all contracts
│   └── addresses.ts        # Contract addresses per chain
│
└── modules/                # Feature modules (MVC pattern)
    ├── admin/              # Pool creation & management
    ├── users/              # User CRUD
    ├── pools/              # Pool listing & details
    ├── positions/          # User positions in pools
    ├── transactions/       # Transaction history
    └── platform/           # Platform-wide metrics
```

## Database Schema (Prisma)

### Core Models

1. **User** - Wallet addresses, KYC status, user types (REGULAR/ADMIN/SPV_MANAGER)
2. **Pool** - Liquidity pools (SINGLE_ASSET or STABLE_YIELD types)
3. **PoolPosition** - User's position in a pool (shares, deposits, returns)
4. **Transaction** - On-chain transactions (deposits, withdrawals, claims)
5. **Network** - Blockchain networks (chainId, RPC URLs, indexer state)
6. **Asset** - Approved ERC20 tokens

### Pool Types

- **SINGLE_ASSET**: Fixed-term, single maturity date, discounted T-bills
  - Has: `targetRaise`, `epochEndTime`, `maturityDate`, `discountRate`, `instrumentType`
- **STABLE_YIELD**: Perpetual, managed portfolio of instruments
  - Has: `Instrument[]`, NAV tracking, withdrawal queue

### Supporting Models

- **Instrument** - Individual RWA holdings (T-bills, bonds) in Stable Yield pools
- **CouponPayment** - Interest payments from instruments
- **WithdrawalRequest** - Queued withdrawals for Stable Yield pools
- **SPVOperation** - Off-chain SPV actions (purchase, liquidation)
- **PoolAnalytics** - TVL, APY, investor counts
- **PoolSnapshot** - Historical data points
- **NAVHistory** - Net Asset Value tracking for Stable Yield pools

### Compliance & Admin

- **KYCDocument**, **BankAccount**, **FiatTransaction**
- **AuditLog**, **ComplianceAlert**, **Notification**

## Module Breakdown

### 1. BlockchainModule

**Purpose**: Interface with Base blockchain

**Services**:

- `BlockchainService` - Core service

  - Manages ethers.js providers (Base Sepolia, Base Mainnet)
  - Caches contract instances
  - Methods: `getManager()`, `getStableYieldManager()`, `getPool()`, `getERC20()`
  - Read methods: `getPoolTotalAssets()`, `getUserShares()`, `getNAVPerShare()`

- `PoolBuilderService` - Transaction builder

  - `buildPoolCreationTx()` - Generates unsigned tx data
  - Handles both Single-Asset and Stable Yield pool types
  - Returns: `{ to, data, value, description }`

- `PoolCreationWatcher` - Event listener (TODO: fully implement)
  - Watches for `PoolCreated` events
  - Auto-updates database when pools deploy

**Smart Contracts**:

- `Manager` - Single-Asset pool manager
- `StableYieldManager` - Stable Yield pool manager
- `PoolFactory` - Single-Asset pool factory
- `ManagedPoolFactory` - Stable Yield pool factory
- `PoolRegistry` - Asset approval registry
- `LiquidityPool` - Single-Asset pool contract
- `StableYieldPool` - Stable Yield pool contract

### 2. AdminModule

**Purpose**: Pool creation and admin operations

**Endpoints**:

- `POST /admin/pools/create` - Create pool metadata + return unsigned tx
- `POST /admin/pools/confirm-deployment` - Manually confirm deployment
- `GET /admin/pools` - List all pools (including pending)
- `GET /admin/pools/:id` - Pool details with positions
- `DELETE /admin/pools/:id` - Cancel pending deployment

**Flow**:

1. Admin submits pool details
2. Backend validates inputs (asset approved, dates valid, etc.)
3. Creates database record with status `PENDING_DEPLOYMENT`
4. Returns unsigned transaction to admin
5. Admin signs & submits tx on frontend
6. Watcher detects `PoolCreated` event OR admin confirms manually
7. Updates pool with addresses and changes status to `FUNDING`

### 3. PoolsModule

**Purpose**: Public pool listing and details

**Endpoints**:

- `GET /pools` - List pools (paginated, filterable)
- `GET /pools/featured` - Featured pools only
- `GET /pools/:poolAddress` - Single pool details
- `GET /pools/:poolAddress/stats` - Pool statistics

**Features**:

- Filtering: type, status, country, region, featured
- Includes analytics (TVL, APY, investors)
- Returns instruments and snapshots for detail view

### 4. PositionsModule

**Purpose**: User portfolio tracking

**Endpoints**:

- `GET /users/:walletAddress/positions` - All user positions
- `GET /users/:walletAddress/positions/:poolAddress` - Single position

**Returns**:

- Shares held, deposits, withdrawals
- Current value, realized/unrealized returns
- For Single-Asset: coupon claims, discount accrued
- For Stable Yield: first/last deposit times

### 5. TransactionsModule

**Purpose**: Transaction history

**Endpoints**:

- `GET /users/:walletAddress/transactions` - User transaction history
- `GET /pools/:poolAddress/transactions` - Pool transaction history
- `GET /transactions/:txHash` - Single transaction details

**Transaction Types**:

- DEPOSIT, WITHDRAWAL, COUPON_CLAIM, MATURITY_CLAIM, REFUND, EMERGENCY_WITHDRAWAL

### 6. UsersModule

**Purpose**: User management

**Endpoints**:

- `GET /users/:walletAddress` - User profile
- `POST /users` - Create user (auto-created on first interaction)

**User Types**:

- `REGULAR_USER` - Investors
- `ADMIN` - Platform admins
- `SPV_MANAGER` - Manages off-chain RWA purchases
- `OPERATOR`, `VERIFIER`, `SUPER_ADMIN`

### 7. PlatformModule

**Purpose**: Platform-wide metrics

**Endpoints**:

- `GET /platform/metrics` - Total TVL, users, pools, 24h volume

## Key Concepts

### NestJS Modules

Each module is self-contained with:

- **Controller** - HTTP endpoints (routes)
- **Service** - Business logic
- **DTOs** - Data Transfer Objects (request/response validation)
- **Module** - Ties it together, declares dependencies

Example flow:

```
HTTP Request → Controller → Service → Prisma → Database
                                    ↓
                              Blockchain Service (optional)
```

### Prisma ORM

- Schema defined in `prisma/schema.prisma`
- Type-safe client auto-generated: `prisma generate`
- Migrations: `prisma migrate dev`
- Seeding: `ts-node prisma/seed.ts`

### Validation

- All DTOs use `class-validator` decorators
- Global validation pipe in `main.ts`
- Example: `@IsEthereumAddress()`, `@IsEnum()`, `@IsOptional()`

### Error Handling

NestJS built-in exceptions:

- `NotFoundException` → 404
- `BadRequestException` → 400
- Auto-formatted JSON responses

## Current State

### ✅ Implemented

- Complete database schema (20+ models)
- Blockchain service (providers, contract instances)
- Pool CRUD (create, read, list)
- Position tracking
- Transaction history
- Platform metrics
- Admin endpoints for pool creation

### 🚧 In Progress

- Event listening/indexing (PoolCreationWatcher)
- Automatic sync of on-chain data

### 📋 TODO

- KYC flow
- Fiat on/off-ramp integration (Blockradar)
- Withdrawal queue processing
- SPV operation workflows
- Scheduled jobs (analytics calculation, NAV updates)
- Authentication/authorization
- Rate limiting
- Logging/monitoring

## Environment Variables

```bash
DATABASE_URL="postgresql://..."       # Supabase connection
DIRECT_URL="postgresql://..."        # Direct connection (migrations)
BASE_SEPOLIA_RPC="https://..."       # Base testnet RPC
BASE_MAINNET_RPC="https://..."       # Base mainnet RPC (optional)
CORS_ORIGIN="*"                      # CORS settings
PORT=3000                            # Server port
```

## Running the App

```bash
# Install
npm install

# Database
npx prisma generate          # Generate Prisma client
npx prisma migrate dev       # Run migrations
npx prisma db seed           # Seed data

# Development
npm run dev                  # Watch mode

# Production
npm run build
npm run start:prod

# Database UI
npx prisma studio
```

## Key Design Decisions

1. **Off-chain metadata**: Pool details stored in DB, not fetched from chain (faster queries, rich metadata)
2. **Dual pool types**: Single-Asset (simple) vs Stable Yield (complex, managed)
3. **SPV model**: Off-chain entity purchases real RWAs, on-chain contract tracks shares
4. **Queued withdrawals**: Stable Yield pools require liquidity management
5. **Calculated fields**: Returns, NAV updated by background jobs (not real-time)
6. **Multi-chain ready**: Network table allows multiple chains
7. **Unsigned transactions**: Backend builds tx, frontend signs (non-custodial)

## API Patterns

### Response Format

```json
{
  "data": [...],
  "pagination": {
    "total": 50,
    "page": 1,
    "limit": 10,
    "totalPages": 5
  }
}
```

### Error Format

```json
{
  "statusCode": 404,
  "message": "Pool not found",
  "error": "Not Found"
}
```

### Decimal Handling

- Stored as `Decimal` in DB (precision)
- Returned as `string` in API (no floating point errors)
- Frontend parses with `ethers.parseUnits()`

## Security Notes

- No private keys stored (backend only reads blockchain)
- User authentication TODO (currently open API)
- Admin endpoints unprotected (add JWT/API key)
- Input validation on all endpoints
- Prepared statements via Prisma (SQL injection safe)

## Testing Strategy (TODO)

- Unit tests: Service logic
- Integration tests: API endpoints
- E2E tests: Full user flows
- Blockchain mocks: Test without testnet dependency
