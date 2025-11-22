# Path 2.5 Implementation Plan

**Goal:** Create a REST API wrapper around CDP AgentKit that ElizaOS agents can call, enabling scalable multi-agent wallet management.

**Timeline:** 4 weeks (can be adjusted based on priorities)

---

## Week 1: REST API Foundation

### Day 1-2: Project Setup & Core Infrastructure

**Deliverables:**
- FastAPI application structure
- Database schema and migrations
- Environment configuration
- Docker setup (optional, for local dev)

**Tasks:**

1. **Create API directory structure**
   ```
   backend/
   ├── agentkit_api/
   │   ├── __init__.py
   │   ├── main.py              # FastAPI app
   │   ├── config.py            # Environment & settings
   │   ├── database.py          # Database connection
   │   ├── models.py            # Pydantic models
   │   ├── crud.py              # Database operations
   │   ├── cdp_client.py        # CDP AgentKit wrapper
   │   └── routers/
   │       ├── __init__.py
   │       ├── wallets.py       # Wallet endpoints
   │       └── actions.py       # Action endpoints
   ├── tests/
   │   ├── test_wallets.py
   │   └── test_actions.py
   ├── requirements.txt
   ├── .env.example
   └── README.md
   ```

2. **Set up database schema**
   ```sql
   -- Add to db/schema.sql
   
   CREATE TABLE agentkit_wallets (
       id SERIAL PRIMARY KEY,
       agent_id VARCHAR(255) UNIQUE NOT NULL,
       wallet_data TEXT NOT NULL,  -- Encrypted CDP wallet export
       address VARCHAR(255) NOT NULL,
       network_id VARCHAR(50) NOT NULL DEFAULT 'base-sepolia',
       created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
       updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
   );
   
   CREATE INDEX idx_agentkit_wallets_agent_id ON agentkit_wallets(agent_id);
   CREATE INDEX idx_agentkit_wallets_address ON agentkit_wallets(address);
   
   CREATE TABLE agentkit_transactions (
       id SERIAL PRIMARY KEY,
       wallet_id INTEGER REFERENCES agentkit_wallets(id) ON DELETE CASCADE,
       agent_id VARCHAR(255) NOT NULL,
       action_type VARCHAR(50) NOT NULL,
       parameters JSONB NOT NULL,
       result JSONB,
       success BOOLEAN NOT NULL,
       error TEXT,
       created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
   );
   
   CREATE INDEX idx_agentkit_transactions_wallet_id ON agentkit_transactions(wallet_id);
   CREATE INDEX idx_agentkit_transactions_agent_id ON agentkit_transactions(agent_id);
   CREATE INDEX idx_agentkit_transactions_created_at ON agentkit_transactions(created_at DESC);
   ```

3. **Create basic FastAPI app**
   ```python
   # agentkit_api/main.py
   from fastapi import FastAPI
   from fastapi.middleware.cors import CORSMiddleware
   from .routers import wallets, actions
   from .config import settings
   
   app = FastAPI(
       title="AgentKit REST API",
       description="REST API wrapper for Coinbase CDP AgentKit",
       version="1.0.0",
   )
   
   app.add_middleware(
       CORSMiddleware,
       allow_origins=["*"],  # Configure appropriately for production
       allow_credentials=True,
       allow_methods=["*"],
       allow_headers=["*"],
   )
   
   app.include_router(wallets.router, prefix="/wallets", tags=["wallets"])
   app.include_router(actions.router, prefix="/actions", tags=["actions"])
   
   @app.get("/health")
   async def health_check():
       return {
           "status": "healthy",
           "version": "1.0.0",
           "cdp_configured": bool(settings.CDP_API_KEY_NAME),
       }
   ```

4. **Environment configuration**
   ```python
   # agentkit_api/config.py
   from pydantic_settings import BaseSettings
   
   class Settings(BaseSettings):
       # Database
       POSTGRES_URL: str
       
       # CDP AgentKit
       CDP_API_KEY_NAME: str
       CDP_API_KEY_PRIVATE_KEY: str
       CDP_DEFAULT_NETWORK: str = "base-sepolia"
       
       # API
       API_HOST: str = "0.0.0.0"
       API_PORT: int = 8000
       
       class Config:
           env_file = ".env"
   
   settings = Settings()
   ```

