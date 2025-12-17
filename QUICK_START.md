# 🚀 Goldsky Quick Start Guide

## TL;DR

This integration replaces your polling indexers with Goldsky webhooks for real-time event processing.

## Prerequisites (5 mins)

```bash
# 1. Install Redis
docker run -d -p 6379:6379 --name redis redis:alpine

# 2. Verify Redis
redis-cli ping  # Should return PONG

# 3. Install dependencies
npm install
```

## Deploy Subgraph (10 mins)

```bash
# 1. Update start blocks in subgraph/networks.json
# Get blocks from https://sepolia.basescan.org

# 2. Build
cd subgraph
npm install
npm run codegen
npm run build

# 3. Deploy to Goldsky
goldsky login
goldsky subgraph create piron-finance-base-sepolia
goldsky subgraph deploy piron-finance-base-sepolia/v1.0.0 --from-abi subgraph.yaml
```

## Configure Webhook (5 mins)

**In Goldsky Dashboard:**

1. Go to your subgraph → Webhooks
2. Add webhook:
   - URL: `https://your-domain.com/api/v1/webhooks/goldsky/event`
   - Events: All
   - Generate secret

**In your `.env`:**

```bash
REDIS_HOST=localhost
REDIS_PORT=6379
GOLDSKY_WEBHOOK_SECRET=<paste_from_goldsky>
GOLDSKY_GRAPHQL_ENDPOINT=<paste_from_goldsky>
```

## Test (5 mins)

```bash
# 1. Restart backend
npm run dev

# 2. Test health
curl -X POST http://localhost:3000/api/v1/webhooks/goldsky/health

# 3. Make a deposit on testnet and watch logs
# Should see: "Received webhook event: Deposit"

# 4. Verify database updated
# Check transactions table for new record
```

## Monitor

```bash
# Queue status
redis-cli LLEN bull:immediate-events:waiting

# Subgraph status  
goldsky subgraph status piron-finance-base-sepolia
```

## Success Criteria

✅ Subgraph synced (status = "Synced")  
✅ Webhooks arriving < 5 seconds  
✅ Database updating automatically  
✅ No errors in logs

## Full Documentation

- **Setup**: `GOLDSKY_SETUP_GUIDE.md`
- **Deployment**: `DEPLOYMENT_CHECKLIST.md`  
- **Overview**: `GOLDSKY_COMPLETE.md`
- **Subgraph**: `subgraph/README.md`

## Problems?

1. Check `GOLDSKY_SETUP_GUIDE.md` troubleshooting
2. Verify Redis is running
3. Check webhook signature is correct
4. Review backend logs

**Goldsky Support**: support@goldsky.com

