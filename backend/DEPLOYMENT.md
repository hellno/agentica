# Deployment Guide - AI Agent Launchpad (Week 1)

This guide walks you through deploying the Week 1 infrastructure for the AI Agent Launchpad.

**Note:** All commands should be run from the repository root directory (`/path/to/agentica/`).

## Prerequisites

1. **Modal Account**
   - Sign up at https://modal.com
   - Install Modal CLI: `pip install modal`
   - Authenticate: `modal token new`

2. **Supabase Project**
   - Create project at https://supabase.com
   - Note your project URL and keys

3. **API Keys**
   - OpenAI API key (required)
   - Anthropic API key (optional)

## Step 1: Set Up Supabase Database

1. Go to your Supabase project's SQL Editor
2. Run the SQL schema from `backend/db/schema.sql`
3. Verify the `agents` table was created

## Step 2: Configure Modal Secrets

Create a Modal secret named `agentica-secrets` with the following environment variables:

### Get Your Supabase Database URL

ElizaOS requires a PostgreSQL connection string via the **`POSTGRES_URL`** environment variable (not `DATABASE_URL`).

**IMPORTANT:** You must use Supabase's **Transaction pooler** for external connections.

1. Go to your Supabase project settings
2. Navigate to **Database** → **Connection string**
3. Select **Connection pooling** tab (NOT the "URI" tab)
4. Choose **Transaction** mode
5. Copy the connection string - it should look like:
   ```
   postgresql://postgres.[project-ref]:[password]@aws-0-[region].pooler.supabase.com:6543/postgres
   ```
6. Replace `[password]` with your actual database password
7. **Add SSL mode** to the end: `?sslmode=require`

**Final format:**
```
postgresql://postgres.[project-ref]:[password]@aws-0-[region].pooler.supabase.com:6543/postgres?sslmode=require
```

