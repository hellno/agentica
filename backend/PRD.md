# PRD: Self-Driving Crypto Wallet - Hackathon MVP

**Version**: 1.0
**Date**: 2025-01-21
**Timeline**: Week 1 MVP (Hackathon)
**Architecture**: Path 2.5 (AgentKit + REST API Wrapper)

---

## Executive Summary

We're building a **self-driving crypto wallet** that autonomously manages user portfolios using AI agents. Users create "portfolio rooms" with trading strategies (e.g., "DCA Bitcoin weekly"), and an AI agent executes trades 24/7 within user-defined guardrails. The system watches markets, remembers past decisions, and reacts to opportunities even when users are offline.

**Why Path 2.5?** We're building a hybrid architecture: a FastAPI wallet service wrapping CDP AgentKit, with ElizaOS agents calling it via HTTP. This gives us:
- ✅ Multi-agent wallet isolation (each room = separate wallet)
- ✅ Pre-built CDP actions (13 blockchain tools ready)
- ✅ Clean separation of concerns (wallet logic ≠ agent logic)
- ✅ Scalable infrastructure (API manages AgentKit instance pool)

**Hackathon Success**: Demo a working system where a user creates a portfolio, the agent autonomously checks balances and executes a transfer, and the user views transaction history.

---

## Technical Architecture

```
┌─────────────────────────────────────────────────┐
│  User                                           │
│  └─> "Create Conservative BTC Portfolio"       │
└─────────────────┬───────────────────────────────┘
                  │
                  ▼
┌─────────────────────────────────────────────────┐
│  Platform API (Modal/FastAPI)                   │
│  POST /rooms                                    │
│   ├─ Validate user input                       │
│   ├─ Call Wallet API to create wallet          │
│   ├─ Create ElizaOS strategy agent             │
│   └─ Create ElizaOS room                       │
└─────────────────┬───────────────────────────────┘
                  │
        ┌─────────┴─────────┐
        │                   │
        ▼                   ▼
┌──────────────────┐  ┌─────────────────────────┐
│ Wallet API       │  │ ElizaOS Runtime         │
│ (Modal/FastAPI)  │  │                         │
│                  │  │ Strategy Agent          │
│ AgentKit Pool:   │  │  ↓ HTTP calls           │
│  ├─ room_1       │←─┤  Wallet API             │
│  ├─ room_2       │  │                         │
│  └─ room_3       │  │ Info Agents (future)    │
│      ↓           │  └─────────────────────────┘
│  CDP SDK         │
│      ↓           │
│  PostgreSQL      │
│  (wallets,       │
│   transactions)  │
└──────────────────┘
```

**Why This Architecture?**

1. **Multi-Agent Wallet Isolation**: Each room gets its own named CDP account with isolated wallet
2. **Server-Side Key Storage**: CDP Server Wallet v2 stores private keys on CDP servers (more secure)
3. **Simple Persistence**: You only store account names in your database, not private keys
4. **Dynamic Actions**: Single endpoint `/wallets/{room_id}/{action}` handles all CDP tools
5. **Transaction History**: PostgreSQL logs every action for user transparency

---

## Core User Flow

### Demo Scenario: "Create Conservative BTC Portfolio"

**Step 1: User Creates Portfolio**
```bash
POST /rooms
{
  "user_id": "user_123",
  "name": "Conservative BTC DCA",
  "prompt": "Buy $100 of BTC every week when price is below $95k. Never spend more than 10% of my portfolio on a single trade.",
  "frequency": "daily"
}

Response:
{
  "room_id": "room_abc",
  "wallet_address": "0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb",
  "strategy_agent_id": "agent_xyz",
  "generated_strategy": "You are a conservative DCA agent. Execute weekly BTC purchases of $100 when price dips below $95k. Never exceed 10% of portfolio in single trade.",
  "status": "active"
}
```

**Step 2: User Funds Wallet**
```bash
# User sends USDC to wallet address via Coinbase/MetaMask
→ 0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb
```

**Step 3: Agent Autonomously Monitors & Trades**
```
[Background Loop]
1. Agent checks BTC price via info agents
2. Price drops to $94,500 (below $95k threshold)
3. Agent calls: POST /wallets/room_abc/swap
4. Executes: Swap $100 USDC → BTC
5. Logs transaction to PostgreSQL
```

**Step 4: User Views Portfolio**
```bash
GET /rooms/room_abc/transactions

Response:
{
  "transactions": [
    {
      "timestamp": "2025-01-21T14:30:00Z",
      "action": "swap",
      "params": {"from": "USDC", "to": "BTC", "amount": 100},
      "tx_hash": "0xabc123...",
      "status": "success"
    }
  ],
  "current_balance": {
    "BTC": "0.00105",
    "USDC": "900"
  }
}
```

