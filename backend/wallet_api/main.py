"""
Wallet API - FastAPI application for CDP Server Wallet v2 management.

This API provides endpoints for:
- Creating smart account wallets for rooms (POST /wallets)
- Executing wallet actions dynamically (POST /wallets/{room_id}/{action})
- Retrieving transaction history (GET /wallets/{room_id}/transactions)
- Health checks (GET /health)

Supported Actions:
    - balance: Get smart account address and wallet information
    - transfer: Send ETH via smart account with gas sponsorship
    - swap: Token swap via CDP Trade API (powered by 0x aggregator)

Architecture:
    - CDP Server Wallet v2 stores keys on CDP servers (secure)
    - Smart accounts (ERC-4337) provide gas-sponsored transactions
    - Database stores wallet metadata and transaction logs
    - All actions logged to wallet_transactions table (no auto-retry)
    - Dynamic action router dispatches to action handlers

Environment Variables:
    - CDP_API_KEY_ID: CDP API key identifier
    - CDP_API_KEY_SECRET: CDP API key secret
    - CDP_WALLET_SECRET: Wallet encryption secret
    - SUPABASE_URL: Supabase project URL
    - SUPABASE_SERVICE_ROLE_KEY: Supabase service role key

Usage:
    # Local development
    uvicorn wallet_api.main:app --reload --port 8000

    # Production deployment (Modal)
    modal deploy backend/wallet_api/main.py
"""

import os
import sys
from pathlib import Path
from typing import Optional

from fastapi import FastAPI, HTTPException, status
from fastapi.responses import JSONResponse
from dotenv import load_dotenv

# Add parent directory to path to import local modules
sys.path.insert(0, str(Path(__file__).parent.parent))

from wallet_api.models import (
    CreateWalletRequest,
    WalletResponse,
    BalanceResponse,
    TransferRequest,
    TransferResponse,
    DynamicActionRequest,
    DynamicActionResponse,
    TransactionHistoryResponse,
    ErrorResponse
)
from wallet_api.database import (
    create_wallet,
    get_wallet,
    wallet_exists,
    log_transaction,
    update_transaction,
    get_transactions
)
from wallet_api.actions import execute_action, get_supported_actions

# Load environment variables from .env file (for local development)
load_dotenv()

# Initialize FastAPI app
app = FastAPI(
    title="Wallet API",
    description="CDP Server Wallet v2 management API for AI Agent Platform",
    version="0.1.0",
    docs_url="/docs",
    redoc_url="/redoc"
)

# Global CDP client (singleton, shared across requests)
cdp_client: Optional[any] = None


# ============================================================================
# LIFECYCLE EVENTS
# ============================================================================

@app.on_event("startup")
async def startup():
    """
    Initialize CDP Client on application startup.

    The CDP client is a singleton that maintains connection to CDP servers.
    It's shared across all requests for efficiency.

    Validates required environment variables:
    - CDP_API_KEY_ID
    - CDP_API_KEY_SECRET
    - CDP_WALLET_SECRET
    """
    global cdp_client

    # Verify required environment variables
    required_vars = ["CDP_API_KEY_ID", "CDP_API_KEY_SECRET", "CDP_WALLET_SECRET"]
    missing_vars = [var for var in required_vars if not os.getenv(var)]

    if missing_vars:
        raise RuntimeError(
            f"Missing required environment variables: {', '.join(missing_vars)}\n"
            "Please set these variables in your .env file or environment."
        )

    # Import CDP SDK (after env vars are loaded)
    try:
        from cdp import CdpClient
    except ImportError as e:
        raise RuntimeError(
            "Failed to import CDP SDK. Please install: pip install cdp-sdk>=0.11.0"
        ) from e

    # Initialize CDP Client
    try:
        cdp_client = CdpClient()
        print("✓ CDP Client initialized successfully")
        print(f"  API Key ID: {os.getenv('CDP_API_KEY_ID', '')[:20]}...")
    except Exception as e:
        raise RuntimeError(f"Failed to initialize CDP Client: {str(e)}") from e


@app.on_event("shutdown")
async def shutdown():
    """
    Close CDP Client on application shutdown.

    Ensures proper cleanup of resources and connections.
    """
    global cdp_client

    if cdp_client:
        try:
            await cdp_client.close()
            print("✓ CDP Client closed successfully")
        except Exception as e:
            print(f"Warning: Error closing CDP Client: {str(e)}")


# ============================================================================
# API ENDPOINTS
# ============================================================================

@app.get("/health", summary="Health check endpoint")
async def health_check():
    """
    Health check endpoint.

    Returns:
        Dict with status and CDP client availability
    """
    return {
        "status": "healthy",
        "cdp_client_initialized": cdp_client is not None,
        "service": "wallet-api",
        "version": "0.1.0"
    }


