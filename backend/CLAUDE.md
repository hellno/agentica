# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

AI Agent Launchpad ("Agentica") - A platform for creating and managing AI agents powered by ElizaOS, deployed on Modal.com with Supabase storage.

**Core Architecture:**
- ElizaOS server runs continuously in Modal container with Docker image `ghcr.io/elizaos/eliza:latest`
- Single FastAPI application (`@modal.asgi_app()`) provides REST API for agent/room management
- ElizaOS exposes port 3000 via `@modal.web_server()` for inter-service communication
- Agents stored in Supabase `platform_agents` table (not `agents` - that's ElizaOS internal)
- Tunnel URL stored via environment variable `ELIZA_SERVER_URL` for API-to-ElizaOS communication

## Development Commands

### Deployment
```bash
# Deploy complete platform (ElizaOS server + API)
modal deploy backend/modal_app.py

# Run locally for testing
modal run backend/modal_app.py
```

### Monitoring
```bash
# View all platform logs (server + API combined)
modal app logs agentica-platform

# Check health
curl https://*.modal.run/health
```

### Secrets Management
```bash
# Create/update Modal secrets (required environment variables)
modal secret create agentica-secrets \
  OPENAI_API_KEY=sk-... \
  POSTGRES_URL="postgresql://postgres.[ref]:[password]@aws-0-[region].pooler.supabase.com:6543/postgres?sslmode=require" \
  SUPABASE_URL=https://xxxxx.supabase.co \
  SUPABASE_SERVICE_ROLE_KEY=eyJ... \
  SUPABASE_ANON_KEY=eyJ... \
  ANTHROPIC_API_KEY=sk-ant-...  # Optional
```

**CRITICAL:** ElizaOS requires `POSTGRES_URL` (not `DATABASE_URL`). Must use Supabase Transaction pooler (port 6543, `.pooler.supabase.com` domain) with `?sslmode=require`.

## Architecture Details

### Modal App Structure (`modal_app.py`)

**Three main functions:**

1. **`eliza_server()`** - Long-running ElizaOS container
   - Decorator: `@modal.web_server(port=3000)`
   - Starts ElizaOS with: `bun /app/packages/cli/dist/index.js start`
   - No `--characters` flag - agents added dynamically via API
   - Exposes stable URL: `https://*.modal.run`

2. **`api()`** - FastAPI application with all routes
   - Decorator: `@modal.asgi_app()`
   - Returns FastAPI app instance with routes: `/health`, `/agents`, `/rooms`, `/rooms/{room_id}/messages`
   - Uses `get_eliza_api_url()` from `config.py` to communicate with ElizaOS server
   - Validates requests with Pydantic models (e.g., `CreateAgentRequest`)

3. **`health_check()`** - Utility function for monitoring

### Configuration Module (`config.py`)

**Key functions:**
- `generate_character_config(name, description, advanced_config)` - Converts simple inputs to ElizaOS character JSON
- `get_tunnel_url()` - Retrieves ElizaOS server URL from `ELIZA_SERVER_URL` env var
- `get_eliza_api_url(endpoint)` - Constructs full URL like `https://.../api/agents`
- `create_supabase_client()` - Initializes Supabase with service role key
- `validate_agent_input(name, description, user_id)` - Input validation (3-50 chars name, 10-500 chars description)

### Database Schema (`db/schema.sql`)

**Table: `platform_agents`** (NOT `agents` - that's ElizaOS internal)
- `id` - UUID primary key
- `user_id` - Owner identifier (TEXT, simplified auth for MVP)
- `eliza_agent_id` - ElizaOS agent ID from `/api/agents` response
- `name` - 3-50 characters
- `description` - 10-500 characters
- `character_config` - JSONB (full ElizaOS config)
- `status` - 'active', 'stopped', or 'error'
- `advanced_config` - JSONB (optional overrides)

**Indexes:**
- `idx_platform_agents_user_id` - User queries
- `idx_platform_agents_status` - Status filtering
- `idx_platform_agents_user_status` - Composite
- `idx_platform_agents_eliza_id` - ElizaOS lookups

## API Endpoints

**Base URL:** `https://*.modal.run`

### Agents
- `POST /agents` - Create agent (requires `user_id`, `name`, `description`, optional `advanced_config`)
  - Creates in ElizaOS via `POST /api/agents` with `{"characterJson": {...}}`
  - Starts agent via `POST /api/agents/{id}/start`
  - Stores metadata in Supabase `platform_agents`
- `GET /agents?user_id=xxx` - List user's agents
- `DELETE /agents/{agent_id}?user_id=xxx` - Delete agent (ownership check required)

### Rooms (Week 2)
- `POST /rooms` - Create room with `{"name": "...", "agent_ids": [...]}`
- `GET /rooms?user_id=xxx` - List user's accessible rooms
- `POST /rooms/{room_id}/messages` - Send message with `{"content": "..."}`

## ElizaOS Integration

### Character Configuration Format
ElizaOS expects specific JSON structure (see `generate_character_config()` in `config.py`):
- `name` - Agent name
- `system` - System prompt defining behavior
- `bio` - Array of bio snippets
- `messageExamples` - Array of conversation examples (uses `name` field, not `user`)
- `postExamples` - Example posts
- `topics`, `adjectives`, `style` - Personality configuration
- `plugins` - Hardcoded: `["@elizaos/plugin-sql", "@elizaos/plugin-openai", "@elizaos/plugin-bootstrap"]`
- `settings` - Voice and secrets configuration

### ElizaOS API Communication
- Agent creation: `POST {tunnel_url}/api/agents` with `{"characterJson": character_config}`
- Agent start: `POST {tunnel_url}/api/agents/{id}/start`
- Agent stop: `POST {tunnel_url}/api/agents/{id}/stop`
- Agent delete: `DELETE {tunnel_url}/api/agents/{id}`
- Room creation: `POST {tunnel_url}/api/rooms` with `{"name": "...", "agentIds": [...]}`
- Message submission: `POST {tunnel_url}/api/messaging/submit` with specific payload structure

### Response Format Variations
ElizaOS responses may use different formats - code handles multiple possibilities:
```python
agent_id = (
    response.get("id") or
    response.get("agentId") or
    response.get("data", {}).get("agentId") or
    response.get("data", {}).get("id")
)
```

## Environment Variables

**ElizaOS Container (`eliza_image`):**
- `NODE_ENV=production`
- `NO_UPDATE_CHECK=1`, `SKIP_POSTINSTALL=1` - Faster startup
- `NODE_TLS_REJECT_UNAUTHORIZED=0` - Accept Supabase pooler SSL certs
- `ELIZA_SERVER_URL` - Self-reference for health checks
- `CENTRAL_MESSAGE_SERVER_URL` - **NOT SET** (Modal doesn't support localhost loopback)

**API Container (`api_image`):**
- `ELIZA_SERVER_URL` - ElizaOS server URL for communication

**Required Secrets:**
- `OPENAI_API_KEY` - GPT models
- `POSTGRES_URL` - PostgreSQL connection (ElizaOS naming, not DATABASE_URL)
- `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY` - Database access
- `ANTHROPIC_API_KEY` (optional) - Claude models

## Common Development Patterns

### Adding New API Endpoint
1. Add Pydantic model for request/response in `modal_app.py` (lines 45-104)
2. Add route to `api()` function (inside FastAPI app)
3. Use `get_eliza_api_url(endpoint)` to communicate with ElizaOS
4. Use `create_supabase_client()` for database operations
5. Wrap ElizaOS calls in try/except with appropriate HTTPException

### Database Operations
```python
supabase = create_supabase_client()
result = supabase.table("platform_agents").select("*").eq("user_id", user_id).execute()
agents = result.data or []
```

### ElizaOS API Calls
```python
create_url = get_eliza_api_url("/api/agents")
response = requests.post(
    create_url,
    json={"characterJson": character_config},
    headers={"Content-Type": "application/json"},
    timeout=30
)
```

## Troubleshooting

### "ElizaOS process exited with code 1"
- **Cause:** Database connection failure
- **Fix:** Verify `POSTGRES_URL` (not `DATABASE_URL`) is set correctly in Modal secrets
- **Format:** Must use Supabase Transaction pooler (port 6543, `.pooler.supabase.com`, `?sslmode=require`)

### "BYPASS: No database configuration found, defaulting to pglite"
- **Cause:** ElizaOS not detecting PostgreSQL
- **Fix:** Environment variable must be named `POSTGRES_URL` (ElizaOS requirement)

### "self signed certificate in certificate chain"
- **Handled:** `NODE_TLS_REJECT_UNAUTHORIZED=0` in `eliza_image` env (line 140)
- **Note:** Connection still uses SSL, only disables cert chain verification

### "Tunnel URL not found"
- **Cause:** ElizaOS server not deployed
- **Fix:** `modal deploy backend/modal_app.py`

### "Failed to communicate with ElizaOS"
- **Debug:** Check logs with `modal app logs agentica-platform`
- **Verify:** ElizaOS server is running and `ELIZA_SERVER_URL` is correct

## Testing

### Create Test Agent
```bash
curl -X POST https://*.modal.run/agents \
  -H "Content-Type: application/json" \
  -d '{
    "user_id": "test-user-123",
    "name": "TestBot",
    "description": "A test agent for development and debugging purposes"
  }'
```

### Verify Database
Check Supabase SQL Editor:
```sql
SELECT id, name, eliza_agent_id, status FROM platform_agents;
```

## File Organization

```
backend/
├── modal_app.py           # Main Modal application (1249 lines)
│   ├── Pydantic models (lines 46-104)
│   ├── eliza_server() - ElizaOS container (lines 185-398)
│   ├── api() - FastAPI app (lines 447-1218)
│   └── health_check() (lines 404-440)
├── config.py              # Utilities and configuration (347 lines)
│   ├── Character config generator (lines 173-319)
│   ├── Tunnel URL management (lines 31-72)
│   ├── Supabase client (lines 78-106)
│   └── Input validation (lines 112-167)
├── db/
│   ├── schema.sql         # Supabase table definitions
│   └── migrate_rename_agents.sql  # Migration from 'agents' to 'platform_agents'
└── requirements.txt       # Python dependencies (modal, fastapi, requests, supabase)
```

## Key Constraints

1. **Single ElizaOS instance:** `max_containers=1` for prototype (line 194 in `modal_app.py`)
2. **24-hour timeout:** ElizaOS server has 86400s timeout (line 191)
3. **Table naming:** Must use `platform_agents` (not `agents`) to avoid ElizaOS conflict
4. **Environment variable naming:** ElizaOS requires `POSTGRES_URL` (not `DATABASE_URL`)
5. **No localhost loopback:** Modal's `@web_server` doesn't support 127.0.0.1 access between functions