---

## API Specification

### 1. Create Portfolio Room

**Endpoint**: `POST /rooms`

**Request**:
```json
{
  "user_id": "string",
  "name": "string",
  "prompt": "string",  // Natural language strategy description
  "frequency": "hourly" | "daily" | "weekly" | "realtime"  // How often agent evaluates
}
```

**Example**:
```json
{
  "user_id": "user_123",
  "name": "Aggressive BTC Momentum",
  "prompt": "Buy BTC when price drops more than 5% in 24h, take profit at 15% gains. Never invest more than 20% of portfolio in a single trade. Focus on momentum plays.",
  "frequency": "hourly"
}
```

**Response**:
```json
{
  "room_id": "uuid",
  "wallet_address": "0x...",
  "strategy_agent_id": "uuid",
  "eliza_room_id": "uuid",
  "status": "active"
}
```

**Implementation**:
```python
@app.post("/rooms")
async def create_room(request: CreateRoomRequest):
    # 1. Generate strategy prompt from user's natural language
    strategy_prompt = await generate_strategy_prompt(
        user_prompt=request.prompt,
        frequency=request.frequency
    )

    # 2. Create wallet via Wallet API
    room_id = str(uuid4())
    wallet = await wallet_api.create_wallet(room_id=room_id)

    # 3. Create strategy agent with generated prompt
    agent = await create_strategy_agent(
        name=request.name,
        strategy_prompt=strategy_prompt,
        wallet_room_id=room_id,
        frequency=request.frequency
    )

    # 4. Create ElizaOS room
    eliza_room = await eliza_client.create_room(
        name=request.name,
        agent_ids=[agent.eliza_id]
    )

    # 5. Store in database
    room = await db.create_room(
        user_id=request.user_id,
        wallet_address=wallet.address,
        user_prompt=request.prompt,  # Original user prompt
        generated_strategy=strategy_prompt,  # AI-generated strategy
        frequency=request.frequency,
        eliza_room_id=eliza_room.id
    )

    return {
        **room,
        "generated_strategy": strategy_prompt  # Show user what was generated
    }
```

---

### Strategy Prompt Generation

**Key Innovation**: Transform user's natural language → structured agent strategy

**Process**:
```python
async def generate_strategy_prompt(user_prompt: str, frequency: str) -> str:
    """
    Use LLM to transform user's natural language into structured strategy prompt.

    Example Input:
    "Buy BTC when price drops 5%, take profit at 15% gains. Max 20% per trade."

    Example Output:
    "You are an aggressive momentum trading agent managing a crypto portfolio.

    STRATEGY:
    - Buy BTC when price drops >5% in 24h
    - Take profit when position gains >15%
    - Evaluation frequency: hourly

    GUARDRAILS:
    - Never invest more than 20% of portfolio in single trade
    - Always maintain at least 10% cash reserves
    - Stop trading if portfolio drops >30% from peak

    EXECUTION:
    - Check market conditions every hour
    - Execute trades only when strategy conditions met
    - Log all decisions with reasoning
    - Report significant portfolio changes to user
    "
    """

    system_prompt = """You are a strategy prompt generator for autonomous trading agents.

Transform the user's natural language trading intent into a clear, structured strategy prompt.

Output format:
1. Agent role description
2. STRATEGY section (what to do)
3. GUARDRAILS section (safety limits)
4. EXECUTION section (how to operate)

Be specific about:
- Entry/exit conditions
- Position sizing
- Risk management
- Frequency of evaluation
- Logging requirements

Always include safety guardrails even if user doesn't specify them."""

    response = await openai.chat.completions.create(
        model="gpt-4",
        messages=[
            {"role": "system", "content": system_prompt},
            {"role": "user", "content": f"User prompt: {user_prompt}\nFrequency: {frequency}"}
        ]
    )

    return response.choices[0].message.content
```

**Benefits**:
- ✅ Users describe intent in natural language
- ✅ LLM adds safety guardrails automatically
- ✅ Strategy is clear and actionable for agent
- ✅ User sees generated strategy before agent executes

**Example Transformations**:

| User Prompt | Generated Strategy (Summary) |
|-------------|------------------------------|
| "YOLO into memecoins" | Aggressive strategy + forced guardrails (max 5% per trade, stop-loss 20%) |
| "Conservative BTC accumulation" | DCA strategy + safety limits (weekly buys, diversification rules) |
| "Rebalance to 60/40 BTC/ETH" | Portfolio balancer + drift thresholds (rebalance at ±5% target) |

