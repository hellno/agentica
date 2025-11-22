"""
Database operations for Wallet API using Supabase.

This module provides async functions for:
- Creating wallet records
- Retrieving wallet information
- Checking wallet existence
- Managing wallet metadata

Database Schema (agent_wallets table):
    - id: UUID primary key
    - room_id: UUID foreign key to platform_rooms (unique)
    - account_name: TEXT (unique, pattern: "room-{room_id}")
    - address: TEXT (blockchain address)
    - network: TEXT (default: "base-sepolia")
    - created_at: TIMESTAMPTZ (auto-generated)

Usage:
    from wallet_api.database import create_wallet, get_wallet

    # Create wallet record
    wallet = await create_wallet(
        room_id="123",
        account_name="room-123",
        address="0x...",
        network="base-sepolia"
    )

    # Retrieve wallet
    wallet = await get_wallet(room_id="123")
"""

import os
import sys
from typing import Optional, Dict, Any
from pathlib import Path

# Add parent directory to path to import config
sys.path.insert(0, str(Path(__file__).parent.parent))

from config import create_supabase_client


async def create_wallet(
    room_id: str,
    owner_account_name: str,
    owner_address: str,
    smart_account_address: str,
    network: str = "base-sepolia"
) -> Dict[str, Any]:
    """
    Create a new wallet record in the database.

    Args:
        room_id: Room identifier
        owner_account_name: CDP account name for owner EOA (pattern: "room-{room_id}-owner")
        owner_address: Owner account blockchain address (EOA)
        smart_account_address: Smart account address (ERC-4337 trading wallet)
        network: Network identifier (default: "base-sepolia")

    Returns:
        Dict containing the created wallet record

    Raises:
        Exception: If database operation fails (e.g., duplicate room_id/account_name)
    """
    supabase = create_supabase_client()

    # Insert wallet record with smart account fields
    result = supabase.table("agent_wallets").insert({
        "room_id": room_id,
        "owner_account_name": owner_account_name,
        "address": owner_address,  # Owner EOA address
        "smart_account_address": smart_account_address,  # Trading wallet
        "account_name": owner_account_name,  # For backwards compatibility
        "network": network
    }).execute()

    # Supabase returns data in result.data
    if not result.data or len(result.data) == 0:
        raise Exception("Failed to create wallet record in database")

    return result.data[0]


async def get_wallet(room_id: str) -> Optional[Dict[str, Any]]:
    """
    Retrieve wallet information by room_id.

    Args:
        room_id: Room identifier

    Returns:
        Dict containing wallet record, or None if not found

    Raises:
        Exception: If database operation fails
    """
    supabase = create_supabase_client()

    # Query wallet by room_id
    result = supabase.table("agent_wallets").select("*").eq("room_id", room_id).execute()

    # Return first result or None
    if result.data and len(result.data) > 0:
        return result.data[0]
    return None


async def wallet_exists(room_id: str) -> bool:
    """
    Check if a wallet exists for the given room_id.

    Args:
        room_id: Room identifier

    Returns:
        True if wallet exists, False otherwise

    Raises:
        Exception: If database operation fails
    """
    wallet = await get_wallet(room_id)
    return wallet is not None


async def get_wallet_by_account_name(account_name: str) -> Optional[Dict[str, Any]]:
    """
    Retrieve wallet information by account_name.

    Useful for reverse lookups when you have the CDP account name.

    Args:
        account_name: CDP Server Wallet v2 account name

    Returns:
        Dict containing wallet record, or None if not found

    Raises:
        Exception: If database operation fails
    """
    supabase = create_supabase_client()

    # Query wallet by account_name
    result = supabase.table("agent_wallets").select("*").eq("account_name", account_name).execute()

    # Return first result or None
    if result.data and len(result.data) > 0:
        return result.data[0]
    return None


async def list_wallets(limit: int = 100, offset: int = 0) -> list[Dict[str, Any]]:
    """
    List all wallets with pagination.

    Args:
        limit: Maximum number of records to return (default: 100)
        offset: Number of records to skip (default: 0)

    Returns:
        List of wallet records

    Raises:
        Exception: If database operation fails
    """
    supabase = create_supabase_client()

    # Query wallets with pagination
    result = (
        supabase.table("agent_wallets")
        .select("*")
        .order("created_at", desc=True)
        .range(offset, offset + limit - 1)
        .execute()
    )

    return result.data or []


