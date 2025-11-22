# Path 2.5 Architecture: AgentKit REST API Integration

## Overview

Path 2.5 introduces a REST API layer between ElizaOS agents and CDP AgentKit, enabling better scalability, security, and multi-agent support.

---

## Architecture Comparison

### Current: Direct CDP Integration (plugin-agentkit)

```
┌─────────────────────────────────────────────────────────────┐
│                      ElizaOS Agent                          │
│  ┌──────────────────────────────────────────────────────┐   │
│  │              Agent Runtime                            │   │
│  │  - Character configuration                           │   │
│  │  - Conversation state                                │   │
│  │  - Action selection                                  │   │
│  └─────────────────────┬────────────────────────────────┘   │
│                        │                                     │
│  ┌─────────────────────▼────────────────────────────────┐   │
│  │         plugin-agentkit                              │   │
│  │  ┌─────────────────────────────────────────────┐    │   │
│  │  │ Wallet Provider                             │    │   │
│  │  │  - Reads wallet_data.txt                   │    │   │
│  │  │  - Provides wallet address to context      │    │   │
│  │  └─────────────────────────────────────────────┘    │   │
│  │  ┌─────────────────────────────────────────────┐    │   │
│  │  │ Actions (dynamically generated)             │    │   │
│  │  │  - Transfer, Swap, Balance, etc.           │    │   │
│  │  │  - Parameter extraction via LLM            │    │   │
│  │  │  - Direct CDP tool calls                   │    │   │
│  │  └─────────────────────────────────────────────┘    │   │
│  └─────────────────────┬────────────────────────────────┘   │
│                        │                                     │
│  ┌─────────────────────▼────────────────────────────────┐   │
│  │       CDP AgentKit Core (@coinbase/cdp-agentkit)    │   │
│  │  - Wallet management (MPC)                          │   │
│  │  - Transaction signing                              │   │
│  │  - Network abstraction                              │   │
│  └─────────────────────┬────────────────────────────────┘   │
│                        │                                     │
│  ┌─────────────────────▼────────────────────────────────┐   │
│  │       CDP LangChain Toolkit                         │   │
│  │  - 13 blockchain tools                              │   │
│  │  - Zod schemas for validation                       │   │
│  └─────────────────────┬────────────────────────────────┘   │
│                        │                                     │
└────────────────────────┼─────────────────────────────────────┘
                         │
                         │ RPC Calls
                         ▼
              ┌──────────────────────┐
              │   Blockchain          │
              │  (Base, Ethereum)     │
              └──────────────────────┘

PROS:
✓ Simple architecture
✓ Low latency (direct calls)
✓ Easy to develop

CONS:
✗ File-based wallet storage (single agent)
✗ CDP credentials in agent environment
✗ No centralized monitoring
✗ Difficult to scale to multiple agents
✗ No transaction history
```

### Path 2.5: REST API Integration

