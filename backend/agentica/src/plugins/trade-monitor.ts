import type { Plugin } from '@elizaos/core';
import {
  type Action,
  type ActionResult,
  type Content,
  type HandlerCallback,
  type IAgentRuntime,
  type Memory,
  Service,
  type State,
  logger,
} from '@elizaos/core';

// ============================
// Types & Interfaces
// ============================

interface TradeMonitorConfig {
  addresses: string[]; // Monitored wallet addresses
  pollInterval: number; // Check interval (default: 5 minutes = 300000ms)
  lookbackHours: number; // How far back to check (24)
  enableAlerts: boolean; // Send notifications on new trades
}

interface ResolvedAddress {
  input: string; // Original input (vitalik.eth, dwr, 0x123...)
  address: string; // Resolved 0x address
  source: 'ens' | 'farcaster' | 'direct';
  label?: string; // Display name
}

interface TradeTransaction {
  txHash: string;
  timestamp: number;
  trader: string;
  protocol: string; // "Uniswap V3", "Sushiswap", etc.
  tokenIn: string;
  tokenOut: string;
  amountIn: number;
  amountOut: number;
  valueUSD: number;
  zapperData?: {
    nftImageUrl?: string;
    labels?: string[];
    interpretation?: string;
  };
}

interface TradeCache {
  address: string;
  lastCheckedAt: number;
  lastTxHash?: string;
  cachedTrades: TradeTransaction[];
}

// ============================
// Default Configuration
// ============================

const DEFAULT_CONFIG: TradeMonitorConfig = {
  addresses: [],
  pollInterval: 5 * 60 * 1000, // 5 minutes
  lookbackHours: 24,
  enableAlerts: true,
};

const MEMORY_TABLE_CONFIG = 'trade_monitor_config';
const MEMORY_TABLE_CACHE = 'trade_cache';

// Base blockchain (Coinbase L2)
const BASE_CHAIN_ID = 8453;
const BASE_GRAPH_URL = 'https://api.studio.thegraph.com/query/48211/uniswap-v3-base/version/latest';

// ============================
// Trade Monitor Service
// ============================

export class TradeMonitorService extends Service {
  static serviceType = 'trade-monitor';
  capabilityDescription =
    'Monitors wallet addresses for DEX trading activity on Base blockchain';

  private serviceConfig: TradeMonitorConfig = DEFAULT_CONFIG;
  private resolvedAddresses: Map<string, ResolvedAddress> = new Map();
  private tradeCaches: Map<string, TradeCache> = new Map();
  private pollingInterval?: NodeJS.Timeout;
  private isRunning = false;

  constructor(runtime?: IAgentRuntime) {
    super(runtime);
  }

  // ============================
  // Lifecycle Methods
  // ============================

  static async start(runtime: IAgentRuntime): Promise<TradeMonitorService> {
    logger.info('Starting Trade Monitor Service');
    const service = new TradeMonitorService(runtime);
    await service.initialize();
    return service;
  }

  static async stop(runtime: IAgentRuntime): Promise<void> {
    logger.info('Stopping Trade Monitor Service');
    const service = runtime.getService<TradeMonitorService>(TradeMonitorService.serviceType);
    if (service) {
      await service.stop();
    }
  }

  private async initialize(): Promise<void> {
    try {
      // Load configuration from memory
      await this.loadConfig();

      // Load resolved addresses from memory
      await this.loadResolvedAddresses();

      // Load trade caches from memory
      await this.loadTradeCaches();

      // Start polling
      this.startPolling();

      logger.info({ config: this.serviceConfig }, 'Trade Monitor Service initialized');
    } catch (error) {
      logger.error({ error }, 'Failed to initialize Trade Monitor Service');
      throw error;
    }
  }

  async stop(): Promise<void> {
    this.isRunning = false;
    if (this.pollingInterval) {
      clearInterval(this.pollingInterval);
      this.pollingInterval = undefined;
    }
    logger.info('Trade Monitor Service stopped');
  }

  // ============================
  // Configuration Management
  // ============================

  async loadConfig(): Promise<void> {
    try {
      const configMemories = await this.runtime.getMemories({
        roomId: this.runtime.agentId,
        tableName: MEMORY_TABLE_CONFIG,
        count: 1,
      });

      if (configMemories && configMemories.length > 0) {
        const configData = configMemories[0].content.config;
        if (configData) {
          this.serviceConfig = { ...DEFAULT_CONFIG, ...configData };
          logger.info({ config: this.serviceConfig }, 'Loaded trade monitor config from memory');
          return;
        }
      }

      // No saved config, use defaults
      this.serviceConfig = DEFAULT_CONFIG;
      await this.saveConfig();
      logger.info('Initialized with default trade monitor config');
    } catch (error) {
      logger.error({ error }, 'Error loading config, using defaults');
      this.serviceConfig = DEFAULT_CONFIG;
    }
  }