### Day 3-4: Wallet Management

**Deliverables:**
- Wallet creation endpoint
- Wallet retrieval endpoint
- Database CRUD operations
- CDP AgentKit integration

**Tasks:**

1. **Implement CDP client wrapper**
   ```python
   # agentkit_api/cdp_client.py
   from coinbase.cdp import CdpAgentkit
   from .config import settings
   
   async def create_agentkit_client(
       wallet_data: str | None = None,
       network_id: str | None = None
   ) -> CdpAgentkit:
       """Initialize CDP AgentKit client with optional existing wallet."""
       config = {
           "networkId": network_id or settings.CDP_DEFAULT_NETWORK,
       }
       
       if wallet_data:
           config["cdpWalletData"] = wallet_data
       
       agentkit = await CdpAgentkit.configureWithWallet(config)
       return agentkit
   
   async def export_wallet(agentkit: CdpAgentkit) -> str:
       """Export wallet data for persistence."""
       return await agentkit.exportWallet()
   
   def get_wallet_address(agentkit: CdpAgentkit) -> str:
       """Extract wallet address from AgentKit client."""
       # Type assertion similar to plugin-agentkit
       return agentkit.wallet.addresses[0].id
   ```

2. **Database operations**
   ```python
   # agentkit_api/crud.py
   from sqlalchemy import select
   from .database import get_db
   from .models import WalletDB
   
   async def get_wallet_by_agent_id(agent_id: str) -> WalletDB | None:
       """Retrieve wallet by agent ID."""
       async with get_db() as db:
           result = await db.execute(
               select(WalletDB).where(WalletDB.agent_id == agent_id)
           )
           return result.scalar_one_or_none()
   
   async def create_wallet(
       agent_id: str,
       wallet_data: str,
       address: str,
       network_id: str
   ) -> WalletDB:
       """Create new wallet record."""
       async with get_db() as db:
           wallet = WalletDB(
               agent_id=agent_id,
               wallet_data=wallet_data,
               address=address,
               network_id=network_id,
           )
           db.add(wallet)
           await db.commit()
           await db.refresh(wallet)
           return wallet
   ```

3. **Wallet endpoints**
   ```python
   # agentkit_api/routers/wallets.py
   from fastapi import APIRouter, HTTPException
   from ..models import WalletCreateRequest, WalletResponse
   from ..cdp_client import create_agentkit_client, export_wallet, get_wallet_address
   from .. import crud
   
   router = APIRouter()
   
   @router.post("", response_model=WalletResponse)
   async def create_or_get_wallet(request: WalletCreateRequest):
       """Create new wallet or return existing one for agent."""
       # Check if wallet exists
       existing = await crud.get_wallet_by_agent_id(request.agent_id)
       if existing:
           return WalletResponse(
               agent_id=existing.agent_id,
               address=existing.address,
               network_id=existing.network_id,
               created_at=existing.created_at,
           )
       
       # Create new wallet via CDP
       try:
           agentkit = await create_agentkit_client(
               network_id=request.network_id
           )
           wallet_data = await export_wallet(agentkit)
           address = get_wallet_address(agentkit)
           
           # Save to database
           wallet = await crud.create_wallet(
               agent_id=request.agent_id,
               wallet_data=wallet_data,
               address=address,
               network_id=request.network_id or "base-sepolia",
           )
           
           return WalletResponse(
               agent_id=wallet.agent_id,
               address=wallet.address,
               network_id=wallet.network_id,
               created_at=wallet.created_at,
           )
       except Exception as e:
           raise HTTPException(status_code=500, detail=str(e))
   
   @router.get("/{agent_id}", response_model=WalletResponse)
   async def get_wallet(agent_id: str):
       """Get wallet info for agent."""
       wallet = await crud.get_wallet_by_agent_id(agent_id)
       if not wallet:
           raise HTTPException(status_code=404, detail="Wallet not found")
       
       return WalletResponse(
           agent_id=wallet.agent_id,
           address=wallet.address,
           network_id=wallet.network_id,
           created_at=wallet.created_at,
       )
   ```

