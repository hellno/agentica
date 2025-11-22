"""
Wallet Actions Module - Dynamic action handlers for wallet operations.

This module provides a dynamic action router that handles:
- balance: Get smart account address information
- transfer: Send ETH via smart account with gas sponsorship
- swap: Token swap (not yet implemented - returns HTTP 501)

Each action is logged to the database for audit trail.
Failed transactions are stored as-is with no automatic retry.

Architecture:
    - execute_action() is the main dispatcher
    - Each handler (handle_*) is responsible for one action type
    - get_supported_actions() provides the action registry
    - All handlers receive room_id, params dict, and cdp_client
"""

from typing import Dict, Any, List
from fastapi import HTTPException, status


# ============================================================================
# ACTION HANDLERS
# ============================================================================

async def handle_balance(room_id: str, params: Dict[str, Any], cdp_client) -> Dict[str, Any]:
    """
    Handle balance action - returns smart account address information.

    This retrieves the wallet metadata from database and returns the smart account
    address which is the actual trading wallet. Users should fund this address with
    tokens (no ETH needed for gas sponsorship).

    Args:
        room_id: Room identifier
        params: Action parameters (unused for balance)
        cdp_client: CDP client instance

    Returns:
        Dict with address, account_name, room_id

    Raises:
        HTTPException: 404 if wallet not found, 500 for other errors
    """
    from wallet_api.database import get_wallet

    try:
        # Retrieve wallet from database
        wallet = await get_wallet(room_id)
        if not wallet:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Wallet not found for room_id: {room_id}"
            )

        # Get smart account address (the trading wallet)
        smart_account_address = wallet.get("smart_account_address")
        owner_account_name = wallet.get("owner_account_name") or wallet.get("account_name")

        # For backwards compatibility, handle old wallets
        if not smart_account_address:
            smart_account_address = wallet.get("address")

        # Return balance information
        return {
            "address": smart_account_address,
            "account_name": owner_account_name,
            "room_id": room_id,
            "network": wallet.get("network", "base-sepolia")
        }

    except HTTPException:
        # Re-raise HTTP exceptions as-is
        raise
    except Exception as e:
        # Catch-all for unexpected errors
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to retrieve balance: {str(e)}"
        )


async def handle_transfer(room_id: str, params: Dict[str, Any], cdp_client) -> Dict[str, Any]:
    """
    Handle transfer action - send ETH via smart account with gas sponsorship.

    This reuses the smart account transfer logic from the original transfer endpoint.
    It retrieves the wallet, gets the smart account, sends a user operation (gas-sponsored),
    and waits for confirmation.

    Args:
        room_id: Room identifier
        params: Dict with 'to_address' and 'amount' (in ETH)
        cdp_client: CDP client instance

    Returns:
        Dict with user_op_hash, transaction_hash, status, block_explorer

    Raises:
        HTTPException: 400 for invalid params, 404 if wallet not found, 500 for errors
    """
    from wallet_api.database import get_wallet

    # Validate required parameters
    to_address = params.get("to_address")
    amount = params.get("amount")

    if not to_address:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Missing required parameter: to_address"
        )

    if not amount:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Missing required parameter: amount"
        )

    try:
        # Retrieve wallet from database
        wallet = await get_wallet(room_id)
        if not wallet:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Wallet not found for room_id: {room_id}"
            )

        owner_account_name = wallet.get("owner_account_name") or wallet.get("account_name")
        if not owner_account_name:
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail="Wallet missing owner account name"
            )

        # Get owner account
        try:
            owner_account = await cdp_client.evm.get_or_create_account(name=owner_account_name)
        except Exception as e:
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail=f"Failed to retrieve owner account: {str(e)}"
            )

        # Get smart account (idempotent - returns existing if already created)
        try:
            smart_account = await cdp_client.evm.get_or_create_smart_account(
                name=owner_account_name,
                owner=owner_account
            )
        except Exception as e:
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail=f"Failed to retrieve smart account: {str(e)}"
            )

        # Send user operation (gas-sponsored!)
        try:
            from cdp.evm_call_types import EncodedCall
            from web3 import Web3
            from decimal import Decimal

            user_operation = await cdp_client.evm.send_user_operation(
                smart_account=smart_account,
                network="base-sepolia",
                calls=[
                    EncodedCall(
                        to=to_address,
                        data="0x",
                        value=Web3.to_wei(Decimal(amount), "ether")
                    )
                ]
            )
        except Exception as e:
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail=f"Failed to send user operation: {str(e)}"
            )

        # Wait for confirmation
        try:
            confirmed = await cdp_client.evm.wait_for_user_operation(
                smart_account_address=smart_account.address,
                user_op_hash=user_operation.user_op_hash
            )
        except Exception as e:
            # Return partial response if confirmation fails
            return {
                "user_op_hash": user_operation.user_op_hash,
                "transaction_hash": None,
                "status": user_operation.status,
                "block_explorer": None
            }

        # Return success response
        transaction_hash = confirmed.transaction_hash if confirmed.status == "complete" else None
        block_explorer = f"https://sepolia.basescan.org/tx/{transaction_hash}" if transaction_hash else None

        return {
            "user_op_hash": user_operation.user_op_hash,
            "transaction_hash": transaction_hash,
            "status": confirmed.status,
            "block_explorer": block_explorer
        }

    except HTTPException:
        # Re-raise HTTP exceptions as-is
        raise
    except Exception as e:
        # Catch-all for unexpected errors
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to process transfer: {str(e)}"
        )