```
┌─────────────────────────────────────────────────────────────┐
│                   ElizaOS Agent 1                           │
│  ┌──────────────────────────────────────────────────────┐   │
│  │    plugin-agentkit-rest                              │   │
│  │  - REST client provider                             │   │
│  │  - Actions call API endpoints                       │   │
│  │  - AgentID passed with each request                 │   │
│  └──────────────────────┬───────────────────────────────┘   │
└────────────────────────┼───────────────────────────────────┘
                         │
┌─────────────────────────────────────────────────────────────┐
│                   ElizaOS Agent 2                           │
│  ┌──────────────────────────────────────────────────────┐   │
│  │    plugin-agentkit-rest                              │   │
│  │  - Same plugin, different agent                     │   │
│  │  - Isolated wallet via AgentID                      │   │
│  └──────────────────────┬───────────────────────────────┘   │
└────────────────────────┼───────────────────────────────────┘
                         │
┌─────────────────────────────────────────────────────────────┐
│                   ElizaOS Agent N                           │
│  ┌──────────────────────────────────────────────────────┐   │
│  │    plugin-agentkit-rest                              │   │
│  └──────────────────────┬───────────────────────────────┘   │
└────────────────────────┼───────────────────────────────────┘
                         │
                         │ HTTPS
                         │
        ┌────────────────▼───────────────────┐
        │                                    │
        │    AgentKit REST API (FastAPI)    │
        │                                    │
        │  ┌──────────────────────────────┐ │
        │  │  Wallet Management Service   │ │
        │  │  - Create wallet             │ │
        │  │  - Get wallet info           │ │
        │  │  - Map agent → wallet        │ │
        │  └──────────────┬───────────────┘ │
        │                 │                  │
        │  ┌──────────────▼───────────────┐ │
        │  │  PostgreSQL Database         │ │
        │  │  ┌─────────────────────────┐ │ │
        │  │  │ wallets table           │ │ │
        │  │  │ - agent_id (unique)     │ │ │
        │  │  │ - wallet_data (enc.)    │ │ │
        │  │  │ - address               │ │ │
        │  │  │ - network_id            │ │ │
        │  │  └─────────────────────────┘ │ │
        │  │  ┌─────────────────────────┐ │ │
        │  │  │ transactions table      │ │ │
        │  │  │ - wallet_id             │ │ │
        │  │  │ - action_type           │ │ │
        │  │  │ - parameters (JSON)     │ │ │
        │  │  │ - result (JSON)         │ │ │
        │  │  │ - success               │ │ │
        │  │  └─────────────────────────┘ │ │
        │  └──────────────────────────────┘ │
        │                                    │
        │  ┌──────────────────────────────┐ │
        │  │  Action Endpoints            │ │
        │  │  POST /actions/transfer      │ │
        │  │  POST /actions/swap          │ │
        │  │  GET  /actions/balance       │ │
        │  │  POST /actions/deploy_token  │ │
        │  │  POST /actions/mint_nft      │ │
        │  │  ... (13 total)              │ │
        │  └──────────────┬───────────────┘ │
        │                 │                  │
        │  ┌──────────────▼───────────────┐ │
        │  │  CDP AgentKit Integration    │ │
        │  │  - Per-request client init   │ │
        │  │  - Load wallet from DB       │ │
        │  │  - Execute CDP operations    │ │
        │  └──────────────┬───────────────┘ │
        │                 │                  │
        └─────────────────┼──────────────────┘
                          │
          ┌───────────────▼────────────────┐
          │  CDP AgentKit Core             │
          │  - Wallet management (MPC)     │
          │  - Transaction signing         │
          └───────────────┬────────────────┘
                          │
          ┌───────────────▼────────────────┐
          │  CDP LangChain Toolkit         │
          │  - 13 blockchain tools         │
          └───────────────┬────────────────┘
                          │
                          │ RPC Calls
                          ▼
              ┌──────────────────────┐
              │   Blockchain          │
              │  (Base, Ethereum)     │
              └──────────────────────┘

PROS:
✓ Database-backed wallet storage
✓ Multi-agent support (isolated wallets)
✓ Centralized transaction history
✓ CDP credentials isolated in API
✓ Monitoring and logging
✓ API can be scaled independently
✓ Better security posture

CONS:
✗ Additional latency (network hop)
✗ API availability dependency
✗ More complex deployment
✗ Need to maintain API service
```

---

## Request Flow: Transfer Action

### Current Approach

```
User: "Send 0.01 ETH to alice.base.eth"
  ↓
ElizaOS Runtime
  ↓ (decides to use TRANSFER action)
Plugin Action Handler
  ↓ (composeState + recent messages)
generateObject()  ← LLM extracts parameters
  ↓ { amount: "0.01", assetId: "eth", destination: "alice.base.eth" }
CDP AgentKit
  ↓ (reads wallet_data.txt)
CdpToolkit.transfer.call()
  ↓
Blockchain RPC
  ↓
Transaction submitted
  ↓
Plugin Action Handler
  ↓ (formats result)
generateText()  ← LLM creates response
  ↓
Agent: "I've sent 0.01 ETH to alice.base.eth. Transaction hash: 0x..."
```

**Time: ~2-3 seconds**

### Path 2.5 Approach

```
User: "Send 0.01 ETH to alice.base.eth"
  ↓
ElizaOS Runtime
  ↓ (decides to use TRANSFER action)
Plugin Action Handler
  ↓ (composeState + recent messages)
generateObject()  ← LLM extracts parameters
  ↓ { amount: "0.01", assetId: "eth", destination: "alice.base.eth" }
REST API Call: POST /actions/transfer
  ↓ Body: { agent_id: "agent-123", amount: "0.01", assetId: "eth", ... }
FastAPI Endpoint
  ↓ (query database for wallet)
Database: SELECT wallet_data WHERE agent_id = 'agent-123'
  ↓
CDP AgentKit.configureWithWallet(wallet_data)
  ↓
CdpToolkit.transfer.call()
  ↓
Blockchain RPC
  ↓
Transaction submitted
  ↓
Database: INSERT INTO transactions (...)
  ↓
API Response: { success: true, result: { txHash: "0x..." } }
  ↓
Plugin Action Handler
  ↓ (formats result)
generateText()  ← LLM creates response
  ↓
Agent: "I've sent 0.01 ETH to alice.base.eth. Transaction hash: 0x..."
```

