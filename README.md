# Piron Finance Backend

A NestJS backend for cross-border investment platform that tokenizes real-world financial instruments (T-Bills, Bonds) on-chain.

## 🏗️ Architecture: Modular Monolith

Single NestJS application with clear module boundaries serving 4 clients:

- Marketing Site (piron.finance)
- User Dashboard (app.piron.finance)
- Admin Dashboard
- SPV Dashboard

## 📚 Documentation

- **[START_NOW_PLAN.md](./START_NOW_PLAN.md)** - Prioritized implementation plan (START HERE)
- **[Context.md](./Context.md)** - Complete system requirements and architecture

## 🚀 Quick Start

```bash
# Install dependencies
npm install

# Set up environment variables
cp .env.sample .env
# Edit .env with your configuration

# Run migrations
npx prisma migrate dev

# Generate Prisma client
npx prisma generate

# Start development server
npm run dev
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

### ✅ Completed (Phase 1)

- Basic project setup
- Simple User CRUD
- Prisma configuration
- TypeScript configuration
- ESLint + Prettier

### 🚧 In Progress

Following the [START_NOW_PLAN.md](./START_NOW_PLAN.md):

**Phase 1 (Today)**: Core Foundation

- [ ] Complete database schema (15 models)
- [ ] Simple JWT auth
- [ ] Blockchain providers
- [ ] Pool module (read-only)
- [ ] Transaction module
- [ ] User portfolio

**Phase 2 (Tomorrow)**: Blockchain Indexer

- [ ] Event indexer
- [ ] Event handlers
- [ ] Background jobs
- [ ] Auto-sync with chain

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
npm run dev              # Start development server
npm run build            # Build for production
npm run start:prod       # Start production server

npm run lint             # Run ESLint
npm run test             # Run tests

npm run prisma:generate  # Generate Prisma client
npm run prisma:migrate   # Run migrations
npm run prisma:studio    # Open Prisma Studio
```

## 🔐 Environment Variables

See `.env.sample` for all required variables:

```bash
# Database
DATABASE_URL="postgresql://..."

# JWT
JWT_SECRET=your-secret-key

# Blockchain
BASE_SEPOLIA_RPC=https://sepolia.base.org
BASE_SEPOLIA_MANAGER_ADDRESS=0x...
BASE_SEPOLIA_STABLE_YIELD_MANAGER_ADDRESS=0x...

# Redis
REDIS_URL=redis://localhost:6379

# AWS S3
AWS_ACCESS_KEY_ID=xxx
AWS_SECRET_ACCESS_KEY=xxx
AWS_S3_BUCKET=piron-kyc-documents
```

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

# Check database
npx prisma studio

# Test blockchain connection
curl http://localhost:3000/health/blockchain

# Test auth
curl -X POST http://localhost:3000/auth/dev-login \
  -H "Content-Type: application/json" \
  -d '{"walletAddress":"0x..."}'
```

## 🤝 Contributing

1. Follow the [START_NOW_PLAN.md](./START_NOW_PLAN.md)
2. Create feature branches from `main`
3. Write tests for new features
4. Submit PR with clear description

## 📄 License

ISC

## 🔗 Links

- [Context Document](./Context.md) - Full system requirements
- [Implementation Plan](./START_NOW_PLAN.md) - Step-by-step guide
- [NestJS Docs](https://docs.nestjs.com)
- [Prisma Docs](https://www.prisma.io/docs)
- [ethers.js Docs](https://docs.ethers.org)

---

**Status**: 🚧 Active Development  
**Last Updated**: November 4, 2025
