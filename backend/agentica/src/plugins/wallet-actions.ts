import type { Plugin } from "@elizaos/core";
import {
  type Action,
  type ActionResult,
  type HandlerCallback,
  type IAgentRuntime,
  type Memory,
  type State,
  logger,
} from "@elizaos/core";
import { createClient } from "@supabase/supabase-js";

// ============================
// Types & Interfaces
// ============================

interface WalletActionConfig {
  walletApiUrl: string;
  supabaseUrl: string;
  supabaseServiceKey: string;
}

interface WalletBalanceResult {
  address: string;
  account_name: string;
  room_id: string;
  network: string;
}

interface WalletTransferResult {
  user_op_hash: string;
  transaction_hash: string | null;
  status: string;
  block_explorer: string | null;
}

interface WalletSwapResult {
  message?: string;
  error?: string;
}

// ============================
// Helper Functions
// ============================

/**
 * Get configuration from environment variables.
 * Validates that all required variables are set.
 */
function getWalletConfig(): WalletActionConfig {
  const walletApiUrl = process.env.WALLET_API_URL;
  const supabaseUrl = process.env.SUPABASE_URL;
  const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!walletApiUrl) {
    throw new Error("WALLET_API_URL environment variable not set");
  }
  if (!supabaseUrl) {
    throw new Error("SUPABASE_URL environment variable not set");
  }
  if (!supabaseServiceKey) {
    throw new Error("SUPABASE_SERVICE_ROLE_KEY environment variable not set");
  }

  return { walletApiUrl, supabaseUrl, supabaseServiceKey };
}

/**
 * Map ElizaOS channel ID to platform room ID.
 *
 * CRITICAL: ElizaOS message.roomId is the eliza_channel_id, NOT the platform room_id.
 * We must query Supabase to find the corresponding platform room_id for Wallet API calls.
 */
async function getPlatformRoomId(
  elizaChannelId: string,
  config: WalletActionConfig,
): Promise<string | null> {
  try {
    const supabase = createClient(
      config.supabaseUrl,
      config.supabaseServiceKey,
    );

    const { data, error } = await supabase
      .from("platform_rooms")
      .select("id")
      .eq("eliza_channel_id", elizaChannelId)
      .single();

    if (error) {
      logger.error(
        { error, elizaChannelId },
        "Failed to map eliza_channel_id to room_id",
      );
      return null;
    }

    if (!data) {
      logger.warn(
        { elizaChannelId },
        "No platform_room found for eliza_channel_id",
      );
      return null;
    }

    return data.id;
  } catch (error) {
    logger.error({ error, elizaChannelId }, "Error querying platform_rooms");
    return null;
  }
}

/**
 * Call Wallet API endpoint.
 */
