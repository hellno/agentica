# Day 4 Testing Guide

## Pre-Deployment Setup

### 1. Update Modal Secrets

Add the WALLET_API_URL to your Modal secrets:

```bash
# Get your Wallet API URL first (if deployed)
# Format: https://*.modal.run

# Update Modal secrets
modal secret create agentica-secrets \
  OPENAI_API_KEY=sk-... \
  POSTGRES_URL="postgresql://..." \
  SUPABASE_URL=https://... \
  SUPABASE_SERVICE_ROLE_KEY=eyJ... \
  SUPABASE_ANON_KEY=eyJ... \
  WALLET_API_URL=https://*.modal.run
```

### 2. Run Database Schema

Execute the platform_rooms schema in Supabase SQL Editor:

```bash
# View the schema
cat backend/db/platform_rooms_schema.sql

# Copy contents and paste into Supabase SQL Editor, then execute
```

### 3. Deploy Platform API

```bash
# Deploy the updated platform API
modal deploy backend/modal_app.py

# Wait for deployment to complete
# Note the API URL: https://*.modal.run
```

## Testing Steps

### Test 1: Create Room with AI Strategy

```bash
# Replace YOUR_ORG with your actual Modal organization
export PLATFORM_API_URL="https://*.modal.run"

# Create a test room
curl -X POST "$PLATFORM_API_URL/rooms" \
  -H "Content-Type: application/json" \
  -d '{
    "user_id": "test-user-123",
    "name": "BTC DCA Strategy",
    "description": "Automated Bitcoin accumulation",
    "prompt": "Buy $100 worth of Bitcoin every week when the 7-day moving average is trending down",
    "frequency": "weekly"
  }' | jq '.'
```

**Expected Response**:
```json
{
  "success": true,
  "room": {
    "id": "550e8400-e29b-41d4-a716-446655440000",
    "eliza_room_id": "eliza-room-uuid",
    "name": "BTC DCA Strategy",
    "description": "Automated Bitcoin accumulation",
    "user_id": "test-user-123",
    "strategy_agent_id": "eliza-agent-uuid",
    "wallet_address": "0x1234...",
    "smart_account_address": "0x5678...",
    "user_prompt": "Buy $100 worth of Bitcoin every week...",
    "generated_strategy": "Strategy overview: This is a systematic...",
    "frequency": "weekly",
    "status": "active",
    "created_at": "2025-11-22T12:34:56Z"
  }
}
```

**Verify**:
- [ ] Response includes wallet addresses (wallet_address, smart_account_address)
- [ ] generated_strategy is a structured trading strategy (not just prompt echo)
- [ ] strategy_agent_id is present
- [ ] Room ID is a valid UUID

**Check Logs**:
```bash
# View platform API logs to see the 8-step process
modal app logs agentica-platform

# Look for these log messages:
# - "Generating AI strategy for room: BTC DCA Strategy"
# - "Generated strategy: ..."
# - "Creating wallet for room: ..."
# - "Wallet created - Owner: 0x..., Smart Account: 0x..."
# - "Creating strategy agent in ElizaOS"
# - "Strategy agent created: ..."
# - "Starting strategy agent: ..."
# - "Creating ElizaOS room"
# - "ElizaOS room created: ..."
# - "Storing room in database"
# - "Storing strategy agent in database"
```

### Test 2: Verify Database Records

Check Supabase to ensure data was stored correctly:

```sql
-- In Supabase SQL Editor

-- Check platform_rooms table
SELECT
  id,
  name,
  user_id,
  wallet_address,
  smart_account_address,
  LEFT(generated_strategy, 100) as strategy_preview,
  frequency,
  status
FROM platform_rooms
ORDER BY created_at DESC
LIMIT 5;

-- Check strategy agent in platform_agents table
SELECT
  id,
  name,
  eliza_agent_id,
  LEFT(description, 100) as description_preview,
  status
FROM platform_agents
WHERE name LIKE '%Strategy%'
ORDER BY created_at DESC
LIMIT 5;
```

**Verify**:
- [ ] Room exists in platform_rooms with correct data
- [ ] Wallet addresses are populated
- [ ] Generated strategy is stored
- [ ] Strategy agent exists in platform_agents
- [ ] Agent description contains AI-generated strategy

### Test 3: Query Transaction History

```bash
# Save room_id from Test 1 response
export ROOM_ID="550e8400-e29b-41d4-a716-446655440000"

# Query transaction history (should be empty initially)
curl "$PLATFORM_API_URL/rooms/$ROOM_ID/transactions?limit=10" | jq '.'
```

**Expected Response** (no transactions yet):
```json
{
  "room_id": "550e8400-e29b-41d4-a716-446655440000",
  "transactions": [],
  "total": 0,
  "limit": 10,
  "offset": 0
}
```

**Verify**:
- [ ] Endpoint returns successfully (200 OK)
- [ ] Response has correct room_id
- [ ] transactions array is empty (no trades yet)

### Test 4: Create Wallet Transaction (via Wallet API)

Test that transactions appear in history:

```bash
export WALLET_API_URL="https://*.modal.run"

# Execute a balance check (creates transaction log)
curl -X POST "$WALLET_API_URL/wallets/$ROOM_ID/balance" \
  -H "Content-Type: application/json" \
  -d '{"params": {}}' | jq '.'

# Now query transactions again
curl "$PLATFORM_API_URL/rooms/$ROOM_ID/transactions?limit=10" | jq '.'
```