async def delete_wallet(room_id: str) -> bool:
    """
    Delete a wallet record by room_id.

    Note: This only deletes the database record, not the CDP account.
    CDP Server Wallet v2 accounts persist on CDP servers.

    Args:
        room_id: Room identifier

    Returns:
        True if wallet was deleted, False if not found

    Raises:
        Exception: If database operation fails
    """
    supabase = create_supabase_client()

    # Delete wallet record
    result = supabase.table("agent_wallets").delete().eq("room_id", room_id).execute()

    # Return True if at least one row was deleted
    return result.data and len(result.data) > 0


# ============================================================================
# TRANSACTION LOGGING (Day 3 - Dynamic Action Router)
# ============================================================================

async def log_transaction(
    room_id: str,
    action: str,
    params: Dict[str, Any],
    status: str = "pending"
) -> Dict[str, Any]:
    """
    Create a transaction log entry for a wallet action.

    This logs all wallet actions (balance, transfer, swap) for audit trail and debugging.
    Transactions are initially created with 'pending' status, then updated to 'success'
    or 'failed' based on execution outcome.

    NO AUTOMATIC RETRY: Failed transactions are stored as-is for manual review.

    Args:
        room_id: Room identifier
        action: Action type ('balance', 'transfer', 'swap')
        params: Action parameters as dict (stored as JSONB)
        status: Initial status ('pending', 'success', 'failed')

    Returns:
        Dict containing the created transaction record with 'id' field

    Raises:
        Exception: If database operation fails
    """
    supabase = create_supabase_client()

    # Insert transaction log
    result = supabase.table("wallet_transactions").insert({
        "room_id": room_id,
        "action": action,
        "params": params,
        "status": status
    }).execute()

    # Supabase returns data in result.data
    if not result.data or len(result.data) == 0:
        raise Exception("Failed to create transaction log in database")

    return result.data[0]


async def update_transaction(
    transaction_id: str,
    status: str,
    result: Optional[Dict[str, Any]] = None,
    error: Optional[str] = None
) -> Dict[str, Any]:
    """
    Update a transaction log entry with execution result.

    This is called after action execution to record the outcome.
    NO AUTOMATIC RETRY: Failed transactions remain in 'failed' status for manual review.

    Args:
        transaction_id: Transaction ID (UUID)
        status: Final status ('success' or 'failed')
        result: Success result data as dict (stored as JSONB, optional)
        error: Error message if status is 'failed' (optional)

    Returns:
        Dict containing the updated transaction record

    Raises:
        Exception: If database operation fails
    """
    supabase = create_supabase_client()

    # Build update data
    update_data = {
        "status": status,
        "updated_at": "now()"  # Supabase will handle this
    }

    if result is not None:
        update_data["result"] = result

    if error is not None:
        update_data["error"] = error

    # Update transaction record
    db_result = supabase.table("wallet_transactions").update(update_data).eq("id", transaction_id).execute()

    # Supabase returns updated data in result.data
    if not db_result.data or len(db_result.data) == 0:
        raise Exception(f"Failed to update transaction {transaction_id} in database")

    return db_result.data[0]


async def get_transactions(
    room_id: str,
    limit: int = 50,
    offset: int = 0,
    status: Optional[str] = None
) -> list[Dict[str, Any]]:
    """
    Retrieve transaction history for a room with pagination.

    Args:
        room_id: Room identifier
        limit: Maximum number of records to return (default: 50)
        offset: Number of records to skip (default: 0)
        status: Filter by status ('pending', 'success', 'failed'), or None for all

    Returns:
        List of transaction records, ordered by created_at (newest first)

    Raises:
        Exception: If database operation fails
    """
    supabase = create_supabase_client()

    # Build query
    query = (
        supabase.table("wallet_transactions")
        .select("*")
        .eq("room_id", room_id)
    )

    # Apply status filter if provided
    if status:
        query = query.eq("status", status)

    # Execute query with pagination and ordering
    result = (
        query
        .order("created_at", desc=True)
        .range(offset, offset + limit - 1)
        .execute()
    )

    return result.data or []
