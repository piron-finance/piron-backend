# Piron Finance Goldsky Subgraph

This subgraph indexes all on-chain events from Piron Finance smart contracts on Base Sepolia (testnet) using Goldsky infrastructure.

## Architecture

```
Smart Contracts (Base Sepolia)
       ↓ emit events
Goldsky Subgraph (indexes & stores)
       ↓ webhook notifications
NestJS Backend (processes & writes to DB)
       ↓ serves data
REST API → Frontend
```

## Setup

### 1. Install Dependencies

```bash
cd subgraph
npm install
```

### 2. Update Configuration

**networks.json** - Update `startBlock` values to actual deployment blocks:

```bash
# Get deployment block for each contract from Base Sepolia explorer
# Update networks.json with real block numbers
```

**Update in `networks.json`:**
- PoolFactory startBlock
- ManagedPoolFactory startBlock  
- Manager startBlock
- StableYieldManager startBlock

### 3. Copy ABIs

ABIs are symlinked from `../src/contracts/abis`. If symlink doesn't work:

```bash
cp -r ../src/contracts/abis ./abis
```

### 4. Generate Code

```bash
npm run codegen
```

This generates TypeScript types from your schema and ABIs.

### 5. Build Subgraph

```bash
npm run build
```

## Deployment to Goldsky

### Prerequisites

1. **Goldsky Account**: Sign up at https://goldsky.com
2. **Goldsky CLI**: Install globally
   ```bash
   npm install -g @graphprotocol/graph-cli
   ```
3. **API Key**: Get from Goldsky dashboard

### Deploy Steps

1. **Authenticate with Goldsky**
   ```bash
   goldsky login
   ```

2. **Create Subgraph** (first time only)
   ```bash
   goldsky subgraph create piron-finance-base-sepolia
   ```

3. **Deploy Subgraph**
   ```bash
   goldsky subgraph deploy piron-finance-base-sepolia/v1.0.0 \
     --from-abi subgraph.yaml
   ```

4. **Get GraphQL Endpoint**
   ```bash
   goldsky subgraph show piron-finance-base-sepolia
   ```

   Save the GraphQL endpoint URL - you'll need it for querying.

### Configure Webhooks

Goldsky will send real-time event notifications to your backend.

1. **Get your webhook URL**:
   ```
   https://your-domain.com/api/v1/webhooks/goldsky/event
   ```

2. **Configure in Goldsky Dashboard**:
   - Go to your subgraph settings
   - Add webhook endpoint
   - Select events to send (all)
   - Copy webhook secret

3. **Add to Backend .env**:
   ```bash
   GOLDSKY_WEBHOOK_SECRET=your_webhook_secret_here
   ```

## Backend Integration

### Environment Variables

Add to your backend `.env`:

```bash
# Redis (required for Bull queues)
REDIS_HOST=localhost
REDIS_PORT=6379
REDIS_PASSWORD=

# Goldsky
GOLDSKY_WEBHOOK_SECRET=your_secret_from_goldsky_dashboard
GOLDSKY_GRAPHQL_ENDPOINT=https://api.goldsky.com/api/public/project_xxx/subgraphs/piron-finance-base-sepolia/v1.0.0/gn
```

### Install Backend Dependencies

```bash
cd ..
npm install @nestjs/bull bull
```

### Start Redis (Required for Queues)

**Using Docker:**
```bash
docker run -d -p 6379:6379 redis:alpine
```

**Or install locally:**
```bash
# macOS
brew install redis
brew services start redis

# Ubuntu
sudo apt-get install redis-server
sudo systemctl start redis
```

### Verify Webhook Endpoint

Test that your webhook is accessible:

```bash
curl -X POST http://localhost:3000/api/v1/webhooks/goldsky/health
```

Should return:
```json
{"status":"ok","timestamp":1234567890}
```

## Testing

### Test Locally (Optional)

1. **Run Graph Node** (Docker required):
   ```bash
   git clone https://github.com/graphprotocol/graph-node/
   cd graph-node/docker
   docker-compose up
   ```

2. **Deploy to local node**:
   ```bash
   npm run create:local
   npm run deploy:local
   ```

3. **Query locally**:
   ```
   http://localhost:8000/subgraphs/name/piron-finance-base-sepolia
   ```

### Test Webhook Processing

