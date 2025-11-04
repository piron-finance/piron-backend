# Piron Finance Backend

A NestJS backend for cross-border investment platform that tokenizes real-world financial instruments (T-Bills, Bonds) on-chain.

## 🏗️ Architecture: Modular Monolith

Single NestJS application with clear module boundaries serving 4 clients:

- Marketing Site (piron.finance)
- User Dashboard (app.piron.finance)
- Admin Dashboard
- SPV Dashboard

## 🚀 Quick Start

### Prerequisites

- Node.js 18+
- PostgreSQL database (Supabase recommended for development)

### Setup

```bash
# 1. Install dependencies
npm install

# 2. Set up environment variables
cp .env.example .env
# Edit .env with your Supabase connection string

# 3. Generate Prisma client
npm run prisma:generate

# 4. Run database migrations
npx prisma migrate dev --name init

# 5. Seed with dummy data (optional)
npm run prisma:seed

# 6. Start development server
npm run dev
```

Server runs on: `http://localhost:3008`

### Database Setup (Supabase)

1. Create account at [supabase.com](https://supabase.com)
2. Create new project
3. Get connection string: **Settings → Database → Transaction pooler**
4. Update `.env` with both `DATABASE_URL` and `DIRECT_URL`

Example:

```bash
DATABASE_URL="postgresql://postgres.xyz:[PASSWORD]@aws-0-region.pooler.supabase.com:6543/postgres?pgbouncer=true"
DIRECT_URL="postgresql://postgres.xyz:[PASSWORD]@aws-0-region.pooler.supabase.com:5432/postgres"
```

## 📦 Tech Stack

- **Framework**: NestJS (TypeScript)
- **Database**: PostgreSQL + Prisma ORM
- **Blockchain**: ethers.js (Base, Morph networks)
- **Queue**: BullMQ + Redis
- **Storage**: AWS S3 (KYC documents)
- **Real-time**: Socket.io (coming in Phase 5)
- **Auth**: JWT + SIWE (Sign-In With Ethereum)

## 🎯 Current Status

### ✅ Completed

- ✅ NestJS project setup with TypeScript
- ✅ Prisma ORM with PostgreSQL (Supabase)
- ✅ Complete database schema (20 models)
- ✅ Pool module with 4 endpoints
  - `GET /pools` - List all pools with filters
  - `GET /pools/featured` - Get featured pools
  - `GET /pools/:poolAddress` - Get pool details
  - `GET /pools/:poolAddress/stats` - Get pool analytics
- ✅ DTOs with validation (class-validator)
- ✅ Database seeding with dummy data
- ✅ ESLint + Prettier
- ✅ Environment configuration

### 🚧 In Progress

**Next Up:**

- [ ] Simple JWT authentication
- [ ] Blockchain providers (ethers.js)
- [ ] User positions & portfolio endpoints
- [ ] Transaction history module
- [ ] Blockchain event indexer

### 📊 What's Seeded

After running `npm run prisma:seed`, you'll have:

- 3 Pools (Nigerian T-Bill, UK Gilt Bond, Stable Yield Fund)
- 3 Users (Alice, Bob, Admin) with positions
- Pool analytics (TVL, APY, investors)
- Sample transactions
- 2 Networks (Base Sepolia, Base Mainnet)
- 2 Assets (USDC, cNGN)

## 🗂️ Project Structure

```
piron-backend/
├── src/
│   ├── core/                      # Shared infrastructure
│   │   ├── blockchain/            # Blockchain providers
│   │   ├── cache/                 # Redis
│   │   ├── storage/               # S3
│   │   ├── websocket/             # Real-time
│   │   └── jobs/                  # Background jobs
│   │
│   ├── modules/                   # Feature modules
│   │   ├── auth/                  # Authentication
│   │   ├── users/                 # User management
│   │   ├── pools/                 # Pool management
│   │   ├── transactions/          # Transaction tracking
│   │   ├── positions/             # User positions
│   │   ├── kyc/                   # KYC/Compliance
│   │   ├── indexer/               # Blockchain indexer
│   │   ├── admin/                 # Admin operations
│   │   └── spv/                   # SPV operations
│   │
│   ├── common/                    # Shared utilities
│   │   ├── decorators/
│   │   ├── guards/
│   │   └── interceptors/
│   │
│   ├── config/                    # Configuration
│   ├── app.module.ts
│   └── main.ts
│
├── prisma/
│   ├── schema.prisma
│   └── migrations/
│
└── test/
```

## 🔧 Available Scripts

```bash
npm run dev              # Start development server (watch mode)
npm run build            # Build for production
npm run start:prod       # Start production server

npm run lint             # Run ESLint
npm run test             # Run tests

npm run prisma:generate  # Generate Prisma client
npm run prisma:migrate   # Run migrations
npm run prisma:studio    # Open Prisma Studio (GUI)
npm run prisma:seed      # Seed database with dummy data
```

## 🔐 Environment Variables

See `.env.example` for all required variables:

```bash
# Database (Supabase)
DATABASE_URL="postgresql://postgres.xyz:[PASSWORD]@aws-0-region.pooler.supabase.com:6543/postgres?pgbouncer=true"
DIRECT_URL="postgresql://postgres.xyz:[PASSWORD]@aws-0-region.pooler.supabase.com:5432/postgres"

# Application
NODE_ENV=development
PORT=3008
CORS_ORIGIN=http://localhost:3000

# JWT Authentication
JWT_SECRET=your-secret-key
JWT_EXPIRY=15m
JWT_REFRESH_SECRET=your-refresh-secret
JWT_REFRESH_EXPIRY=7d

# Blockchain (optional - for Phase 2)
BASE_SEPOLIA_RPC=https://sepolia.base.org
BASE_SEPOLIA_CHAIN_ID=84532
```

**Note**: Special characters in passwords must be URL-encoded (e.g., `@` → `%40`).

## 🎯 Roadmap

### Phase 1-2 (Week 1): Core + Indexer ← WE ARE HERE

- Complete database schema
- Pool browsing with live blockchain data
- Blockchain event indexer
- Auto-sync positions and transactions

### Phase 3 (Week 2): Auth + KYC

- SIWE wallet authentication
- KYC document uploads
- Notification system

### Phase 4 (Week 3): Admin + SPV

- Admin dashboard APIs
- SPV operations module
- Analytics and reporting

### Phase 5 (Week 4): Production

- WebSocket real-time updates
- Performance optimization
- API documentation
- Testing
- Deployment

## 📖 Key Concepts

### Pool Types

**Single-Asset Pools**: Fixed-term investments

- Lifecycle: FUNDING → FILLED → INVESTED → MATURED → WITHDRAWN
- Tied to specific T-Bills or Bonds
- Clear maturity date

**Stable Yield Pools**: Flexible investments

- Continuous deposits/withdrawals
- NAV-based pricing
- 30-day minimum holding
- Withdrawal queue system

### User Roles

- `REGULAR_USER` - Normal investor
- `ADMIN` - Platform administrator
- `SPV_MANAGER` - Off-chain investment execution
- `OPERATOR` - Platform operator
- `VERIFIER` - KYC verifier
- `SUPER_ADMIN` - Full system access

## 🐛 Debugging

```bash
# View logs
npm run dev

# Check database connection and data
npx prisma studio

# Verify database is connected
# Look for "✅ Database connected" in server logs

# Test API endpoints
curl http://localhost:3008/pools
curl http://localhost:3008/pools/featured
```

## 🧪 Testing

```bash
# Test pool endpoints
curl http://localhost:3008/pools
curl http://localhost:3008/pools/featured
curl http://localhost:3008/pools/0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa

# Open database GUI
npm run prisma:studio
```

## 🤝 Contributing

1. Create feature branches from `main`
2. Follow existing code structure and naming conventions
3. Write tests for new features
4. Run `npm run lint` before committing
5. Submit PR with clear description

## 📄 License

ISC

## 🔗 Useful Links

- [NestJS Documentation](https://docs.nestjs.com)
- [Prisma Documentation](https://www.prisma.io/docs)
- [Supabase Documentation](https://supabase.com/docs)
- [ethers.js Documentation](https://docs.ethers.org)

---

**Status**: 🚧 Active Development  
**Last Updated**: November 4, 2025
