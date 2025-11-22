"""
Modal application for AI Agent Launchpad - Unified Platform.

This module provides:
- Long-running custom ElizaOS project server in Modal container
- Single FastAPI application for agent management (create, list, delete)
- Tunnel exposure for external API access
- Volume persistence for agent state

The custom ElizaOS project (backend/agentica/) is built and run in Modal,
allowing custom plugins and actions while supporting dynamic agent creation
via REST API (no server restarts required).

Usage:
    # Deploy the complete application (server + API)
    modal deploy backend/modal_app.py

    # Run locally for testing
    modal run backend/modal_app.py

    # View logs
    modal app logs agentica-platform

Architecture:
    - Custom ElizaOS project built from backend/agentica/
    - Built with Node.js + Bun in Modal container
    - Port 3000 exposed via modal.web_server()
    - /data volume for agent state persistence
    - Secrets injected for API keys and database credentials
    - Single FastAPI application with multiple routes via @modal.asgi_app()
    - Supports custom plugins/actions in agentica/src/plugins/
"""

import os
import subprocess
import time
from pathlib import Path
from typing import Any, Dict, Optional

import modal
from pydantic import BaseModel, Field

# ============================================================================
# PYDANTIC MODELS FOR REQUEST/RESPONSE VALIDATION
# ============================================================================

class CreateAgentRequest(BaseModel):
    """Request model for creating a new agent."""
    user_id: str = Field(..., min_length=1, description="User ID")
    name: str = Field(..., min_length=3, max_length=50, description="Agent name")
    description: str = Field(..., min_length=10, max_length=500, description="Agent description")
    advanced_config: Optional[Dict[str, Any]] = Field(None, description="Optional advanced character config")


class AgentResponse(BaseModel):
    """Response model for agent information."""
    id: str
    eliza_agent_id: str
    name: str
    status: str
    created_at: str


class DeleteAgentResponse(BaseModel):
    """Response model for agent deletion."""
    success: bool
    agent_id: str
    message: str


class HealthResponse(BaseModel):
    """Response model for health check."""
    status: str
    service: str


class CreateRoomRequest(BaseModel):
    """Request model for creating a new room with AI strategy."""
    user_id: str = Field(..., min_length=1, description="User ID")
    name: str = Field(..., min_length=1, max_length=100, description="Room name")
    description: Optional[str] = Field(None, max_length=500, description="Room description")
    prompt: str = Field(..., min_length=10, max_length=1000, description="User prompt for AI strategy generation")
    frequency: str = Field(..., description="Trading frequency (e.g., 'daily', 'weekly', 'hourly')")
    agent_ids: Optional[list[str]] = Field(None, description="Optional list of additional agent IDs (strategy agent created automatically)")


class SendMessageRequest(BaseModel):
    """Request model for sending a message to a room."""
    content: str = Field(..., min_length=1, description="Message content/text")
    metadata: Optional[Dict[str, Any]] = Field(None, description="Optional message metadata")


class RoomResponse(BaseModel):
    """Response model for room information with wallet and strategy details."""
    id: str
    eliza_room_id: str
    name: str
    description: Optional[str]
    user_id: str
    strategy_agent_id: Optional[str]
    wallet_address: Optional[str]
    smart_account_address: Optional[str]
    user_prompt: Optional[str]
    generated_strategy: Optional[str]
    frequency: Optional[str]
    status: str
    created_at: str


class MessageResponse(BaseModel):
    """Response model for message confirmation."""
    success: bool
    message_id: Optional[str]
    room_id: str
    content: str


# ============================================================================
# MODAL APP INITIALIZATION
# ============================================================================

app = modal.App("agentica-platform")

# ============================================================================
# DOCKER IMAGE CONFIGURATION
# ============================================================================

# Build custom ElizaOS project instead of using base Docker image
eliza_image = (
    modal.Image.debian_slim(python_version="3.11")
    # Install Node.js and Bun
    .apt_install("curl", "ca-certificates", "unzip")
    .run_commands(
        # Install Node.js 20.x
        "curl -fsSL https://deb.nodesource.com/setup_20.x | bash -",
        "apt-get install -y nodejs",
        # Install Bun
        "curl -fsSL https://bun.sh/install | bash",
        "ln -s /root/.bun/bin/bun /usr/local/bin/bun",
        # Verify installations
        "node --version",
        "bun --version",
    )
    # Copy ElizaOS project directory (copy=True to run build commands on it)
    # Exclude node_modules and build artifacts - Modal will install fresh
    .add_local_dir(
        "backend/agentica",
        "/app",
        copy=True,
        ignore=[
            "node_modules/**",
            "dist/**",
            ".eliza/**",
            "*.log",
            ".env",
            ".env.local",
        ]
    )
    # Install dependencies and build project
    .run_commands(
        "cd /app && bun install",
        "cd /app && bun run build",
    )
    # Set production environment variables
    .env({
        "NODE_ENV": "production",
        "NO_UPDATE_CHECK": "1",  # Skip update checks for faster startup
        "SKIP_POSTINSTALL": "1",  # Skip post-install scripts
        "ELIZA_UI_ENABLE": "true",
        # Disable SSL certificate verification for Supabase pooler connections
        "NODE_TLS_REJECT_UNAUTHORIZED": "0",
        # ElizaOS server URL for health checks and inter-service communication
        "ELIZA_SERVER_URL": "https://herocast--agentica-platform-eliza-server.modal.run",
    })
    # Install Python dependencies for config.py
    .pip_install(
        "supabase",  # For database operations
        "requests",  # For HTTP requests
    )
    # Add config.py to the image so it's importable
    .add_local_file("backend/config.py", "/root/config.py")
)

# API image for FastAPI application
api_image = (
    modal.Image.debian_slim(python_version="3.11")
    .pip_install(
        "fastapi[standard]",
        "requests",
        "supabase",
        "pydantic",
        "openai>=1.0.0",  # For AI strategy generation
    )
    # Set ElizaOS server URL for API to communicate with ElizaOS
    # This is the stable Modal URL for the eliza_server function
    .env({
        "ELIZA_SERVER_URL": "https://herocast--agentica-platform-eliza-server.modal.run"
    })
    # Add config.py to the image so it's importable (must be last)
    .add_local_file("backend/config.py", "/root/config.py")
)

