"""
Pydantic models for Wallet API request/response validation.

These models define the data structures for:
- Wallet creation requests
- Wallet information responses
- Balance query responses
- Transfer requests/responses
- Dynamic action requests/responses (Day 3)
- Transaction history responses (Day 3)
- Error responses

All models include proper type hints and validation rules.
"""

from typing import Optional, Dict, Any, List
from pydantic import BaseModel, Field, field_validator


class CreateWalletRequest(BaseModel):
    """
    Request model for creating a new wallet.

    Attributes:
        room_id: Unique identifier for the room (will be used in account name pattern)
    """
    room_id: str = Field(
        ...,
        description="Room ID (UUID or string identifier)",
        min_length=1,
        max_length=255
    )

    @field_validator('room_id')
    @classmethod
    def validate_room_id(cls, v: str) -> str:
        """Validate room_id is not empty after stripping whitespace."""
        v = v.strip()
        if not v:
            raise ValueError("room_id cannot be empty or only whitespace")
        return v


class WalletResponse(BaseModel):
    """
    Response model for wallet information.

    Attributes:
        room_id: Room identifier
        owner_account_name: CDP account name for owner EOA (pattern: "room-{room_id}-owner")
        owner_address: Owner account blockchain address (EOA)
        smart_account_address: Smart account address (ERC-4337 trading wallet)
        network: Network identifier (e.g., "base-sepolia")
    """
    room_id: str
    owner_account_name: str
    owner_address: str
    smart_account_address: str
    network: str = "base-sepolia"

    class Config:
        json_schema_extra = {
            "example": {
                "room_id": "550e8400-e29b-41d4-a716-446655440000",
                "owner_account_name": "room-550e8400-e29b-41d4-a716-446655440000-owner",
                "owner_address": "0x1234567890123456789012345678901234567890",
                "smart_account_address": "0xabcdef0123456789abcdef0123456789abcdef01",
                "network": "base-sepolia"
            }
        }


class BalanceResponse(BaseModel):
    """
    Response model for wallet balance information.

    Attributes:
        address: Blockchain address
        account_name: CDP Server Wallet v2 account name
        room_id: Room identifier
        balance: Optional balance information (to be implemented)
    """
    address: str
    account_name: str
    room_id: str
    # Future: Add balance field when CDP SDK provides balance API
    # balance: Optional[str] = None

    class Config:
        json_schema_extra = {
            "example": {
                "address": "0x1234567890123456789012345678901234567890",
                "account_name": "room-550e8400-e29b-41d4-a716-446655440000",
                "room_id": "550e8400-e29b-41d4-a716-446655440000"
            }
        }


class TransferRequest(BaseModel):
    """
    Request model for sending ETH transfers via smart account.

    Attributes:
        to_address: Recipient address
        amount: Amount in ETH (e.g., "0.001")
    """
    to_address: str = Field(
        ...,
        description="Recipient blockchain address",
        min_length=42,
        max_length=42,
        pattern=r"^0x[a-fA-F0-9]{40}$"
    )
    amount: str = Field(
        ...,
        description="Amount in ETH (e.g., '0.001')",
        pattern=r"^\d+(\.\d+)?$"
    )

    class Config:
        json_schema_extra = {
            "example": {
                "to_address": "0x1234567890123456789012345678901234567890",
                "amount": "0.001"
            }
        }


class TransferResponse(BaseModel):
    """
    Response model for transfer operations.

    Attributes:
        user_op_hash: User operation hash
        transaction_hash: On-chain transaction hash (if confirmed)
        status: Operation status
        block_explorer: Block explorer URL (if confirmed)
    """
    user_op_hash: str
    transaction_hash: Optional[str] = None
    status: str
    block_explorer: Optional[str] = None

    class Config:
        json_schema_extra = {
            "example": {
                "user_op_hash": "0xabcdef...",
                "transaction_hash": "0x123456...",
                "status": "complete",
                "block_explorer": "https://sepolia.basescan.org/tx/0x123456..."
            }
        }


class ErrorResponse(BaseModel):
    """
    Standard error response model.

    Attributes:
        detail: Human-readable error message
        error_code: Optional machine-readable error code
    """
    detail: str
    error_code: Optional[str] = None

    class Config:
        json_schema_extra = {
            "example": {
                "detail": "Wallet not found for room_id: xxx",
                "error_code": "WALLET_NOT_FOUND"
            }
        }


# ============================================================================
# DAY 3: Dynamic Action Router Models
# ============================================================================

class DynamicActionRequest(BaseModel):
    """
    Request model for dynamic wallet actions.

    This model supports multiple action types (balance, transfer, swap)
    with action-specific parameters passed as a flexible dictionary.

    Attributes:
        params: Action-specific parameters as key-value pairs
            - balance: {} (no params required)
            - transfer: {"to_address": "0x...", "amount": "0.001"}
            - swap: {"from_token": "ETH", "to_token": "USDC", "amount": "1.0"}
    """
    params: Dict[str, Any] = Field(
        default_factory=dict,
        description="Action-specific parameters"
    )

    class Config:
        json_schema_extra = {
            "examples": [
                {
                    "description": "Balance action (no params)",
                    "value": {"params": {}}
                },
                {
                    "description": "Transfer action",
                    "value": {
                        "params": {
                            "to_address": "0x1234567890123456789012345678901234567890",
                            "amount": "0.001"
                        }
                    }
                },
                {
                    "description": "Swap action (not yet implemented)",
                    "value": {
                        "params": {
                            "from_token": "ETH",
                            "to_token": "USDC",
                            "amount": "1.0"
                        }
                    }
                }
            ]
        }