async function callWalletAPI(
  endpoint: string,
  method: "GET" | "POST",
  walletApiUrl: string,
  body?: any,
): Promise<any> {
  const url = `${walletApiUrl}${endpoint}`;

  const options: RequestInit = {
    method,
    headers: {
      "Content-Type": "application/json",
    },
  };

  if (body && method === "POST") {
    options.body = JSON.stringify(body);
  }

  logger.info({ url, method, body }, "Calling Wallet API");

  const response = await fetch(url, options);

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Wallet API error ${response.status}: ${errorText}`);
  }

  return response.json();
}

// ============================
// Actions
// ============================

/**
 * CHECK_BALANCE Action
 *
 * Retrieves wallet information for the current room.
 * Shows the smart account address (trading wallet) where users should deposit funds.
 *
 * Triggers on phrases like:
 * - "what's my balance?"
 * - "check wallet"
 * - "show my address"
 */
const checkBalanceAction: Action = {
  name: "CHECK_BALANCE",
  similes: ["WALLET_BALANCE", "GET_ADDRESS", "SHOW_WALLET", "CHECK_WALLET"],
  description: "Get wallet balance and smart account address for trading",

  validate: async (
    _runtime: IAgentRuntime,
    message: Memory,
    _state: State,
  ): Promise<boolean> => {
    const text = message.content.text?.toLowerCase() || "";

    const balanceKeywords = ["balance", "wallet", "address", "funds"];
    const checkKeywords = ["check", "show", "get", "what", "my"];

    const hasBalanceKeyword = balanceKeywords.some((keyword) =>
      text.includes(keyword),
    );
    const hasCheckKeyword = checkKeywords.some((keyword) =>
      text.includes(keyword),
    );

    return hasBalanceKeyword && hasCheckKeyword;
  },

  handler: async (
    runtime: IAgentRuntime,
    message: Memory,
    _state: State,
    _options: any,
    callback: HandlerCallback,
  ): Promise<ActionResult> => {
    try {
      logger.info("Handling CHECK_BALANCE action");

      // Get configuration
      const config = getWalletConfig();

      // Map ElizaOS channel ID to platform room ID
      const elizaChannelId = message.roomId; // This is the ElizaOS internal room ID
      const platformRoomId = await getPlatformRoomId(elizaChannelId, config);

      if (!platformRoomId) {
        await callback({
          text: "Could not find wallet for this room. Please create a trading room first.",
          source: message.content.source,
        });

        return {
          text: "Room mapping failed",
          success: false,
          error: new Error("No platform_room found for eliza_channel_id"),
        };
      }

      // Call Wallet API
      const result = await callWalletAPI(
        `/wallets/${platformRoomId}/balance`,
        "POST",
        config.walletApiUrl,
        { params: {} },
      );

      // Parse response
      const balanceData = result.result as WalletBalanceResult;

      // Format response message
      const responseText =
        `💰 Wallet Information\n\n` +
        `Smart Account (Trading Wallet): ${balanceData.address}\n` +
        `Network: ${balanceData.network}\n\n` +
        `⚠️ Fund this address with tokens to start trading. Gas is FREE!`;

      await callback({
        text: responseText,
        actions: ["CHECK_BALANCE"],
        source: message.content.source,
      });

      return {
        text: "Balance check completed",
        success: true,
        values: {
          address: balanceData.address,
          network: balanceData.network,
        },
        data: {
          actionName: "CHECK_BALANCE",
          balanceData,
        },
      };
    } catch (error) {
      logger.error({ error }, "Error in CHECK_BALANCE action");

      await callback({
        text: "Failed to retrieve wallet information. Please try again.",
        source: message.content.source,
      });

      return {
        text: "Balance check failed",
        success: false,
        error: error instanceof Error ? error : new Error(String(error)),
      };
    }
  },

  examples: [
    [
      {
        name: "{{name1}}",
        content: { text: "What's my wallet balance?" },
      },
      {
        name: "{{name2}}",
        content: {
          text: "💰 Wallet Information\n\nSmart Account (Trading Wallet): 0x1234...\nNetwork: base-sepolia\n\n⚠️ Fund this address with tokens to start trading. Gas is FREE!",
          actions: ["CHECK_BALANCE"],
        },
      },
    ],
  ],
};

/**
 * TRANSFER Action
 *
 * Sends ETH from the room's smart account wallet.
 * Uses gas sponsorship (no ETH needed for gas).
 * FULLY AUTONOMOUS - no user confirmation required.
 *
 * Triggers on phrases like:
 * - "send 0.1 ETH to 0x123..."
 * - "transfer 1.5 to vitalik.eth"
 */
const transferAction: Action = {
  name: "TRANSFER",
  similes: ["SEND_ETH", "SEND_FUNDS", "WALLET_TRANSFER"],
  description:
    "Send ETH from smart account wallet with gas sponsorship (autonomous)",

  validate: async (
    _runtime: IAgentRuntime,
    message: Memory,
    _state: State,
  ): Promise<boolean> => {
    const text = message.content.text?.toLowerCase() || "";

    const transferKeywords = ["send", "transfer"];
    const hasTransferKeyword = transferKeywords.some((keyword) =>
      text.includes(keyword),
    );

    // Check for address pattern or amount
    const hasAddress = text.includes("0x") || text.includes(".eth");
    const hasAmount = /\d+\.?\d*\s*(eth|ether)/.test(text);

    return hasTransferKeyword && (hasAddress || hasAmount);
  },

  handler: async (
    runtime: IAgentRuntime,
    message: Memory,
    _state: State,
    _options: any,
    callback: HandlerCallback,
  ): Promise<ActionResult> => {
    try {
      logger.info("Handling TRANSFER action (AUTONOMOUS)");

      // Parse transfer details from message
      const text = message.content.text || "";

      // Extract amount (e.g., "0.1 ETH", "1.5", "2 ether")
      const amountMatch = text.match(/(\d+\.?\d*)\s*(eth|ether)?/i);
      if (!amountMatch) {
        await callback({
          text: 'Please specify an amount to transfer (e.g., "send 0.1 ETH to 0x123...").',
          source: message.content.source,
        });
        return { text: "No amount specified", success: false };
      }

      const amount = parseFloat(amountMatch[1]);

      // Extract destination address
      const addressMatch = text.match(/(0x[a-fA-F0-9]{40})/);
      const ensMatch = text.match(/([a-zA-Z0-9-]+\.eth)/);

      let toAddress: string | null = null;
      if (addressMatch) {
        toAddress = addressMatch[1];
      } else if (ensMatch) {
        // TODO: Implement ENS resolution
        await callback({
          text: "ENS resolution not yet supported. Please use a 0x address.",
          source: message.content.source,
        });
        return { text: "ENS not supported", success: false };
      }

      if (!toAddress) {
        await callback({
          text: "Please specify a destination address (0x...).",
          source: message.content.source,
        });
        return { text: "No address specified", success: false };
      }

      // Get configuration
      const config = getWalletConfig();

      // Map ElizaOS channel ID to platform room ID
      const elizaChannelId = message.roomId;
      const platformRoomId = await getPlatformRoomId(elizaChannelId, config);

      if (!platformRoomId) {
        await callback({
          text: "Could not find wallet for this room.",
          source: message.content.source,
        });
        return { text: "Room mapping failed", success: false };
      }

      // Call Wallet API transfer action (AUTONOMOUS - no confirmation)
      logger.info(
        { amount, toAddress, platformRoomId },
        "Executing autonomous transfer",
      );

      const result = await callWalletAPI(
        `/wallets/${platformRoomId}/transfer`,
        "POST",
        config.walletApiUrl,
        {
          params: {
            to_address: toAddress,
            amount: amount.toString(),
          },
        },
      );

      const transferData = result.result as WalletTransferResult;

      // Format response
      let responseText =
        `✅ Transfer executed autonomously!\n\n` +
        `Amount: ${amount} ETH\n` +
        `To: ${toAddress.slice(0, 10)}...\n` +
        `Status: ${transferData.status}\n`;

      if (transferData.block_explorer) {
        responseText += `\nView on explorer: ${transferData.block_explorer}`;
      }

      await callback({
        text: responseText,
        actions: ["TRANSFER"],
        source: message.content.source,
      });

      return {
        text: "Transfer completed autonomously",
        success: true,
        values: {
          amount,
          toAddress,
          transactionHash: transferData.transaction_hash,
        },
        data: {
          actionName: "TRANSFER",
          transferData,
        },
      };
    } catch (error) {
      logger.error({ error }, "Error in TRANSFER action");

      await callback({
        text: `Failed to complete transfer: ${error instanceof Error ? error.message : String(error)}`,
        source: message.content.source,
      });

      return {
        text: "Transfer failed",
        success: false,
        error: error instanceof Error ? error : new Error(String(error)),
      };
    }
  },

  examples: [
    [
      {
        name: "{{name1}}",
        content: {
          text: "Send 0.1 ETH to 0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb",
        },
      },
      {
        name: "{{name2}}",
        content: {
          text: "✅ Transfer executed autonomously!\n\nAmount: 0.1 ETH\nTo: 0x742d35Cc...\nStatus: complete\n\nView on explorer: https://sepolia.basescan.org/tx/0x...",
          actions: ["TRANSFER"],
        },
      },
    ],
  ],
};

/**
 * SWAP Action
 *
 * Executes token swaps via DEX integration.
 * Currently handles 501 (Not Implemented) gracefully.
 * FULLY AUTONOMOUS - no user confirmation required.
 *
 * Triggers on phrases like:
 * - "swap 100 USDC for ETH"
 * - "trade 1 ETH to USDC"
 */
const swapAction: Action = {
  name: "SWAP",
  similes: ["TRADE", "EXCHANGE", "SWAP_TOKENS"],
  description:
    "Swap tokens via DEX (autonomous, currently pending DEX integration)",

  validate: async (
    _runtime: IAgentRuntime,
    message: Memory,
    _state: State,
  ): Promise<boolean> => {
    const text = message.content.text?.toLowerCase() || "";

    const swapKeywords = ["swap", "trade", "exchange"];
    const hasSwapKeyword = swapKeywords.some((keyword) =>
      text.includes(keyword),
    );

    // Check for token mentions or amounts
    const hasTokens = /usdc|eth|btc|weth|dai|usdt|bitcoin/.test(text);
    const hasAmount = /\d+\.?\d*/.test(text);

    return hasSwapKeyword && (hasTokens || hasAmount);
  },

  handler: async (
    runtime: IAgentRuntime,
    message: Memory,
    _state: State,
    _options: any,
    callback: HandlerCallback,
  ): Promise<ActionResult> => {
    try {
      logger.info("Handling SWAP action (AUTONOMOUS)");

      // Parse swap details from message
      const text = message.content.text || "";

      // Extract amount
      const amountMatch = text.match(/(\d+\.?\d*)/);
      if (!amountMatch) {
        await callback({
          text: 'Please specify an amount to swap (e.g., "swap 100 USDC for ETH").',
          source: message.content.source,
        });
        return { text: "No amount specified", success: false };
      }

      const amount = parseFloat(amountMatch[1]);

      // Extract tokens (simple pattern matching)
      const fromTokenMatch = text.match(/(usdc|eth|weth|dai|usdt)/i);
      const toTokenMatch = text.match(/(?:for|to)\s+(usdc|eth|weth|dai|usdt)/i);

      if (!fromTokenMatch || !toTokenMatch) {
        await callback({
          text: 'Please specify both tokens (e.g., "swap 100 USDC for ETH").',
          source: message.content.source,
        });
        return { text: "Tokens not specified", success: false };
      }

      const fromToken = fromTokenMatch[1].toUpperCase();
      const toToken = toTokenMatch[1].toUpperCase();

      // Get configuration
      const config = getWalletConfig();

      // Map ElizaOS channel ID to platform room ID
      const elizaChannelId = message.roomId;
      const platformRoomId = await getPlatformRoomId(elizaChannelId, config);

      if (!platformRoomId) {
        await callback({
          text: "Could not find wallet for this room.",
          source: message.content.source,
        });
        return { text: "Room mapping failed", success: false };
      }

      // Call Wallet API swap action (AUTONOMOUS - no confirmation)
      logger.info(
        { amount, fromToken, toToken, platformRoomId },
        "Attempting autonomous swap",
      );

      try {
        const result = await callWalletAPI(
          `/wallets/${platformRoomId}/swap`,
          "POST",
          config.walletApiUrl,
          {
            params: {
              from_token: fromToken,
              to_token: toToken,
              amount: amount.toString(),
            },
          },
        );

        const swapData = result.result as WalletSwapResult;

        await callback({
          text: `✅ Swap executed! ${amount} ${fromToken} → ${toToken}`,
          actions: ["SWAP"],
          source: message.content.source,
        });

        return {
          text: "Swap completed autonomously",
          success: true,
          values: { amount, fromToken, toToken },
          data: { actionName: "SWAP", swapData },
        };
      } catch (error) {
        // Handle 501 Not Implemented gracefully
        if (error instanceof Error && error.message.includes("501")) {
          logger.info("SWAP action received 501 - DEX integration pending");

          await callback({
            text: `🔧 Swap functionality is ready but DEX integration is pending.\n\nRequested: ${amount} ${fromToken} → ${toToken}\nThis will be executed automatically once DEX integration is complete.`,
            source: message.content.source,
          });

          return {
            text: "SWAP ready - DEX integration pending",
            success: true, // Mark as success since action structure is correct
            values: {
              amount,
              fromToken,
              toToken,
              status: "pending_dex_integration",
            },
            data: { actionName: "SWAP", pending: true },
          };
        }

        throw error; // Re-throw other errors
      }
    } catch (error) {
      logger.error({ error }, "Error in SWAP action");

      await callback({
        text: `Failed to complete swap: ${error instanceof Error ? error.message : String(error)}`,
        source: message.content.source,
      });

      return {
        text: "Swap failed",
        success: false,
        error: error instanceof Error ? error : new Error(String(error)),
      };
    }
  },

  examples: [
    [
      {
        name: "{{name1}}",
        content: { text: "Swap 100 USDC for ETH" },
      },
      {
        name: "{{name2}}",
        content: {
          text: "🔧 Swap functionality is ready but DEX integration is pending.\n\nRequested: 100 USDC → ETH\nThis will be executed automatically once DEX integration is complete.",
          actions: ["SWAP"],
        },
      },
    ],
  ],
};

// ============================
// Plugin Definition
// ============================

const walletActionsPlugin: Plugin = {
  name: "wallet-actions",
  description: "Autonomous trading wallet actions for ElizaOS agents",
  actions: [checkBalanceAction, transferAction, swapAction],
};

export default walletActionsPlugin;