1. **Send test event**:
   ```bash
   curl -X POST http://localhost:3000/api/v1/webhooks/goldsky/event \
     -H "Content-Type: application/json" \
     -H "x-goldsky-signature: test" \
     -d '{
       "event": "Deposit",
       "data": {
         "transaction": {
           "txHash": "0xtest",
           "timestamp": 1234567890,
           "blockNumber": 12345
         },
         "user": {
           "walletAddress": "0xtest"
         },
         "pool": {
           "poolAddress": "0xpool"
         },
         "amount": "1000",
         "shares": "1000"
       }
     }'
   ```

2. **Check queue status**:
   ```
   GET http://localhost:3000/api/v1/admin/queue-stats
   ```

## GraphQL Queries

Once deployed, you can query your subgraph:

### Get All Pools

```graphql
query {
  pools(first: 10, orderBy: createdAt, orderDirection: desc) {
    id
    poolAddress
    poolType
    name
    totalValueLocked
    totalShares
    uniqueInvestors
    status
    createdAt
  }
}
```

### Get User Positions

```graphql
query GetUserPositions($user: ID!) {
  user(id: $user) {
    id
    walletAddress
    totalDeposited
    totalWithdrawn
    positions {
      pool {
        name
        poolAddress
      }
      totalShares
      currentValue
      unrealizedReturn
    }
  }
}
```

### Get Pool with Transactions

```graphql
query GetPoolDetails($poolAddress: ID!) {
  pool(id: $poolAddress) {
    id
    name
    totalValueLocked
    navPerShare
    transactions(first: 100, orderBy: timestamp, orderDirection: desc) {
      id
      type
      amount
      shares
      timestamp
      user {
        walletAddress
      }
    }
  }
}
```

## Monitoring

### Check Subgraph Health

```bash
goldsky subgraph status piron-finance-base-sepolia
```

### View Logs

```bash
goldsky subgraph logs piron-finance-base-sepolia --follow
```

### Backend Queue Monitoring

Monitor Bull queues via Redis:

```bash
redis-cli
> KEYS bull:*
> LLEN bull:immediate-events:waiting
> LLEN bull:delayed-events:waiting
```

Or use Bull Board (optional):

```bash
npm install @bull-board/api @bull-board/express
```

## Event Processing

### Priority Queues

**Immediate Queue** (processed instantly):
- Deposit
- Withdraw
- PoolCreated
- CouponClaimed
- EmergencyWithdrawal

**Delayed Queue** (2 minute delay):
- NAVUpdated
- InstrumentPurchased
- ReservesRebalanced
- Analytics events

### Retry Logic

- **Attempts**: 3 retries
- **Backoff**: Exponential (2s, 4s, 8s)
- **Failed jobs**: Kept for debugging (last 1000)

## Troubleshooting

### Subgraph not syncing

1. Check Goldsky status page
2. Verify contract addresses and start blocks
3. Check logs: `goldsky subgraph logs piron-finance-base-sepolia`

### Webhooks not arriving

1. Verify webhook URL is publicly accessible
2. Check signature verification (set secret in .env)
3. Test health endpoint
4. Check Goldsky dashboard webhook logs

### Queue not processing

1. Verify Redis is running: `redis-cli ping`
2. Check queue stats in logs
3. Restart backend to clear stuck jobs
4. Check failed jobs: `redis-cli LRANGE bull:immediate-events:failed 0 -1`

### Database not updating

1. Check event processor logs
2. Verify Prisma connection
3. Ensure pool exists before processing deposits
4. Check transaction uniqueness (txHash)

## Updating the Subgraph

When contracts change:

1. Update ABIs in `src/contracts/abis/`
2. Update `schema.graphql` if entities change
3. Update mappings in `src/mappings/`
4. Regenerate code: `npm run codegen`
5. Build: `npm run build`
6. Deploy new version: `goldsky subgraph deploy piron-finance-base-sepolia/v1.0.1`

## Production Checklist

- [ ] Update all `startBlock` values in `networks.json`
- [ ] Set `GOLDSKY_WEBHOOK_SECRET` in production env
- [ ] Configure Redis with persistence (AOF/RDB)
- [ ] Set up Redis backup
- [ ] Add monitoring/alerting for queue depth
- [ ] Set up webhook retry alerts
- [ ] Test failover to existing indexers
- [ ] Document rollback procedure
- [ ] Set up Goldsky alerts
- [ ] Configure rate limiting on webhook endpoint

## Support

- **Goldsky Docs**: https://docs.goldsky.com
- **The Graph Docs**: https://thegraph.com/docs
- **Bull Queue Docs**: https://docs.bullmq.io