  async saveConfig(): Promise<void> {
    try {
      await this.runtime.createMemory(
        {
          id: crypto.randomUUID(),
          entityId: this.runtime.agentId,
          agentId: this.runtime.agentId,
          roomId: this.runtime.agentId,
          content: {
            text: 'Trade monitor configuration',
            config: this.serviceConfig,
          },
          createdAt: Date.now(),
        },
        MEMORY_TABLE_CONFIG
      );

      logger.info({ config: this.serviceConfig }, 'Saved trade monitor config');
    } catch (error) {
      logger.error({ error }, 'Failed to save config');
    }
  }

  async updateConfig(updates: Partial<TradeMonitorConfig>): Promise<void> {
    this.serviceConfig = { ...this.serviceConfig, ...updates };
    await this.saveConfig();

    // Restart polling with new interval if it changed
    if (updates.pollInterval && this.isRunning) {
      this.stopPolling();
      this.startPolling();
    }
  }

  getConfig(): TradeMonitorConfig {
    return { ...this.serviceConfig };
  }

  // ============================
  // Address Management
  // ============================

  async addAddress(input: string): Promise<ResolvedAddress[]> {
    try {
      logger.info({ input }, 'Adding address to monitoring');

      // Resolve the input to one or more addresses
      const resolved = await this.resolveAddress(input);

      if (!resolved || resolved.length === 0) {
        logger.warn({ input }, 'Could not resolve input to any addresses');
        return [];
      }

      // Store resolved addresses
      const newAddresses: string[] = [];
      for (const resolvedAddr of resolved) {
        this.resolvedAddresses.set(resolvedAddr.address, resolvedAddr);
        newAddresses.push(resolvedAddr.address);
      }

      // Update config with new addresses
      const currentAddresses = this.serviceConfig.addresses;
      const updatedAddresses = [...new Set([...currentAddresses, ...newAddresses])];

      await this.updateConfig({ addresses: updatedAddresses });

      // Save resolved addresses to memory
      await this.saveResolvedAddresses();

      logger.info({ resolved, count: resolved.length }, 'Added addresses to monitoring');
      return resolved;
    } catch (error) {
      logger.error({ error, input }, 'Failed to add address');
      throw error;
    }
  }

  async removeAddress(address: string): Promise<boolean> {
    try {
      logger.info({ address }, 'Removing address from monitoring');

      // Normalize address
      const normalizedAddress = address.toLowerCase();

      // Find and remove from resolved addresses
      let removed = false;
      for (const [key, value] of this.resolvedAddresses.entries()) {
        if (
          key.toLowerCase() === normalizedAddress ||
          value.input.toLowerCase() === normalizedAddress
        ) {
          this.resolvedAddresses.delete(key);
          removed = true;
        }
      }

      // Update config
      const updatedAddresses = this.serviceConfig.addresses.filter(
        (addr) => addr.toLowerCase() !== normalizedAddress
      );

      await this.updateConfig({ addresses: updatedAddresses });

      // Save updated resolved addresses
      await this.saveResolvedAddresses();

      // Remove from cache
      this.tradeCaches.delete(normalizedAddress);

      logger.info({ address, removed }, 'Address removal complete');
      return removed;
    } catch (error) {
      logger.error({ error, address }, 'Failed to remove address');
      throw error;
    }
  }

  getMonitoredAddresses(): ResolvedAddress[] {
    return Array.from(this.resolvedAddresses.values());
  }

  private async loadResolvedAddresses(): Promise<void> {
    try {
      const addressMemories = await this.runtime.getMemories({
        roomId: this.runtime.agentId,
        tableName: 'resolved_addresses',
        count: 100,
      });

      if (addressMemories && addressMemories.length > 0) {
        for (const memory of addressMemories) {
          const resolved = memory.content.resolved as ResolvedAddress;
          if (resolved && resolved.address) {
            this.resolvedAddresses.set(resolved.address, resolved);
          }
        }
        logger.info({ count: this.resolvedAddresses.size }, 'Loaded resolved addresses');
      }
    } catch (error) {
      logger.error({ error }, 'Error loading resolved addresses');
    }
  }

  private async saveResolvedAddresses(): Promise<void> {
    try {
      for (const resolved of this.resolvedAddresses.values()) {
        await this.runtime.createMemory(
          {
            id: crypto.randomUUID(),
            entityId: this.runtime.agentId,
            agentId: this.runtime.agentId,
            roomId: this.runtime.agentId,
            content: {
              text: `Resolved address: ${resolved.input} -> ${resolved.address}`,
              resolved,
            },
            createdAt: Date.now(),
          },
          'resolved_addresses'
        );
      }
      logger.info({ count: this.resolvedAddresses.size }, 'Saved resolved addresses');
    } catch (error) {
      logger.error({ error }, 'Failed to save resolved addresses');
    }
  }

