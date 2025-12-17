# Goldsky Subgraph Deployment Checklist

Complete this checklist to deploy and test your Goldsky subgraph integration.

## ✅ Pre-Deployment

- [ ] Goldsky account created
- [ ] Goldsky CLI installed: `npm install -g @graphprotocol/graph-cli`
- [ ] Redis installed and running (`redis-cli ping` returns PONG)
- [ ] All contract deployment blocks noted
- [ ] Backend dependencies installed (`npm install`)

## ✅ Subgraph Setup

### Step 1: Configure

- [ ] Update `subgraph/networks.json` with correct `startBlock` values:
  ```json
  {
    "base-sepolia": {
      "PoolFactory": { "startBlock": XXXXX },
      "ManagedPoolFactory": { "startBlock": XXXXX },
      "Manager": { "startBlock": XXXXX },
      "StableYieldManager": { "startBlock": XXXXX }
    }
  }
  ```

### Step 2: Build

```bash
cd subgraph
npm install
npm run codegen
npm run build
```

- [ ] No errors in codegen
- [ ] No errors in build
- [ ] `build/` directory created

### Step 3: Deploy to Goldsky

```bash
# Login
goldsky login

# Create subgraph (first time)
goldsky subgraph create piron-finance-base-sepolia

# Deploy
goldsky subgraph deploy piron-finance-base-sepolia/v1.0.0 --from-abi subgraph.yaml
```

- [ ] Deployment successful
- [ ] Subgraph syncing started

### Step 4: Configure Webhook

**In Goldsky Dashboard:**

1. Go to your subgraph
2. Click "Webhooks" tab
3. Add webhook:
   - **Name**: Piron Backend
   - **URL**: `https://your-domain.com/api/v1/webhooks/goldsky/event` (or use ngrok for testing)
   - **Events**: Select all
   - **Secret**: Generate and save

- [ ] Webhook URL added
- [ ] Secret saved
- [ ] Webhook enabled

### Step 5: Update Backend Environment

Add to `.env`:
```bash
REDIS_HOST=localhost
REDIS_PORT=6379
GOLDSKY_WEBHOOK_SECRET=<paste_secret_from_goldsky>
GOLDSKY_GRAPHQL_ENDPOINT=<paste_endpoint_from_goldsky>
```

- [ ] Redis variables added
- [ ] GOLDSKY_WEBHOOK_SECRET added
- [ ] GOLDSKY_GRAPHQL_ENDPOINT added

### Step 6: Restart Backend

```bash
npm run dev
```

Check logs for:
- [ ] `✅ Redis connected`
- [ ] `🎯 Goldsky webhook module loaded`
- [ ] `📡 Webhook endpoint: /api/v1/webhooks/goldsky/event`
- [ ] No errors on startup

## ✅ Testing

### Test 1: Health Check

```bash
curl -X POST http://localhost:3000/api/v1/webhooks/goldsky/health
```

- [ ] Returns `{"status":"ok","timestamp":...}`

### Test 2: Subgraph Status

```bash
goldsky subgraph status piron-finance-base-sepolia
```

- [ ] Status: Syncing or Synced
- [ ] No errors
- [ ] Current block is recent

### Test 3: GraphQL Query

```bash
curl -X POST <YOUR_GOLDSKY_ENDPOINT> \
  -H "Content-Type: application/json" \
  -d '{"query":"{ pools(first:5) { id name totalValueLocked } }"}'
```

- [ ] Returns data
- [ ] Pools list not empty
- [ ] Data matches expectations

### Test 4: Redis Queues

```bash
redis-cli
> KEYS bull:*
> LLEN bull:immediate-events:waiting
> LLEN bull:delayed-events:waiting
```

- [ ] Bull queues exist
- [ ] Can query queue lengths

### Test 5: Mock Webhook Event

```bash
curl -X POST http://localhost:3000/api/v1/webhooks/goldsky/event \
  -H "Content-Type: application/json" \
  -d '{
    "event": "Deposit",
    "data": {
      "transaction": {"txHash": "0xtest", "timestamp": 1234567890, "blockNumber": 12345},
      "user": {"walletAddress": "0x1234567890abcdef1234567890abcdef12345678"},
      "pool": {"poolAddress": "0x4A7E6245CA1AaE0E0f159A8aF23b336542a30aF0"},
      "amount": "1000000",
      "shares": "1000000"
    }
  }'
```