---

### 2. Execute Wallet Action (Dynamic Routing)

**Endpoint**: `POST /wallets/{room_id}/{action}`

**Supported Actions** (13 total from CDP AgentKit):
- `transfer` - Send tokens to address
- `swap` - Trade tokens
- `balance` - Check balances (GET also works)
- `deploy_token` - Create new ERC20
- `mint_nft` - Mint NFT
- `wrap_eth` - Convert ETH ↔ WETH
- ... (10 more)

**Example: Transfer**:
```bash
POST /wallets/room_abc/transfer
{
  "to": "0x123...",
  "amount": "10",
  "asset_id": "USDC"
}

Response:
{
  "success": true,
  "tx_hash": "0xabc...",
  "transaction_id": "uuid"
}
```

**Example: Swap**:
```bash
POST /wallets/room_abc/swap
{
  "from_asset": "USDC",
  "to_asset": "BTC",
  "amount": "100"
}

Response:
{
  "success": true,
  "tx_hash": "0xdef...",
  "amount_received": "0.00105",
  "transaction_id": "uuid"
}
```

**Implementation Pattern**:
```python
@app.post("/wallets/{room_id}/{action}")
async def execute_action(room_id: str, action: str, params: dict):
    # 1. Get AgentKit instance for this room
    agentkit = agentkit_pool.get(room_id)
    if not agentkit:
        agentkit = await create_agentkit_instance(room_id)
        agentkit_pool[room_id] = agentkit

    # 2. Map action name to CDP tool
    tool = agentkit.get_tool(action)
    if not tool:
        raise HTTPException(404, f"Action '{action}' not found")

    # 3. Execute tool
    try:
        result = await tool.call(params)
    except Exception as e:
        # Log error
        await db.log_transaction(room_id, action, params, error=str(e))
        raise HTTPException(500, str(e))

    # 4. Log success
    tx_id = await db.log_transaction(
        room_id=room_id,
        action=action,
        params=params,
        result=result,
        tx_hash=result.get("tx_hash")
    )

    return {"success": True, "transaction_id": tx_id, **result}
```

---

### 3. Get Transaction History

**Endpoint**: `GET /rooms/{room_id}/transactions`

**Response**:
```json
{
  "transactions": [
    {
      "id": "uuid",
      "timestamp": "ISO8601",
      "action": "swap",
      "params": { ... },
      "result": { ... },
      "tx_hash": "0x...",
      "status": "success" | "failed"
    }
  ],
  "count": 10
}
```

---

## Database Schema

```sql
-- Rooms table (extends existing platform_rooms)
CREATE TABLE platform_rooms (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id TEXT NOT NULL,
  name TEXT NOT NULL,
  eliza_room_id TEXT UNIQUE NOT NULL,

  -- Wallet reference
  wallet_address TEXT NOT NULL UNIQUE,

  -- Strategy configuration
  user_prompt TEXT NOT NULL,  -- Original user input
  generated_strategy TEXT NOT NULL,  -- AI-generated strategy prompt
  frequency TEXT NOT NULL,  -- Evaluation frequency

  -- Agent reference
  strategy_agent_id UUID REFERENCES platform_agents(id),

  status TEXT DEFAULT 'active' CHECK (status IN ('active', 'paused', 'stopped')),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Wallet account names (for CDP Server Wallet v2)
-- NOTE: Server Wallet v2 stores keys on CDP servers, not in your database
-- You only need to store account names for retrieval
CREATE TABLE agent_wallets (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  room_id UUID REFERENCES platform_rooms(id) UNIQUE,

  -- CDP account name (used to retrieve account from CDP servers)
  -- Pattern: "room-{room_id}" for easy mapping
  account_name TEXT NOT NULL UNIQUE,

  -- Metadata (cached from CDP for quick lookups)
  address TEXT NOT NULL,
  network TEXT NOT NULL DEFAULT 'base-sepolia',

  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Transaction log
CREATE TABLE wallet_transactions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  room_id UUID REFERENCES platform_rooms(id),

  -- Action details
  action TEXT NOT NULL,  -- 'transfer', 'swap', etc.
  params JSONB NOT NULL,
  result JSONB,

  -- Blockchain details
  tx_hash TEXT,
  status TEXT NOT NULL DEFAULT 'pending',
  error TEXT,

  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes
CREATE INDEX idx_rooms_user_id ON platform_rooms(user_id);
CREATE INDEX idx_rooms_wallet ON platform_rooms(wallet_address);
CREATE INDEX idx_wallets_room ON agent_wallets(room_id);
CREATE INDEX idx_transactions_room ON wallet_transactions(room_id);
CREATE INDEX idx_transactions_created ON wallet_transactions(created_at DESC);
```

