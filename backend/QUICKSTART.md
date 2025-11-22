# Quick Start Guide - AI Agent Launchpad

Get up and running with the AI Agent Launchpad in 5 minutes.

**Note:** All commands should be run from the repository root directory (`/path/to/agentica/`).

## Prerequisites

```bash
# Install Modal
pip install modal

# Authenticate with Modal
modal token new

# Verify installation
modal --version
```

## Setup (One-Time)

### 1. Configure Secrets

```bash
modal secret create agentica-secrets \
  OPENAI_API_KEY=sk-your-key-here \
  SUPABASE_URL=https://xxxxx.supabase.co \
  SUPABASE_SERVICE_ROLE_KEY=eyJ... \
  SUPABASE_ANON_KEY=eyJ...
```

### 2. Set Up Database

1. Go to your Supabase SQL Editor
2. Copy and paste the contents of `backend/db/schema.sql`
3. Run the SQL to create the `agents` table

### 3. Deploy

```bash
# Deploy the complete platform (server + API endpoints)
modal deploy backend/modal_app.py
```

## Usage

**Base API URL:** `https://YOUR_ORG--agentica-platform-api.modal.run`

All endpoints are now under a single FastAPI application.

### Create Your First Agent

```bash
curl -X POST https://YOUR_ORG--agentica-platform-api.modal.run/agents \
  -H "Content-Type: application/json" \
  -d '{
    "user_id": "my-user-id",
    "name": "MyFirstAgent",
    "description": "A helpful AI assistant that answers questions and provides information"
  }'
```

### List Your Agents

```bash
curl "https://YOUR_ORG--agentica-platform-api.modal.run/agents?user_id=my-user-id"
```

### Delete an Agent

```bash
curl -X DELETE "https://YOUR_ORG--agentica-platform-api.modal.run/agents/AGENT_ID?user_id=my-user-id"
```

## What's Included

### Week 1 Features

- **Dynamic Agent Creation**: Create AI agents on-the-fly without server restarts
- **ElizaOS Integration**: Full ElizaOS backend running on Modal
- **Persistent Storage**: Agents stored in Supabase database
- **RESTful API**: Clean HTTP endpoints for all operations
- **Error Handling**: Comprehensive validation and error responses

### Project Structure

```
agentica/
├── backend/
│   ├── modal_app.py        # Unified Modal app (ElizaOS server + API endpoints)
│   ├── config.py           # Configuration and utilities
│   ├── db/
│   │   └── schema.sql      # Supabase database schema
│   ├── DEPLOYMENT.md       # Full deployment guide
│   ├── QUICKSTART.md       # This file
│   └── requirements.txt    # Python dependencies
├── frontend/               # NextJS app (to be added)
└── docs/                   # Documentation
```

## Key Concepts

### Agent Creation Flow

1. **User submits**: name + description
2. **API generates**: Full ElizaOS character config
3. **ElizaOS creates**: Agent instance via REST API
4. **Agent starts**: Immediately active (no restart)
5. **Metadata stored**: In Supabase for queries

### Modal.Dict for Configuration

The ElizaOS server tunnel URL is stored in Modal.Dict, allowing API endpoints to discover and communicate with the running server without a database.

```python
# Server stores tunnel URL on startup
tunnel_dict = modal.Dict.from_name("agentica-config")
tunnel_dict["tunnel_url"] = tunnel.url

# API retrieves tunnel URL
tunnel_url = get_tunnel_url()  # from config.py
```

## Advanced Usage

### Custom Agent Configuration

You can provide advanced configuration options:

```bash
curl -X POST https://YOUR_ORG--agentica-platform-api.modal.run/agents \
  -H "Content-Type: application/json" \
  -d '{
    "user_id": "my-user-id",
    "name": "AdvancedBot",
    "description": "A specialized AI agent",
    "advanced_config": {
      "model_provider": "anthropic",
      "topics": ["technology", "science", "programming"],
      "adjectives": ["analytical", "precise", "thorough"],
      "style": {
        "all": ["be technical and detailed", "use examples"],
        "chat": ["ask follow-up questions"]
      }
    }
  }'
```

## Monitoring

### View Logs

```bash
# View all platform logs (server + API)
modal app logs agentica-platform
```

### Check Status

```bash
# Verify ElizaOS is running
modal run backend/modal_app.py

# Health check (new unified API)
curl https://YOUR_ORG--agentica-platform-api.modal.run/health
```

## Troubleshooting

| Issue | Solution |
|-------|----------|
| "Tunnel URL not found" | Deploy the platform: `modal deploy backend/modal_app.py` |
| "Failed to communicate with ElizaOS" | Check platform logs: `modal app logs agentica-platform` |
| "Failed to query database" | Verify Supabase credentials in Modal secrets |
| Agent creation fails | Check that database schema is created in Supabase |

## Next Steps

1. **Test the API**: Create, list, and delete test agents
2. **Integrate**: Connect your frontend or other services
3. **Monitor**: Watch logs to see agents in action
4. **Read Week 2 PRD**: Plan for chatroom features (coming soon)

## Get Help

- Check `backend/DEPLOYMENT.md` for detailed deployment instructions
- Review code comments in `backend/config.py` and `backend/modal_app.py`
- Check Modal dashboard for resource usage and logs
- Review Supabase dashboard for database queries

## What's Next (Week 2)

- Multi-agent chatrooms
- Real-time message routing
- WebSocket support
- Channel management
- Agent-to-agent communication

---

Happy building! 🚀