### Day 5: Testing & Documentation

**Deliverables:**
- Unit tests for wallet operations
- API documentation (OpenAPI/Swagger)
- Local testing with curl/Postman

**Tasks:**

1. **Write tests**
   ```python
   # tests/test_wallets.py
   import pytest
   from fastapi.testclient import TestClient
   from agentkit_api.main import app
   
   client = TestClient(app)
   
   def test_create_wallet():
       response = client.post(
           "/wallets",
           json={"agent_id": "test-agent-123", "network_id": "base-sepolia"}
       )
       assert response.status_code == 200
       data = response.json()
       assert data["agent_id"] == "test-agent-123"
       assert "address" in data
   
   def test_get_wallet():
       # Create wallet first
       client.post("/wallets", json={"agent_id": "test-agent-456"})
       
       # Get wallet
       response = client.get("/wallets/test-agent-456")
       assert response.status_code == 200
       data = response.json()
       assert data["agent_id"] == "test-agent-456"
   ```

2. **Test locally**
   ```bash
   # Start API
   uvicorn agentkit_api.main:app --reload
   
   # Create wallet
   curl -X POST http://localhost:8000/wallets \
     -H "Content-Type: application/json" \
     -d '{"agent_id": "test-agent", "network_id": "base-sepolia"}'
   
   # Get wallet
   curl http://localhost:8000/wallets/test-agent
   ```

---

## Week 2: Action Endpoints

### Day 1-2: Core Actions (Transfer, Balance)

**Deliverables:**
- Transfer endpoint
- Balance endpoint
- Transaction logging

**Tasks:**

1. **Implement action endpoints**
   ```python
   # agentkit_api/routers/actions.py
   from fastapi import APIRouter, HTTPException
   from coinbase.cdp import CdpToolkit
   from ..models import TransferRequest, BalanceRequest, ActionResponse
   from ..cdp_client import create_agentkit_client
   from .. import crud
   
   router = APIRouter()
   
   @router.post("/transfer", response_model=ActionResponse)
   async def transfer(request: TransferRequest):
       """Transfer assets to destination address."""
       # Get wallet
       wallet = await crud.get_wallet_by_agent_id(request.agent_id)
       if not wallet:
           raise HTTPException(status_code=404, detail="Wallet not found")
       
       try:
           # Initialize CDP AgentKit with wallet
           agentkit = await create_agentkit_client(
               wallet_data=wallet.wallet_data,
               network_id=wallet.network_id,
           )
           
           # Get transfer tool
           toolkit = CdpToolkit(agentkit)
           tools = toolkit.getTools()
           transfer_tool = next(t for t in tools if t.name == "transfer")
           
           # Execute transfer
           result = await transfer_tool.call({
               "amount": request.amount,
               "assetId": request.asset_id,
               "destination": request.destination,
           })
           
           # Log transaction
           await crud.create_transaction(
               wallet_id=wallet.id,
               agent_id=request.agent_id,
               action_type="transfer",
               parameters=request.dict(),
               result=result,
               success=True,
           )
           
           return ActionResponse(success=True, result=result)
       except Exception as e:
           # Log failed transaction
           await crud.create_transaction(
               wallet_id=wallet.id,
               agent_id=request.agent_id,
               action_type="transfer",
               parameters=request.dict(),
               result={},
               success=False,
               error=str(e),
           )
           return ActionResponse(success=False, error=str(e))
   
   @router.get("/balance", response_model=ActionResponse)
   async def get_balance(agent_id: str, asset_id: str = "eth"):
       """Get balance for specific asset."""
       wallet = await crud.get_wallet_by_agent_id(agent_id)
       if not wallet:
           raise HTTPException(status_code=404, detail="Wallet not found")
       
       try:
           agentkit = await create_agentkit_client(
               wallet_data=wallet.wallet_data,
               network_id=wallet.network_id,
           )
           
           toolkit = CdpToolkit(agentkit)
           tools = toolkit.getTools()
           balance_tool = next(t for t in tools if t.name == "get_balance")
           
           result = await balance_tool.call({"assetId": asset_id})
           
           return ActionResponse(success=True, result=result)
       except Exception as e:
           return ActionResponse(success=False, error=str(e))
   ```