---

## Implementation Plan (Week 1 MVP)

**Critical Path**: Day 1 CDP wallet testing is a **GO/NO-GO decision point**. If CDP integration doesn't work, we need to resolve it before building the rest of the system.

### Day 1: CDP Wallet Generation (DE-RISK PRIORITY)

**Goal**: Prove that CDP Server Wallet v2 account creation works from server-side

**Tasks**:
- [x] Set up CDP Server Wallet v2 credentials (API key + wallet secret)
- [x] Create test script to verify CDP connection
- [x] Test account creation with named accounts: `cdp.evm.get_or_create_account(name="...")`
- [x] Verify account retrieval by name (persistence test)
- [x] Test creating multiple accounts with same API key (multi-room isolation)
- [x] Document account naming pattern and storage requirements

**Credentials Required** (from CDP Portal → Server Wallets):
```bash
CDP_API_KEY_ID=<your-api-key-id>
CDP_API_KEY_SECRET=<your-api-key-secret>
CDP_WALLET_SECRET=<your-wallet-secret>
```

**Test Script** (`test_cdp_wallet.py`):
```python
import asyncio
from cdp import CdpClient
import os
from dotenv import load_dotenv

load_dotenv()

async def test_cdp_wallet_creation():
    """Critical test: Verify CDP Server Wallet v2 account creation works"""

    async with CdpClient() as cdp:
        # 1. Create first account with a name
        account1 = await cdp.evm.get_or_create_account(name="test-wallet-1")
        print(f"✓ Account 1 created: {account1.address}")

        # 2. Create second account (verify isolation)
        account2 = await cdp.evm.get_or_create_account(name="test-wallet-2")
        print(f"✓ Account 2 created: {account2.address}")

        # Verify different addresses
        assert account1.address != account2.address
        print("✓ Accounts are isolated")

        # 3. Retrieve account 1 by name (verify persistence)
        account1_retrieved = await cdp.evm.get_or_create_account(name="test-wallet-1")
        print(f"✓ Account 1 retrieved: {account1_retrieved.address}")

        # 4. Verify addresses match
        assert account1.address == account1_retrieved.address
        print("✓ Account retrieval verified")

    print("\n✅ CDP SERVER WALLET V2 WORKS - proceed with implementation")

if __name__ == "__main__":
    asyncio.run(test_cdp_wallet_creation())
```

**Success Criteria**:
- ✅ Can create accounts with CDP Server Wallet v2 credentials
- ✅ Named accounts work correctly (`get_or_create_account` is idempotent)
- ✅ Can retrieve existing accounts by name
- ✅ Multiple accounts work with same API credentials
- ✅ Keys stored securely on CDP servers (not in your database)

**Key Insights**:
- **Server Wallet v2 stores private keys on CDP servers** - you never handle them
- **You only store account NAMES** in your database (e.g., "room-abc123")
- **Same name = same account** - calling `get_or_create_account("room-X")` twice returns the same account
- **Pattern for rooms**: Use `f"room-{room_id}"` as account name for easy mapping

**Blocker Resolution**: If this fails, we need to fix CDP integration BEFORE building the rest of the system.

---

### Day 2: Wallet API Foundation

**Tasks**:
- [ ] Create new FastAPI app: `backend/wallet_api/main.py`
- [ ] Install CDP SDK: `pip install cdp-sdk>=0.11.0`
- [ ] Initialize CDP Client with Server Wallet v2 credentials
- [ ] Create POST `/wallets` endpoint (creates named account)
- [ ] Create GET `/wallets/{room_id}/balance` endpoint
- [ ] Test account creation and balance check locally