  // ============================
  // Address Resolution (SCAFFOLDED)
  // ============================

  private async resolveAddress(input: string): Promise<ResolvedAddress[]> {
    // TODO: Implement address resolution routing
    // 1. Detect input type (ENS name, Farcaster username, or direct address)
    // 2. Route to appropriate resolver
    // 3. Return array of resolved addresses

    logger.info({ input }, 'Resolving address input');

    const trimmedInput = input.trim();

    // Check if it's a direct Ethereum address (0x followed by 40 hex chars)
    const addressRegex = /^0x[a-fA-F0-9]{40}$/;
    if (addressRegex.test(trimmedInput)) {
      logger.info({ input: trimmedInput }, 'Input is direct Ethereum address');
      return [
        {
          input: trimmedInput,
          address: trimmedInput.toLowerCase(),
          source: 'direct',
        },
      ];
    }

    // Check if it looks like ENS (.eth suffix)
    if (trimmedInput.endsWith('.eth')) {
      logger.info({ input: trimmedInput }, 'Input appears to be ENS name');
      const ensAddress = await this.resolveENS(trimmedInput);
      if (ensAddress) {
        return [
          {
            input: trimmedInput,
            address: ensAddress.toLowerCase(),
            source: 'ens',
            label: trimmedInput,
          },
        ];
      }
    }

    // Otherwise, try Farcaster username
    logger.info({ input: trimmedInput }, 'Attempting Farcaster username resolution');
    const farcasterAddresses = await this.resolveFarcaster(trimmedInput);
    if (farcasterAddresses.length > 0) {
      return farcasterAddresses.map((addr) => ({
        input: trimmedInput,
        address: addr.toLowerCase(),
        source: 'farcaster' as const,
        label: `@${trimmedInput}`,
      }));
    }

    logger.warn({ input: trimmedInput }, 'Could not resolve input to any address');
    return [];
  }

  private async resolveENS(ensName: string): Promise<string | null> {
    // TODO: Implement ENS resolution using ethers.js or Viem
    // 1. Connect to Ethereum mainnet provider
    // 2. Call provider.resolveName(ensName)
    // 3. Return resolved address or null
    logger.warn({ ensName }, 'ENS resolution not yet implemented');
    return null;
  }

  private async resolveFarcaster(username: string): Promise<string[]> {
    // TODO: Implement Farcaster username resolution using Neynar API
    // 1. Call Neynar API to look up user by username
    // 2. Extract verified addresses (custody + connected addresses)
    // 3. Return array of addresses (may be multiple per user)
    logger.warn({ username }, 'Farcaster resolution not yet implemented');
    return [];
  }

  // ============================
  // Trade Discovery (SCAFFOLDED)
  // ============================

  private async fetchRecentTrades(address: string): Promise<TradeTransaction[]> {
    // TODO: Implement trade fetching using TheGraph
    // 1. Calculate since timestamp (now - lookbackHours)
    // 2. Build GraphQL query for swaps involving the address
    // 3. Execute query against Base subgraph
    // 4. Parse and return trade transactions

    logger.info({ address, lookbackHours: this.serviceConfig.lookbackHours }, 'Fetching recent trades');

    const sinceTimestamp = Math.floor(Date.now() / 1000) - this.serviceConfig.lookbackHours * 3600;

    try {
      const query = this.buildGraphQLQuery(address, sinceTimestamp);
      logger.debug({ query }, 'Built GraphQL query');

      // TODO: Execute GraphQL query
      // const response = await fetch(BASE_GRAPH_URL, {
      //   method: 'POST',
      //   headers: { 'Content-Type': 'application/json' },
      //   body: JSON.stringify({ query }),
      // });
      // const data = await response.json();
      // return this.parseGraphQLResponse(data);

      logger.warn('GraphQL query execution not yet implemented');
      return [];
    } catch (error) {
      logger.error({ error, address }, 'Failed to fetch trades');
      return [];
    }
  }

  private buildGraphQLQuery(address: string, sinceTimestamp: number): string {
    // TODO: Build GraphQL query for Uniswap V3 swaps on Base
    // Query should fetch:
    // - Swaps where origin/sender is the monitored address
    // - Only swaps after sinceTimestamp
    // - Include: txHash, timestamp, tokens, amounts, pool info

    const lowerAddress = address.toLowerCase();

    // Placeholder query structure
    const query = `
      query GetRecentSwaps {
        swaps(
          first: 100,
          orderBy: timestamp,
          orderDirection: desc,
          where: {
            origin: "${lowerAddress}",
            timestamp_gte: ${sinceTimestamp}
          }
        ) {
          id
          transaction {
            id
            timestamp
          }
          origin
          pool {
            token0 {
              symbol
            }
            token1 {
              symbol
            }
          }
          amount0
          amount1
          amountUSD
        }
      }
    `;

    logger.debug({ address: lowerAddress, sinceTimestamp }, 'TODO: Build complete GraphQL query');
    return query;
  }