# ============================================================================
# VOLUME CONFIGURATION
# ============================================================================

# Persistent volume for agent state and data
# This ensures agents persist across container restarts
data_volume = modal.Volume.from_name(
    "agentica-data",
    create_if_missing=True
)

# ============================================================================
# ELIZA SERVER FUNCTION
# ============================================================================

@app.function(
    image=eliza_image,
    secrets=[modal.Secret.from_name("agentica-secrets")],
    volumes={"/data": data_volume},
    cpu=2,
    memory=2048,  # 2GB RAM
    timeout=86400,  # 24 hours
    scaledown_window=3600,  # 1 hour scaledown window (renamed from container_idle_timeout)
    min_containers=1,  # Keep at least 1 container warm (renamed from keep_warm)
    max_containers=1,  # Only 1 ElizaOS server for prototype (no scaling),
)
@modal.concurrent(max_inputs=1000)
@modal.web_server(port=3000, startup_timeout=300)
def eliza_server():
    """
    Start custom ElizaOS project server with tunnel exposure.

    This function:
    1. Validates required environment variables
    2. Starts our custom ElizaOS project on port 3000
    3. Exposes tunnel via modal.web_server()
    4. Keeps server running indefinitely

    The custom project is built from backend/agentica/ and includes:
    - Custom ElizaOS project structure
    - Ability to add custom plugins/actions
    - Dynamic agent creation via REST API

    Environment Variables (from Modal secrets):
        OPENAI_API_KEY: OpenAI API key for GPT models
        POSTGRES_URL: PostgreSQL connection string (required by ElizaOS - not DATABASE_URL!)
        ANTHROPIC_API_KEY: Optional Anthropic API key for Claude models
        SUPABASE_URL: Supabase project URL
        SUPABASE_SERVICE_ROLE_KEY: Supabase service role key
        SUPABASE_ANON_KEY: Supabase anonymous key

    Returns:
        subprocess.Popen: ElizaOS server process

    Note:
        Uses `elizaos start` to run the custom project. The project includes
        a base agent defined in src/index.ts, and supports dynamic agent
        creation via POST /api/agents endpoint.
    """
    print("=" * 80)
    print("STARTING ELIZA AGENT PLATFORM SERVER")
    print("=" * 80)

    # Validate required environment variables
    required_vars = [
        "OPENAI_API_KEY",
        "POSTGRES_URL",  # Required by ElizaOS for PostgreSQL (not DATABASE_URL!)
        "SUPABASE_URL",
        "SUPABASE_SERVICE_ROLE_KEY",
    ]

    missing_vars = [var for var in required_vars if not os.environ.get(var)]
    if missing_vars:
        raise ValueError(f"Missing required environment variables: {', '.join(missing_vars)}")

    print("\n✓ Environment variables validated")

    # DEBUG: Check POSTGRES_URL before setting DATABASE_URL
    postgres_url = os.environ.get("POSTGRES_URL")
    print(f"\nDEBUG - Before setting DATABASE_URL:")
    print(f"  POSTGRES_URL: {'SET (' + postgres_url[:30] + '...)' if postgres_url else 'NOT SET'}")
    print(f"  DATABASE_URL: {'SET (' + os.environ.get('DATABASE_URL', '')[:30] + '...)' if os.environ.get('DATABASE_URL') else 'NOT SET'}")

    # Set DATABASE_URL for ElizaOS SQL plugin
    # The plugin looks for DATABASE_URL, but we use POSTGRES_URL in Modal secrets
    if postgres_url:
        os.environ["DATABASE_URL"] = postgres_url
        print("\n✓ Setting DATABASE_URL from POSTGRES_URL")
        print(f"DEBUG - After setting DATABASE_URL:")
        print(f"  DATABASE_URL: {'SET (' + os.environ.get('DATABASE_URL', '')[:30] + '...)' if os.environ.get('DATABASE_URL') else 'FAILED TO SET!'}")
    else:
        print("\n✗ ERROR: POSTGRES_URL not found in environment!")
        print("  ElizaOS will default to pglite (local database)")

    # Ensure data directory exists
    data_dir = Path("/data")
    data_dir.mkdir(parents=True, exist_ok=True)
    print(f"✓ Data directory ready: {data_dir}")

    # Check for package manager availability
    import shutil
    bun_path = shutil.which("bun")
    npm_path = shutil.which("npm")

    print("\nPackage Manager Detection:")
    print(f"  bun available: {bun_path or 'NOT FOUND'}")
    print(f"  npm available: {npm_path or 'NOT FOUND'}")

    if not bun_path:
        raise RuntimeError(
            "bun not found in PATH. Please ensure bun is installed in the Docker image. "
            f"ElizaOS requires bun as its package manager. Available: npm={npm_path}"
        )

    print(f"✓ Using bun at: {bun_path}")

    # Additional environment variable diagnostics
    print("\nEnvironment Diagnostics:")
    print(f"  NODE_ENV: {os.environ.get('NODE_ENV', 'NOT SET')}")
    print(f"  OPENAI_API_KEY: {'SET' if os.environ.get('OPENAI_API_KEY') else 'NOT SET'}")
    print(f"  ANTHROPIC_API_KEY: {'SET' if os.environ.get('ANTHROPIC_API_KEY') else 'NOT SET'}")
    print(f"  SUPABASE_URL: {'SET' if os.environ.get('SUPABASE_URL') else 'NOT SET'}")

    # Database-related env vars
    print("\nDatabase Environment Variables:")
    for key in sorted(os.environ.keys()):
        if 'DATABASE' in key or 'POSTGRES' in key or 'DB' in key:
            value = os.environ[key]
            # Show first 40 chars to see connection string format
            display = value[:40] + '...' if len(value) > 40 else value
            print(f"  {key}: {display}")

    # Check for ElizaOS project structure
    print("\nElizaOS Project Checks:")

    # Check if our custom project structure exists
    required_paths = [
        "/app/dist/index.js",  # Built project output
        "/app/node_modules",   # Dependencies
        "/app/package.json",   # Project manifest
    ]

    missing_paths = []
    for req_path in required_paths:
        if not Path(req_path).exists():
            missing_paths.append(req_path)
            print(f"  ✗ Missing: {req_path}")
        else:
            print(f"  ✓ Found: {req_path}")

    if missing_paths:
        print("\n⚠ Warning: Some expected project paths are missing:")
        for path in missing_paths:
            print(f"  - {path}")
        print("This may cause startup failures.\n")

    # Prepare ElizaOS startup command
    # Use elizaos CLI to start the server
    # This will load the project from /app and start the server on port 3000
    eliza_cmd = [
        "bun",
        "run",
        "start",  # Uses "elizaos start" from package.json
    ]

    print(f"\n✓ Starting ElizaOS with command: {' '.join(eliza_cmd)}")

    # Set working directory to our ElizaOS project
    eliza_dir = Path("/app")
    if not eliza_dir.exists():
        raise RuntimeError(f"ElizaOS project directory not found: {eliza_dir}")

    print(f"✓ ElizaOS project directory: {eliza_dir}")

    # Start ElizaOS server process
    try:
        process = subprocess.Popen(
            eliza_cmd,
            cwd=str(eliza_dir),
            stdout=subprocess.PIPE,
            stderr=subprocess.STDOUT,
            universal_newlines=True,
            bufsize=1
        )

        print("✓ ElizaOS process started")

        # Wait for server to be ready (check for startup message in logs)
        startup_timeout = 120  # 2 minutes
        start_time = time.time()
        server_ready = False
        output_lines = []  # Store all output for error diagnosis

        print("\nWaiting for ElizaOS to be ready...")

        while time.time() - start_time < startup_timeout:
            line = process.stdout.readline()
            if line:
                stripped_line = line.rstrip()
                print(f"[ElizaOS] {stripped_line}")
                output_lines.append(stripped_line)

                # Check for startup indicators
                if "listening" in line.lower() or "started" in line.lower():
                    server_ready = True
                    break

            # Check if process died
            if process.poll() is not None:
                # Process exited - read ALL remaining output from buffer
                print("\n⚠ ElizaOS process exited unexpectedly. Reading remaining output...")

                remaining_output = process.stdout.read()
                if remaining_output:
                    for remaining_line in remaining_output.split('\n'):
                        if remaining_line.strip():
                            print(f"[ElizaOS] {remaining_line}")
                            output_lines.append(remaining_line)

                # Print comprehensive error information
                print("\n" + "=" * 80)
                print("ELIZA STARTUP FAILURE DETAILS")
                print("=" * 80)
                print(f"Exit Code: {process.returncode}")
                print(f"\nComplete Output ({len(output_lines)} lines):")
                print("-" * 80)
                for idx, out_line in enumerate(output_lines, 1):
                    print(f"{idx:3d} | {out_line}")
                print("=" * 80 + "\n")

                raise Exception(
                    f"ElizaOS process exited with code {process.returncode}. "
                    f"Check logs above for error details. "
                    f"Total output lines: {len(output_lines)}"
                )

            time.sleep(0.5)

        if not server_ready:
            # Even if we didn't see startup message, try to continue
            print("⚠ Startup message not detected, but continuing...")

        print("\n" + "=" * 80)
        print("ELIZA SERVER READY")
        print("=" * 80)
        print("Port: 3000")
        print("Tunnel will be available via Modal")
        print("=" * 80 + "\n")

        # Return the process - Modal will manage tunnel and keep it running
        return process

    except Exception as e:
        print(f"\n✗ Failed to start ElizaOS: {str(e)}")
        raise