**Code Template**:
```python
# backend/wallet_api/main.py
from fastapi import FastAPI, HTTPException
from cdp import CdpClient
import os
from dotenv import load_dotenv

load_dotenv()

app = FastAPI()

# Initialize CDP Client (singleton for all requests)
cdp_client = None

@app.on_event("startup")
async def startup():
    global cdp_client
    cdp_client = CdpClient()

@app.on_event("shutdown")
async def shutdown():
    if cdp_client:
        await cdp_client.close()

@app.post("/wallets")
async def create_wallet(room_id: str):
    # Create named account (pattern: "room-{room_id}")
    account_name = f"room-{room_id}"
    account = await cdp_client.evm.get_or_create_account(name=account_name)

    # Save account name to database (for retrieval)
    await db.create_wallet(
        room_id=room_id,
        account_name=account_name,
        address=account.address
    )

    return {
        "room_id": room_id,
        "account_name": account_name,
        "address": account.address,
        "network": "base-sepolia"  # Server Wallet v2 default
    }

@app.get("/wallets/{room_id}/balance")
async def get_balance(room_id: str):
    # Retrieve account from database
    wallet = await db.get_wallet(room_id)

    # Get account from CDP (idempotent)
    account = await cdp_client.evm.get_or_create_account(name=wallet.account_name)

    # Get balance (implementation depends on CDP SDK balance API)
    # For now, return cached address
    return {
        "address": account.address,
        "account_name": wallet.account_name
    }
```

---

### Day 3: Dynamic Action Router

**Tasks**:
- [ ] Implement POST `/wallets/{room_id}/{action}` endpoint
- [ ] Map action names to CDP tools dynamically
- [ ] Add transaction logging to PostgreSQL
- [ ] Test transfer and swap actions
- [ ] Add error handling (3-level strategy from plugin-agentkit)

**Code Template**:
```python
@app.post("/wallets/{room_id}/{action}")
async def execute_action(room_id: str, action: str, params: dict):
    # Get account name from database
    wallet = await db.get_wallet(room_id)

    # Retrieve account from CDP Server Wallet v2
    account = await cdp_client.evm.get_or_create_account(name=wallet.account_name)

    # Execute action using CDP SDK
    # Note: Server Wallet v2 has different action methods
    try:
        if action == "transfer":
            # Example: Use CDP SDK to send transaction
            result = await cdp_client.evm.send_transaction(
                address=account.address,
                transaction={
                    "to": params["to"],
                    "value": params["amount"]
                },
                network="base-sepolia"
            )
        elif action == "balance":
            # Get balance
            result = {"address": account.address}
        else:
            raise HTTPException(404, f"Action '{action}' not supported")

        # Log success
        await db.log_transaction(
            room_id=room_id,
            action=action,
            params=params,
            result=result,
            tx_hash=result.get("transaction_hash"),
            status="success"
        )

        return {"success": True, **result}

    except Exception as e:
        # Log failure
        await db.log_transaction(
            room_id=room_id,
            action=action,
            params=params,
            error=str(e),
            status="failed"
        )
        raise HTTPException(500, str(e))
```

---

### Day 4: Platform API Integration

**Tasks**:
- [ ] Implement `generate_strategy_prompt()` using OpenAI/Anthropic
- [ ] Add strategy generation to `POST /rooms` endpoint
- [ ] Extend `POST /rooms` in `modal_app.py` to call Wallet API
- [ ] Update database schema (run migrations)
- [ ] Test strategy generation with various user prompts
- [ ] Test end-to-end room creation flow
- [ ] Add `GET /rooms/{room_id}/transactions` endpoint

**Code Changes** (`modal_app.py`):
```python
async def generate_strategy_prompt(user_prompt: str, frequency: str) -> str:
    """Transform user's natural language into structured strategy prompt."""
    import anthropic  # or openai

    client = anthropic.Anthropic(api_key=os.getenv("ANTHROPIC_API_KEY"))

    system = """You are a strategy prompt generator for autonomous trading agents.

Transform user's natural language into a clear, structured strategy prompt.

Format:
- Agent role description
- STRATEGY section (what to do)
- GUARDRAILS section (safety limits - ALWAYS include these)
- EXECUTION section (how to operate)

Always add safety guardrails even if user doesn't specify them."""

    response = client.messages.create(
        model="claude-3-5-sonnet-20241022",
        max_tokens=1024,
        messages=[{
            "role": "user",
            "content": f"User prompt: {user_prompt}\nFrequency: {frequency}\n\nGenerate structured strategy prompt:"
        }],
        system=system
    )

    return response.content[0].text


@web_app.post("/rooms", status_code=201)
async def create_room(request: CreateRoomRequest):
    # Generate room ID
    room_id = str(uuid4())

    # 1. Generate strategy prompt from user's natural language
    strategy_prompt = await generate_strategy_prompt(
        user_prompt=request.prompt,
        frequency=request.frequency
    )

    # 2. Create wallet via Wallet API
    wallet_response = await wallet_api_client.post(
        f"{WALLET_API_URL}/wallets",
        json={"room_id": room_id}
    )
    wallet = wallet_response.json()

    # 3. Create strategy agent with generated prompt
    strategy_agent = await create_strategy_agent(
        name=f"{request.name}_strategy",
        strategy_prompt=strategy_prompt,  # AI-generated prompt
        wallet_room_id=room_id
    )

    # 4. Create ElizaOS room
    eliza_room = await eliza_client.create_room(
        name=request.name,
        agent_ids=[strategy_agent.eliza_id]
    )

    # 5. Store in Supabase
    room = await supabase.create_room(
        user_id=request.user_id,
        eliza_room_id=eliza_room.id,
        wallet_address=wallet["address"],
        user_prompt=request.prompt,  # Original user input
        generated_strategy=strategy_prompt,  # AI-generated strategy
        frequency=request.frequency,
        strategy_agent_id=strategy_agent.id
    )

    return {
        "room_id": room.id,
        "wallet_address": wallet["address"],
        "generated_strategy": strategy_prompt,  # Show user what was generated
        "strategy_agent_id": strategy_agent.id,
        "eliza_room_id": eliza_room.id
    }
```