@app.post(
    "/wallets",
    response_model=WalletResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Create a new wallet for a room",
    responses={
        201: {"description": "Wallet created successfully"},
        400: {"model": ErrorResponse, "description": "Invalid request"},
        409: {"model": ErrorResponse, "description": "Wallet already exists"},
        500: {"model": ErrorResponse, "description": "Internal server error"}
    }
)
async def create_wallet_endpoint(request: CreateWalletRequest) -> WalletResponse:
    """
    Create a smart account (ERC-4337) wallet for a room with gas sponsorship.

    This endpoint:
    1. Checks if wallet already exists for the room
    2. Creates owner account (EOA) using pattern: "room-{room_id}-owner"
    3. Creates smart account (ERC-4337) controlled by owner
    4. Stores metadata in database (room_id, owner info, smart account address)
    5. Returns wallet information

    Smart Account Benefits:
    - FREE gas on Base Sepolia (auto-sponsored)
    - Users only need trading tokens (USDC), no ETH required
    - Perfect for autonomous trading

    Args:
        request: CreateWalletRequest with room_id

    Returns:
        WalletResponse with room_id, owner_account_name, owner_address, smart_account_address, network

    Raises:
        HTTPException:
            - 400: Invalid room_id
            - 409: Wallet already exists for this room
            - 500: CDP or database error
    """
    if not cdp_client:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="CDP Client not initialized"
        )

    room_id = request.room_id.strip()

    try:
        # Check if wallet already exists
        existing_wallet = await wallet_exists(room_id)
        if existing_wallet:
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail=f"Wallet already exists for room_id: {room_id}"
            )

        # Step 1: Create owner account (EOA)
        # Use room_id directly as account name (UUID = 36 chars, CDP limit = 36)
        owner_account_name = room_id

        try:
            owner_account = await cdp_client.evm.get_or_create_account(name=owner_account_name)
            owner_address = owner_account.address
        except Exception as e:
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail=f"Failed to create owner account: {str(e)}"
            )

        # Step 2: Create smart account (ERC-4337)
        try:
            smart_account = await cdp_client.evm.get_or_create_smart_account(
                name=owner_account_name,
                owner=owner_account
            )
            smart_account_address = smart_account.address
        except Exception as e:
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail=f"Failed to create smart account: {str(e)}"
            )

        # Step 3: Store wallet metadata in database
        try:
            db_wallet = await create_wallet(
                room_id=room_id,
                owner_account_name=owner_account_name,
                owner_address=owner_address,
                smart_account_address=smart_account_address,
                network="base"  # Base Mainnet
            )
        except Exception as e:
            # If database insert fails, accounts still exist on CDP
            # User can retry - get_or_create_account is idempotent
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail=f"Failed to save wallet to database: {str(e)}"
            )

        # Return wallet information
        return WalletResponse(
            room_id=room_id,
            owner_account_name=owner_account_name,
            owner_address=owner_address,
            smart_account_address=smart_account_address,
            network="base"  # Base Mainnet
        )

    except HTTPException:
        # Re-raise HTTP exceptions as-is
        raise
    except Exception as e:
        # Catch-all for unexpected errors
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Unexpected error creating wallet: {str(e)}"
        )


