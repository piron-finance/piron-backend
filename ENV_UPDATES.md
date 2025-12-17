# Environment Variables - Add These to Your .env

Add these new environment variables for Goldsky subgraph integration:

```bash
# ============================================
# REDIS (Required for Bull queues)
# ============================================
REDIS_HOST=localhost
REDIS_PORT=6379
REDIS_PASSWORD=

# ============================================
# GOLDSKY SUBGRAPH
# ============================================
# Get webhook secret from Goldsky dashboard after setting up webhook
GOLDSKY_WEBHOOK_SECRET=your_webhook_secret_from_goldsky_dashboard

# Get GraphQL endpoint after deploying subgraph
GOLDSKY_GRAPHQL_ENDPOINT=https://api.goldsky.com/api/public/project_xxx/subgraphs/piron-finance-base-sepolia/v1.0.0/gn

# ============================================
# EXISTING VARIABLES (Keep these)
# ============================================
DATABASE_URL="postgresql://..."
DIRECT_URL="postgresql://..."
BASE_SEPOLIA_RPC="https://base-sepolia.g.alchemy.com/v2/YOUR_KEY"
BASE_MAINNET_RPC="https://base-mainnet.g.alchemy.com/v2/YOUR_KEY"
INDEXER_MAX_BLOCK_RANGE=250
PORT=3000
CORS_ORIGIN=*
NODE_ENV=development
```

## Setup Steps

1. **Install Redis** (if not already):
   ```bash
   # Using Docker (easiest)
   docker run -d -p 6379:6379 --name redis redis:alpine
   
   # OR on macOS
   brew install redis
   brew services start redis
   ```

2. **Verify Redis is running**:
   ```bash
   redis-cli ping
   # Should return: PONG
   ```

3. **Add variables to .env**:
   - Copy the Redis and Goldsky sections above
   - Leave GOLDSKY_* values empty for now
   - Fill them in after deploying subgraph

4. **Install new npm dependencies**:
   ```bash
   npm install
   ```

5. **Restart backend**:
   ```bash
   npm run dev
   ```

Look for these logs:
```
🎯 Goldsky webhook module loaded
📡 Webhook endpoint: /api/v1/webhooks/goldsky/event
✅ Redis connected
```