  private parseGraphQLResponse(response: any): TradeTransaction[] {
    // TODO: Parse GraphQL response into TradeTransaction objects
    // 1. Extract swap data from response
    // 2. Determine which token was in/out based on amounts
    // 3. Identify protocol from pool data
    // 4. Return array of TradeTransaction objects

    logger.warn({ response }, 'GraphQL response parsing not yet implemented');

    // Placeholder parsing
    if (!response || !response.data || !response.data.swaps) {
      return [];
    }

    // TODO: Implement actual parsing logic
    return [];
  }

  // ============================
  // Metadata Enrichment (SCAFFOLDED)
  // ============================

  private async enrichWithZapperData(tx: TradeTransaction): Promise<TradeTransaction> {
    // TODO: Implement Zapper API enrichment
    // 1. Call Zapper transaction endpoint with txHash
    // 2. Extract NFT image URL, labels, interpretation
    // 3. Attach to transaction object

    logger.debug({ txHash: tx.txHash }, 'TODO: Enrich with Zapper metadata');

    try {
      const zapperData = await this.fetchZapperMetadata(tx.txHash);
      if (zapperData) {
        return {
          ...tx,
          zapperData,
        };
      }
    } catch (error) {
      logger.warn({ error, txHash: tx.txHash }, 'Failed to enrich with Zapper data');
    }

    return tx;
  }

  private async fetchZapperMetadata(txHash: string): Promise<any> {
    // TODO: Implement Zapper API call
    // 1. Construct Zapper API URL with txHash and chain ID
    // 2. Add authentication header (API key)
    // 3. Parse response for nftImageUrl, labels, interpretation
    // 4. Return metadata object

    logger.warn({ txHash }, 'Zapper API call not yet implemented');

    // Placeholder structure
    return null;
    // return {
    //   nftImageUrl: 'https://...',
    //   labels: ['swap', 'uniswap-v3'],
    //   interpretation: 'Swapped 1.5 ETH for 3000 USDC',
    // };
  }

  // ============================
  // Caching
  // ============================

  private async loadTradeCaches(): Promise<void> {
    try {
      const cacheMemories = await this.runtime.getMemories({
        roomId: this.runtime.agentId,
        tableName: MEMORY_TABLE_CACHE,
        count: 100,
      });

      if (cacheMemories && cacheMemories.length > 0) {
        for (const memory of cacheMemories) {
          const cache = memory.content.cache as TradeCache;
          if (cache && cache.address) {
            this.tradeCaches.set(cache.address, cache);
          }
        }
        logger.info({ count: this.tradeCaches.size }, 'Loaded trade caches');
      }
    } catch (error) {
      logger.error({ error }, 'Error loading trade caches');
    }
  }

  private async saveTradeCache(address: string, cache: TradeCache): Promise<void> {
    try {
      await this.runtime.createMemory(
        {
          id: crypto.randomUUID(),
          entityId: this.runtime.agentId,
          agentId: this.runtime.agentId,
          roomId: this.runtime.agentId,
          content: {
            text: `Trade cache for ${address}`,
            address,
            cache,
          },
          createdAt: Date.now(),
        },
        MEMORY_TABLE_CACHE
      );

      this.tradeCaches.set(address, cache);
      logger.debug({ address }, 'Saved trade cache');
    } catch (error) {
      logger.error({ error, address }, 'Failed to save trade cache');
    }
  }

  private shouldRefetch(cache: TradeCache | null): boolean {
    if (!cache) {
      return true;
    }

    const now = Date.now();
    const timeSinceLastCheck = now - cache.lastCheckedAt;

    // Refetch if cache is older than poll interval
    return timeSinceLastCheck >= this.serviceConfig.pollInterval;
  }

  // ============================
  // Polling & Monitoring
  // ============================

  private startPolling(): void {
    if (this.isRunning) {
      logger.warn('Polling already running');
      return;
    }

    this.isRunning = true;

    // Run immediately on start
    this.checkAllAddresses().catch((error) => {
      logger.error({ error }, 'Error in initial trade check');
    });

    // Then run on interval
    this.pollingInterval = setInterval(() => {
      this.checkAllAddresses().catch((error) => {
        logger.error({ error }, 'Error in scheduled trade check');
      });
    }, this.serviceConfig.pollInterval);

    logger.info(
      { interval: this.serviceConfig.pollInterval },
      'Trade monitoring polling started'
    );
  }

  private stopPolling(): void {
    if (this.pollingInterval) {
      clearInterval(this.pollingInterval);
      this.pollingInterval = undefined;
    }
    this.isRunning = false;
    logger.info('Trade monitoring polling stopped');
  }