# ============================================================================
# HEALTH CHECK FUNCTION
# ============================================================================

@app.function(
    image=eliza_image,
    secrets=[modal.Secret.from_name("agentica-secrets")],
)
def health_check():
    """
    Check if ElizaOS server is running and accessible.

    Returns:
        dict: Health status with tunnel URL and timestamp
    """
    from datetime import datetime

    import requests
    from config import get_tunnel_url

    try:
        tunnel_url = get_tunnel_url()

        # Try to reach ElizaOS health endpoint
        response = requests.get(
            f"{tunnel_url}/health",
            timeout=5
        )

        return {
            "status": "healthy" if response.ok else "unhealthy",
            "tunnel_url": tunnel_url,
            "timestamp": datetime.utcnow().isoformat(),
            "response_code": response.status_code,
        }
    except Exception as e:
        return {
            "status": "error",
            "error": str(e),
            "timestamp": datetime.utcnow().isoformat(),
        }


# ============================================================================
# FASTAPI APPLICATION WITH ALL ROUTES
# ============================================================================

@app.function(
    image=api_image,
    secrets=[modal.Secret.from_name("agentica-secrets")],
)
@modal.concurrent(max_inputs=100)  # Handle concurrent requests (replaces allow_concurrent_inputs)
@modal.asgi_app()
def api():
    """
    Single FastAPI application with all API routes.

    This replaces individual @modal.web_endpoint() decorators with a unified
    FastAPI application, providing better route management, middleware support,
    and a single base URL for all endpoints.

    Endpoints:
        - GET  /health - Health check
        - POST /agents - Create a new agent
        - GET  /agents - List user's agents
        - DELETE /agents/{agent_id} - Delete an agent
    """
    # Import dependencies inside the function (they'll be available in the container)
    import traceback

    import requests
    from config import (
        create_supabase_client,
        generate_character_config,
        get_eliza_api_url,
        get_tunnel_url,
        validate_agent_input,
    )
    from fastapi import FastAPI, HTTPException, Query, Request
    from fastapi import Path as PathParam
    from fastapi.responses import JSONResponse

    # Create FastAPI application
    web_app = FastAPI(
        title="Agentica Platform API",
        description="AI Agent Launchpad - Dynamic agent creation and management",
        version="1.0.0",
    )

    # ========================================================================
    # HELPER FUNCTIONS
    # ========================================================================

    def generate_strategy_prompt(user_prompt: str) -> str:
        """
        Generate AI trading strategy from user prompt using OpenAI.

        Uses gpt-4o-mini for fast, cost-effective strategy generation.
        Transforms natural language into structured trading strategy with
        automatic guardrails.

        Args:
            user_prompt: User's natural language trading strategy description

        Returns:
            str: AI-generated trading strategy with guardrails

        Raises:
            Exception: If OpenAI API call fails
        """
        import os
        from openai import OpenAI

        # Initialize OpenAI client
        client = OpenAI(api_key=os.getenv("OPENAI_API_KEY"))

        # Simple system prompt for strategy generation
        system_prompt = """You are a trading strategy expert. Transform the user's trading idea into a clear, structured strategy.

Your response should include:
1. Strategy overview (2-3 sentences)
2. Entry conditions
3. Exit conditions
4. Risk management rules

Keep it concise and actionable. Automatically include these guardrails:
- Maximum 5% portfolio risk per trade
- Stop loss required on all positions
- No trading on low liquidity tokens (<$100k daily volume)"""

        try:
            response = client.chat.completions.create(
                model="gpt-4o-mini",
                messages=[
                    {"role": "system", "content": system_prompt},
                    {"role": "user", "content": user_prompt}
                ],
                max_tokens=500,
                temperature=0.7
            )

            generated_strategy = response.choices[0].message.content.strip()
            return generated_strategy

        except Exception as e:
            raise Exception(f"OpenAI strategy generation failed: {str(e)}")

    # ========================================================================
    # EXCEPTION HANDLERS
    # ========================================================================

    @web_app.exception_handler(HTTPException)
    async def http_exception_handler(request: Request, exc: HTTPException):
        """Handle HTTP exceptions with consistent error format."""
        return JSONResponse(
            status_code=exc.status_code,
            content={"success": False, "error": exc.detail}
        )

    @web_app.exception_handler(Exception)
    async def general_exception_handler(request: Request, exc: Exception):
        """Handle unexpected exceptions."""
        traceback.print_exc()
        return JSONResponse(
            status_code=500,
            content={
                "success": False,
                "error": "Internal server error",
                "details": str(exc)
            }
        )

    # ========================================================================
    # HEALTH CHECK ENDPOINT
    # ========================================================================

    @web_app.get("/health", tags=["Health"])
    async def health():
        """
        Health check endpoint.

        Returns:
            dict: Health status information
        """
        return {
            "status": "healthy",
            "service": "agentica-platform"
        }

    # ========================================================================
    # CREATE AGENT ENDPOINT
    # ========================================================================

    @web_app.post("/agents", status_code=201, tags=["Agents"])
    async def create_agent(agent_request: CreateAgentRequest):
        """
        Create a new AI agent.

        This endpoint:
        1. Validates input (name, description, user_id)
        2. Generates ElizaOS character configuration
        3. Creates agent in ElizaOS via POST /api/agents
        4. Starts agent in ElizaOS via POST /api/agents/{id}/start
        5. Stores metadata in Supabase
        6. Returns agent information

        Args:
            agent_request: CreateAgentRequest with user_id, name, description, and optional advanced_config

        Returns:
            dict: Success response with agent information

        Raises:
            HTTPException: 400 for invalid input, 500 for server errors
        """
        # Extract inputs from Pydantic model
        user_id = agent_request.user_id
        name = agent_request.name
        description = agent_request.description
        advanced_config = agent_request.advanced_config

        # Validate inputs
        is_valid, error_msg = validate_agent_input(name, description, user_id)
        if not is_valid:
            raise HTTPException(status_code=400, detail=error_msg)

        # Generate character configuration
        try:
            character_config = generate_character_config(
                name.strip(),
                description.strip(),
                advanced_config
            )
        except Exception as e:
            raise HTTPException(
                status_code=400,
                detail=f"Failed to generate character config: {str(e)}"
            )

        # Get tunnel URL to communicate with ElizaOS
        try:
            tunnel_url = get_tunnel_url()
        except Exception:
            raise HTTPException(
                status_code=503,
                detail="ElizaOS server not available. Please try again later."
            )

        # POST to ElizaOS API to create agent
        try:
            create_url = get_eliza_api_url("/api/agents")
            # ElizaOS expects character config wrapped in "characterJson" field
            payload = {"characterJson": character_config}
            create_response = requests.post(
                create_url,
                json=payload,
                headers={"Content-Type": "application/json"},
                timeout=30
            )

            if not create_response.ok:
                raise Exception(
                    f"ElizaOS API error: {create_response.status_code} - {create_response.text}"
                )

            eliza_data = create_response.json()
            print(f"ElizaOS create response: {eliza_data}")  # Debug logging

            # Try multiple possible response formats
            eliza_agent_id = (
                eliza_data.get("id") or
                eliza_data.get("agentId") or
                eliza_data.get("data", {}).get("agentId") or
                eliza_data.get("data", {}).get("id")
            )

            if not eliza_agent_id:
                raise Exception(f"ElizaOS did not return agent ID. Response: {eliza_data}")

        except requests.exceptions.RequestException as e:
            raise HTTPException(
                status_code=502,
                detail=f"Failed to communicate with ElizaOS server: {str(e)}"
            )
        except Exception as e:
            raise HTTPException(
                status_code=500,
                detail=f"Failed to create agent in ElizaOS: {str(e)}"
            )

        # Start the agent in ElizaOS
        try:
            start_url = get_eliza_api_url(f"/api/agents/{eliza_agent_id}/start")
            start_response = requests.post(
                start_url,
                timeout=30
            )

            if not start_response.ok:
                print(f"Warning: Failed to start agent {eliza_agent_id}: {start_response.text}")
                # Don't fail - agent is created, just not started yet

        except Exception as e:
            print(f"Warning: Failed to start agent {eliza_agent_id}: {str(e)}")
            # Continue - agent exists even if start failed

        # Store in Supabase
        try:
            supabase = create_supabase_client()

            agent_data = {
                "user_id": user_id,
                "eliza_agent_id": eliza_agent_id,
                "name": name.strip(),
                "description": description.strip(),
                "character_config": character_config,
                "status": "active",
                "advanced_config": advanced_config,
            }

            result = supabase.table("platform_agents").insert(agent_data).execute()

            if not result.data:
                raise Exception("Supabase insert returned no data")

            db_agent = result.data[0]

        except Exception as e:
            # Agent created in ElizaOS but not in database
            # Try to clean up ElizaOS agent
            try:
                delete_url = get_eliza_api_url(f"/api/agents/{eliza_agent_id}")
                requests.delete(delete_url, timeout=10)
            except:
                pass

            raise HTTPException(
                status_code=500,
                detail=f"Failed to store agent in database: {str(e)}"
            )

        # Return success response
        return {
            "success": True,
            "agent": {
                "id": db_agent["id"],
                "eliza_agent_id": db_agent["eliza_agent_id"],
                "name": db_agent["name"],
                "description": db_agent["description"],
                "status": db_agent["status"],
                "created_at": db_agent["created_at"],
            }
        }

    # ========================================================================
    # LIST AGENTS ENDPOINT
    # ========================================================================

    @web_app.get("/agents", tags=["Agents"])
    async def list_agents(user_id: str = Query(..., description="User ID to filter agents")):
        """
        List all agents for a specific user.

        Args:
            user_id: User ID to filter agents (required query parameter)

        Returns:
            dict: Success response with list of agents

        Raises:
            HTTPException: 400 for invalid input, 500 for server errors
        """
        # Validate user_id
        if not user_id or not isinstance(user_id, str):
            raise HTTPException(
                status_code=400,
                detail="user_id is required and must be a non-empty string"
            )

        # Query Supabase
        try:
            supabase = create_supabase_client()

            result = supabase.table("platform_agents").select("*").eq("user_id", user_id).order(
                "created_at", desc=True
            ).execute()

            agents = result.data or []

        except Exception as e:
            raise HTTPException(
                status_code=500,
                detail=f"Failed to query database: {str(e)}"
            )

        # Format response
        formatted_agents = [
            {
                "id": agent["id"],
                "eliza_agent_id": agent["eliza_agent_id"],
                "name": agent["name"],
                "description": agent["description"],
                "status": agent["status"],
                "created_at": agent["created_at"],
                "updated_at": agent["updated_at"],
            }
            for agent in agents
        ]

        return {
            "success": True,
            "agents": formatted_agents,
            "count": len(formatted_agents),
        }

    # ========================================================================
    # DELETE AGENT ENDPOINT
    # ========================================================================

    @web_app.delete("/agents/{agent_id}", tags=["Agents"])
    async def delete_agent(
        agent_id: str = PathParam(..., description="Agent ID to delete"),
        user_id: str = Query(..., description="User ID for ownership verification"),
    ):
        """
        Delete an agent.

        This endpoint:
        1. Verifies agent belongs to user (ownership check)
        2. Stops agent in ElizaOS
        3. Deletes agent from ElizaOS
        4. Deletes agent from Supabase
        5. Returns success confirmation

        Args:
            agent_id: UUID of agent to delete (path parameter)
            user_id: User ID for ownership verification (query parameter)

        Returns:
            dict: Success response with deletion confirmation

        Raises:
            HTTPException: 400 for invalid input, 404 if not found, 500 for server errors
        """
        # Validate user_id
        if not user_id or not isinstance(user_id, str):
            raise HTTPException(
                status_code=400,
                detail="user_id is required for ownership verification"
            )

        # Get agent from database and verify ownership
        try:
            supabase = create_supabase_client()

            result = supabase.table("platform_agents").select("*").eq("id", agent_id).eq(
                "user_id", user_id
            ).execute()

            if not result.data:
                raise HTTPException(
                    status_code=404,
                    detail="Agent not found or you don't have permission to delete it"
                )

            agent = result.data[0]
            eliza_agent_id = agent["eliza_agent_id"]

        except HTTPException:
            raise  # Re-raise HTTPExceptions
        except Exception as e:
            raise HTTPException(
                status_code=500,
                detail=f"Failed to query database: {str(e)}"
            )

        # Stop agent in ElizaOS
        try:
            tunnel_url = get_tunnel_url()
            stop_url = get_eliza_api_url(f"/api/agents/{eliza_agent_id}/stop")

            stop_response = requests.post(stop_url, timeout=10)

            if not stop_response.ok:
                print(f"Warning: Failed to stop agent {eliza_agent_id}: {stop_response.text}")
                # Continue - we'll still try to delete

        except Exception as e:
            print(f"Warning: Failed to stop agent {eliza_agent_id}: {str(e)}")
            # Continue - not critical for deletion

        # Delete agent from ElizaOS
        try:
            delete_url = get_eliza_api_url(f"/api/agents/{eliza_agent_id}")

            delete_response = requests.delete(delete_url, timeout=10)

            if not delete_response.ok:
                print(f"Warning: Failed to delete agent from ElizaOS: {delete_response.text}")
                # Continue - we'll still delete from database

        except Exception as e:
            print(f"Warning: Failed to delete agent from ElizaOS: {str(e)}")
            # Continue - we'll still delete from database

        # Delete from Supabase
        try:
            result = supabase.table("platform_agents").delete().eq("id", agent_id).execute()

            if not result.data:
                # Agent might have been deleted already, but that's okay
                print(f"Warning: No rows deleted for agent {agent_id}")

        except Exception as e:
            raise HTTPException(
                status_code=500,
                detail=f"Failed to delete agent from database: {str(e)}"
            )

        # Return success response
        return {
            "success": True,
            "agent_id": agent_id,
            "message": "Agent deleted successfully",
        }

    # ========================================================================
    # CREATE ROOM ENDPOINT
    # ========================================================================

    @web_app.post("/rooms", status_code=201, tags=["Rooms"])
    async def create_room(room_request: CreateRoomRequest):
        """
        Create a new portfolio room with AI strategy agent and wallet.

        This endpoint:
        1. Generates AI trading strategy from user prompt via OpenAI
        2. Creates wallet via Wallet API (POST /wallets)
        3. Creates strategy agent in ElizaOS with generated strategy
        4. Starts the strategy agent
        5. Creates ElizaOS room with strategy agent
        6. Stores room metadata in platform_rooms table
        7. Stores strategy agent in platform_agents table
        8. Returns room info with wallet addresses and generated strategy

        Args:
            room_request: CreateRoomRequest with user_id, name, prompt, frequency, optional agent_ids

        Returns:
            dict: Success response with room information, wallet addresses, and AI strategy

        Raises:
            HTTPException: 400 for invalid input, 500 for server errors
        """
        import os
        import uuid

        # Extract inputs from Pydantic model
        user_id = room_request.user_id
        name = room_request.name
        description = room_request.description
        user_prompt = room_request.prompt
        frequency = room_request.frequency
        additional_agent_ids = room_request.agent_ids or []

        # Generate unique room_id for wallet creation
        room_id = str(uuid.uuid4())

        # Step 1: Generate AI strategy from user prompt
        print(f"Generating AI strategy for room: {name}")
        try:
            generated_strategy = generate_strategy_prompt(user_prompt)
            print(f"Generated strategy: {generated_strategy[:100]}...")
        except Exception as e:
            raise HTTPException(
                status_code=500,
                detail=f"Failed to generate AI strategy: {str(e)}"
            )

        # Step 2: Create wallet via Wallet API
        print(f"Creating wallet for room: {room_id}")
        wallet_address = None
        smart_account_address = None
        try:
            wallet_api_url = os.getenv("WALLET_API_URL")
            if not wallet_api_url:
                raise Exception("WALLET_API_URL environment variable not set")

            wallet_response = requests.post(
                f"{wallet_api_url}/wallets",
                json={"room_id": room_id},
                headers={"Content-Type": "application/json"},
                timeout=30
            )

            if not wallet_response.ok:
                raise Exception(f"Wallet API error: {wallet_response.status_code} - {wallet_response.text}")

            wallet_data = wallet_response.json()
            wallet_address = wallet_data.get("owner_address")
            smart_account_address = wallet_data.get("smart_account_address")

            print(f"Wallet created - Owner: {wallet_address}, Smart Account: {smart_account_address}")

        except Exception as e:
            raise HTTPException(
                status_code=500,
                detail=f"Failed to create wallet: {str(e)}"
            )

        # Step 3: Create strategy agent in ElizaOS
        print(f"Creating strategy agent in ElizaOS")
        strategy_agent_id = None
        try:
            # Generate character config for strategy agent
            strategy_agent_name = f"{name} Strategy"
            strategy_character_config = generate_character_config(
                name=strategy_agent_name,
                description=generated_strategy,
                advanced_config=None
            )

            # Create agent in ElizaOS
            create_agent_url = get_eliza_api_url("/api/agents")
            agent_payload = {"characterJson": strategy_character_config}
            agent_response = requests.post(
                create_agent_url,
                json=agent_payload,
                headers={"Content-Type": "application/json"},
                timeout=30
            )

            if not agent_response.ok:
                raise Exception(f"ElizaOS agent creation error: {agent_response.status_code} - {agent_response.text}")

            agent_data = agent_response.json()
            strategy_agent_id = (
                agent_data.get("id") or
                agent_data.get("agentId") or
                agent_data.get("data", {}).get("agentId") or
                agent_data.get("data", {}).get("id")
            )

            if not strategy_agent_id:
                raise Exception(f"ElizaOS did not return agent ID. Response: {agent_data}")

            print(f"Strategy agent created: {strategy_agent_id}")

        except Exception as e:
            raise HTTPException(
                status_code=500,
                detail=f"Failed to create strategy agent: {str(e)}"
            )

        # Step 4: Start the strategy agent
        print(f"Starting strategy agent: {strategy_agent_id}")
        try:
            start_url = get_eliza_api_url(f"/api/agents/{strategy_agent_id}/start")
            start_response = requests.post(start_url, timeout=30)

            if not start_response.ok:
                print(f"Warning: Failed to start agent {strategy_agent_id}: {start_response.text}")

        except Exception as e:
            print(f"Warning: Failed to start agent {strategy_agent_id}: {str(e)}")

        # Step 5: Create ElizaOS room with strategy agent (and optional additional agents)
        print(f"Creating ElizaOS room")
        eliza_room_id = None
        try:
            # Combine strategy agent with additional agents
            all_eliza_agent_ids = [strategy_agent_id]

            # If additional agent_ids provided, get their eliza_agent_ids
            if additional_agent_ids:
                supabase = create_supabase_client()
                result = supabase.table("platform_agents").select("eliza_agent_id").in_(
                    "id", additional_agent_ids
                ).execute()
                all_eliza_agent_ids.extend([agent["eliza_agent_id"] for agent in (result.data or [])])

            # Create room in ElizaOS
            create_room_url = get_eliza_api_url("/api/rooms")
            room_payload = {
                "name": name,
                "description": description or f"Portfolio room with AI strategy: {name}",
                "agentIds": all_eliza_agent_ids,
            }

            room_response = requests.post(
                create_room_url,
                json=room_payload,
                headers={"Content-Type": "application/json"},
                timeout=30
            )

            if not room_response.ok:
                raise Exception(f"ElizaOS room creation error: {room_response.status_code} - {room_response.text}")

            room_data = room_response.json()
            eliza_room_id = (
                room_data.get("id") or
                room_data.get("roomId") or
                room_data.get("data", {}).get("id") or
                room_data.get("data", {}).get("roomId")
            )

            if not eliza_room_id:
                raise Exception(f"ElizaOS did not return room ID. Response: {room_data}")

            print(f"ElizaOS room created: {eliza_room_id}")

        except Exception as e:
            raise HTTPException(
                status_code=500,
                detail=f"Failed to create ElizaOS room: {str(e)}"
            )

        # Step 6: Store room metadata in platform_rooms table
        print(f"Storing room in database")
        try:
            supabase = create_supabase_client()

            room_db_data = {
                "id": room_id,
                "user_id": user_id,
                "name": name,
                "description": description,
                "eliza_room_id": eliza_room_id,
                "strategy_agent_id": strategy_agent_id,
                "wallet_address": wallet_address,
                "smart_account_address": smart_account_address,
                "user_prompt": user_prompt,
                "generated_strategy": generated_strategy,
                "frequency": frequency,
                "status": "active",
            }

            room_result = supabase.table("platform_rooms").insert(room_db_data).execute()

            if not room_result.data:
                raise Exception("Supabase insert returned no data for platform_rooms")

            db_room = room_result.data[0]

        except Exception as e:
            # If database insert fails, we have orphaned resources
            # Log error but don't try to clean up (too complex for prototype)
            raise HTTPException(
                status_code=500,
                detail=f"Failed to store room in database: {str(e)}"
            )

        # Step 7: Store strategy agent in platform_agents table
        print(f"Storing strategy agent in database")
        try:
            agent_db_data = {
                "user_id": user_id,
                "eliza_agent_id": strategy_agent_id,
                "name": strategy_agent_name,
                "description": generated_strategy,
                "character_config": strategy_character_config,
                "status": "active",
                "advanced_config": None,
            }

            agent_result = supabase.table("platform_agents").insert(agent_db_data).execute()

            if not agent_result.data:
                raise Exception("Supabase insert returned no data for platform_agents")

        except Exception as e:
            print(f"Warning: Failed to store strategy agent in database: {str(e)}")
            # Continue - room is created, agent just not tracked in DB

        # Step 8: Return success response
        return {
            "success": True,
            "room": {
                "id": db_room["id"],
                "eliza_room_id": db_room["eliza_room_id"],
                "name": db_room["name"],
                "description": db_room["description"],
                "user_id": db_room["user_id"],
                "strategy_agent_id": db_room["strategy_agent_id"],
                "wallet_address": db_room["wallet_address"],
                "smart_account_address": db_room["smart_account_address"],
                "user_prompt": db_room["user_prompt"],
                "generated_strategy": db_room["generated_strategy"],
                "frequency": db_room["frequency"],
                "status": db_room["status"],
                "created_at": db_room["created_at"],
            }
        }

    # ========================================================================
    # SEND MESSAGE TO ROOM ENDPOINT
    # ========================================================================

    @web_app.post("/rooms/{room_id}/messages", status_code=201, tags=["Rooms"])
    async def send_message_to_room(
        room_id: str = PathParam(..., description="Room ID to send message to"),
        message_request: SendMessageRequest = None,
    ):
        """
        Send a message to a room.

        This endpoint:
        1. Builds ElizaOS messaging payload per their API spec
        2. Posts to ElizaOS /api/messaging/submit endpoint
        3. Returns success response

        Args:
            room_id: UUID of room to send message to (path parameter)
            message_request: SendMessageRequest with content and optional metadata

        Returns:
            dict: Success response with message confirmation

        Raises:
            HTTPException: 400 for invalid input, 500 for server errors
        """
        # Extract inputs
        content = message_request.content
        metadata = message_request.metadata or {}

        # Build ElizaOS messaging payload
        # Based on requirements and search results, the payload structure is:
        # {
        #   "channel_id": room_id,
        #   "server_id": "00000000-0000-0000-0000-000000000000",
        #   "author_id": <agent_id or system>,
        #   "content": message_text,
        #   "source_type": "agent_response",
        #   "raw_message": {"text": message_text},
        #   "metadata": {...}
        # }

        # For system messages, we'll use a special author_id
        # In a real implementation, you might want to extract agent_id from metadata
        author_id = metadata.get("author_id", "system")

        message_payload = {
            "channel_id": room_id,
            "server_id": "00000000-0000-0000-0000-000000000000",  # Default server ID
            "author_id": author_id,
            "content": content,
            "source_type": metadata.get("source_type", "agent_response"),
            "raw_message": {
                "text": content,
                **(metadata.get("raw_message", {}))
            },
            "metadata": metadata,
        }

        # POST to ElizaOS messaging endpoint
        try:
            submit_url = get_eliza_api_url("/api/messaging/submit")

            submit_response = requests.post(
                submit_url,
                json=message_payload,
                headers={"Content-Type": "application/json"},
                timeout=30
            )

            if not submit_response.ok:
                print(f"ElizaOS message submission failed: {submit_response.status_code} - {submit_response.text}")
                raise Exception(
                    f"ElizaOS API error: {submit_response.status_code} - {submit_response.text}"
                )

            eliza_message_data = submit_response.json()
            print(f"ElizaOS message submission response: {eliza_message_data}")

            # Try multiple possible response formats
            message_id = (
                eliza_message_data.get("id") or
                eliza_message_data.get("messageId") or
                eliza_message_data.get("data", {}).get("id") or
                eliza_message_data.get("data", {}).get("messageId")
            )

        except requests.exceptions.RequestException as e:
            raise HTTPException(
                status_code=502,
                detail=f"Failed to communicate with ElizaOS server: {str(e)}"
            )
        except HTTPException:
            raise
        except Exception as e:
            raise HTTPException(
                status_code=500,
                detail=f"Failed to send message to ElizaOS: {str(e)}"
            )

        # Return success response
        return {
            "success": True,
            "message_id": message_id,
            "room_id": room_id,
            "content": content,
            "submitted_at": eliza_message_data.get("created_at") or eliza_message_data.get("createdAt"),
        }

    # ========================================================================
    # LIST ROOMS ENDPOINT
    # ========================================================================

    @web_app.get("/rooms", tags=["Rooms"])
    async def list_rooms(user_id: str = Query(..., description="User ID to filter rooms")):
        """
        List all rooms accessible to a specific user.

        This endpoint queries ElizaOS for rooms and filters them based on
        the user's agents.

        Args:
            user_id: User ID to filter rooms (required query parameter)

        Returns:
            dict: Success response with list of rooms

        Raises:
            HTTPException: 400 for invalid input, 500 for server errors
        """
        # Validate user_id
        if not user_id or not isinstance(user_id, str):
            raise HTTPException(
                status_code=400,
                detail="user_id is required and must be a non-empty string"
            )

        # Get user's agents to filter rooms
        try:
            supabase = create_supabase_client()

            result = supabase.table("platform_agents").select("eliza_agent_id").eq(
                "user_id", user_id
            ).execute()

            user_agent_ids = [agent["eliza_agent_id"] for agent in (result.data or [])]

            if not user_agent_ids:
                # User has no agents, return empty list
                return {
                    "success": True,
                    "rooms": [],
                    "count": 0,
                }

        except Exception as e:
            raise HTTPException(
                status_code=500,
                detail=f"Failed to query user agents: {str(e)}"
            )

        # Query ElizaOS for rooms
        # ASSUMPTION: ElizaOS has a GET /api/rooms endpoint
        # This might need to be adjusted based on actual ElizaOS API
        try:
            list_url = get_eliza_api_url("/api/rooms")

            list_response = requests.get(
                list_url,
                timeout=30
            )

            if not list_response.ok:
                print(f"ElizaOS room listing failed: {list_response.status_code} - {list_response.text}")
                raise Exception(
                    f"ElizaOS API error: {list_response.status_code} - {list_response.text}"
                )

            eliza_rooms_data = list_response.json()

            # Handle different response formats
            rooms_list = (
                eliza_rooms_data.get("rooms") or
                eliza_rooms_data.get("data") or
                (eliza_rooms_data if isinstance(eliza_rooms_data, list) else [])
            )

            # Filter rooms that include user's agents
            user_rooms = []
            for room in rooms_list:
                room_agent_ids = room.get("agentIds") or room.get("agent_ids") or []
                # Check if any of the user's agents are in this room
                if any(agent_id in room_agent_ids for agent_id in user_agent_ids):
                    user_rooms.append({
                        "id": room.get("id"),
                        "name": room.get("name"),
                        "description": room.get("description"),
                        "created_at": room.get("created_at") or room.get("createdAt"),
                        "agent_ids": room_agent_ids,
                    })

        except requests.exceptions.RequestException as e:
            raise HTTPException(
                status_code=502,
                detail=f"Failed to communicate with ElizaOS server: {str(e)}"
            )
        except HTTPException:
            raise
        except Exception as e:
            raise HTTPException(
                status_code=500,
                detail=f"Failed to list rooms from ElizaOS: {str(e)}"
            )

        return {
            "success": True,
            "rooms": user_rooms,
            "count": len(user_rooms),
        }

    # ========================================================================
    # GET ROOM TRANSACTIONS ENDPOINT
    # ========================================================================

    @web_app.get("/rooms/{room_id}/transactions", tags=["Rooms"])
    async def get_room_transactions(
        room_id: str = PathParam(..., description="Room ID"),
        limit: int = Query(50, description="Maximum number of records to return"),
        offset: int = Query(0, description="Number of records to skip"),
        status: Optional[str] = Query(None, description="Filter by status (pending, success, failed)")
    ):
        """
        Get transaction history for a room's wallet.

        This endpoint proxies to Wallet API's transaction history endpoint.
        It first verifies the room exists in platform_rooms, then fetches
        transaction history from the Wallet API.

        Args:
            room_id: Room identifier (path parameter)
            limit: Maximum number of records to return (default: 50, max: 100)
            offset: Number of records to skip (default: 0)
            status: Filter by status ('pending', 'success', 'failed'), or None for all

        Returns:
            dict: Transaction history from Wallet API

        Raises:
            HTTPException: 404 if room not found, 500 for server errors
        """
        import os

        # Verify room exists in platform_rooms
        try:
            supabase = create_supabase_client()

            result = supabase.table("platform_rooms").select("*").eq("id", room_id).execute()

            if not result.data:
                raise HTTPException(
                    status_code=404,
                    detail=f"Room not found: {room_id}"
                )

        except HTTPException:
            raise
        except Exception as e:
            raise HTTPException(
                status_code=500,
                detail=f"Failed to verify room: {str(e)}"
            )

        # Call Wallet API to get transaction history
        try:
            wallet_api_url = os.getenv("WALLET_API_URL")
            if not wallet_api_url:
                raise Exception("WALLET_API_URL environment variable not set")

            # Build query parameters
            params = {
                "limit": min(limit, 100),  # Enforce max limit
                "offset": offset,
            }
            if status:
                params["status"] = status

            # Call Wallet API
            wallet_response = requests.get(
                f"{wallet_api_url}/wallets/{room_id}/transactions",
                params=params,
                timeout=30
            )

            if not wallet_response.ok:
                raise Exception(f"Wallet API error: {wallet_response.status_code} - {wallet_response.text}")

            # Return Wallet API response as-is
            return wallet_response.json()

        except Exception as e:
            raise HTTPException(
                status_code=500,
                detail=f"Failed to retrieve transaction history: {str(e)}"
            )

    # Return the FastAPI application
    return web_app


# ============================================================================
# LOCAL ENTRYPOINT FOR TESTING
# ============================================================================

@app.local_entrypoint()
def main():
    """
    Local entrypoint for testing the application.

    Usage:
        modal run modal_app.py
    """
    print("AI Agent Launchpad - Agentica Platform")
    print("\nDeployed URLs:")
    print("\n✓ ElizaOS Server: https://herocast--agentica-platform-eliza-server.modal.run")
    print("✓ API Base URL: https://herocast--agentica-platform-api.modal.run")
    print("\nAPI Endpoints:")
    print("  GET    /health - Health check")
    print("  POST   /agents - Create a new agent")
    print("  GET    /agents?user_id=xxx - List user's agents")
    print("  DELETE /agents/{agent_id}?user_id=xxx - Delete an agent")
    print("  POST   /rooms - Create a new room")
    print("  GET    /rooms?user_id=xxx - List user's rooms")
    print("  POST   /rooms/{room_id}/messages - Send message to room")
    print("\nTo deploy:")
    print("  modal deploy backend/modal_app.py")
    print("\nTo view logs:")
    print("  modal app logs agentica-platform")
