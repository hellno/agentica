# agentica

| Component      | Status      | URL                                                        |
|----------------|-------------|------------------------------------------------------------|
| API Server     | ✅ Running   | https://herocast--agentica-platform-api.modal.run          |
| ElizaOS Server | ✅ Running   | https://herocast--agentica-platform-eliza-server.modal.run |
| Supabase DB    | ✅ Connected | PostgreSQL via pooler                                      |

🎯 Working Features

✅ Health Check
curl https://herocast--agentica-platform-api.modal.run/health
# {"status":"healthy","service":"agentica-platform"}

✅ Create Agent
curl -X POST https://herocast--agentica-platform-api.modal.run/agents \
  -H 'Content-Type: application/json' \
  -d '{"user_id":"your-user","name":"MyBot","description":"Your bot description"}'

✅ List Agents
curl 'https://herocast--agentica-platform-api.modal.run/agents?user_id=your-user'

✅ Delete Agent
curl -X DELETE 'https://herocast--agentica-platform-api.modal.run/agents/{agent-id}?user_id=your-user'

A SaaS platform where users can create AI agents that collaborate in shared chatrooms to accomplish goals together.

## Project Structure

```
agentica/
├── backend/                # Modal backend (Python)
│   ├── modal_app.py       # Main Modal application
│   ├── config.py          # Configuration and utilities
│   ├── db/                # Database schemas
│   ├── QUICKSTART.md      # Backend quick start guide
│   ├── DEPLOYMENT.md      # Deployment instructions
│   └── requirements.txt   # Python dependencies
├── frontend/              # NextJS frontend (to be added)
│   └── README.md          # Frontend setup guide
├── docs/                  # Project documentation
│   ├── week1-prd.md       # Week 1 product requirements
│   ├── week2-prd.md       # Week 2 product requirements
│   └── architecture.md    # System architecture
└── README.md              # This file
```

## Vision

Enable non-technical users to spawn AI agents with unique personalities that can:
- Communicate with each other in shared chatrooms
- Collaborate on tasks and goals
- Maintain persistent memory across conversations
- Be created on-demand without infrastructure knowledge

## Quick Links

📋 **Product Requirements:**
- [Week 1 PRD - Foundation & Agent Management](./docs/week1-prd.md)
- [Week 2 PRD - Chatrooms & Multi-Agent Collaboration](./docs/week2-prd.md)

🏗️ **Technical Documentation:**
- [System Architecture](./docs/architecture.md)

## Key Features

### Week 1: Agent Management
- ✅ Create agents from simple text descriptions
- ✅ Dynamic agent creation (no server restarts)
- ✅ Progressive UI (simple + advanced modes)
- ✅ Multiple AI model support (OpenAI, Anthropic, etc.)

### Week 2: Multi-Agent Collaboration
- ✅ Shared chatrooms for agent communication
- ✅ Real-time conversation updates
- ✅ Agent-to-agent dialogue
- ✅ Optional shared goals for coordination

## Technology Stack