---

### Day 5-6: ElizaOS Agent Integration

**Tasks**:
- [ ] Create custom ElizaOS action: `CHECK_BALANCE`
- [ ] Create custom ElizaOS action: `TRANSFER_TOKENS`
- [ ] Agent character config references Wallet API URL
- [ ] Test agent autonomous balance checking
- [ ] Polish demo script

**ElizaOS Action Template**:
```typescript
// backend/agentica/src/actions/walletActions.ts
import { Action, IAgentRuntime, Memory, State } from "@elizaos/core";

export const checkBalanceAction: Action = {
  name: "CHECK_BALANCE",
  description: "Check wallet balance for this portfolio",

  handler: async (runtime: IAgentRuntime, message: Memory, state?: State) => {
    // Get room ID from agent character settings
    const roomId = runtime.character.settings.wallet_room_id;

    // Call Wallet API
    const response = await fetch(
      `${process.env.WALLET_API_URL}/wallets/${roomId}/balance`
    );

    const balance = await response.json();

    return {
      success: true,
      balance: balance
    };
  },

  examples: [
    [
      {
        user: "{{user1}}",
        content: { text: "What's my current balance?" }
      },
      {
        user: "{{agent}}",
        content: {
          text: "Let me check your wallet balance",
          action: "CHECK_BALANCE"
        }
      }
    ]
  ]
};
```

---

## Technical Patterns

### AgentKit Instance Pooling

**Problem**: Multiple rooms need separate wallets with same CDP API key

**Solution**: Maintain in-memory pool of AgentKit instances

```python
# In-memory pool (MVP)
agentkit_pool: dict[str, CdpAgentkit] = {}

async def get_or_create_agentkit(room_id: str) -> CdpAgentkit:
    # Check pool
    if room_id in agentkit_pool:
        return agentkit_pool[room_id]

    # Restore from database
    wallet_data = await db.get_wallet(room_id)

    if wallet_data:
        # Restore existing wallet
        agentkit = await CdpAgentkit.configure_with_wallet(
            cdp_wallet_data=wallet_data.wallet_data
        )
    else:
        # Create new wallet
        agentkit = await CdpAgentkit.configure({
            "cdp_api_key_name": os.getenv("CDP_API_KEY_NAME"),
            "cdp_api_key_private_key": os.getenv("CDP_API_KEY_PRIVATE_KEY"),
            "network_id": "base-mainnet"
        })

        # Save to database
        await db.create_wallet(
            room_id=room_id,
            wallet_data=agentkit.export_wallet(),
            address=agentkit.address
        )

    # Add to pool
    agentkit_pool[room_id] = agentkit
    return agentkit
```

---

### Dynamic Action Routing

**Problem**: Supporting 13 CDP actions without hardcoding endpoints

**Solution**: Single endpoint with action name parameter

```python
# Map of supported actions (from CDP AgentKit)
SUPPORTED_ACTIONS = [
    "transfer", "swap", "balance", "deploy_token", "mint_nft",
    "wrap_eth", "register_basename", "request_faucet", ...
]

@app.post("/wallets/{room_id}/{action}")
async def execute_action(room_id: str, action: str, params: dict):
    # Validate action
    if action not in SUPPORTED_ACTIONS:
        raise HTTPException(
            400,
            f"Unsupported action. Supported: {SUPPORTED_ACTIONS}"
        )

    # Get AgentKit instance
    agentkit = await get_or_create_agentkit(room_id)

    # Find CDP tool
    tool = next(
        (t for t in agentkit.get_tools() if t.name == action),
        None
    )

    # Execute
    result = await tool.call(params)

    return result
```