  async checkAllAddresses(): Promise<void> {
    if (this.resolvedAddresses.size === 0) {
      logger.debug('No addresses configured for monitoring');
      return;
    }

    logger.info({ count: this.resolvedAddresses.size }, 'Checking all addresses for new trades');

    for (const resolvedAddr of this.resolvedAddresses.values()) {
      await this.checkAddressForNewTrades(resolvedAddr);
    }
  }

  private async checkAddressForNewTrades(resolvedAddr: ResolvedAddress): Promise<void> {
    try {
      logger.debug({ address: resolvedAddr.address }, 'Checking address for new trades');

      // Load cache
      const cache = this.tradeCaches.get(resolvedAddr.address) || null;

      // Check if we should refetch
      if (!this.shouldRefetch(cache)) {
        logger.debug({ address: resolvedAddr.address }, 'Cache still fresh, skipping fetch');
        return;
      }

      // Fetch recent trades
      const trades = await this.fetchRecentTrades(resolvedAddr.address);

      if (trades.length === 0) {
        logger.debug({ address: resolvedAddr.address }, 'No new trades found');

        // Update cache timestamp even if no trades
        const updatedCache: TradeCache = {
          address: resolvedAddr.address,
          lastCheckedAt: Date.now(),
          lastTxHash: cache?.lastTxHash,
          cachedTrades: cache?.cachedTrades || [],
        };
        await this.saveTradeCache(resolvedAddr.address, updatedCache);
        return;
      }

      // Determine which trades are new (not in cache)
      const lastSeenTxHash = cache?.lastTxHash;
      const newTrades: TradeTransaction[] = [];

      for (const trade of trades) {
        if (!lastSeenTxHash || trade.txHash !== lastSeenTxHash) {
          newTrades.push(trade);
        } else {
          // Found the last seen transaction, stop
          break;
        }
      }

      if (newTrades.length > 0 && this.serviceConfig.enableAlerts) {
        logger.info({ address: resolvedAddr.address, count: newTrades.length }, 'Found new trades');

        // Send alerts for new trades
        for (const trade of newTrades) {
          await this.sendTradeAlert(trade, resolvedAddr);
        }
      }

      // Update cache
      const updatedCache: TradeCache = {
        address: resolvedAddr.address,
        lastCheckedAt: Date.now(),
        lastTxHash: trades[0]?.txHash,
        cachedTrades: trades.slice(0, 20), // Keep last 20 trades
      };
      await this.saveTradeCache(resolvedAddr.address, updatedCache);
    } catch (error) {
      logger.error({ error, address: resolvedAddr.address }, 'Failed to check address for trades');
    }
  }

  // ============================
  // Alerting
  // ============================

  private async sendTradeAlert(
    trade: TradeTransaction,
    resolvedAddr: ResolvedAddress
  ): Promise<void> {
    const label = resolvedAddr.label || resolvedAddr.address.slice(0, 10) + '...';
    const valueFormatted = trade.valueUSD.toLocaleString('en-US', {
      style: 'currency',
      currency: 'USD',
    });

    const alertText = `🔄 New Trade Detected!\n\n` +
      `Trader: ${label}\n` +
      `Protocol: ${trade.protocol}\n` +
      `Swap: ${trade.tokenIn} → ${trade.tokenOut}\n` +
      `Value: ${valueFormatted}\n` +
      `Tx: ${trade.txHash.slice(0, 10)}...`;

    logger.info({ trade, address: resolvedAddr.address }, 'Sending trade alert');

    try {
      // Get all rooms the agent is in
      const roomIds = await this.runtime.getRoomsForParticipant(this.runtime.agentId);

      if (!roomIds || roomIds.length === 0) {
        logger.debug('No rooms found to send alerts to');
        return;
      }

      // Send alert to each room
      for (const roomId of roomIds) {
        await this.runtime.createMemory(
          {
            id: crypto.randomUUID(),
            entityId: this.runtime.agentId,
            agentId: this.runtime.agentId,
            roomId,
            content: {
              text: alertText,
              source: 'trade-monitor',
              action: 'TRADE_ALERT',
              trade,
              resolvedAddress: resolvedAddr,
            },
            createdAt: Date.now(),
          },
          'messages'
        );
      }

      logger.info({ roomCount: roomIds.length, alertText }, 'Alert broadcast complete');
    } catch (error) {
      logger.error({ error }, 'Failed to broadcast alert');
    }
  }

  // ============================
  // Public Methods for Actions
  // ============================

  getStatus(): {
    config: TradeMonitorConfig;
    addresses: ResolvedAddress[];
    caches: TradeCache[];
  } {
    return {
      config: this.getConfig(),
      addresses: this.getMonitoredAddresses(),
      caches: Array.from(this.tradeCaches.values()),
    };
  }
}

// ============================
// Actions
// ============================

/**
 * Add Trade Monitor Action
 * Handles commands like:
 * - "monitor vitalik.eth trades"
 * - "watch dwr for swaps"
 * - "track 0x123... trading activity"
 */