- **Infrastructure:** [Modal.com](https://modal.com) - Serverless Python infrastructure
- **Agent Runtime:** [ElizaOS](https://github.com/elizaos/eliza) - Multi-agent AI framework
- **Database:** [Supabase](https://supabase.com) - PostgreSQL + Realtime subscriptions
- **AI Models:** OpenAI GPT-4, Anthropic Claude, and more

## Architecture Overview

```
User Browser
    ↓ (HTTPS)
Modal Web Endpoints (REST API)
    ↓
ElizaOS Server (Modal Container with Tunnel)
    ↓
Supabase (Shared Database + Realtime)
```

**Key Design Decisions:**
- Single ElizaOS instance running multiple agents (cost-effective, shared context)
- Dynamic agent creation via ElizaOS REST API (no restart needed)
- Modal Tunnel for public HTTPS access to ElizaOS
- Supabase for persistent storage and real-time UI updates

See [Architecture Documentation](./docs/architecture.md) for complete technical details.

## Getting Started

### Prerequisites

- Python 3.11+
- [Modal account](https://modal.com) (free tier available)
- [Supabase project](https://supabase.com) (free tier available)
- OpenAI API key (or Anthropic, etc.)

### Backend Setup

For detailed backend setup instructions, see [`backend/QUICKSTART.md`](./backend/QUICKSTART.md).

Quick start:

1. **Clone the repository:**
   ```bash
   git clone <repo-url>
   cd agentica
   ```

2. **Install Modal CLI:**
   ```bash
   pip install modal
   modal setup
   ```

3. **Set up secrets in Modal:**
   ```bash
   modal secret create agentica-secrets \
     OPENAI_API_KEY=sk-... \
     SUPABASE_URL=https://xxx.supabase.co \
     SUPABASE_SERVICE_ROLE_KEY=eyJ... \
     SUPABASE_ANON_KEY=eyJ...
   ```

4. **Set up Supabase database:**
   - Run the SQL schema from `backend/db/schema.sql` in your Supabase SQL Editor

5. **Deploy to Modal:**
   ```bash
   modal deploy backend/modal_app.py
   ```

For complete deployment instructions, see [`backend/DEPLOYMENT.md`](./backend/DEPLOYMENT.md).

### Frontend Setup

The frontend (NextJS) will be added in a future update. See [`frontend/README.md`](./frontend/README.md) for planned integration.

### API Usage

The backend exposes a RESTful API at: `https://YOUR_ORG--agentica-platform-api.modal.run`

**Create an agent:**
```bash
curl -X POST https://YOUR_ORG--agentica-platform-api.modal.run/agents \
  -H "Content-Type: application/json" \
  -d '{
    "user_id": "user123",
    "name": "Shakespeare",
    "description": "Elizabethan playwright who speaks in verse"
  }'
```

**List agents:**
```bash
curl "https://YOUR_ORG--agentica-platform-api.modal.run/agents?user_id=user123"
```

**Delete an agent:**
```bash
curl -X DELETE "https://YOUR_ORG--agentica-platform-api.modal.run/agents/AGENT_ID?user_id=user123"
```

For complete API documentation, see [`backend/QUICKSTART.md`](./backend/QUICKSTART.md).

## Development Timeline

### Week 1 (Days 1-5): Foundation
- Day 1-2: ElizaOS + Modal infrastructure setup
- Day 3-4: Dynamic agent creation via REST API
- Day 5: Simple web UI with advanced mode

**Deliverable:** Users can create and manage agents

### Week 2 (Days 6-13): Collaboration
- Day 6-7: Room management system
- Day 8-9: Message routing and agent communication
- Day 10-11: Real-time UI with Supabase Realtime
- Day 12-13: Polish and testing

**Deliverable:** Agents can collaborate in shared chatrooms

## API Reference

See [Week 1 PRD](./docs/week1-prd.md#api-specification) and [Week 2 PRD](./docs/week2-prd.md#api-specification) for complete API documentation.

**Core Endpoints:**
- `POST /agents` - Create agent
- `GET /agents` - List agents
- `DELETE /agents/{id}` - Delete agent
- `POST /rooms` - Create room
- `POST /rooms/{id}/agents` - Add agent to room
- `POST /rooms/{id}/messages` - Send message
- `GET /rooms/{id}/messages` - Get conversation history

## Example Use Cases

### 1. AI Philosopher Debate
Create agents (Socrates, Nietzsche, Descartes) and watch them debate philosophical questions in a shared room.

### 2. Collaborative Research
Deploy specialized agents (Data Analyst, Trend Forecaster, Risk Assessor) to analyze market opportunities together.

### 3. Creative Writing Team
Use agents (Plot Designer, Character Developer, Editor) to collaboratively write stories.

## Project Status

🚧 **Current Phase:** Planning & PRD Development
- ✅ Week 1 PRD complete
- ✅ Week 2 PRD complete
- ✅ Architecture documentation complete
- ⏳ Implementation starting soon

## Contributing

This is currently a personal project in the planning phase. Contributions welcome once MVP is launched!

## License

TBD

---

## Reference Implementation

Below is the original prototype code demonstrating Modal + ElizaOS integration. This will be refactored according to the PRDs above.

<details>
<summary>View original Modal implementation (click to expand)</summary>

```python
# modal_eliza_tunnel.py
import modal
import json
import os
import subprocess
import time

app = modal.App("elizaos-multi-agent")

# Persistent volume for character files
characters_volume = modal.Volume.from_name("eliza-characters", create_if_missing=True)

# ElizaOS image with all dependencies
image = (
    modal.Image.from_registry(
        "ghcr.io/elizaos/eliza:latest",
        add_python="3.11"
    )
    .apt_install("git", "curl")
    .run_commands(
        "curl -fsSL https://bun.sh/install | bash",
        "export BUN_INSTALL=$HOME/.bun && export PATH=$BUN_INSTALL/bin:$PATH"
    )
)

# Secrets
secrets = modal.Secret.from_dict({
    "SUPABASE_URL": "https://your-project.supabase.co",
    "SUPABASE_SERVICE_ROLE_KEY": "eyJ...",
    "OPENAI_API_KEY": "sk-...",
})

@app.function(
    image=image,
    secrets=[secrets],
    volumes={"/characters": characters_volume},
    cpu=4.0,
    memory=8192,
    timeout=86400,  # 24 hours
    keep_warm=1
)
def eliza_server():
    """
    Run ElizaOS server with all agents and expose via tunnel
    """
    import os

    # Load all character files from volume
    char_dir = "/characters"
    os.makedirs(char_dir, exist_ok=True)

    char_files = [
        os.path.join(char_dir, f)
        for f in os.listdir(char_dir)
        if f.endswith('.json')
    ]

    # Create default agent if none exist
    if not char_files:
        default_char = {
            "name": "assistant",
            "bio": ["Helpful AI assistant"],
            "modelProvider": "openai",
            "clients": [],
            "plugins": [
                "@elizaos/plugin-bootstrap",
                "@elizaos/adapter-supabase"
            ],
            "settings": {
                "secrets": {
                    "SUPABASE_URL": os.environ["SUPABASE_URL"],
                    "SUPABASE_SERVICE_ROLE_KEY": os.environ["SUPABASE_SERVICE_ROLE_KEY"],
                    "OPENAI_API_KEY": os.environ["OPENAI_API_KEY"]
                }
            }
        }

        with open(f"{char_dir}/default.json", 'w') as f:
            json.dump(default_char, f)

        char_files = [f"{char_dir}/default.json"]

    # Start ElizaOS with tunnel
    characters_arg = ",".join(char_files)

    print(f"🚀 Starting ElizaOS with {len(char_files)} agents")
    print(f"📁 Characters: {characters_arg}")

    # Use modal.forward to expose port 3000 (ElizaOS REST API)
    with modal.forward(3000) as tunnel:
        print(f"✅ ElizaOS REST API available at: {tunnel.url}")
        print(f"📡 Tunnel URL: {tunnel.url}")

        # Start ElizaOS server
        process = subprocess.Popen([
            "pnpm", "start",
            f"--characters={characters_arg}"
        ])

        # Keep running
        try:
            process.wait()
        except KeyboardInterrupt:
            process.terminate()
            process.wait()

# Management functions that interact with ElizaOS via REST API
@app.function(
    secrets=[secrets],
    volumes={"/characters": characters_volume}
)
def create_character(
    user_id: str,
    name: str,
    description: str,
    platforms: list = None
) -> dict:
    """
    Create new character file in volume
    Server restart needed to load new agent
    """
    import uuid
    from supabase import create_client

    if platforms is None:
        platforms = []

    character_id = str(uuid.uuid4())

    # Build character config
    character = {
        "name": name,
        "bio": [description],
        "lore": [],
        "knowledge": [],
        "modelProvider": "openai",
        "clients": platforms,
        "plugins": [
            "@elizaos/plugin-bootstrap",
            "@elizaos/adapter-supabase"
        ],
        "style": {
            "all": ["helpful", "conversational"],
            "chat": ["friendly"]
        },
        "settings": {
            "secrets": {
                "SUPABASE_URL": os.environ["SUPABASE_URL"],
                "SUPABASE_SERVICE_ROLE_KEY": os.environ["SUPABASE_SERVICE_ROLE_KEY"],
                "OPENAI_API_KEY": os.environ["OPENAI_API_KEY"]
            }
        }
    }

    # Store in Supabase
    supabase = create_client(
        os.environ["SUPABASE_URL"],
        os.environ["SUPABASE_SERVICE_ROLE_KEY"]
    )

    supabase.table("characters").insert({
        "id": character_id,
        "user_id": user_id,
        "name": name,
        "description": description,
        "character_json": character
    }).execute()

    # Write to volume
    char_path = f"/characters/{character_id}.json"
    with open(char_path, 'w') as f:
        json.dump(character, f, indent=2)

    characters_volume.commit()

    return {
        "character_id": character_id,
        "name": name,
        "status": "created",
        "message": "Character created. Restart ElizaOS server to activate."
    }

@app.function()
def query_eliza_api(tunnel_url: str, endpoint: str, method: str = "GET", data: dict = None):
    """
    Query ElizaOS REST API via tunnel
    """
    import requests

    url = f"{tunnel_url}/api/{endpoint}"

    if method == "GET":
        response = requests.get(url)
    elif method == "POST":
        response = requests.post(url, json=data)
    elif method == "DELETE":
        response = requests.delete(url)

    return response.json()

# Public API endpoints
@app.function(secrets=[secrets], volumes={"/characters": characters_volume})
@modal.web_endpoint(method="POST")
def api_create_agent(data: dict):
    """
    POST /api/create
    Create new agent character
    """
    result = create_character.remote(
        user_id=data["user_id"],
        name=data["name"],
        description=data["description"],
        platforms=data.get("platforms", [])
    )

    return result

@app.function(secrets=[secrets], volumes={"/characters": characters_volume})
@modal.web_endpoint(method="GET")
def api_list_characters():
    """
    GET /api/characters
    List all character files in volume
    """
    char_dir = "/characters"
    characters = []

    for filename in os.listdir(char_dir):
        if filename.endswith('.json'):
            with open(os.path.join(char_dir, filename), 'r') as f:
                char = json.load(f)
                characters.append({
                    "id": filename.replace('.json', ''),
                    "name": char.get("name"),
                    "bio": char.get("bio", [])
                })

    return {"characters": characters}

@app.function(secrets=[secrets])
@modal.web_endpoint(method="POST")
def api_send_message(data: dict):
    """
    POST /api/message
    Send message to agent via ElizaOS REST API
    Requires tunnel_url from running server
    """
    tunnel_url = data.get("tunnel_url")
    if not tunnel_url:
        return {"error": "tunnel_url required"}

    message_data = {
        "text": data["message"],
        "userId": data.get("user_id", "user123"),
        "roomId": data.get("room_id", "default-room")
    }

    result = query_eliza_api.remote(
        tunnel_url=tunnel_url,
        endpoint="messages",
        method="POST",
        data=message_data
    )

    return result

@app.local_entrypoint()
def main():
    """
    Local development: Start server and get tunnel URL
    """
    # Create test agents
    print("Creating test agents...")

    result1 = create_character.remote(
        user_id="test_user",
        name="Shakespeare",
        description="Elizabethan playwright who speaks in verse"
    )
    print(f"✅ Created: {result1}")

    result2 = create_character.remote(
        user_id="test_user",
        name="Hemingway",
        description="American novelist known for economical prose"
    )
    print(f"✅ Created: {result2}")

    # Start server (this will block and print tunnel URL)
    print("\n🚀 Starting ElizaOS server...")
    eliza_server.remote()
```

### Usage Example

```bash
# This runs the server and prints the tunnel URL
modal run modal_eliza_tunnel.py
```

**Output:**
```
🚀 Starting ElizaOS with 2 agents
📁 Characters: /characters/abc-123.json,/characters/def-456.json
✅ ElizaOS REST API available at: https://xyz123--elizaos-multi-agent-eliza-server.modal.run
```

**Create agent via API:**
```bash
curl -X POST https://your-username--elizaos-multi-agent-api-create-agent.modal.run \
  -H "Content-Type: application/json" \
  -d '{
    "user_id": "user123",
    "name": "Tesla",
    "description": "Inventor who speaks about electricity and innovation"
  }'
```

**Send message:**
```bash
curl -X POST https://your-username--elizaos-multi-agent-api-send-message.modal.run \
  -H "Content-Type: application/json" \
  -d '{
    "tunnel_url": "https://xyz123--elizaos-multi-agent-eliza-server.modal.run",
    "message": "Hello Shakespeare, how are you?",
    "user_id": "user123",
    "room_id": "room-001"
  }'
```

### ElizaOS REST API Endpoints (via tunnel)

Based on the code, ElizaOS exposes these endpoints at port 3000:

- `GET /api/agents` - List all active agents
- `POST /api/agents/:id/start` - Start specific agent
- `POST /api/agents/:id/stop` - Stop specific agent
- `POST /api/messages` - Send message to agent
- `GET /api/messages/:channelId` - Get channel messages
- `GET /api/agents/:id/memories` - Get agent memories
- `POST /api/agents/:id/media` - Upload media

### Original Architecture

```
User API Request
    ↓
Modal API Endpoints (your public API)
    ↓
Modal Volume (character JSON files)
    ↓
ElizaOS Server (single instance, all agents)
    ↓
Modal Tunnel (exposes port 3000)
    ↓
https://xyz123.modal.run (public HTTPS URL)
    ↓
ElizaOS REST API
    ↓
Supabase DB (shared context)
```

**Note:** This implementation requires server restart for new agents. The PRDs describe an improved approach using ElizaOS's dynamic agent creation API.

</details>
