# Wallet API - CDP Smart Accounts with Gas Sponsorship

FastAPI service for managing CDP Smart Accounts (ERC-4337) for AI agents. This API provides wallet creation, balance checking, and gas-sponsored transactions for the Agentica platform.

## Overview

This API integrates with CDP Server Wallet v2 Smart Accounts to provide secure, server-side wallet management with FREE gas on Base Sepolia:

- **Smart Accounts (ERC-4337)**: Account abstraction with gas sponsorship
- **Server Wallet v2**: Private keys stored on CDP servers (not in our database)
- **Database Storage**: Only metadata (room_id, owner info, smart account address)
- **Gas Sponsorship**: FREE gas on Base Sepolia testnet - users only need trading tokens
- **Account Naming**: Pattern `"room-{room_id}-owner"` for owner EOA
- **Idempotent Operations**: `get_or_create_account()` safe to call multiple times

## Smart Accounts (ERC-4337)

This API uses CDP Smart Accounts with gas sponsorship:

### Architecture
```
┌─────────────────────────────────────────────┐
│             Wallet Per Room                  │
├─────────────────────────────────────────────┤
│                                              │
│  Owner Account (EOA)                         │
│  ├─ Name: "room-{room_id}-owner"            │
│  ├─ Type: Externally Owned Account           │
│  └─ Purpose: Controls smart account          │
│                                              │
│  Smart Account (ERC-4337)                    │
│  ├─ Type: Smart Account                      │
│  ├─ Owner: Owner Account above               │
│  ├─ Purpose: Trading wallet (gas-sponsored)  │
│  └─ Gas: FREE on Base Sepolia! ⛽            │
│                                              │
└─────────────────────────────────────────────┘
         │
         ├─────────────► CDP Server Wallet v2
         │               (stores private keys)
         │
         └─────────────► Supabase Database
                         (stores metadata only)
```

### Benefits
- FREE gas on Base Sepolia testnet
- Users don't need ETH, only trading tokens (USDC, etc.)
- Perfect for autonomous trading
- Web2-like UX - no gas management needed

### Key Design Decisions

1. **Smart Accounts**: Each room gets an ERC-4337 smart account with gas sponsorship
2. **Owner Account**: EOA controls the smart account (pattern: `room-{room_id}-owner`)
3. **Server Wallet v2**: CDP manages keys, we only store account names
4. **Idempotent Account Creation**: Safe to retry operations
5. **No Private Keys**: Database never stores sensitive key material

## Setup

### Prerequisites

- Python 3.11+
- CDP Server Wallet v2 credentials (API key + wallet secret)
- Supabase project with `agent_wallets` table

### Environment Variables

Create a `.env` file in the `backend/` directory:

```bash
# CDP Server Wallet v2 Credentials
CDP_API_KEY_ID=your_api_key_id_here
CDP_API_KEY_SECRET=your_api_key_secret_here
CDP_WALLET_SECRET=your_wallet_secret_here

# Supabase Credentials
SUPABASE_URL=https://xxxxx.supabase.co
SUPABASE_SERVICE_ROLE_KEY=eyJhbG...
```

**How to Get CDP Credentials:**

