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

# Token address mapping for Base Mainnet
# Maps token symbols to their contract addresses
TOKEN_ADDRESSES = {
    "ETH": "0x0000000000000000000000000000000000000000",  # Native ETH
    "WETH": "0x4200000000000000000000000000000000000006",  # Wrapped ETH
    "USDC": "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913",  # USD Coin
    "DAI": "0x50c5725949A6F0c72E6C4a641F24049A917DB0Cb",   # Dai Stablecoin
    "USDT": "0xfde4C96c8593536E31F229EA8f37b2ADa2699bb2",  # Tether USD
    # Add more tokens as needed
}

def resolve_token_address(token: str) -> str:
    """
    Resolve token symbol or address to contract address.

    Args:
        token: Token symbol (e.g., "USDC") or address (e.g., "0x833...")

    Returns:
        Token contract address

    Raises:
        HTTPException: If token symbol not found
    """
    # If already an address (starts with 0x), return as-is
    if token.startswith("0x"):
        return token

    # Convert symbol to uppercase and look up address
    symbol = token.upper()
    if symbol in TOKEN_ADDRESSES:
        return TOKEN_ADDRESSES[symbol]

    # Token not found
    raise HTTPException(
        status_code=status.HTTP_400_BAD_REQUEST,
        detail=f"Unknown token: {token}. Supported tokens: {', '.join(TOKEN_ADDRESSES.keys())}"
    )


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
            "network": wallet.get("network", "base")  # Base Mainnet
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
                network="base",  # Base Mainnet
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
        block_explorer = f"https://basescan.org/tx/{transaction_hash}" if transaction_hash else None  # Base Mainnet

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
    Handle swap action - token swap via CDP Trade API (powered by 0x aggregator).

    This action performs token swaps using CDP's built-in Trade API which:
    - Aggregates liquidity across multiple DEXes (Uniswap, SushiSwap, Curve, etc.)
    - Provides sub-500ms execution latency
    - Includes automatic slippage protection
    - Supports gas-sponsored transactions via Smart Accounts
    - Returns best prices through MEV-aware routing

    Args:
        room_id: Room identifier
        params: Dict with:
            - from_token: Token to sell (address or symbol like "ETH", "USDC")
            - to_token: Token to buy (address or symbol)
            - amount: Amount to sell (in token's base units or decimal string)
            - slippage_bps: Optional slippage tolerance in basis points (default: 100 = 1%)
        cdp_client: CDP client instance

    Returns:
        Dict with:
            - user_op_hash: User operation hash
            - transaction_hash: Blockchain transaction hash (after confirmation)
            - status: Operation status ("pending", "complete", etc.)
            - from_token: Token sold
            - to_token: Token bought
            - from_amount: Amount sold
            - to_amount: Amount received (estimated)
            - block_explorer: Block explorer URL

    Raises:
        HTTPException: 400 for invalid params, 404 if wallet not found, 500 for errors
    """
    from wallet_api.database import get_wallet

    # Validate required parameters
    from_token = params.get("from_token")
    to_token = params.get("to_token")
    amount = params.get("amount")
    slippage_bps = params.get("slippage_bps", 100)  # Default: 1% slippage

    if not from_token:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Missing required parameter: from_token"
        )

    if not to_token:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Missing required parameter: to_token"
        )

    if not amount:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Missing required parameter: amount"
        )

    # Resolve token symbols to addresses (supports both symbols like "USDC" and addresses like "0x833...")
    from_token_address = resolve_token_address(from_token)
    to_token_address = resolve_token_address(to_token)

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

        # Step 1: Approve Permit2 to spend tokens (required for ERC20 swaps)
        # Skip approval for native ETH (address: 0x0000000000000000000000000000000000000000)
        permit2_address = "0x000000000022D473030F116dDEE9F6B43aC78BA3"

        # Get paymaster URL from environment for gas sponsorship
        import os
        paymaster_url = os.getenv("CDP_PAYMASTER_URL")

        if from_token.lower() not in ["0x0000000000000000000000000000000000000000", "eth"]:
            try:
                from cdp.evm_call_types import EncodedCall
                from web3 import Web3

                # Encode ERC20 approve(address spender, uint256 amount) call using Web3 ABI encoder
                from eth_abi import encode

                # ERC20 approve function: approve(address spender, uint256 amount)
                # Function selector: 0x095ea7b3
                function_selector = "0x095ea7b3"
                # Encode parameters: permit2_address and amount * 10 (for safety margin)
                encoded_params = encode(
                    ['address', 'uint256'],
                    [Web3.to_checksum_address(permit2_address), int(amount) * 10]
                ).hex()
                approve_data = function_selector + encoded_params

                # Send approval user operation with gas sponsorship
                approval_op = await cdp_client.evm.send_user_operation(
                    smart_account=smart_account,
                    network="base",
                    calls=[
                        EncodedCall(
                            to=from_token,  # USDC contract address
                            data=approve_data,
                            value=0
                        )
                    ],
                    paymaster_url=paymaster_url  # Gas sponsorship
                )

                # Wait for approval confirmation
                await cdp_client.evm.wait_for_user_operation(
                    smart_account_address=smart_account.address,
                    user_op_hash=approval_op.user_op_hash
                )

            except Exception as e:
                raise HTTPException(
                    status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                    detail=f"Failed to approve Permit2: {str(e)}"
                )

        # Step 2: Execute swap
        try:
            # Import SmartAccountSwapOptions
            from cdp.actions.evm.swap import SmartAccountSwapOptions

            # All-in-one swap method (now with Permit2 approval set)
            swap_options = SmartAccountSwapOptions(
                network="base",
                from_token=from_token,
                to_token=to_token,
                from_amount=str(amount),
                slippage_bps=slippage_bps
            )

            # Add paymaster URL if available for gas sponsorship
            if paymaster_url:
                swap_options.paymaster_url = paymaster_url

            result = await smart_account.swap(swap_options)

            user_op_hash = result.user_op_hash

            # Store swap details for response
            swap_from_amount = str(amount)
            swap_to_amount = getattr(result, 'to_amount', None)

        except Exception as e:
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail=f"Failed to execute swap: {str(e)}"
            )

        # Wait for confirmation
        try:
            receipt = await smart_account.wait_for_user_operation(user_op_hash=user_op_hash)
        except Exception as e:
            # Return partial response if confirmation fails
            return {
                "user_op_hash": user_op_hash,
                "transaction_hash": None,
                "status": "pending",
                "from_token": from_token,
                "to_token": to_token,
                "from_amount": swap_from_amount,
                "to_amount": swap_to_amount,
                "block_explorer": None
            }

        # Return success response
        transaction_hash = receipt.transaction_hash if receipt.status == "complete" else None
        block_explorer = f"https://basescan.org/tx/{transaction_hash}" if transaction_hash else None  # Base Mainnet

        return {
            "user_op_hash": user_op_hash,
            "transaction_hash": transaction_hash,
            "status": receipt.status,
            "from_token": from_token,
            "to_token": to_token,
            "from_amount": swap_from_amount,
            "to_amount": swap_to_amount,
            "block_explorer": block_explorer
        }

    except HTTPException:
        # Re-raise HTTP exceptions as-is
        raise
    except Exception as e:
        # Catch-all for unexpected errors
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to process swap: {str(e)}"
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
            "description": "Swap tokens via CDP Trade API (powered by 0x aggregator)",
            "required_params": ["from_token", "to_token", "amount"]
        }
    }
