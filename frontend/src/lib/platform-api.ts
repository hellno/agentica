/**
 * Platform API Client
 *
 * Client-side utility for calling Platform API (Modal backend) via Next.js proxy.
 *
 * Architecture:
 * - All calls go through /api/platform/* proxy (NOT direct to Modal)
 * - Proxy injects user_id from your auth provider
 * - Backend validates ownership and returns filtered data
 *
 * Security:
 * - Modal URL never exposed to browser
 * - User ID managed by backend auth, not client
 * - All queries filtered by user ownership
 */

// Response types
export interface Room {
  id: string;
  user_id: string;
  name: string;
  description?: string;
  eliza_room_id: string;
  strategy_agent_id: string;
  wallet_address: string;
  smart_account_address: string;
  user_prompt: string;
  generated_strategy: string;
  frequency: string;
  status: "active" | "paused" | "deleted";
  created_at: string;
  updated_at: string;
}

export interface WalletTransaction {
  id: string;
  room_id: string;
  action: string;
  params: Record<string, any>;
  result?: Record<string, any>;
  tx_hash?: string;
  status: "pending" | "success" | "failed";
  error?: string;
  created_at: string;
}

export interface CreateRoomRequest {
  user_id: string; // Injected by proxy from auth
  name: string;
  description?: string;
  prompt: string;
  frequency: string;
}

export interface CreateRoomResponse {
  success: boolean;
  data?: {
    room_id: string;
    eliza_room_id: string;
    wallet_address: string;
    smart_account_address: string;
    generated_strategy: string;
    strategy_agent_id: string;
  };
  error?: string;
}

export interface WalletActionRequest {
  params: Record<string, any>;
}

export interface WalletActionResponse {
  success: boolean;
  action: string;
  room_id: string;
  transaction_id: string;
  result?: Record<string, any>;
  error?: string;
}

/**
 * Create a new portfolio room with AI-generated strategy
 *
 * Flow:
 * 1. Frontend → POST /api/platform/rooms
 * 2. Next.js proxy forwards user_id from request (currently evmAddress)
 * 3. Modal backend orchestrates: AI strategy → wallet → ElizaOS room
 * 4. Returns room details and wallet address
 *
 * Note: Currently using evmAddress as user_id. TODO: Implement proper auth.
 */
export async function createRoom(
  request: CreateRoomRequest
): Promise<CreateRoomResponse> {
  const response = await fetch("/api/platform/rooms", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(request),
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || "Failed to create room");
  }

  return response.json();
}

/**
 * Get all rooms for current user
 *
 * Note: Currently requires user_id as query param (using evmAddress).
 * TODO: Extract from auth session instead.
 */
export async function getRooms(userId: string): Promise<Room[]> {
  const params = new URLSearchParams({ user_id: userId });
  const response = await fetch(`/api/platform/rooms?${params}`, {
    method: "GET",
    headers: {
      "Content-Type": "application/json",
    },
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || "Failed to fetch rooms");
  }

  const data = await response.json();
  return data.success ? data.data : [];
}

/**
 * Execute wallet action (transfer, swap, balance, etc.)
 *
 * Examples:
 * - executeWalletAction(roomId, "balance", {})
 * - executeWalletAction(roomId, "transfer", { to: "0x...", amount: "10", asset_id: "USDC" })
 * - executeWalletAction(roomId, "swap", { from_asset: "USDC", to_asset: "BTC", amount: "100" })
 */
export async function executeWalletAction(
  roomId: string,
  action: string,
  params: Record<string, any>
): Promise<WalletActionResponse> {
  const response = await fetch(`/api/platform/wallets/${roomId}/${action}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ params }),
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || `Failed to execute ${action}`);
  }

  return response.json();
}

/**
 * Get transaction history for a wallet
 */
export async function getWalletTransactions(
  roomId: string,
  options?: {
    limit?: number;
    offset?: number;
    status?: "pending" | "success" | "failed";
  }
): Promise<{ transactions: WalletTransaction[]; total: number }> {
  const params = new URLSearchParams();
  if (options?.limit) params.set("limit", options.limit.toString());
  if (options?.offset) params.set("offset", options.offset.toString());
  if (options?.status) params.set("status", options.status);

  const query = params.toString();
  const url = `/api/platform/rooms/${roomId}/transactions${query ? `?${query}` : ""}`;

  const response = await fetch(url, {
    method: "GET",
    headers: {
      "Content-Type": "application/json",
    },
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || "Failed to fetch transactions");
  }

  const data = await response.json();
  return {
    transactions: data.transactions || [],
    total: data.total || 0,
  };
}

/**
 * Example: Check wallet balance
 */
export async function getWalletBalance(roomId: string) {
  return executeWalletAction(roomId, "balance", {});
}

/**
 * Example: Transfer tokens
 */
export async function transferTokens(
  roomId: string,
  to: string,
  amount: string,
  assetId: string = "USDC"
) {
  return executeWalletAction(roomId, "transfer", {
    to,
    amount,
    asset_id: assetId,
  });
}

/**
 * Example: Swap tokens
 */
export async function swapTokens(
  roomId: string,
  fromAsset: string,
  toAsset: string,
  amount: string
) {
  return executeWalletAction(roomId, "swap", {
    from_asset: fromAsset,
    to_asset: toAsset,
    amount,
  });
}
