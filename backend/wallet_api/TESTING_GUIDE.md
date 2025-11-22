# Wallet API Testing Guide

Complete guide for testing the Wallet API locally and in production.

## Prerequisites

1. **Environment Variables Set**:
   ```bash
   # Check they're set
   echo $CDP_API_KEY_ID
   echo $CDP_API_KEY_SECRET
   echo $CDP_WALLET_SECRET
   echo $SUPABASE_URL
   echo $SUPABASE_SERVICE_ROLE_KEY
   ```

2. **Database Migration Complete**:
   - Run `backend/db/create_agent_wallets.sql` in Supabase SQL Editor

3. **Dependencies Installed**:
   ```bash
   pip install -r requirements.txt
   ```

## Local Testing

### 1. Start the Server

```bash
# From backend/wallet_api directory
python main.py

# Or from backend/ directory
uvicorn wallet_api.main:app --reload --port 8000
```

Expected output:
```
Starting Wallet API server...
Environment variables:
  CDP_API_KEY_ID: organizations/xxxxx...
  CDP_WALLET_SECRET: xxxxxxxxxxxxxxxx...
  SUPABASE_URL: https://xxxxx.supabase.co
INFO:     Uvicorn running on http://0.0.0.0:8000
✓ CDP Client initialized successfully
  API Key ID: organizations/xxxxx...
```

### 2. Test Health Endpoint

```bash
curl http://localhost:8000/health
```

**Expected Response:**
```json
{
  "status": "healthy",
  "cdp_client_initialized": true,
  "service": "wallet-api",
  "version": "0.1.0"
}
```

### 3. Create a Wallet

```bash
curl -X POST http://localhost:8000/wallets \
  -H "Content-Type: application/json" \
  -d '{
    "room_id": "test-room-001"
  }'
```

**Expected Response (201 Created):**
```json
{
  "room_id": "test-room-001",
  "account_name": "room-test-room-001",
  "address": "0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb",
  "network": "base-sepolia"
}
```

**What Happens:**
1. API checks if wallet exists in database
2. Creates CDP account: `room-test-room-001`
3. CDP returns blockchain address
4. API saves metadata to database
5. Returns wallet information

### 4. Get Wallet Balance

```bash
curl http://localhost:8000/wallets/test-room-001/balance
```

**Expected Response (200 OK):**
```json
{
  "address": "0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb",
  "account_name": "room-test-room-001",
  "room_id": "test-room-001"
}
```

**What Happens:**
1. API retrieves wallet from database
2. Retrieves CDP account (verifies it still exists)
3. Returns address and metadata

### 5. Test Error Cases

#### Duplicate Wallet (409 Conflict)

```bash
# Try creating same wallet again
curl -X POST http://localhost:8000/wallets \
  -H "Content-Type: application/json" \
  -d '{
    "room_id": "test-room-001"
  }'
```

**Expected Response (409 Conflict):**
```json
{
  "detail": "Wallet already exists for room_id: test-room-001"
}
```

#### Wallet Not Found (404 Not Found)

```bash
curl http://localhost:8000/wallets/nonexistent-room/balance
```

**Expected Response (404 Not Found):**
```json
{
  "detail": "Wallet not found for room_id: nonexistent-room"
}
```

#### Invalid Input (422 Unprocessable Entity)

```bash
# Empty room_id
curl -X POST http://localhost:8000/wallets \
  -H "Content-Type: application/json" \
  -d '{
    "room_id": "   "
  }'
```

**Expected Response (422):**
```json
{
  "detail": [
    {
      "type": "value_error",
      "loc": ["body", "room_id"],
      "msg": "room_id cannot be empty or only whitespace"
    }
  ]
}
```

## Testing with Multiple Wallets

Create several wallets to test isolation:

```bash
# Create wallet 1
curl -X POST http://localhost:8000/wallets \
  -H "Content-Type: application/json" \
  -d '{"room_id": "room-alpha"}'

# Create wallet 2
curl -X POST http://localhost:8000/wallets \
  -H "Content-Type: application/json" \
  -d '{"room_id": "room-beta"}'

# Create wallet 3
curl -X POST http://localhost:8000/wallets \
  -H "Content-Type: application/json" \
  -d '{"room_id": "room-gamma"}'

# Verify each has unique address
curl http://localhost:8000/wallets/room-alpha/balance
curl http://localhost:8000/wallets/room-beta/balance
curl http://localhost:8000/wallets/room-gamma/balance
```

**Verify:**
- Each wallet has a different `address`
- Each wallet has the correct `account_name` (e.g., "room-room-alpha")
- All wallets have `network: "base-sepolia"`

## Testing with UUIDs

Test with proper UUID format (matching platform_rooms):

```bash
# Create wallet with UUID
curl -X POST http://localhost:8000/wallets \
  -H "Content-Type: application/json" \
  -d '{
    "room_id": "550e8400-e29b-41d4-a716-446655440000"
  }'

# Get balance
curl http://localhost:8000/wallets/550e8400-e29b-41d4-a716-446655440000/balance
```

**Verify:**
- `account_name` is "room-550e8400-e29b-41d4-a716-446655440000"
- Address is valid EVM address (0x...)

## Database Verification

Check Supabase to verify records:

```sql
-- View all wallets
SELECT
    room_id,
    account_name,
    address,
    network,
    created_at
FROM agent_wallets
ORDER BY created_at DESC;

-- Count wallets
SELECT COUNT(*) FROM agent_wallets;

-- Check specific wallet
SELECT * FROM agent_wallets
WHERE room_id = 'test-room-001';

-- Verify unique constraints
SELECT
    account_name,
    COUNT(*) as count
FROM agent_wallets
GROUP BY account_name
HAVING COUNT(*) > 1;
-- Should return 0 rows (all account_names unique)
```

## Interactive API Documentation

Open in browser:

- **Swagger UI**: http://localhost:8000/docs
- **ReDoc**: http://localhost:8000/redoc

**Features:**
- Try out endpoints interactively
- See request/response schemas
- View error responses
- Test validation rules

## Testing with Python

Use `requests` library for programmatic testing:

```python
import requests

BASE_URL = "http://localhost:8000"

# Test health
response = requests.get(f"{BASE_URL}/health")
print(f"Health: {response.json()}")

# Create wallet
response = requests.post(
    f"{BASE_URL}/wallets",
    json={"room_id": "python-test-room"}
)
print(f"Create wallet: {response.status_code}")
print(response.json())

# Get balance
response = requests.get(f"{BASE_URL}/wallets/python-test-room/balance")
print(f"Balance: {response.json()}")
```

## Load Testing

Test API performance with multiple concurrent requests:

```bash
# Install Apache Bench
# macOS: brew install httpd
# Linux: apt-get install apache2-utils

# Test health endpoint (100 requests, 10 concurrent)
ab -n 100 -c 10 http://localhost:8000/health

# Test wallet creation (careful: creates real wallets!)
# Create payload file first
echo '{"room_id": "load-test-1"}' > /tmp/wallet.json

ab -n 10 -c 2 -p /tmp/wallet.json \
   -T application/json \
   http://localhost:8000/wallets
```

## Troubleshooting

### Server Won't Start

**Check 1: Environment variables**
```bash
python -c "import os; print('CDP_API_KEY_ID:', os.getenv('CDP_API_KEY_ID', 'NOT SET')[:20])"
```

**Check 2: CDP SDK installed**
```bash
python -c "from cdp import CdpClient; print('CDP SDK OK')"
```

**Check 3: Supabase connection**
```bash
python -c "from config import create_supabase_client; create_supabase_client(); print('Supabase OK')"
```

### "CDP Client not initialized"

**Symptom:** All endpoints return 503

**Cause:** CDP credentials invalid or missing

**Fix:**
1. Check .env file has correct credentials
2. Verify credentials in CDP Portal
3. Restart server

### "Failed to create CDP account"

**Symptom:** 500 error when creating wallet

**Possible Causes:**
- Invalid CDP credentials
- Network connectivity issue
- CDP service outage

**Debug:**
```bash
# Check logs (server console)
# Look for detailed error message

# Test CDP credentials directly
python test_cdp_wallet.py
```

### "Failed to save wallet to database"

**Symptom:** Wallet created on CDP but API returns 500

**Possible Causes:**
- Database table doesn't exist
- Supabase credentials invalid
- Unique constraint violation

**Fix:**
```bash
# Check table exists
psql $DATABASE_URL -c "SELECT * FROM agent_wallets LIMIT 1;"

# Or check in Supabase SQL Editor:
SELECT * FROM agent_wallets LIMIT 1;
```

### "Address mismatch" Warning

**Symptom:** Warning in logs: "Address mismatch for room X"

**Cause:** Database address doesn't match CDP account address

**Investigation:**
```sql
-- Check database address
SELECT room_id, address FROM agent_wallets WHERE room_id = 'X';
```

Then compare with CDP account (curl balance endpoint).

This could indicate:
- Database corruption
- Account was recreated on CDP
- Bug in code

## Next Steps

After local testing succeeds:

1. **Commit Code**: Git commit the wallet_api implementation
2. **Run Database Migration**: Execute in production Supabase
3. **Deploy to Modal**: (Instructions coming in future updates)
4. **Integration Testing**: Test with ElizaOS agents

## Test Checklist

Use this checklist to verify everything works:

- [ ] Server starts without errors
- [ ] Health endpoint returns 200
- [ ] Can create wallet
- [ ] Can get wallet balance
- [ ] Duplicate wallet returns 409
- [ ] Nonexistent wallet returns 404
- [ ] Invalid input returns 422
- [ ] Multiple wallets have unique addresses
- [ ] Database records match API responses
- [ ] Account names follow pattern: "room-{room_id}"
- [ ] Network is "base-sepolia"
- [ ] Interactive docs work (/docs)

## Success Criteria

The Wallet API is ready for integration when:

1. All checklist items pass
2. No errors in server logs
3. Database records are correct
4. CDP accounts are accessible
5. API responses match documentation

## Related Files

- `/Users/hellno/dev/misc/agentica/backend/wallet_api/main.py` - API implementation
- `/Users/hellno/dev/misc/agentica/backend/wallet_api/README.md` - Setup guide
- `/Users/hellno/dev/misc/agentica/backend/test_cdp_wallet.py` - CDP validation test
- `/Users/hellno/dev/misc/agentica/backend/db/create_agent_wallets.sql` - Database migration