**Time: ~2.5-4 seconds** (additional ~500ms-1s for API call + DB query)

---

## API Endpoints Specification

### Wallet Management

#### Create or Get Wallet

```
POST /wallets
```

**Request:**
```json
{
  "agent_id": "agent-123",
  "network_id": "base-sepolia"  // optional, defaults to base-sepolia
}
```

**Response:**
```json
{
  "agent_id": "agent-123",
  "address": "0x1234567890abcdef1234567890abcdef12345678",
  "network_id": "base-sepolia",
  "created_at": "2025-11-21T10:00:00Z"
}
```

#### Get Wallet Info

```
GET /wallets/{agent_id}
```

**Response:**
```json
{
  "agent_id": "agent-123",
  "address": "0x1234567890abcdef1234567890abcdef12345678",
  "network_id": "base-sepolia",
  "created_at": "2025-11-21T10:00:00Z"
}
```

### Actions

#### Transfer

```
POST /actions/transfer
```

**Request:**
```json
{
  "agent_id": "agent-123",
  "amount": "0.01",
  "asset_id": "eth",
  "destination": "alice.base.eth"
}
```

**Response:**
```json
{
  "success": true,
  "result": {
    "transactionHash": "0xabcdef...",
    "transactionLink": "https://basescan.org/tx/0xabcdef...",
    "status": "pending"
  },
  "error": null
}
```

#### Get Balance

```
GET /actions/balance?agent_id=agent-123&asset_id=eth
```

**Response:**
```json
{
  "success": true,
  "result": {
    "asset_id": "eth",
    "balance": "1.234567",
    "formatted": "1.23 ETH"
  },
  "error": null
}
```

#### Swap

```
POST /actions/swap
```

**Request:**
```json
{
  "agent_id": "agent-123",
  "amount": "0.01",
  "from_asset_id": "eth",
  "to_asset_id": "usdc"
}
```

**Response:**
```json
{
  "success": true,
  "result": {
    "transactionHash": "0x123456...",
    "from_amount": "0.01",
    "to_amount": "30.50",
    "from_asset": "eth",
    "to_asset": "usdc"
  },
  "error": null
}
```

### Health & Status

```
GET /health
```

**Response:**
```json
{
  "status": "healthy",
  "version": "1.0.0",
  "cdp_connected": true,
  "database_connected": true
}
```

### Transaction History

```
GET /transactions?agent_id=agent-123&limit=10&offset=0
```

**Response:**
```json
{
  "agent_id": "agent-123",
  "transactions": [
    {
      "id": 1,
      "action_type": "transfer",
      "parameters": {
        "amount": "0.01",
        "asset_id": "eth",
        "destination": "alice.base.eth"
      },
      "result": {
        "transactionHash": "0xabcdef..."
      },
      "success": true,
      "created_at": "2025-11-21T10:30:00Z"
    }
  ],
  "total": 42,
  "limit": 10,
  "offset": 0
}
```

---

## Security Considerations

### Current Approach

- CDP API credentials in agent environment
- Wallet data in plaintext file (wallet_data.txt)
- No audit trail of actions
- Direct blockchain access from agent

**Risks:**
- Environment variable exposure
- File system access vulnerabilities
- No centralized security controls
- Difficult to revoke access

### Path 2.5

- CDP API credentials only in API service
- Wallet data encrypted in database
- All actions logged to database
- API can enforce rate limits, quotas
- API can implement authentication/authorization

**Benefits:**
- Reduced attack surface (credentials isolated)
- Database-level encryption
- Audit trail of all operations
- Centralized access control
- Can implement agent whitelisting

---

## Deployment Architecture

### Development

```
┌─────────────────────────────────────────────┐
│  Local Machine                              │
│                                             │
│  ┌────────────────────────────────────┐    │
│  │  ElizaOS Agent                      │    │
│  │  - plugin-agentkit-rest            │    │
│  │  - AGENTKIT_API_URL=localhost:8000 │    │
│  └──────────────┬──────────────────────┘    │
│                 │                           │
│  ┌──────────────▼──────────────────────┐    │
│  │  FastAPI Service                    │    │
│  │  - Port 8000                        │    │
│  │  - CDP credentials from .env        │    │
│  └──────────────┬──────────────────────┘    │
│                 │                           │
│  ┌──────────────▼──────────────────────┐    │
│  │  PostgreSQL                         │    │
│  │  - Port 5432                        │    │
│  │  - Local data directory             │    │
│  └─────────────────────────────────────┘    │
└─────────────────────────────────────────────┘
```