### Day 3-4: Additional Actions (Swap, Deploy, NFT)

**Deliverables:**
- Swap endpoint
- Deploy token endpoint
- Mint NFT endpoint

**Tasks:**

1. **Implement additional actions** (similar pattern to transfer)
   - POST /actions/swap
   - POST /actions/deploy_token
   - POST /actions/mint_nft
   - POST /actions/deploy_nft

2. **Add transaction history endpoint**
   ```python
   @router.get("/transactions", response_model=TransactionListResponse)
   async def get_transactions(
       agent_id: str,
       limit: int = 10,
       offset: int = 0
   ):
       """Get transaction history for agent."""
       transactions = await crud.get_transactions(
           agent_id=agent_id,
           limit=limit,
           offset=offset,
       )
       total = await crud.count_transactions(agent_id=agent_id)
       
       return TransactionListResponse(
           agent_id=agent_id,
           transactions=transactions,
           total=total,
           limit=limit,
           offset=offset,
       )
   ```

### Day 5: Testing & Integration

**Deliverables:**
- Integration tests for all actions
- Error handling tests
- API documentation updates

---

## Week 3: ElizaOS Plugin

### Day 1-2: Plugin Structure

**Deliverables:**
- Plugin project structure
- REST client provider
- Basic configuration

**Tasks:**

1. **Create plugin directory**
   ```
   packages/
   └── plugin-agentkit-rest/
       ├── src/
       │   ├── index.ts
       │   ├── provider.ts
       │   ├── client.ts
       │   ├── actions/
       │   │   ├── transfer.ts
       │   │   ├── balance.ts
       │   │   └── swap.ts
       │   └── types.ts
       ├── package.json
       ├── tsconfig.json
       └── README.md
   ```

2. **Implement REST client**
   ```typescript
   // src/client.ts
   export class AgentKitRestClient {
       private baseUrl: string;
       
       constructor(baseUrl: string) {
           this.baseUrl = baseUrl;
       }
       
       async createWallet(agentId: string, networkId?: string) {
           const response = await fetch(`${this.baseUrl}/wallets`, {
               method: "POST",
               headers: { "Content-Type": "application/json" },
               body: JSON.stringify({ agent_id: agentId, network_id: networkId }),
           });
           
           if (!response.ok) {
               throw new Error(`Failed to create wallet: ${response.statusText}`);
           }
           
           return await response.json();
       }
       
       async transfer(agentId: string, params: TransferParams) {
           const response = await fetch(`${this.baseUrl}/actions/transfer`, {
               method: "POST",
               headers: { "Content-Type": "application/json" },
               body: JSON.stringify({ agent_id: agentId, ...params }),
           });
           
           return await response.json();
       }
       
       // ... other methods
   }
   ```

### Day 3-4: Action Implementation

**Deliverables:**
- Transfer action
- Balance action
- Swap action
- Action validation and error handling

**Tasks:**

1. **Implement actions** (following plugin-agentkit pattern)
   ```typescript
   // src/actions/transfer.ts
   import { Action, IAgentRuntime, Memory, State, HandlerCallback, generateObject, ModelClass } from "@elizaos/core";
   import { z } from "zod";
   
   export const transferAction: Action = {
       name: "TRANSFER",
       description: "Transfer assets to a destination address",
       similes: ["SEND", "PAY", "MOVE"],
       validate: async () => true,
       handler: async (
           runtime: IAgentRuntime,
           message: Memory,
           state: State | undefined,
           _options?: Record<string, unknown>,
           callback?: HandlerCallback
       ): Promise<boolean> => {
           try {
               // Extract parameters using LLM
               const { object: parameters } = await generateObject({
                   runtime,
                   context: `Extract transfer parameters from: ${message.content.text}`,
                   modelClass: ModelClass.LARGE,
                   schema: z.object({
                       amount: z.string().describe("Amount to transfer"),
                       assetId: z.string().describe("Asset ID"),
                       destination: z.string().describe("Destination address"),
                   }),
               });
               
               // Call REST API
               const client = getClient(); // From provider
               const result = await client.transfer(
                   runtime.agentId,
                   parameters
               );
               
               if (!result.success) {
                   throw new Error(result.error || "Transfer failed");
               }
               
               callback?.({
                   text: `Successfully transferred ${parameters.amount} ${parameters.assetId}`,
                   content: result.result,
               });
               
               return true;
           } catch (error) {
               callback?.({
                   text: `Error: ${error.message}`,
                   content: { error: error.message },
               });
               return false;
           }
       },
       examples: [/* ... */],
   };
   ```