---

### Error Handling (3-Level Strategy)

**Level 1: API Level** - Never crash the server
```python
@app.post("/wallets/{room_id}/{action}")
async def execute_action(...):
    try:
        result = await tool.call(params)
        return {"success": True, **result}
    except Exception as e:
        logger.error(f"Action failed: {e}")
        return {
            "success": False,
            "error": str(e),
            "error_type": type(e).__name__
        }
```

**Level 2: Action Level** - Log and return structured errors
```python
try:
    result = await tool.call(params)
    await db.log_transaction(room_id, action, params, result, status="success")
except CDPError as e:
    await db.log_transaction(room_id, action, params, error=str(e), status="failed")
    raise HTTPException(400, f"CDP error: {e}")
except Exception as e:
    await db.log_transaction(room_id, action, params, error=str(e), status="failed")
    raise HTTPException(500, f"Internal error: {e}")
```

**Level 3: Provider Level** - Graceful degradation
```python
async def get_balance(room_id: str):
    try:
        agentkit = await get_or_create_agentkit(room_id)
        return await agentkit.get_balance()
    except Exception as e:
        logger.error(f"Balance check failed: {e}")
        # Return cached balance if available
        cached = await db.get_cached_balance(room_id)
        if cached:
            return {"balance": cached, "cached": True}
        return {"balance": {}, "error": "Unable to fetch balance"}
```

---

## Out of Scope (Hackathon)

The following features are **explicitly excluded** from Week 1 MVP:

1. **Multi-strategy agent discussions** - Single agent per room only
2. **Info agent webhooks** - No onchain event listeners (future)
3. **Frontend UI** - API-only demo with cURL
4. **Fiat on-ramp** - Users manually fund wallets
5. **Advanced DeFi** - Only basic transfer/swap (no lending, staking, etc.)
6. **Production monitoring** - Basic logging only, no Sentry/DataDog

---

## Demo Script (3 Minutes)

**Setup**:
```bash
# Start Wallet API
cd backend/wallet_api
python main.py  # Runs on localhost:8001

# Start Platform API (existing)
modal deploy backend/modal_app.py
```

**Demo Flow**:
```bash
# 1. Create portfolio with natural language prompt (30 seconds)
curl -X POST https://*.modal.run/rooms \
  -H "Content-Type: application/json" \
  -d '{
    "user_id": "demo_user",
    "name": "Conservative BTC DCA",
    "prompt": "Buy $100 of BTC every week when price is below $95k. Keep at least 20% cash reserves. If portfolio drops 30%, stop trading and alert me.",
    "frequency": "daily"
  }'

# Response:
# {
#   "room_id": "abc",
#   "wallet_address": "0x...",
#   "generated_strategy": "You are a conservative DCA agent. Execute weekly BTC purchases...",
#   "status": "active"
# }

# 2. Fund wallet (manual - show in MetaMask)
# Send 1000 USDC to wallet_address

# 3. Agent checks balance (1 minute)
# (Agent automatically calls Wallet API in background)

curl https://*.modal.run/rooms/abc/transactions
# Shows: [{"action": "balance", "result": {"USDC": "1000"}, ...}]

# 4. Execute transfer (1 minute)
curl -X POST http://localhost:8001/wallets/abc/transfer \
  -H "Content-Type: application/json" \
  -d '{
    "to": "0x123...",
    "amount": "10",
    "asset_id": "USDC"
  }'

# Response: {"success": true, "tx_hash": "0xdef...", ...}

# 5. View history (30 seconds)
curl https://*.modal.run/rooms/abc/transactions
# Shows: [
#   {"action": "balance", ...},
#   {"action": "transfer", "tx_hash": "0xdef...", ...}
# ]
```

---

## Key Decisions & Rationale

### Why Path 2.5 (REST API Wrapper)?

**Decision**: Build Wallet API as separate service, not direct ElizaOS plugin

**Reasons**:
1. **Multi-agent wallet isolation**: API manages AgentKit instance pool
2. **Clean separation**: Wallet logic independent of agent framework
3. **Easier testing**: Test wallet operations without ElizaOS
4. **Scalability**: API can serve multiple ElizaOS instances

**Trade-off**: +500ms latency per action (acceptable for blockchain operations that take 1-5 seconds)

---

### Why AgentKit vs CDP SDK Directly?

**Decision**: Use CDP AgentKit instead of raw CDP SDK