@app.post(
    "/wallets/{room_id}/{action}",
    response_model=DynamicActionResponse,
    summary="Execute a wallet action dynamically",
    responses={
        200: {"description": "Action executed successfully"},
        400: {"model": ErrorResponse, "description": "Invalid action or parameters"},
        404: {"model": ErrorResponse, "description": "Wallet not found"},
        501: {"model": ErrorResponse, "description": "Action not yet implemented"},
        500: {"model": ErrorResponse, "description": "Internal server error"}
    }
)
async def dynamic_action_endpoint(
    room_id: str,
    action: str,
    request: DynamicActionRequest
) -> DynamicActionResponse:
    """
    Execute a wallet action dynamically based on action type.

    This endpoint replaces the old balance and transfer endpoints with a unified
    dynamic router that supports multiple action types:
    - balance: Get wallet address and account information
    - transfer: Send ETH via smart account with gas sponsorship
    - swap: Token swap via CDP Trade API (powered by 0x aggregator)

    Transaction Logging:
    All actions are logged to the database for audit trail. Failed transactions
    are stored as-is with NO automatic retry (manual review required).

    Args:
        room_id: Room identifier
        action: Action type ('balance', 'transfer', 'swap')
        request: DynamicActionRequest with action-specific parameters

    Returns:
        DynamicActionResponse with success, action, transaction_id, result, and error

    Raises:
        HTTPException:
            - 400: Invalid action type or missing parameters
            - 404: Wallet not found
            - 501: Action not yet implemented (swap)
            - 500: CDP or database error
    """
    if not cdp_client:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="CDP Client not initialized"
        )

    # Validate action type
    supported_actions = get_supported_actions()
    if action not in supported_actions:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Invalid action: {action}. Supported actions: {', '.join(supported_actions.keys())}"
        )

    # Check if wallet exists
    wallet = await get_wallet(room_id)
    if not wallet:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Wallet not found for room_id: {room_id}"
        )

    # Log transaction as pending
    transaction_log = await log_transaction(
        room_id=room_id,
        action=action,
        params=request.params,
        status="pending"
    )
    transaction_id = transaction_log["id"]

    try:
        # Execute action
        result = await execute_action(
            room_id=room_id,
            action=action,
            params=request.params,
            cdp_client=cdp_client
        )

        # Update transaction as success
        await update_transaction(
            transaction_id=transaction_id,
            status="success",
            result=result
        )

        # Return success response
        return DynamicActionResponse(
            success=True,
            action=action,
            room_id=room_id,
            transaction_id=transaction_id,
            result=result,
            error=None
        )

    except HTTPException as e:
        # Update transaction as failed
        await update_transaction(
            transaction_id=transaction_id,
            status="failed",
            error=str(e.detail)
        )

        # Re-raise HTTP exceptions as-is
        raise

    except Exception as e:
        # Update transaction as failed
        error_message = str(e)
        await update_transaction(
            transaction_id=transaction_id,
            status="failed",
            error=error_message
        )

        # Return error response
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to execute action: {error_message}"
        )


@app.get(
    "/wallets/{room_id}/transactions",
    response_model=TransactionHistoryResponse,
    summary="Get transaction history for a wallet",
    responses={
        200: {"description": "Transaction history retrieved successfully"},
        404: {"model": ErrorResponse, "description": "Wallet not found"},
        500: {"model": ErrorResponse, "description": "Internal server error"}
    }
)
async def transaction_history_endpoint(
    room_id: str,
    limit: int = 50,
    offset: int = 0,
    status: Optional[str] = None
) -> TransactionHistoryResponse:
    """
    Retrieve transaction history for a wallet with pagination.

    This endpoint returns all logged wallet actions (balance, transfer, swap)
    for audit trail and debugging purposes.

    Args:
        room_id: Room identifier
        limit: Maximum number of records to return (default: 50, max: 100)
        offset: Number of records to skip (default: 0)
        status: Filter by status ('pending', 'success', 'failed'), or None for all

    Returns:
        TransactionHistoryResponse with room_id, transactions, total, limit, offset

    Raises:
        HTTPException:
            - 404: Wallet not found
            - 500: Database error
    """
    # Check if wallet exists
    wallet = await get_wallet(room_id)
    if not wallet:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Wallet not found for room_id: {room_id}"
        )

    # Enforce max limit
    if limit > 100:
        limit = 100

    try:
        # Get transactions
        transactions = await get_transactions(
            room_id=room_id,
            limit=limit,
            offset=offset,
            status=status
        )

        # Get total count (without pagination)
        all_transactions = await get_transactions(
            room_id=room_id,
            limit=10000,  # Large number to get all
            offset=0,
            status=status
        )
        total = len(all_transactions)

        # Return response
        return TransactionHistoryResponse(
            room_id=room_id,
            transactions=transactions,
            total=total,
            limit=limit,
            offset=offset
        )

    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to retrieve transaction history: {str(e)}"
        )


# ============================================================================
# ERROR HANDLERS
# ============================================================================

@app.exception_handler(Exception)
async def global_exception_handler(request, exc):
    """
    Global exception handler for uncaught exceptions.

    Logs error and returns JSON response with error details.
    """
    print(f"Unhandled exception: {exc}")
    import traceback
    traceback.print_exc()

    return JSONResponse(
        status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
        content={
            "detail": "Internal server error",
            "error": str(exc)
        }
    )


# ============================================================================
# MAIN (for local development)
# ============================================================================

if __name__ == "__main__":
    import uvicorn

    print("Starting Wallet API server...")
    print("Environment variables:")
    print(f"  CDP_API_KEY_ID: {os.getenv('CDP_API_KEY_ID', 'NOT SET')[:20]}...")
    print(f"  CDP_WALLET_SECRET: {os.getenv('CDP_WALLET_SECRET', 'NOT SET')[:20]}...")
    print(f"  SUPABASE_URL: {os.getenv('SUPABASE_URL', 'NOT SET')}")

    uvicorn.run(
        "main:app",
        host="0.0.0.0",
        port=8000,
        reload=True,
        log_level="info"
    )