### Day 5: Testing & Documentation

**Deliverables:**
- Plugin tests (with mocked API)
- Integration tests (with real API)
- README and usage examples

---

## Week 4: Integration & Deployment

### Day 1-2: End-to-End Testing

**Tasks:**
1. Deploy API to staging environment
2. Test plugin with real API
3. Test multiple agents
4. Performance testing
5. Error scenario testing

### Day 3-4: Production Deployment

**Tasks:**
1. Deploy API to production (Modal or other cloud provider)
2. Configure production database
3. Set up monitoring and alerts
4. Update agent configurations
5. Deploy agents with new plugin

### Day 5: Documentation & Handoff

**Deliverables:**
- Complete API documentation
- Plugin usage guide
- Deployment guide
- Architecture documentation
- Known issues and future work

---

## Dependencies & Requirements

### Python Dependencies (API)
```txt
fastapi==0.104.1
uvicorn[standard]==0.24.0
sqlalchemy[asyncio]==2.0.23
asyncpg==0.29.0
pydantic==2.5.0
pydantic-settings==2.1.0
python-dotenv==1.0.0

# CDP AgentKit
coinbase-cdp-agentkit-core==0.0.10
coinbase-cdp-langchain==0.0.11
langchain-core==0.3.27

# Testing
pytest==7.4.3
pytest-asyncio==0.21.1
httpx==0.25.2
```

### TypeScript Dependencies (Plugin)
```json
{
  "dependencies": {
    "@elizaos/core": "^0.1.7",
    "zod": "^3.22.4"
  },
  "devDependencies": {
    "@types/node": "^20.10.0",
    "typescript": "^5.3.3",
    "vitest": "^1.0.4"
  }
}
```

---

## Success Criteria

### Week 1
- [ ] API runs locally
- [ ] Wallet creation works
- [ ] Wallet retrieval works
- [ ] Data persists in database
- [ ] Basic tests pass

### Week 2
- [ ] Transfer action works
- [ ] Balance check works
- [ ] Swap action works
- [ ] Transactions logged to database
- [ ] Error handling works

### Week 3
- [ ] Plugin compiles
- [ ] Plugin connects to API
- [ ] Actions execute successfully
- [ ] Provider shows wallet info
- [ ] Tests pass

### Week 4
- [ ] API deployed to production
- [ ] Plugin tested with real agents
- [ ] Multiple agents can use API
- [ ] Monitoring in place
- [ ] Documentation complete

---

## Risk Mitigation

### Technical Risks

1. **CDP AgentKit API Changes**
   - Mitigation: Pin versions, test thoroughly
   - Fallback: Can revert to direct integration

2. **Database Performance**
   - Mitigation: Proper indexing, connection pooling
   - Fallback: Implement caching layer

3. **API Latency**
   - Mitigation: Optimize database queries, use async operations
   - Fallback: Implement request queuing

4. **Wallet Data Security**
   - Mitigation: Database encryption, secure environment variables
   - Fallback: Additional encryption layer

### Operational Risks

1. **API Downtime**
   - Mitigation: Health checks, automatic restarts
   - Fallback: Implement circuit breaker pattern

2. **Database Failures**
   - Mitigation: Regular backups, replication
   - Fallback: Degraded mode (read-only)

3. **Scaling Issues**
   - Mitigation: Load testing, auto-scaling
   - Fallback: Rate limiting, request queuing

---

## Next Steps

1. **Review this plan** with the team
2. **Get approval** for timeline and approach
3. **Set up development environment** (database, API keys)
4. **Start Week 1 implementation**

Would you like me to start implementing any specific part of this plan?