1. Go to [CDP Portal](https://portal.cdp.coinbase.com/)
2. Navigate to "Server Wallets" section
3. Create new API key
4. Save the credentials (you won't see them again!)

### Install Dependencies

```bash
# From backend/ directory
pip install -r requirements.txt

# Or install specific packages
pip install fastapi uvicorn cdp-sdk>=0.11.0 supabase python-dotenv
```

### Database Migration

**IMPORTANT**: You must run the smart accounts migration before using this API.

#### For New Installations
Run this SQL in your Supabase SQL Editor (from `backend/db/schema.sql`):

```sql
-- Create agent_wallets table
CREATE TABLE agent_wallets (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  room_id UUID REFERENCES platform_rooms(id) UNIQUE,
  owner_account_name TEXT NOT NULL,
  address TEXT NOT NULL,
  smart_account_address TEXT NOT NULL UNIQUE,
  account_name TEXT NOT NULL UNIQUE,  -- For backwards compatibility
  network TEXT NOT NULL DEFAULT 'base-sepolia',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create indexes for performance
CREATE INDEX idx_agent_wallets_room_id ON agent_wallets(room_id);
CREATE INDEX idx_agent_wallets_account_name ON agent_wallets(account_name);
CREATE INDEX idx_agent_wallets_address ON agent_wallets(address);
CREATE INDEX idx_smart_account_address ON agent_wallets(smart_account_address);
CREATE INDEX idx_owner_account_name ON agent_wallets(owner_account_name);

-- Add comments
COMMENT ON TABLE agent_wallets IS 'CDP Smart Accounts metadata for rooms';
COMMENT ON COLUMN agent_wallets.owner_account_name IS 'CDP account name for owner (EOA) - pattern: room-{id}-owner';
COMMENT ON COLUMN agent_wallets.address IS 'Owner EOA blockchain address (controls smart account)';
COMMENT ON COLUMN agent_wallets.smart_account_address IS 'Smart account (ERC-4337) address - the actual trading wallet with gas sponsorship';
```

#### For Existing Installations
Run the migration script in `backend/db/add_smart_accounts.sql`:

```bash
# In Supabase SQL Editor, run:
# backend/db/add_smart_accounts.sql
```

This will add the `owner_account_name` and `smart_account_address` columns to your existing `agent_wallets` table.

**Note**: Existing wallets will need to be recreated as old accounts don't have smart account support.

## Local Testing

### Start the API Server

```bash
# From backend/ directory
cd wallet_api
python main.py

# Or use uvicorn directly
uvicorn wallet_api.main:app --reload --port 8000
```

The API will be available at:
- API: http://localhost:8000
- Interactive Docs: http://localhost:8000/docs
- ReDoc: http://localhost:8000/redoc

### Test with curl

#### 1. Health Check

```bash
curl http://localhost:8000/health
```

Expected response:
```json
{
  "status": "healthy",
  "cdp_client_initialized": true,
  "service": "wallet-api",
  "version": "0.1.0"
}
```

#### 2. Create Wallet (Smart Account)

```bash
curl -X POST http://localhost:8000/wallets \
  -H "Content-Type: application/json" \
  -d '{
    "room_id": "550e8400-e29b-41d4-a716-446655440000"
  }'
```

Expected response (201 Created):
```json
{
  "room_id": "550e8400-e29b-41d4-a716-446655440000",
  "owner_account_name": "room-550e8400-e29b-41d4-a716-446655440000-owner",
  "owner_address": "0x1234567890abcdef1234567890abcdef12345678",
  "smart_account_address": "0xabcdef0123456789abcdef0123456789abcdef01",
  "network": "base-sepolia"
}
```

**Important**: Fund the `smart_account_address` with USDC/tokens (NOT the owner address). The smart account is your trading wallet with gas sponsorship.

#### 3. Get Balance

```bash
curl http://localhost:8000/wallets/550e8400-e29b-41d4-a716-446655440000/balance
```

Expected response (200 OK):
```json
{
  "address": "0xabcdef0123456789abcdef0123456789abcdef01",
  "account_name": "room-550e8400-e29b-41d4-a716-446655440000-owner",
  "room_id": "550e8400-e29b-41d4-a716-446655440000"
}
```

**Note**: The `address` field returns the smart account address (trading wallet).

#### 4. Send Transfer (Gas-Sponsored!)

```bash
curl -X POST http://localhost:8000/wallets/550e8400-e29b-41d4-a716-446655440000/transfer \
  -H "Content-Type: application/json" \
  -d '{
    "to_address": "0x0000000000000000000000000000000000000000",
    "amount": "0.0001"
  }'
```

Expected response (200 OK):
```json
{
  "user_op_hash": "0xabcdef1234567890...",
  "transaction_hash": "0x1234567890abcdef...",
  "status": "complete",
  "block_explorer": "https://sepolia.basescan.org/tx/0x1234567890abcdef..."
}
```

**Gas**: Completely FREE on Base Sepolia! No ETH needed in smart account.

#### 5. Error Cases

**Duplicate wallet (409 Conflict):**
```bash
# Try creating same wallet again
curl -X POST http://localhost:8000/wallets \
  -H "Content-Type: application/json" \
  -d '{
    "room_id": "550e8400-e29b-41d4-a716-446655440000"
  }'
```

Response:
```json
{
  "detail": "Wallet already exists for room_id: 550e8400-e29b-41d4-a716-446655440000"
}
```

**Wallet not found (404 Not Found):**
```bash
curl http://localhost:8000/wallets/nonexistent-room-id/balance
```

Response:
```json
{
  "detail": "Wallet not found for room_id: nonexistent-room-id"
}
```

## API Reference

### Endpoints

#### `GET /health`

Health check endpoint.

**Response:**
```json
{
  "status": "healthy",
  "cdp_client_initialized": true,
  "service": "wallet-api",
  "version": "0.1.0"
}
```

---

#### `POST /wallets`

Create a new smart account wallet for a room.

**Request Body:**
```json
{
  "room_id": "string"
}
```

**Response (201 Created):**
```json
{
  "room_id": "string",
  "owner_account_name": "string",
  "owner_address": "string",
  "smart_account_address": "string",
  "network": "string"
}
```

**What Happens:**
1. Creates owner account (EOA) with name `room-{room_id}-owner`
2. Creates smart account (ERC-4337) controlled by owner
3. Returns both addresses - **fund the smart_account_address**

**Error Responses:**
- `400 Bad Request`: Invalid room_id
- `409 Conflict`: Wallet already exists
- `500 Internal Server Error`: CDP or database error

**Example:**
```bash
curl -X POST http://localhost:8000/wallets \
  -H "Content-Type: application/json" \
  -d '{"room_id": "test-room-123"}'
```

---

#### `GET /wallets/{room_id}/balance`

Get wallet balance information.

**Path Parameters:**
- `room_id` (string): Room identifier

**Response (200 OK):**
```json
{
  "address": "string",
  "account_name": "string",
  "room_id": "string"
}
```

**Note**: The `address` field returns the smart account address (trading wallet).

**Error Responses:**
- `404 Not Found`: Wallet not found
- `500 Internal Server Error`: CDP or database error

**Example:**
```bash
curl http://localhost:8000/wallets/test-room-123/balance
```

---

#### `POST /wallets/{room_id}/transfer`

Send gas-sponsored ETH transfer from smart account.

**Path Parameters:**
- `room_id` (string): Room identifier

**Request Body:**
```json
{
  "to_address": "0x1234567890123456789012345678901234567890",
  "amount": "0.001"
}
```

**Response (200 OK):**
```json
{
  "user_op_hash": "string",
  "transaction_hash": "string",
  "status": "string",
  "block_explorer": "string"
}
```

**Gas Sponsorship:**
- FREE on Base Sepolia testnet
- No ETH required in smart account
- Only need tokens for actual transfer amount

**Error Responses:**
- `404 Not Found`: Wallet not found
- `500 Internal Server Error`: CDP or database error

**Example:**
```bash
curl -X POST http://localhost:8000/wallets/test-room-123/transfer \
  -H "Content-Type: application/json" \
  -d '{
    "to_address": "0x0000000000000000000000000000000000000000",
    "amount": "0.0001"
  }'
```

---

## Smart Account Patterns

### Account Naming

The API uses a consistent naming pattern for CDP accounts:

```python
# Owner account (EOA) - controls smart account
owner_account_name = f"room-{room_id}-owner"

# Smart account (ERC-4337) - trading wallet
# Address generated by CDP when creating smart account
```

This pattern:
- Maps rooms to wallets 1:1
- Allows deterministic account lookup
- Supports room-based wallet isolation
- Clear separation: owner vs trading wallet

### Smart Account Creation

Creating a smart account involves two steps:

```python
# Step 1: Create owner account (EOA)
owner_account = await cdp.evm.get_or_create_account(name="room-123-owner")

# Step 2: Create smart account (ERC-4337)
smart_account = await cdp.evm.create_smart_account(owner=owner_account)
```

The smart account address is **deterministic** - calling `create_smart_account()` with the same owner returns the same smart account.

### Gas-Sponsored Transactions

Smart accounts use `send_user_operation()` instead of `send_transaction()`:

```python
from cdp.evm_call_types import EncodedCall
from web3 import Web3
from decimal import Decimal

# Send gas-sponsored transaction
user_operation = await cdp.evm.send_user_operation(
    smart_account=smart_account,
    network="base-sepolia",
    calls=[
        EncodedCall(
            to="0x...",
            data="0x",
            value=Web3.to_wei(Decimal("0.001"), "ether")
        )
    ]
)

# Wait for confirmation
confirmed = await cdp.evm.wait_for_user_operation(
    smart_account_address=smart_account.address,
    user_op_hash=user_operation.user_op_hash
)
```

**Key Differences from Regular Transactions:**
- Uses `send_user_operation()` not `send_transaction()`
- Gas is FREE on Base Sepolia (auto-sponsored)
- Returns `user_op_hash` not `transaction_hash`
- Must wait with `wait_for_user_operation()`

### What We Store

**In Database (agent_wallets table):**
- `room_id`: Room identifier
- `owner_account_name`: CDP account name for owner (e.g., "room-123-owner")
- `address`: Owner EOA blockchain address
- `smart_account_address`: Smart account (ERC-4337) trading wallet address
- `network`: Network identifier

**On CDP Servers:**
- Private keys (owner and smart account)
- Account metadata
- Transaction history

**NOT Stored Anywhere by Us:**
- Private keys
- Mnemonics
- Wallet export data

## Project Structure

```
wallet_api/
├── __init__.py       # Package initialization
├── main.py           # FastAPI application
├── models.py         # Pydantic request/response models
├── database.py       # Supabase database operations
└── README.md         # This file
```

### Module Overview

- **main.py**: FastAPI app with endpoints, CDP client lifecycle
- **models.py**: Pydantic models for validation
- **database.py**: Async database operations using Supabase
- **__init__.py**: Package metadata

## Deployment

### Modal Deployment (Recommended)

**Coming Soon**: Modal deployment integration

The API will be deployed alongside the main Agentica platform on Modal.com.

### Manual Deployment

For deploying to other platforms:

```bash
# Install dependencies
pip install -r requirements.txt

# Set environment variables
export CDP_API_KEY_ID=...
export CDP_API_KEY_SECRET=...
export CDP_WALLET_SECRET=...
export SUPABASE_URL=...
export SUPABASE_SERVICE_ROLE_KEY=...

# Run with gunicorn (production)
gunicorn wallet_api.main:app -w 4 -k uvicorn.workers.UvicornWorker
```

## Troubleshooting

### "CDP Client not initialized"

**Symptom:** `503 Service Unavailable` on all endpoints

**Cause:** Missing CDP credentials

**Fix:**
```bash
# Verify environment variables are set
echo $CDP_API_KEY_ID
echo $CDP_API_KEY_SECRET
echo $CDP_WALLET_SECRET

# If missing, add to .env file
```

### "Failed to import CDP SDK"

**Symptom:** Server won't start

**Cause:** CDP SDK not installed

**Fix:**
```bash
pip install cdp-sdk>=0.11.0
```

### "Failed to initialize Supabase client"

**Symptom:** Database operations fail

**Cause:** Missing or invalid Supabase credentials

**Fix:**
```bash
# Verify Supabase environment variables
echo $SUPABASE_URL
echo $SUPABASE_SERVICE_ROLE_KEY

# Test connection
python -c "from config import create_supabase_client; create_supabase_client()"
```

### "Wallet already exists for room_id"

**Symptom:** `409 Conflict` when creating wallet

**Cause:** Wallet already created for this room

**Solution:** This is expected behavior. Each room can only have one wallet.

To get existing wallet:
```bash
curl http://localhost:8000/wallets/{room_id}/balance
```

## Next Steps

After setting up the Wallet API:

1. **Run Database Migration**: Create `agent_wallets` table in Supabase
2. **Test Locally**: Use curl commands above to verify API works
3. **Integrate with Platform**: Connect to ElizaOS agents
4. **Deploy to Modal**: (Instructions coming in future updates)

## Resources

- [CDP SDK Documentation](https://docs.cdp.coinbase.com/)
- [CDP Server Wallets](https://portal.cdp.coinbase.com/)
- [FastAPI Documentation](https://fastapi.tiangolo.com/)
- [Supabase Documentation](https://supabase.com/docs)

## Support

For issues or questions:
1. Check the troubleshooting section above
2. Review CDP SDK documentation
3. Check API logs: `python main.py` (local) or Modal logs (production)
4. Verify environment variables are set correctly

## License

Part of the Agentica platform.