const addTradeMonitorAction: Action = {
  name: 'ADD_TRADE_MONITOR',
  similes: ['WATCH_TRADER', 'MONITOR_WALLET', 'TRACK_ADDRESS', 'WATCH_SWAPS'],
  description: 'Add a wallet address to trade monitoring (supports ENS, Farcaster, or direct address)',

  validate: async (_runtime: IAgentRuntime, message: Memory, _state: State): Promise<boolean> => {
    const text = message.content.text?.toLowerCase() || '';

    // Trigger on monitoring-related keywords
    const monitorKeywords = ['monitor', 'watch', 'track'];
    const tradeKeywords = ['trade', 'swap', 'trading', 'dex'];

    const hasMonitorKeyword = monitorKeywords.some((keyword) => text.includes(keyword));
    const hasTradeKeyword = tradeKeywords.some((keyword) => text.includes(keyword));

    // Also check for address patterns
    const hasAddress =
      text.includes('.eth') || text.includes('0x') || text.match(/\b@?\w+\b/);

    return (hasMonitorKeyword && hasTradeKeyword) || (hasMonitorKeyword && hasAddress);
  },

  handler: async (
    runtime: IAgentRuntime,
    message: Memory,
    _state: State,
    _options: any,
    callback: HandlerCallback
  ): Promise<ActionResult> => {
    try {
      logger.info('Handling ADD_TRADE_MONITOR action');

      const service = runtime.getService<TradeMonitorService>(TradeMonitorService.serviceType);
      if (!service) {
        throw new Error('Trade Monitor Service not available');
      }

      const text = message.content.text || '';

      // Extract potential address/name from text
      // Look for: ENS names (.eth), addresses (0x...), or usernames
      const ensMatch = text.match(/([a-zA-Z0-9-]+\.eth)/);
      const addressMatch = text.match(/(0x[a-fA-F0-9]{40})/);
      const usernameMatch = text.match(/(?:^|\s)@?(\w+)(?:\s|$)/);

      let addressInput: string | null = null;

      if (ensMatch) {
        addressInput = ensMatch[1];
      } else if (addressMatch) {
        addressInput = addressMatch[1];
      } else if (usernameMatch) {
        addressInput = usernameMatch[1];
      }

      if (!addressInput) {
        await callback({
          text: 'Please provide an address to monitor (ENS name, Farcaster username, or Ethereum address)',
          source: message.content.source,
        });

        return {
          text: 'No address provided',
          values: {
            success: false,
            error: 'NO_ADDRESS_PROVIDED',
          },
          data: {
            actionName: 'ADD_TRADE_MONITOR',
          },
          success: false,
        };
      }

      // Add address to monitoring
      const resolved = await service.addAddress(addressInput);

      if (resolved.length === 0) {
        await callback({
          text: `Could not resolve "${addressInput}" to a valid address. Please check the input and try again.`,
          source: message.content.source,
        });

        return {
          text: 'Address resolution failed',
          values: {
            success: false,
            error: 'RESOLUTION_FAILED',
          },
          data: {
            actionName: 'ADD_TRADE_MONITOR',
            input: addressInput,
          },
          success: false,
        };
      }

      // Format response
      const addressList = resolved
        .map((r) => `  • ${r.label || r.address} (${r.source})`)
        .join('\n');

      const responseText =
        `✅ Now monitoring trade activity for:\n${addressList}\n\n` +
        `I'll alert you when new DEX swaps are detected on Base.`;

      await callback({
        text: responseText,
        actions: ['ADD_TRADE_MONITOR'],
        source: message.content.source,
      });

      return {
        text: 'Trade monitoring configured',
        values: {
          success: true,
          resolved,
        },
        data: {
          actionName: 'ADD_TRADE_MONITOR',
          input: addressInput,
          resolved,
        },
        success: true,
      };
    } catch (error) {
      logger.error({ error }, 'Error in ADD_TRADE_MONITOR action');

      await callback({
        text: 'Failed to add address to trade monitoring. Please try again.',
        source: message.content.source,
      });

      return {
        text: 'Failed to add trade monitor',
        values: {
          success: false,
          error: 'ADD_FAILED',
        },
        data: {
          actionName: 'ADD_TRADE_MONITOR',
          error: error instanceof Error ? error.message : String(error),
        },
        success: false,
        error: error instanceof Error ? error : new Error(String(error)),
      };
    }
  },

  examples: [
    [
      {
        name: '{{name1}}',
        content: {
          text: 'Can you monitor vitalik.eth for trading activity?',
        },
      },
      {
        name: '{{name2}}',
        content: {
          text: "✅ Now monitoring trade activity for:\n  • vitalik.eth (ens)\n\nI'll alert you when new DEX swaps are detected on Base.",
          actions: ['ADD_TRADE_MONITOR'],
        },
      },
    ],
    [
      {
        name: '{{name1}}',
        content: {
          text: 'Watch dwr for swaps',
        },
      },
      {
        name: '{{name2}}',
        content: {
          text: "✅ Now monitoring trade activity for:\n  • @dwr (farcaster)\n\nI'll alert you when new DEX swaps are detected on Base.",
          actions: ['ADD_TRADE_MONITOR'],
        },
      },
    ],
  ],
};

