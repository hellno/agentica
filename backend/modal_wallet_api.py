"""
Modal deployment for Wallet API - CDP Server Wallet v2 management.

This module deploys the Wallet API as a Modal ASGI application, providing
endpoints for:
- Creating smart account wallets for rooms (POST /wallets)
- Retrieving wallet balance information (GET /wallets/{room_id}/balance)
- Sending gas-sponsored transfers (POST /wallets/{room_id}/transfer)
- Health checks (GET /health)

Architecture:
    - CDP Server Wallet v2 stores keys on CDP servers (secure)
    - Smart accounts (ERC-4337) with gas sponsorship on Base Sepolia
    - Database stores metadata: room_id, account_name, address
    - Account naming: "room-{room_id}-owner" for owner EOA
    - get_or_create_account() is idempotent (safe to call multiple times)

Environment Variables (from Modal secrets):
    - CDP_API_KEY_ID: CDP API key identifier
    - CDP_API_KEY_SECRET: CDP API key secret
    - CDP_WALLET_SECRET: Wallet encryption secret
    - SUPABASE_URL: Supabase project URL
    - SUPABASE_SERVICE_ROLE_KEY: Supabase service role key

Usage:
    # Deploy to Modal
    modal deploy backend/modal_wallet_api.py

    # View logs
    modal app logs agentica-wallet-api

    # Test locally
    modal run backend/modal_wallet_api.py
"""

import sys
from pathlib import Path

import modal

# Add backend directory to path for imports
sys.path.insert(0, str(Path(__file__).parent))

# ============================================================================
# MODAL APP INITIALIZATION
# ============================================================================

app = modal.App("agentica-wallet-api")

# ============================================================================
# DOCKER IMAGE CONFIGURATION
# ============================================================================

# API image with all dependencies
api_image = (
    modal.Image.debian_slim(python_version="3.11")
    .pip_install(
        "fastapi[standard]>=0.104.0",  # Web framework with uvicorn
        "cdp-sdk>=0.11.0",              # CDP Server Wallet v2
        "web3>=6.0.0",                  # Web3 for blockchain interactions
        "supabase>=2.0.0",              # Database client
        "python-dotenv>=1.0.0",         # Environment variables
        "pydantic>=2.0.0",              # Request/response validation
    )
    # Add wallet_api module to the image
    .add_local_dir(
        str(Path(__file__).parent / "wallet_api"),
        "/root/wallet_api",
        copy=True
    )
    # Add config.py (required by wallet_api/database.py)
    .add_local_file(
        str(Path(__file__).parent / "config.py"),
        "/root/config.py"
    )
)

# ============================================================================
# FASTAPI APPLICATION
# ============================================================================

@app.function(
    image=api_image,
    secrets=[modal.Secret.from_name("agentica-secrets")],
    cpu=1,
    memory=1024,  # 1GB RAM
    timeout=300,  # 5 minutes for long-running operations
    min_containers=0,  # Scale to zero when idle
    max_containers=10,  # Scale up as needed
)
@modal.concurrent(max_inputs=100)  # Handle concurrent requests
@modal.asgi_app()
def wallet_api():
    """
    Deploy Wallet API as Modal ASGI application.

    This function imports the FastAPI app from wallet_api.main and returns it
    for Modal to serve. The app is configured with:
    - CDP Client initialization on startup
    - Smart account creation with gas sponsorship
    - Database persistence for wallet metadata
    - Automatic cleanup on shutdown

    Returns:
        FastAPI: The Wallet API application instance

    Endpoints:
        - GET  /health - Health check
        - POST /wallets - Create smart account wallet for room
        - GET  /wallets/{room_id}/balance - Get wallet balance info
        - POST /wallets/{room_id}/transfer - Send gas-sponsored transfer
        - GET  /docs - API documentation (Swagger UI)
        - GET  /redoc - API documentation (ReDoc)
    """
    # Import inside function so it runs in Modal container
    from wallet_api.main import app as fastapi_app

    return fastapi_app


# ============================================================================
# LOCAL ENTRYPOINT FOR TESTING
# ============================================================================

@app.local_entrypoint()
def main():
    """
    Local entrypoint for testing the application.

    Usage:
        modal run backend/modal_wallet_api.py
    """
    print("\n" + "="*80)
    print("WALLET API - Modal Deployment")
    print("="*80)
    print("\nService: CDP Server Wallet v2 Management")
    print("Network: Base Sepolia (testnet)")
    print("Features:")
    print("  • Smart accounts (ERC-4337) with gas sponsorship")
    print("  • FREE gas on Base Sepolia")
    print("  • Server-side key storage (CDP managed)")
    print("  • Room-based wallet management")
    print("\nDeployment Status:")
    print("  ✓ Modal app configured: agentica-wallet-api")
    print("  ✓ Image: Python 3.11 + FastAPI + CDP SDK")
    print("  ✓ Secrets: agentica-secrets (required)")
    print("\nTo deploy:")
    print("  modal deploy backend/modal_wallet_api.py")
    print("\nTo view logs:")
    print("  modal app logs agentica-wallet-api")
    print("\nTo test:")
    print("  python backend/test_wallet_api_modal.py")
    print("\nAPI Documentation:")
    print("  https://YOUR_ORG--agentica-wallet-api-wallet-api.modal.run/docs")
    print("="*80 + "\n")
