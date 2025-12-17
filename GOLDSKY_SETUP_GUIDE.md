# Goldsky Subgraph Setup Guide

Complete guide to deploying and testing your Piron Finance Goldsky subgraph.

## 📋 Prerequisites Checklist

- [ ] Goldsky account created (https://goldsky.com)
- [ ] Goldsky API key obtained
- [ ] Redis installed/accessible
- [ ] Base Sepolia Alchemy RPC URL
- [ ] Contract deployment block numbers

## 🚀 Quick Start

### 1. Install Subgraph Dependencies

```bash
cd subgraph
npm install
```

### 2. Run Setup Script

```bash
./setup.sh
```

This will:
- Install dependencies
- Link ABIs
- Prompt for start blocks
- Generate code
- Build subgraph

### 3. Deploy to Goldsky

```bash
# Login to Goldsky
goldsky login

# Create subgraph (first time only)
goldsky subgraph create piron-finance-base-sepolia

# Deploy
goldsky subgraph deploy piron-finance-base-sepolia/v1.0.0 \
  --from-abi subgraph.yaml
```

### 4. Configure Webhook

1. Get your subgraph endpoint:
   ```bash
   goldsky subgraph show piron-finance-base-sepolia
   ```

2. In Goldsky dashboard:
   - Navigate to your subgraph
   - Go to "Webhooks" tab
   - Add new webhook:
     - **URL**: `https://your-domain.com/api/v1/webhooks/goldsky/event`
     - **Events**: Select all
     - **Secret**: Generate and copy

3. Add secret to backend `.env`:
   ```bash
   GOLDSKY_WEBHOOK_SECRET=your_secret_here
   GOLDSKY_GRAPHQL_ENDPOINT=your_graphql_endpoint_here
   ```

### 5. Setup Redis

**Option A: Docker (Recommended for dev)**
```bash
docker run -d -p 6379:6379 --name redis redis:alpine
```

**Option B: Local Install**
```bash
# macOS
brew install redis
brew services start redis

# Ubuntu
sudo apt-get install redis-server
sudo systemctl start redis
```

**Verify Redis:**
```bash
redis-cli ping
# Should return: PONG
```

### 6. Install Backend Dependencies

```bash
cd ..
npm install
```

### 7. Restart Backend

```bash
npm run dev
```

Check logs for:
```
🔍 Pool creation watcher started for chain 84532
💰 Deposit indexer started
🎯 Goldsky webhook module loaded
📡 Webhook endpoint: /api/v1/webhooks/goldsky/event
```

## 🧪 Testing

### Test 1: Webhook Health Check

```bash
curl -X POST http://localhost:3000/api/v1/webhooks/goldsky/health
```

**Expected:**
```json
{"status":"ok","timestamp":1234567890}
```

### Test 2: GraphQL Query

Query your deployed subgraph:

```bash
curl -X POST https://api.goldsky.com/.../your-endpoint/gn \
  -H "Content-Type: application/json" \
  -d '{
    "query": "{ pools(first: 5) { id name poolAddress totalValueLocked } }"
  }'
```

### Test 3: Mock Deposit Event

Test webhook processing:

```bash
curl -X POST http://localhost:3000/api/v1/webhooks/goldsky/event \
  -H "Content-Type: application/json" \
  -d '{
    "event": "Deposit",
    "data": {
      "transaction": {
        "txHash": "0x123test",
        "timestamp": 1234567890,
        "blockNumber": 12345
      },
      "user": {
        "walletAddress": "0x1234567890abcdef1234567890abcdef12345678"
      },
      "pool": {
        "poolAddress": "0x4A7E6245CA1AaE0E0f159A8aF23b336542a30aF0"
      },
      "amount": "1000000",
      "shares": "1000000"
    }
  }'
```

**Check:**
1. Backend logs show event queued
2. Redis has job: `redis-cli LLEN bull:immediate-events:waiting`
3. Database updated with transaction

### Test 4: Queue Monitoring

```bash
# Check queue status
redis-cli

> KEYS bull:*
> LLEN bull:immediate-events:waiting
> LLEN bull:immediate-events:active
> LLEN bull:immediate-events:failed
> LLEN bull:delayed-events:waiting
```

## 🔍 Verification Steps

### Step 1: Verify Subgraph Syncing

```bash
goldsky subgraph status piron-finance-base-sepolia
```

Look for:
- **Status**: Syncing or Synced
- **Current Block**: Should be recent
- **Health**: OK

### Step 2: Verify Webhooks Working

1. Make a real deposit transaction on testnet
2. Wait 30 seconds
3. Check backend logs for webhook received
4. Check database for new transaction record
5. Verify Redis queue processed

### Step 3: Verify Data Accuracy

Query subgraph and compare with database:

**Subgraph Query:**
```graphql
query {
  pool(id: "0xYourPoolAddress") {
    totalValueLocked
    totalShares
    uniqueInvestors
  }
}
```

**Database Query:**
```sql
SELECT "totalValueLocked", "totalShares", "uniqueInvestors" 
FROM "PoolAnalytics" 
WHERE "poolId" = 'your-pool-id';
```

Values should match!

## 📊 Monitoring

### Goldsky Dashboard

Monitor in real-time:
- Indexing progress
- Query performance
- Error rates
- Webhook delivery

### Backend Monitoring

Add to your monitoring:

**Queue Depth:**
```bash
# Alert if queue backs up
redis-cli LLEN bull:immediate-events:waiting
```

**Failed Jobs:**
```bash
# Alert on failures
redis-cli LLEN bull:immediate-events:failed
```

**Webhook Endpoint:**
```bash
# Health check every minute
curl -f http://localhost:3000/api/v1/webhooks/goldsky/health
```

## 🐛 Troubleshooting

### Issue: Subgraph won't deploy

**Check:**
1. ABIs are accessible: `ls -la abis/`
2. Networks.json has valid block numbers
3. Ran `npm run codegen` successfully
4. No TypeScript errors: `npm run build`

**Fix:**
```bash
cd subgraph
rm -rf build generated
npm run codegen
npm run build
```

### Issue: Webhooks not arriving

**Check:**
1. Webhook URL is public (use ngrok for local testing)
2. Signature verification not blocking
3. Goldsky dashboard shows webhook configured
4. Check Goldsky webhook logs

**Debug:**
```bash
# Disable signature check temporarily
# In webhook controller, comment out signature verification
# Check if events arrive
```

### Issue: Events queued but not processed

**Check:**
1. Redis is running: `redis-cli ping`
2. Bull processors are registered
3. No errors in backend logs
4. Queue isn't paused

**Fix:**
```bash
# Clear stuck jobs
redis-cli FLUSHDB

# Restart backend
npm run dev
```

### Issue: Database not updating

**Check:**
1. Pool exists in database before deposit
2. User wallet address format (lowercase)
3. Transaction not duplicate (txHash unique)
4. Prisma connection working

**Debug:**
```typescript
// Add more logging in event-processor.service.ts
this.logger.log(`Processing ${eventName} for pool ${pool.poolAddress}`);
```

## 🔄 Rollback Plan

If Goldsky has issues, fallback to existing indexers:

1. **Keep existing indexers running** (don't remove yet)
2. **Monitor both systems** for 1-2 weeks
3. **Compare data accuracy** daily
4. **Document any discrepancies**

**Disable Goldsky webhooks:**
```bash
# In Goldsky dashboard, pause webhooks
# Existing indexers will continue working
```

**Re-enable polling indexers:**
```bash
# Ensure DepositIndexer and PoolCreationWatcher are active
# Check logs for "indexer started"
```

## 📈 Performance Expectations

**Subgraph Sync:**
- Initial sync: ~10-30 minutes (depending on history)
- Real-time: 2-5 seconds behind chain

**Webhook Delivery:**
- Immediate events: < 3 seconds
- Delayed events: 2 minutes + processing time

**Database Writes:**
- Deposits/Withdrawals: < 1 second
- Analytics: < 5 seconds

## 🎯 Success Criteria

Goldsky is working correctly when:

- [ ] Subgraph fully synced (status = "Synced")
- [ ] Webhooks arriving within 5 seconds of on-chain events
- [ ] All events being processed (no failed jobs)
- [ ] Database matches subgraph data
- [ ] Queue depth stays below 100
- [ ] No errors in last 24 hours
- [ ] Existing indexers can be safely deprecated

## 📞 Support

**Goldsky:**
- Docs: https://docs.goldsky.com
- Discord: https://discord.gg/goldsky
- Support: support@goldsky.com

**The Graph:**
- Docs: https://thegraph.com/docs
- Discord: https://discord.gg/thegraph

**Issues:**
- Check `GOLDSKY_SETUP_GUIDE.md`
- Review backend logs
- Check Redis queue status
- Consult Goldsky dashboard