async def handle_swap(room_id: str, params: Dict[str, Any], cdp_client) -> Dict[str, Any]:
    """
    Handle swap action - token swap via DEX integration.

    This action is not yet implemented. It requires integration with a DEX protocol
    (e.g., Uniswap, 1inch) to perform token swaps.

    Args:
        room_id: Room identifier
        params: Dict with swap parameters (from_token, to_token, amount, etc.)
        cdp_client: CDP client instance

    Returns:
        Never returns - always raises HTTP 501

    Raises:
        HTTPException: Always raises 501 Not Implemented
    """
    raise HTTPException(
        status_code=status.HTTP_501_NOT_IMPLEMENTED,
        detail="Swap action requires DEX integration (not yet implemented)"
    )


# ============================================================================
# ACTION DISPATCHER
# ============================================================================

async def execute_action(
    room_id: str,
    action: str,
    params: Dict[str, Any],
    cdp_client
) -> Dict[str, Any]:
    """
    Execute a wallet action dynamically based on action type.

    This is the main dispatcher that routes actions to their respective handlers.
    It validates the action type and delegates to the appropriate handler function.

    Args:
        room_id: Room identifier
        action: Action type ('balance', 'transfer', 'swap')
        params: Action-specific parameters
        cdp_client: CDP client instance

    Returns:
        Dict with action result (structure varies by action type)

    Raises:
        HTTPException: 400 for invalid action, or handler-specific errors
    """
    # Get action registry
    supported_actions = get_supported_actions()

    # Validate action
    if action not in supported_actions:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Invalid action: {action}. Supported actions: {', '.join(supported_actions.keys())}"
        )

    # Get handler function
    handler = supported_actions[action]["handler"]

    # Execute action
    result = await handler(room_id, params, cdp_client)

    return result


def get_supported_actions() -> Dict[str, Dict[str, Any]]:
    """
    Get registry of supported wallet actions.

    This provides metadata about each action including the handler function,
    description, and required parameters.

    Returns:
        Dict mapping action names to their metadata:
        {
            "action_name": {
                "handler": async function,
                "description": str,
                "required_params": list of str
            }
        }
    """
    return {
        "balance": {
            "handler": handle_balance,
            "description": "Get wallet balance and address information",
            "required_params": []
        },
        "transfer": {
            "handler": handle_transfer,
            "description": "Send ETH transfer via smart account (gas-sponsored)",
            "required_params": ["to_address", "amount"]
        },
        "swap": {
            "handler": handle_swap,
            "description": "Swap tokens via DEX integration (not yet implemented)",
            "required_params": ["from_token", "to_token", "amount"]
        }
    }