**Reasons**:
1. **13 pre-built tools**: transfer, swap, deploy_token, mint_nft, etc.
2. **Battle-tested**: Used in production by Coinbase
3. **LLM integration**: Tools have Zod schemas for AI parameter extraction
4. **Faster development**: ~50% less code than raw CDP SDK

**Trade-off**: Less control over low-level CDP operations (acceptable for hackathon)

---

### Why Dynamic Routing?

**Decision**: `/wallets/{room_id}/{action}` instead of 13 separate endpoints

**Reasons**:
1. **Cleaner API**: Single endpoint vs. 13 routes
2. **Extensible**: New CDP tools automatically supported
3. **Consistent**: Same pattern for all actions
4. **Simpler code**: Generic handler vs. action-specific handlers

**Trade-off**: Less type safety (mitigated by runtime validation)

---

### Why Database-Backed Wallets?

**Decision**: Store wallet data in PostgreSQL, not files

**Reasons**:
1. **Multi-instance safe**: No file conflicts in serverless
2. **Transaction history**: Built-in audit trail
3. **Production-ready**: Easy to add backups, replication
4. **Query performance**: Fast wallet lookups by room_id

**Trade-off**: Requires database migrations (one-time setup)

---

## Success Metrics

### Demo Checklist

- [ ] **Create room**: User creates portfolio in <5 seconds
- [ ] **Fund wallet**: User sends USDC to wallet address
- [ ] **Check balance**: Agent autonomously queries balance
- [ ] **Execute transfer**: Agent successfully sends tokens
- [ ] **View history**: User sees transaction log with tx hashes
- [ ] **Error handling**: API returns clear error for invalid action

### Technical Metrics

- **Wallet creation time**: <3 seconds
- **Action execution**: <5 seconds (CDP blockchain time)
- **API uptime**: 99%+ during demo
- **Error rate**: <5% (excluding user input errors)

---

## Next Steps (Immediately Actionable)

### Day 1 (CRITICAL - CDP DE-RISK)
1. Get CDP API credentials from Coinbase Developer Platform
2. Set environment variables: `CDP_API_KEY_NAME`, `CDP_API_KEY_PRIVATE_KEY`
3. Create test script: `backend/test_cdp_wallet.py`
4. Run CDP wallet creation test
5. Verify wallet export/import works
6. Test multiple wallet creation with same API key
7. Document wallet data structure

**Blocker**: If CDP doesn't work, STOP and fix before continuing

### Day 2
8. Create directory: `backend/wallet_api/`
9. Install dependencies: `pip install cdp-agentkit-core fastapi uvicorn`
10. Implement Wallet API with AgentKit
11. Run database migrations (add tables from schema)
12. Test: Create wallet → Save → Restore → Check balance

### Day 3
13. Implement dynamic action router
14. Test transfer action with testnet funds
15. Test swap action
16. Add transaction logging

### Day 4
17. Integrate with existing Platform API (`modal_app.py`)
18. Implement `generate_strategy_prompt()`
19. Update `POST /rooms` to call Wallet API
20. Test end-to-end room creation flow

### Day 5-6
21. Create ElizaOS custom actions (CHECK_BALANCE, TRANSFER)
22. Deploy strategy agent with Wallet API integration
23. Test autonomous agent behavior

### Day 7
24. Polish demo script
25. Record demo video
26. Deploy to production

---

## Questions & Unknowns

1. **CDP API Rate Limits**: What's the rate limit for wallet creation and transactions?
2. **Testnet vs Mainnet**: Should MVP use base-sepolia (testnet) or base-mainnet?
3. **Wallet Funding**: Where do users get testnet USDC for demo?
4. **Error Recovery**: If AgentKit instance crashes, how do we restore from database?
5. **Instance Pool Size**: How many AgentKit instances can run in single process?

---

## Appendix: File Structure

```
backend/
├── modal_app.py                 # Existing Platform API (extend)
├── config.py                    # Existing config (extend)
│
├── wallet_api/                  # NEW: Wallet Service
│   ├── main.py                  # FastAPI app
│   ├── agentkit_pool.py         # Instance management
│   ├── actions.py               # Action router
│   └── database.py              # PostgreSQL client
│
├── db/
│   ├── schema.sql               # Existing schema
│   └── migrations/
│       └── 001_add_wallets.sql  # NEW: Wallet tables
│
└── agentica/src/
    └── actions/
        └── walletActions.ts     # NEW: ElizaOS wallet actions
```

---

**END OF PRD**

---

**Next Action**: Review this PRD, then start Day 1 tasks to build Wallet API foundation.