### Production

```
┌────────────────────────────────────────────────────────────┐
│  Cloud Environment (AWS/GCP/Azure)                         │
│                                                            │
│  ┌──────────────────────────────────────────────────────┐ │
│  │  ElizaOS Agents (Multiple Instances)                 │ │
│  │  ┌──────────┐  ┌──────────┐  ┌──────────┐          │ │
│  │  │ Agent 1  │  │ Agent 2  │  │ Agent N  │          │ │
│  │  │ (Docker) │  │ (Docker) │  │ (Docker) │          │ │
│  │  └────┬─────┘  └────┬─────┘  └────┬─────┘          │ │
│  │       │             │             │                  │ │
│  └───────┼─────────────┼─────────────┼──────────────────┘ │
│          │             │             │                    │
│          └─────────────┴─────────────┘                    │
│                        │                                  │
│  ┌─────────────────────▼──────────────────────────────┐  │
│  │  Load Balancer                                      │  │
│  │  - SSL termination                                  │  │
│  │  - Rate limiting                                    │  │
│  └─────────────────────┬──────────────────────────────┘  │
│                        │                                  │
│  ┌─────────────────────▼──────────────────────────────┐  │
│  │  AgentKit API (Auto-scaling)                       │  │
│  │  ┌───────────┐  ┌───────────┐  ┌───────────┐      │  │
│  │  │ API Pod 1 │  │ API Pod 2 │  │ API Pod N │      │  │
│  │  │ (K8s/ECS) │  │ (K8s/ECS) │  │ (K8s/ECS) │      │  │
│  │  └─────┬─────┘  └─────┬─────┘  └─────┬─────┘      │  │
│  │        │              │              │              │  │
│  └────────┼──────────────┼──────────────┼──────────────┘  │
│           │              │              │                 │
│           └──────────────┴──────────────┘                 │
│                          │                                │
│  ┌───────────────────────▼────────────────────────────┐  │
│  │  Managed PostgreSQL (RDS/CloudSQL)                 │  │
│  │  - Encrypted at rest                               │  │
│  │  - Automated backups                               │  │
│  │  - Read replicas (optional)                        │  │
│  └────────────────────────────────────────────────────┘  │
│                                                           │
│  ┌────────────────────────────────────────────────────┐  │
│  │  Monitoring & Logging                              │  │
│  │  - CloudWatch / Stackdriver / Datadog              │  │
│  │  - API metrics, error rates, latency               │  │
│  │  - Transaction success rates                       │  │
│  └────────────────────────────────────────────────────┘  │
└────────────────────────────────────────────────────────────┘
```

---

## Migration Path

### Phase 1: API Development (Week 1)

1. **Setup FastAPI project**
   - Project structure
   - Environment configuration
   - Database connection

2. **Implement wallet endpoints**
   - POST /wallets (create/get)
   - GET /wallets/{agent_id}

3. **Implement core actions**
   - POST /actions/transfer
   - GET /actions/balance
   - POST /actions/swap

4. **Testing**
   - Unit tests
   - Integration tests with CDP
   - Local testing with curl/Postman

### Phase 2: Plugin Development (Week 2)

1. **Create plugin structure**
   - index.ts
   - provider.ts
   - actions/ directory

2. **Implement REST client**
   - HTTP client
   - Error handling
   - Retry logic

3. **Implement actions**
   - Transfer, balance, swap
   - Parameter extraction
   - Response formatting

4. **Testing**
   - Mock API server
   - Integration tests with real API
   - End-to-end tests

### Phase 3: Integration & Testing (Week 3)

1. **Integration testing**
   - Agent + API together
   - Multiple agents
   - Error scenarios

2. **Performance testing**
   - Latency measurements
   - Load testing
   - Database performance

3. **Documentation**
   - API documentation
   - Plugin documentation
   - Deployment guide

### Phase 4: Production Deployment (Week 4)

1. **Deploy API**
   - Set up cloud resources
   - Deploy to staging
   - Deploy to production

2. **Deploy agents**
   - Update agent configurations
   - Deploy with new plugin
   - Monitor rollout

3. **Monitoring**
   - Set up dashboards
   - Configure alerts
   - Monitor metrics

---

## Next Steps

1. **Review this architecture** with the team
2. **Finalize API endpoint specifications**
3. **Set up development environment**
4. **Begin Phase 1: API Development**

Once approved, we can start implementing the REST API in FastAPI following the patterns extracted from the plugin-agentkit analysis.