/**
 * List Trade Monitors Action
 * Handles commands like:
 * - "what trades are you monitoring?"
 * - "list monitored wallets"
 * - "show trade monitoring status"
 */
const listTradeMonitorsAction: Action = {
  name: 'LIST_TRADE_MONITORS',
  similes: ['SHOW_MONITORED_WALLETS', 'TRADE_MONITORING_STATUS', 'LIST_WATCHED_TRADERS'],
  description: 'Show all monitored wallet addresses and recent trade activity',

  validate: async (_runtime: IAgentRuntime, message: Memory, _state: State): Promise<boolean> => {
    const text = message.content.text?.toLowerCase() || '';

    const listKeywords = ['list', 'show', 'status', 'what'];
    const monitorKeywords = ['monitor', 'watch', 'track'];
    const tradeKeywords = ['trade', 'swap', 'trading'];

    const hasListKeyword = listKeywords.some((keyword) => text.includes(keyword));
    const hasMonitorKeyword = monitorKeywords.some((keyword) => text.includes(keyword));
    const hasTradeKeyword = tradeKeywords.some((keyword) => text.includes(keyword));

    return hasListKeyword && (hasMonitorKeyword || hasTradeKeyword);
  },

  handler: async (
    runtime: IAgentRuntime,
    message: Memory,
    _state: State,
    _options: any,
    callback: HandlerCallback
  ): Promise<ActionResult> => {
    try {
      logger.info('Handling LIST_TRADE_MONITORS action');

      const service = runtime.getService<TradeMonitorService>(TradeMonitorService.serviceType);
      if (!service) {
        throw new Error('Trade Monitor Service not available');
      }

      const status = service.getStatus();

      // Build status message
      let statusText = '📊 Trade Monitoring Status\n\n';

      if (status.addresses.length === 0) {
        statusText += 'No addresses currently monitored.\n\n';
        statusText += 'Use "monitor [address]" to start tracking trade activity.';
      } else {
        statusText += `Monitored Addresses (${status.addresses.length}):\n`;

        for (const addr of status.addresses) {
          const label = addr.label || addr.address.slice(0, 10) + '...';
          const cache = status.caches.find((c) => c.address === addr.address);

          statusText += `\n  • ${label} (${addr.source})\n`;
          statusText += `    Address: ${addr.address.slice(0, 10)}...\n`;

          if (cache && cache.cachedTrades.length > 0) {
            const lastTrade = cache.cachedTrades[0];
            const tradeTime = new Date(lastTrade.timestamp * 1000).toLocaleString();
            statusText += `    Last Trade: ${lastTrade.tokenIn} → ${lastTrade.tokenOut} at ${tradeTime}\n`;
          } else {
            statusText += `    Last Trade: No recent activity\n`;
          }
        }

        statusText += `\n\nCheck Interval: ${(status.config.pollInterval / 60000).toFixed(0)} minutes`;
        statusText += `\nLookback Period: ${status.config.lookbackHours} hours`;
        statusText += `\nAlerts: ${status.config.enableAlerts ? 'Enabled' : 'Disabled'}`;
      }

      await callback({
        text: statusText,
        actions: ['LIST_TRADE_MONITORS'],
        source: message.content.source,
      });

      return {
        text: 'Provided trade monitoring status',
        values: {
          success: true,
          status,
        },
        data: {
          actionName: 'LIST_TRADE_MONITORS',
          status,
        },
        success: true,
      };
    } catch (error) {
      logger.error({ error }, 'Error in LIST_TRADE_MONITORS action');

      await callback({
        text: 'Failed to retrieve trade monitoring status. Please try again.',
        source: message.content.source,
      });

      return {
        text: 'Failed to get monitoring status',
        values: {
          success: false,
          error: 'STATUS_CHECK_FAILED',
        },
        data: {
          actionName: 'LIST_TRADE_MONITORS',
          error: error instanceof Error ? error.message : String(error),
        },
        success: false,
        error: error instanceof Error ? error : new Error(String(error)),
      };
    }
  },

  examples: [
    [
      {
        name: '{{name1}}',
        content: {
          text: 'What trades are you monitoring?',
        },
      },
      {
        name: '{{name2}}',
        content: {
          text: '📊 Trade Monitoring Status\n\nMonitored Addresses (2):\n\n  • vitalik.eth (ens)\n    Address: 0xd8dA6BF...\n    Last Trade: WETH → USDC at 1/22/2025, 3:45 PM\n\n  • @dwr (farcaster)\n    Address: 0xabc123...\n    Last Trade: No recent activity\n\nCheck Interval: 5 minutes\nLookback Period: 24 hours\nAlerts: Enabled',
          actions: ['LIST_TRADE_MONITORS'],
        },
      },
    ],
  ],
};

