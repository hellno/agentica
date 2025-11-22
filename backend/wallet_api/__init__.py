"""
Wallet API - FastAPI service for managing CDP Server Wallet v2 accounts.

This package provides:
- REST API endpoints for wallet creation and balance checking
- Database operations for wallet metadata persistence
- CDP Server Wallet v2 integration
- Pydantic models for request/response validation

Usage:
    # Start the API server locally
    uvicorn wallet_api.main:app --reload

    # Or run with Modal
    modal deploy backend/wallet_api/main.py

Architecture:
    - CDP Server Wallet v2 stores keys on CDP servers (secure)
    - Database only stores account names and addresses (metadata)
    - Account naming pattern: "room-{room_id}" (critical for room-to-wallet mapping)
    - get_or_create_account() is idempotent (safe to call multiple times)
"""

__version__ = "0.1.0"