**Key differences from standard PostgreSQL:**
- Uses `.pooler.supabase.com` domain (connection pooling)
- Port `6543` (NOT 5432)
- Must include `?sslmode=require` for SSL connections
- **Environment variable must be named `POSTGRES_URL`** (ElizaOS won't recognize `DATABASE_URL`)

### Create the Modal Secret

```bash
modal secret create agentica-secrets \
  OPENAI_API_KEY=sk-... \
  POSTGRES_URL="postgresql://postgres.[project-ref]:[password]@aws-0-[region].pooler.supabase.com:6543/postgres?sslmode=require" \
  SUPABASE_URL=https://xxxxx.supabase.co \
  SUPABASE_SERVICE_ROLE_KEY=eyJ... \
  SUPABASE_ANON_KEY=eyJ... \
  ANTHROPIC_API_KEY=sk-ant-...  # Optional
```

**Note:** The POSTGRES_URL is in quotes because it contains special characters (`?`). **Do not use `DATABASE_URL`** - ElizaOS specifically looks for `POSTGRES_URL`.

Or use the Modal web interface:
1. Go to https://modal.com/secrets
2. Create new secret named `agentica-secrets`
3. Add the environment variables above

**Required variables:**
- `OPENAI_API_KEY`: Your OpenAI API key
- `POSTGRES_URL`: PostgreSQL connection string from Supabase (ElizaOS specifically uses this name, not DATABASE_URL!)
- `SUPABASE_URL`: Your Supabase project URL
- `SUPABASE_SERVICE_ROLE_KEY`: Your Supabase service role key

**Optional variables:**
- `SUPABASE_ANON_KEY`: Supabase anonymous key (for future frontend)
- `ANTHROPIC_API_KEY`: Anthropic API key (if using Claude models)

**Important:** ElizaOS will fall back to `pglite` (local SQLite-like database) if `POSTGRES_URL` is not set. You won't see tables in Supabase without this variable.

## Step 3: Deploy the Platform

Deploy the complete platform (ElizaOS server + API endpoints) with a single command:

```bash
modal deploy backend/modal_app.py
```

This will:
- Start ElizaOS in a Modal container
- Expose it via a Modal tunnel
- Store the tunnel URL in Modal.Dict
- Deploy all API endpoints
- Keep the server running 24/7

**Note:** The first deployment may take a few minutes as it pulls the ElizaOS Docker image.

## Step 4: Get Your API URL

After deployment, Modal will display your endpoint URL:

```
✓ Created ASGI app api => https://YOUR_ORG--agentica-platform-api.modal.run
```

This is your **single base URL** for all API endpoints. The new architecture uses a unified FastAPI application with multiple routes instead of separate web endpoints.

**Available routes:**
- `GET  /health` - Health check
- `POST /agents` - Create a new agent
- `GET  /agents?user_id=xxx` - List user's agents
- `DELETE /agents/{agent_id}?user_id=xxx` - Delete an agent

Save this base URL - you'll need it to interact with the API.

## Step 5: Verify Deployment

Test that everything is working:

```bash
# Check ElizaOS server status
modal run backend/modal_app.py

# Check API health (note the new route structure)
curl https://YOUR_ORG--agentica-platform-api.modal.run/health
```

## Testing the API

**Base URL:** `https://YOUR_ORG--agentica-platform-api.modal.run`

### Create an Agent

```bash
curl -X POST https://YOUR_ORG--agentica-platform-api.modal.run/agents \
  -H "Content-Type: application/json" \
  -d '{
    "user_id": "test-user-123",
    "name": "SupportBot",
    "description": "A friendly AI agent that helps users with technical support questions and troubleshooting"
  }'
```

Expected response:
```json
{
  "success": true,
  "agent": {
    "id": "550e8400-e29b-41d4-a716-446655440000",
    "eliza_agent_id": "agent_abc123",
    "name": "SupportBot",
    "description": "A friendly AI agent...",
    "status": "active",
    "created_at": "2025-01-13T10:30:00Z"
  }
}
```

### List Agents

```bash
curl "https://YOUR_ORG--agentica-platform-api.modal.run/agents?user_id=test-user-123"
```

Expected response:
```json
{
  "success": true,
  "agents": [
    {
      "id": "550e8400-e29b-41d4-a716-446655440000",
      "eliza_agent_id": "agent_abc123",
      "name": "SupportBot",
      "description": "A friendly AI agent...",
      "status": "active",
      "created_at": "2025-01-13T10:30:00Z",
      "updated_at": "2025-01-13T10:30:00Z"
    }
  ],
  "count": 1
}
```

### Delete an Agent

```bash
curl -X DELETE "https://YOUR_ORG--agentica-platform-api.modal.run/agents/550e8400-e29b-41d4-a716-446655440000?user_id=test-user-123"
```

Expected response:
```json
{
  "success": true,
  "agent_id": "550e8400-e29b-41d4-a716-446655440000",
  "message": "Agent deleted successfully"
}
```

## Monitoring and Debugging

### View Logs

```bash
# View all platform logs (server + API)
modal app logs agentica-platform
```

### Check Tunnel URL

```bash
modal run backend/modal_app.py
```

This will display the current tunnel URL and server status.

### Common Issues

**Problem:** "ElizaOS process exited with code 1" or "Database connection failed: Failed to connect"

**Solution:** This means ElizaOS can't connect to PostgreSQL. Most common causes:

1. **Wrong environment variable name** - ElizaOS uses `POSTGRES_URL`, not `DATABASE_URL`
2. **Wrong connection string format** - Must use Supabase's Transaction pooler

**Fix:**
1. Verify you're using **`POSTGRES_URL`** (not `DATABASE_URL`)
2. Verify you're using the **Transaction pooler** URL (NOT the direct connection URL):
   - ✅ Correct: `postgresql://postgres.[ref]:[password]@aws-0-[region].pooler.supabase.com:6543/postgres?sslmode=require`
   - ❌ Wrong: `postgresql://postgres.[ref]:[password]@db.[ref].supabase.co:5432/postgres`

3. Key requirements:
   - Environment variable must be named `POSTGRES_URL`
   - Must use `.pooler.supabase.com` domain
   - Must use port `6543` (NOT 5432)
   - Must include `?sslmode=require` at the end

4. Update your Modal secret:
   ```bash
   # Delete old secret
   modal secret delete agentica-secrets

   # Create new secret with correct POSTGRES_URL
   modal secret create agentica-secrets \
     OPENAI_API_KEY=sk-... \
     POSTGRES_URL="postgresql://postgres.[project-ref]:[password]@aws-0-[region].pooler.supabase.com:6543/postgres?sslmode=require" \
     SUPABASE_URL=https://xxxxx.supabase.co \
     SUPABASE_SERVICE_ROLE_KEY=eyJ...
   ```

5. Redeploy: `modal deploy backend/modal_app.py`

**Problem:** "BYPASS: No database configuration found, defaulting to pglite"

**Solution:** This means ElizaOS isn't detecting your PostgreSQL connection. The issue is almost always that you set `DATABASE_URL` instead of `POSTGRES_URL`. ElizaOS specifically looks for `POSTGRES_URL`. Update your Modal secret to use the correct variable name (see above).

**Problem:** "Database connection failed: self signed certificate in certificate chain"

**Solution:** This is an SSL certificate verification issue with Supabase's connection pooler. The application is configured to handle this by setting `NODE_TLS_REJECT_UNAUTHORIZED=0` in the Docker image environment variables (line 110 in `modal_app.py`). This tells Node.js to accept Supabase's pooler SSL certificates without strict validation.

If you're still seeing this error:
1. Verify the `modal_app.py` has `NODE_TLS_REJECT_UNAUTHORIZED: "0"` in the `eliza_image` env block
2. Redeploy to ensure the updated image is used: `modal deploy backend/modal_app.py`

**Note:** The connection is still encrypted with SSL. We're only disabling certificate chain verification, which is necessary for Supabase's pooler in containerized environments.

**Problem:** "Tunnel URL not found" error

**Solution:** ElizaOS server may not be running. Deploy it:
```bash
modal deploy backend/modal_app.py
```

**Problem:** "Failed to communicate with ElizaOS server"

**Solution:** Check platform logs for errors:
```bash
modal app logs agentica-platform
```

**Problem:** "Failed to query database"

**Solution:**
1. Verify Supabase credentials in Modal secrets
2. Ensure database schema is created
3. Check Supabase logs for connection errors

## Architecture Overview

### New Single FastAPI Application Design

The platform now uses a **single FastAPI application** with multiple routes instead of separate Modal web endpoints. This provides:

- **Single base URL** for all API operations
- **Better route management** with FastAPI decorators
- **Middleware support** for error handling, logging, etc.
- **Automatic API documentation** via FastAPI (OpenAPI/Swagger)
- **No Modal endpoint limits** - unlimited routes in one app

```
┌─────────────────┐
│   Client/User   │
└────────┬────────┘
         │
         ▼
┌────────────────────────────────────────────────┐
│   Agentica Platform (backend/modal_app.py)     │
│                                                 │
│   ┌─────────────────────────────────────┐      │
│   │  FastAPI App (@modal.asgi_app)      │      │
│   │  Base: /api                          │      │
│   │                                      │      │
│   │  Routes:                             │      │
│   │  - GET  /health                      │      │
│   │  - POST /agents                      │      │
│   │  - GET  /agents?user_id=xxx          │      │
│   │  - DELETE /agents/{id}?user_id=xxx   │      │
│   └─────────────────────────────────────┘      │
│                                                 │
│   ┌─────────────────────────────────────┐      │
│   │  ElizaOS Server                      │      │
│   │  (@modal.web_server)                 │      │
│   │  Port: 3000                          │      │
│   └─────────────────────────────────────┘      │
└───────┬─────────────────────────────────────────┘
        │
        ├─────────────────┐
        │                 │
        ▼                 ▼
┌──────────────┐   ┌──────────────┐
│   Supabase   │   │ Modal.Dict   │
│   Database   │   │              │
│              │   │ - Tunnel URL │
│  - agents    │   │   Storage    │
│    table     │   │              │
└──────────────┘   └──────────────┘
```

### Key Architecture Changes

**Before (Week 1 original):**
- Multiple `@modal.web_endpoint()` decorators
- Each endpoint had its own URL
- Limited by Modal's endpoint count restrictions
- No shared middleware or exception handling

**After (Refactored):**
- Single `@modal.asgi_app()` with FastAPI
- One base URL with multiple routes
- Unlimited routes in one application
- Shared exception handlers and middleware
- Automatic OpenAPI documentation
- Better request validation with Pydantic models

## Cost Estimates

**Modal:**
- ElizaOS server: ~$0.50-2.00/day (depending on usage)
- API endpoints: Pay-per-use (very low cost for development)
- Free tier: $30/month credit

**Supabase:**
- Free tier: 500MB database, 2GB bandwidth
- Should be sufficient for Week 1 testing

**APIs:**
- OpenAI: ~$0.002 per agent conversation
- Anthropic (optional): ~$0.008 per agent conversation

## Next Steps (Week 2)

Week 2 will add:
- Room/channel management
- Multi-agent chatrooms
- Message routing between agents
- WebSocket support for real-time updates

## Support

For issues or questions:
1. Check Modal logs: `modal app logs <app-name>`
2. Verify secrets are configured correctly
3. Test ElizaOS server is running: `modal run backend/modal_app.py`
4. Review Supabase logs for database issues

## Production Considerations

Before going to production:

1. **Security:**
   - Enable Supabase Row Level Security (RLS)
   - Add proper authentication (replace user_id strings)
   - Use API rate limiting
   - Add request validation middleware

2. **Monitoring:**
   - Set up error alerts in Modal
   - Monitor Supabase performance
   - Track API usage and costs

3. **Scaling:**
   - Increase ElizaOS container resources if needed
   - Consider multiple ElizaOS instances for high availability
   - Enable Supabase connection pooling

4. **Backups:**
   - Enable Supabase automatic backups
   - Back up Modal volumes regularly