/**
 * Remove Trade Monitor Action
 * Handles commands like:
 * - "stop monitoring vitalik.eth"
 * - "remove 0x123... from trade watch"
 * - "unwatch dwr"
 */
const removeTradeMonitorAction: Action = {
  name: 'REMOVE_TRADE_MONITOR',
  similes: ['STOP_MONITORING_WALLET', 'UNWATCH_TRADER', 'REMOVE_ADDRESS'],
  description: 'Stop monitoring a wallet address for trade activity',

  validate: async (_runtime: IAgentRuntime, message: Memory, _state: State): Promise<boolean> => {
    const text = message.content.text?.toLowerCase() || '';

    const removeKeywords = ['stop', 'remove', 'unwatch', 'delete'];
    const monitorKeywords = ['monitor', 'watch', 'track'];

    const hasRemoveKeyword = removeKeywords.some((keyword) => text.includes(keyword));
    const hasMonitorKeyword = monitorKeywords.some((keyword) => text.includes(keyword));

    return hasRemoveKeyword && hasMonitorKeyword;
  },

  handler: async (
    runtime: IAgentRuntime,
    message: Memory,
    _state: State,
    _options: any,
    callback: HandlerCallback
  ): Promise<ActionResult> => {
    try {
      logger.info('Handling REMOVE_TRADE_MONITOR action');

      const service = runtime.getService<TradeMonitorService>(TradeMonitorService.serviceType);
      if (!service) {
        throw new Error('Trade Monitor Service not available');
      }

      const text = message.content.text || '';

      // Extract address/name from text
      const ensMatch = text.match(/([a-zA-Z0-9-]+\.eth)/);
      const addressMatch = text.match(/(0x[a-fA-F0-9]{40})/);
      const usernameMatch = text.match(/(?:^|\s)@?(\w+)(?:\s|$)/);

      let addressInput: string | null = null;

      if (ensMatch) {
        addressInput = ensMatch[1];
      } else if (addressMatch) {
        addressInput = addressMatch[1];
      } else if (usernameMatch) {
        addressInput = usernameMatch[1];
      }

      if (!addressInput) {
        await callback({
          text: 'Please specify which address to stop monitoring',
          source: message.content.source,
        });

        return {
          text: 'No address provided',
          values: {
            success: false,
            error: 'NO_ADDRESS_PROVIDED',
          },
          data: {
            actionName: 'REMOVE_TRADE_MONITOR',
          },
          success: false,
        };
      }

      // Remove address from monitoring
      const removed = await service.removeAddress(addressInput);

      if (!removed) {
        await callback({
          text: `"${addressInput}" was not being monitored or could not be found.`,
          source: message.content.source,
        });

        return {
          text: 'Address not found',
          values: {
            success: false,
            removed: false,
          },
          data: {
            actionName: 'REMOVE_TRADE_MONITOR',
            input: addressInput,
          },
          success: true, // Not an error, just not found
        };
      }

      const responseText = `✅ Stopped monitoring trade activity for "${addressInput}"`;

      await callback({
        text: responseText,
        actions: ['REMOVE_TRADE_MONITOR'],
        source: message.content.source,
      });

      return {
        text: 'Trade monitoring removed',
        values: {
          success: true,
          removed: true,
        },
        data: {
          actionName: 'REMOVE_TRADE_MONITOR',
          input: addressInput,
        },
        success: true,
      };
    } catch (error) {
      logger.error({ error }, 'Error in REMOVE_TRADE_MONITOR action');

      await callback({
        text: 'Failed to remove address from trade monitoring. Please try again.',
        source: message.content.source,
      });

      return {
        text: 'Failed to remove trade monitor',
        values: {
          success: false,
          error: 'REMOVE_FAILED',
        },
        data: {
          actionName: 'REMOVE_TRADE_MONITOR',
          error: error instanceof Error ? error.message : String(error),
        },
        success: false,
        error: error instanceof Error ? error : new Error(String(error)),
      };
    }
  },

  examples: [
    [
      {
        name: '{{name1}}',
        content: {
          text: 'Stop monitoring vitalik.eth',
        },
      },
      {
        name: '{{name2}}',
        content: {
          text: '✅ Stopped monitoring trade activity for "vitalik.eth"',
          actions: ['REMOVE_TRADE_MONITOR'],
        },
      },
    ],
  ],
};

// ============================
// Plugin Definition
// ============================

const tradeMonitorPlugin: Plugin = {
  name: 'trade-monitor',
  description: 'Monitors wallet addresses for DEX trading activity on Base blockchain',
  services: [TradeMonitorService],
  actions: [addTradeMonitorAction, listTradeMonitorsAction, removeTradeMonitorAction],
};

export default tradeMonitorPlugin;