**Expected Response** (with transaction):
```json
{
  "room_id": "550e8400-e29b-41d4-a716-446655440000",
  "transactions": [
    {
      "id": "tx-uuid",
      "room_id": "550e8400-e29b-41d4-a716-446655440000",
      "action": "balance",
      "params": {},
      "status": "success",
      "result": {
        "wallet_address": "0x1234...",
        "smart_account_address": "0x5678...",
        "network": "base-sepolia"
      },
      "created_at": "2025-11-22T...",
      "updated_at": "2025-11-22T..."
    }
  ],
  "total": 1,
  "limit": 10,
  "offset": 0
}
```

**Verify**:
- [ ] Transaction appears in history
- [ ] Action type is correct (balance)
- [ ] Status is success
- [ ] Result contains wallet info

### Test 5: Different Trading Strategies

Test various prompts to verify OpenAI strategy generation:

```bash
# Momentum strategy
curl -X POST "$PLATFORM_API_URL/rooms" \
  -H "Content-Type: application/json" \
  -d '{
    "user_id": "test-user-123",
    "name": "ETH Momentum",
    "prompt": "Buy Ethereum when RSI crosses above 50 and MACD is positive",
    "frequency": "daily"
  }' | jq '.room.generated_strategy'

# Range trading strategy
curl -X POST "$PLATFORM_API_URL/rooms" \
  -H "Content-Type: application/json" \
  -d '{
    "user_id": "test-user-123",
    "name": "SOL Range Trading",
    "prompt": "Buy Solana at support levels around $100, sell at resistance around $120",
    "frequency": "hourly"
  }' | jq '.room.generated_strategy'

# DeFi yield strategy
curl -X POST "$PLATFORM_API_URL/rooms" \
  -H "Content-Type: application/json" \
  -d '{
    "user_id": "test-user-123",
    "name": "USDC Yield",
    "prompt": "Automatically move USDC to the highest yielding lending protocol among Aave, Compound, and Maker",
    "frequency": "daily"
  }' | jq '.room.generated_strategy'
```

**Verify**:
- [ ] Each strategy is unique and relevant to the prompt
- [ ] Strategies include risk management (stop loss, position sizing)
- [ ] Entry and exit conditions are clear
- [ ] Guardrails are mentioned (5% max risk, liquidity requirements)

### Test 6: Error Handling

Test error cases to ensure proper handling:

```bash
# Test 6a: Invalid room_id for transactions
curl "$PLATFORM_API_URL/rooms/invalid-uuid/transactions" | jq '.'
# Expected: 404 error "Room not found"

# Test 6b: Missing required fields
curl -X POST "$PLATFORM_API_URL/rooms" \
  -H "Content-Type: application/json" \
  -d '{
    "user_id": "test-user-123",
    "name": "Test"
  }' | jq '.'
# Expected: 422 validation error (missing prompt and frequency)

# Test 6c: Prompt too short
curl -X POST "$PLATFORM_API_URL/rooms" \
  -H "Content-Type: application/json" \
  -d '{
    "user_id": "test-user-123",
    "name": "Test",
    "prompt": "Buy BTC",
    "frequency": "daily"
  }' | jq '.'
# Expected: 422 validation error (prompt min_length=10)
```

**Verify**:
- [ ] Invalid room_id returns 404 with clear message
- [ ] Missing fields return 422 with validation details
- [ ] Short prompt returns 422 with min_length error

## Troubleshooting

### Issue: "WALLET_API_URL environment variable not set"

**Solution**:
```bash
# Update Modal secrets with WALLET_API_URL
modal secret create agentica-secrets \
  WALLET_API_URL=https://*.modal.run

# Redeploy
modal deploy backend/modal_app.py
```

### Issue: "Failed to generate AI strategy"

**Cause**: OpenAI API key not set or invalid

**Solution**:
```bash
# Check logs for OpenAI error
modal app logs agentica-platform

# Verify OPENAI_API_KEY in secrets
modal secret list
```

### Issue: "Failed to create wallet"

**Cause**: Wallet API not deployed or URL incorrect

**Solution**:
```bash
# Check Wallet API status
curl https://*.modal.run/health

# Verify WALLET_API_URL matches deployed URL
modal secret list
```

### Issue: "Supabase insert returned no data"

**Cause**: Database schema not created or missing columns

**Solution**:
```sql
-- In Supabase SQL Editor, verify table exists
SELECT * FROM platform_rooms LIMIT 1;

-- If table missing, run schema:
-- backend/db/platform_rooms_schema.sql
```

## Success Criteria

All tests pass when:

- ✅ Room creation completes successfully with all 8 steps
- ✅ Wallet addresses are returned (both owner and smart account)
- ✅ AI-generated strategy is unique and relevant to prompt
- ✅ Strategy agent is created and stored in database
- ✅ Transaction history endpoint returns data
- ✅ Error cases return appropriate HTTP status codes
- ✅ Database records are created correctly

## Next Steps After Testing

Once all tests pass:

1. Test with real wallet funding (send testnet ETH to smart_account_address)
2. Execute actual trades via wallet actions
3. Verify transactions appear in history
4. Monitor strategy agent behavior in ElizaOS
5. Add periodic strategy execution (cron)
6. Connect frontend to display rooms and strategies

## Reference

- Platform API: `https://*.modal.run`
- Wallet API: `https://*.modal.run`
- API Docs: `https://*.modal.run/docs`
- Database: Supabase SQL Editor

## Log Monitoring

```bash
# Watch logs in real-time
modal app logs agentica-platform --follow

# Filter for room creation
modal app logs agentica-platform | grep "Creating"

# Filter for errors
modal app logs agentica-platform | grep -i "error\|failed"
```