- [ ] Backend logs show event received
- [ ] Event queued in Redis
- [ ] Event processed (check DB)

### Test 6: Real Transaction

Make a real deposit on testnet:

- [ ] Transaction confirmed on-chain
- [ ] Webhook received within 10 seconds
- [ ] Transaction in database
- [ ] Pool analytics updated
- [ ] User position updated

### Test 7: Data Consistency

Compare subgraph vs database:

```graphql
# Query subgraph
{ pool(id: "0xYourPool") { totalValueLocked totalShares } }
```

```sql
-- Query database
SELECT "totalValueLocked", "totalShares" FROM "PoolAnalytics" WHERE "poolId" = '...';
```

- [ ] TVL matches
- [ ] Shares match
- [ ] Investor count matches

## ✅ Monitoring Setup

### Goldsky Dashboard

- [ ] Bookmark subgraph dashboard URL
- [ ] Enable email alerts for errors
- [ ] Review webhook delivery logs

### Backend Monitoring

Add to your monitoring:

```bash
# Queue depth alert (alert if > 100)
redis-cli LLEN bull:immediate-events:waiting

# Failed jobs alert (alert if > 10)
redis-cli LLEN bull:immediate-events:failed

# Webhook health check (every minute)
curl -f http://localhost:3000/api/v1/webhooks/goldsky/health
```

- [ ] Queue depth monitoring added
- [ ] Failed jobs monitoring added
- [ ] Health check monitoring added
- [ ] Alerts configured

## ✅ Production Readiness

### Performance

- [ ] Subgraph fully synced (all historical data)
- [ ] Webhooks arriving < 5 seconds
- [ ] Events processing < 2 seconds
- [ ] No queue backlog
- [ ] Database writes < 1 second

### Reliability

- [ ] Tested webhook signature verification
- [ ] Tested retry logic (force failures)
- [ ] Tested fallback to existing indexers
- [ ] Redis persistence configured (AOF enabled)
- [ ] Documented rollback procedure

### Security

- [ ] GOLDSKY_WEBHOOK_SECRET set
- [ ] Webhook signature verification enabled
- [ ] Webhook endpoint rate-limited
- [ ] Redis password set (production)
- [ ] Environment variables secured

### Documentation

- [ ] Team trained on Goldsky dashboard
- [ ] Runbook created for common issues
- [ ] Contact info for Goldsky support
- [ ] Rollback procedure documented
- [ ] Monitoring alerts documented

## ✅ Deprecation of Old Indexers

**Only after 1-2 weeks of stable operation:**

- [ ] Goldsky running stable for 1+ weeks
- [ ] No data discrepancies found
- [ ] Team comfortable with new system
- [ ] Rollback plan tested

**Then:**

- [ ] Stop `DepositIndexer` service
- [ ] Stop `PoolCreationWatcher` service  
- [ ] Remove indexer code (keep in git history)
- [ ] Update documentation
- [ ] Celebrate! 🎉

## 🚨 Rollback Plan

If Goldsky has issues:

1. [ ] Pause webhooks in Goldsky dashboard
2. [ ] Re-enable existing indexers
3. [ ] Verify indexers catching up
4. [ ] Debug Goldsky issue
5. [ ] Document what went wrong

## 📊 Success Metrics

After 1 week, verify:

- [ ] 99.9%+ webhook delivery rate
- [ ] < 5 second average latency
- [ ] 0 data inconsistencies
- [ ] < 1% failed jobs
- [ ] 0 manual interventions needed

## 📞 Support Contacts

- **Goldsky Support**: support@goldsky.com
- **Goldsky Discord**: https://discord.gg/goldsky
- **Goldsky Docs**: https://docs.goldsky.com
- **Internal**: [Your team contact]

---

**Deployed by**: _____________  
**Date**: _____________  
**Version**: v1.0.0  
**Status**: ⬜ Not Started | ⬜ In Progress | ⬜ Complete