class DynamicActionResponse(BaseModel):
    """
    Response model for dynamic wallet actions.

    Attributes:
        success: Whether the action completed successfully
        action: Action type that was executed
        room_id: Room identifier
        transaction_id: Transaction log ID (UUID)
        result: Action result data (structure varies by action type)
        error: Error message if success is False
    """
    success: bool
    action: str
    room_id: str
    transaction_id: str
    result: Optional[Dict[str, Any]] = None
    error: Optional[str] = None

    class Config:
        json_schema_extra = {
            "examples": [
                {
                    "description": "Successful balance action",
                    "value": {
                        "success": True,
                        "action": "balance",
                        "room_id": "550e8400-e29b-41d4-a716-446655440000",
                        "transaction_id": "7c9e6679-7425-40de-944b-e07fc1f90ae7",
                        "result": {
                            "address": "0xabcdef0123456789abcdef0123456789abcdef01",
                            "account_name": "room-550e8400-e29b-41d4-a716-446655440000",
                            "room_id": "550e8400-e29b-41d4-a716-446655440000",
                            "network": "base-sepolia"
                        },
                        "error": None
                    }
                },
                {
                    "description": "Successful transfer action",
                    "value": {
                        "success": True,
                        "action": "transfer",
                        "room_id": "550e8400-e29b-41d4-a716-446655440000",
                        "transaction_id": "8d0f7780-8536-51fe-a55c-f18gd2g01bf8",
                        "result": {
                            "user_op_hash": "0xabcdef...",
                            "transaction_hash": "0x123456...",
                            "status": "complete",
                            "block_explorer": "https://sepolia.basescan.org/tx/0x123456..."
                        },
                        "error": None
                    }
                },
                {
                    "description": "Failed action",
                    "value": {
                        "success": False,
                        "action": "transfer",
                        "room_id": "550e8400-e29b-41d4-a716-446655440000",
                        "transaction_id": "9e1g8881-9647-62gf-b66d-g29he3h12cg9",
                        "result": None,
                        "error": "Insufficient balance for transfer"
                    }
                }
            ]
        }


class TransactionRecord(BaseModel):
    """
    Model for a single transaction record.

    Attributes:
        id: Transaction ID (UUID)
        room_id: Room identifier
        action: Action type ('balance', 'transfer', 'swap')
        params: Action parameters as dict
        status: Transaction status ('pending', 'success', 'failed')
        result: Success result data (if status is 'success')
        error: Error message (if status is 'failed')
        created_at: When transaction was initiated
        updated_at: When transaction status was last updated
    """
    id: str
    room_id: str
    action: str
    params: Dict[str, Any]
    status: str
    result: Optional[Dict[str, Any]] = None
    error: Optional[str] = None
    created_at: str
    updated_at: str

    class Config:
        json_schema_extra = {
            "example": {
                "id": "7c9e6679-7425-40de-944b-e07fc1f90ae7",
                "room_id": "550e8400-e29b-41d4-a716-446655440000",
                "action": "transfer",
                "params": {
                    "to_address": "0x1234567890123456789012345678901234567890",
                    "amount": "0.001"
                },
                "status": "success",
                "result": {
                    "user_op_hash": "0xabcdef...",
                    "transaction_hash": "0x123456...",
                    "status": "complete",
                    "block_explorer": "https://sepolia.basescan.org/tx/0x123456..."
                },
                "error": None,
                "created_at": "2025-11-22T10:30:00Z",
                "updated_at": "2025-11-22T10:30:15Z"
            }
        }


class TransactionHistoryResponse(BaseModel):
    """
    Response model for transaction history endpoint.

    Attributes:
        room_id: Room identifier
        transactions: List of transaction records
        total: Total number of transactions (before pagination)
        limit: Pagination limit used
        offset: Pagination offset used
    """
    room_id: str
    transactions: List[TransactionRecord]
    total: int
    limit: int
    offset: int

    class Config:
        json_schema_extra = {
            "example": {
                "room_id": "550e8400-e29b-41d4-a716-446655440000",
                "transactions": [
                    {
                        "id": "7c9e6679-7425-40de-944b-e07fc1f90ae7",
                        "room_id": "550e8400-e29b-41d4-a716-446655440000",
                        "action": "transfer",
                        "params": {
                            "to_address": "0x1234567890123456789012345678901234567890",
                            "amount": "0.001"
                        },
                        "status": "success",
                        "result": {
                            "user_op_hash": "0xabcdef...",
                            "transaction_hash": "0x123456..."
                        },
                        "error": None,
                        "created_at": "2025-11-22T10:30:00Z",
                        "updated_at": "2025-11-22T10:30:15Z"
                    }
                ],
                "total": 25,
                "limit": 50,
                "offset": 0
            }
        }
