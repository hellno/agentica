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

interface PriceMonitorConfig {
  tokens: string[];
  threshold: number; // Percentage as decimal (0.05 = 5%)
  cooldown: number; // Milliseconds
  pollInterval: number; // Milliseconds
}

interface PriceAlertState {
  token: string;
  lastPrice: number;
  lastAlertPrice: number;
  lastAlertTimestamp: number;
}

interface CoinGeckoPrice {
  usd: number;
}

interface CoinGeckoPriceResponse {
  [tokenId: string]: CoinGeckoPrice;
}

// ============================
// Default Configuration
// ============================

const DEFAULT_CONFIG: PriceMonitorConfig = {
  tokens: ['bitcoin', 'ethereum', 'solana'],
  threshold: 0.05, // 5%
  cooldown: 900000, // 15 minutes
  pollInterval: 180000, // 3 minutes
};

const COINGECKO_API_BASE = 'https://api.coingecko.com/api/v3';

// Token display names for better UX
const TOKEN_DISPLAY_NAMES: Record<string, string> = {
  bitcoin: 'Bitcoin',
  ethereum: 'Ethereum',
  solana: 'Solana',
  cardano: 'Cardano',
  polkadot: 'Polkadot',
  avalanche: 'Avalanche',
};

// ============================
// Price Monitor Service
// ============================

export class PriceMonitorService extends Service {
  static serviceType = 'price-monitor';
  capabilityDescription = 'Monitors cryptocurrency prices and sends alerts on significant changes';

  private serviceConfig: PriceMonitorConfig = DEFAULT_CONFIG;
  private priceStates: Map<string, PriceAlertState> = new Map();
  private pollingInterval?: NodeJS.Timeout;
  private isRunning = false;

  constructor(runtime?: IAgentRuntime) {
    super(runtime);
  }

  static async start(runtime: IAgentRuntime): Promise<PriceMonitorService> {
    logger.info('Starting Price Monitor Service');
    const service = new PriceMonitorService(runtime);
    await service.initialize();
    return service;
  }

  static async stop(runtime: IAgentRuntime): Promise<void> {
    logger.info('Stopping Price Monitor Service');
    const service = runtime.getService<PriceMonitorService>(PriceMonitorService.serviceType);
    if (service) {
      await service.stop();
    }
  }

  private async initialize(): Promise<void> {
    try {
      logger.info('🚀 [PRICE-MONITOR] Starting initialization...');

      // Load configuration from memory
      await this.loadConfig();
      logger.info({ config: this.serviceConfig }, '📋 [PRICE-MONITOR] Configuration loaded');

      // Load price states from memory
      await this.loadPriceStates();
      logger.info({ stateCount: this.priceStates.size }, '💾 [PRICE-MONITOR] Price states loaded');

      // Start polling
      this.startPolling();

      logger.info({ config: this.serviceConfig }, '✅ [PRICE-MONITOR] Service initialized successfully');
    } catch (error) {
      logger.error({ error }, '❌ [PRICE-MONITOR] Failed to initialize');
      throw error;
    }
  }

  async stop(): Promise<void> {
    this.isRunning = false;
    if (this.pollingInterval) {
      clearInterval(this.pollingInterval);
      this.pollingInterval = undefined;
    }
    logger.info('Price Monitor Service stopped');
  }

  // ============================
  // Configuration Management
  // ============================

  async loadConfig(): Promise<void> {
    try {
      const configMemories = await this.runtime.getMemories({
        roomId: this.runtime.agentId,
        tableName: 'price_monitor_config',
        count: 1,
      });

      if (configMemories && configMemories.length > 0) {
        const configData = configMemories[0].content.config;
        if (configData) {
          this.serviceConfig = { ...DEFAULT_CONFIG, ...configData };
          logger.info({ config: this.serviceConfig }, 'Loaded price monitor config from memory');
          return;
        }
      }

      // No saved config, use defaults
      this.serviceConfig = DEFAULT_CONFIG;
      await this.saveConfig();
      logger.info('Initialized with default price monitor config');
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
            text: 'Price monitor configuration',
            config: this.serviceConfig,
          },
          createdAt: Date.now(),
        },
        'price_monitor_config'
      );

      logger.info({ config: this.serviceConfig }, 'Saved price monitor config');
    } catch (error) {
      logger.error({ error }, 'Failed to save config');
    }
  }

  async updateConfig(updates: Partial<PriceMonitorConfig>): Promise<void> {
    this.serviceConfig = { ...this.serviceConfig, ...updates };
    await this.saveConfig();

    // Restart polling with new interval if it changed
    if (updates.pollInterval && this.isRunning) {
      this.stopPolling();
      this.startPolling();
    }
  }

  getConfig(): PriceMonitorConfig {
    return { ...this.serviceConfig };
  }

  // ============================
  // Price State Management
  // ============================

  async loadPriceStates(): Promise<void> {
    try {
      for (const token of this.serviceConfig.tokens) {
        const stateMemories = await this.runtime.getMemories({
          roomId: this.runtime.agentId,
          tableName: 'price_alert_state',
          count: 1,
        });

        const tokenState = stateMemories?.find((m: Memory) => m.content.token === token);

        if (tokenState && tokenState.content.state) {
          this.priceStates.set(token, tokenState.content.state as PriceAlertState);
        } else {
          // Initialize with placeholder state
          this.priceStates.set(token, {
            token,
            lastPrice: 0,
            lastAlertPrice: 0,
            lastAlertTimestamp: 0,
          });
        }
      }

      logger.info({ tokenCount: this.priceStates.size }, 'Loaded price states');
    } catch (error) {
      logger.error({ error }, 'Error loading price states');
    }
  }

  async savePriceState(token: string, state: PriceAlertState): Promise<void> {
    try {
      await this.runtime.createMemory(
        {
          id: crypto.randomUUID(),
          entityId: this.runtime.agentId,
          agentId: this.runtime.agentId,
          roomId: this.runtime.agentId,
          content: {
            text: `Price state for ${token}`,
            token,
            state,
          },
          createdAt: Date.now(),
        },
        'price_alert_state'
      );

      this.priceStates.set(token, state);
    } catch (error) {
      logger.error({ error, token }, 'Failed to save price state');
    }
  }

  // ============================
  // Polling Logic
  // ============================

  private startPolling(): void {
    if (this.isRunning) {
      logger.warn('Polling already running');
      return;
    }

    this.isRunning = true;

    // Run immediately on start
    this.checkPrices().catch((error) => {
      logger.error({ error }, 'Error in initial price check');
    });

    // Then run on interval
    this.pollingInterval = setInterval(() => {
      this.checkPrices().catch((error) => {
        logger.error({ error }, 'Error in scheduled price check');
      });
    }, this.serviceConfig.pollInterval);

    logger.info(
      { interval: this.serviceConfig.pollInterval },
      'Price monitoring polling started'
    );
  }

  private stopPolling(): void {
    if (this.pollingInterval) {
      clearInterval(this.pollingInterval);
      this.pollingInterval = undefined;
    }
    this.isRunning = false;
    logger.info('Price monitoring polling stopped');
  }

  async checkPrices(): Promise<void> {
    logger.info({ tokenCount: this.serviceConfig.tokens.length }, '⏰ [PRICE-MONITOR] checkPrices() called');

    if (this.serviceConfig.tokens.length === 0) {
      logger.warn('⚠️ [PRICE-MONITOR] No tokens configured for monitoring');
      return;
    }

    try {
      const prices = await this.fetchPrices();
      logger.info({ prices, tokenCount: Object.keys(prices).length }, '📊 [PRICE-MONITOR] Got prices, processing updates...');

      for (const token of this.serviceConfig.tokens) {
        const currentPrice = prices[token];
        if (!currentPrice) {
          logger.warn({ token }, '⚠️ [PRICE-MONITOR] No price data for token');
          continue;
        }

        logger.info({ token, currentPrice }, '🔄 [PRICE-MONITOR] Processing price update');
        await this.processPriceUpdate(token, currentPrice);
      }

      logger.info('✅ [PRICE-MONITOR] Price check completed');
    } catch (error) {
      logger.error({ error }, '❌ [PRICE-MONITOR] Failed to check prices');
    }
  }

  private async fetchPrices(): Promise<Record<string, number>> {
    const tokenIds = this.serviceConfig.tokens.join(',');
    const url = `${COINGECKO_API_BASE}/simple/price?ids=${tokenIds}&vs_currencies=usd`;

    logger.info({ url, tokens: tokenIds }, '🌐 [PRICE-MONITOR] Fetching prices from CoinGecko...');

    try {
      const response = await fetch(url);

      if (!response.ok) {
        logger.error({ status: response.status, statusText: response.statusText }, '❌ [PRICE-MONITOR] CoinGecko API error');
        throw new Error(`CoinGecko API error: ${response.status} ${response.statusText}`);
      }

      const data = (await response.json()) as CoinGeckoPriceResponse;
      logger.info({ data }, '📦 [PRICE-MONITOR] Received data from CoinGecko');

      const prices: Record<string, number> = {};
      for (const [token, priceData] of Object.entries(data)) {
        prices[token] = priceData.usd;
      }

      logger.info({ prices }, '💰 [PRICE-MONITOR] Parsed prices successfully');
      return prices;
    } catch (error) {
      logger.error({ error }, '❌ [PRICE-MONITOR] Failed to fetch prices');
      throw error;
    }
  }

  private async processPriceUpdate(token: string, currentPrice: number): Promise<void> {
    const state = this.priceStates.get(token);

    if (!state) {
      // First time seeing this token, initialize state WITHOUT sending alert
      await this.savePriceState(token, {
        token,
        lastPrice: currentPrice,
        lastAlertPrice: currentPrice,
        lastAlertTimestamp: Date.now(),
      });
      logger.info({ token, price: currentPrice }, 'Initialized price tracking for token (no alert on first run)');
      return;
    }

    // Sanity check: ensure lastAlertPrice is valid to avoid Infinity calculations
    if (!state.lastAlertPrice || state.lastAlertPrice === 0) {
      logger.warn({ token, state }, 'Invalid lastAlertPrice detected, reinitializing state');
      state.lastAlertPrice = currentPrice;
      state.lastPrice = currentPrice;
      state.lastAlertTimestamp = Date.now();
      await this.savePriceState(token, state);
      return;
    }

    // Update last price
    state.lastPrice = currentPrice;

    // Check if alert should be sent
    const shouldAlert = this.shouldSendAlert(state, currentPrice);

    if (shouldAlert) {
      const priceChange = ((currentPrice - state.lastAlertPrice) / state.lastAlertPrice) * 100;
      await this.sendAlert(token, currentPrice, priceChange);

      // Update alert state
      state.lastAlertPrice = currentPrice;
      state.lastAlertTimestamp = Date.now();
      await this.savePriceState(token, state);
    } else {
      // Just update the last price, no need to save to DB constantly
      this.priceStates.set(token, state);
    }
  }

  private shouldSendAlert(state: PriceAlertState, currentPrice: number): boolean {
    const now = Date.now();

    // Check cooldown period
    const timeSinceLastAlert = now - state.lastAlertTimestamp;
    if (timeSinceLastAlert < this.serviceConfig.cooldown) {
      return false;
    }

    // Check price change threshold
    const priceChange = Math.abs((currentPrice - state.lastAlertPrice) / state.lastAlertPrice);
    return priceChange >= this.serviceConfig.threshold;
  }

  // ============================
  // Alert Broadcasting
  // ============================

  async sendAlert(token: string, price: number, changePercent: number): Promise<void> {
    const direction = changePercent > 0 ? '↑' : '↓';
    const tokenName = TOKEN_DISPLAY_NAMES[token] || token;
    const formattedPrice = price.toLocaleString('en-US', {
      style: 'currency',
      currency: 'USD',
    });
    const formattedChange = Math.abs(changePercent).toFixed(2);

    const alertText = `🚨 ${tokenName} Price Alert: ${formattedPrice} ${direction}${formattedChange}%`;

    logger.info({ token, price, changePercent, alertText }, '🚨 [PRICE-MONITOR] Preparing to send price alert');

    try {
      // Get all rooms the agent is in (returns UUID[])
      const roomIds = await this.runtime.getRoomsForParticipant(this.runtime.agentId);
      logger.info({ roomIds, roomCount: roomIds?.length || 0 }, '📍 [PRICE-MONITOR] Got rooms for agent');

      if (!roomIds || roomIds.length === 0) {
        logger.warn('⚠️ [PRICE-MONITOR] No rooms found to send alerts to');
        return;
      }

      // Send alert to each room
      for (const roomId of roomIds) {
        logger.info({ roomId, alertText }, '📤 [PRICE-MONITOR] Sending alert to room');
        await this.runtime.createMemory(
          {
            id: crypto.randomUUID(),
            entityId: this.runtime.agentId,
            agentId: this.runtime.agentId,
            roomId,
            content: {
              text: alertText,
              source: 'price-monitor',
              action: 'PRICE_ALERT',
            },
            createdAt: Date.now(),
          },
          'messages'
        );
        logger.info({ roomId }, '✅ [PRICE-MONITOR] Alert sent to room');
      }

      logger.info({ roomCount: roomIds.length, alertText }, '✅ [PRICE-MONITOR] Alert broadcast complete');
    } catch (error) {
      logger.error({ error }, '❌ [PRICE-MONITOR] Failed to broadcast alert');
    }
  }

  // ============================
  // Public Methods for Actions
  // ============================

  getStatus(): {
    config: PriceMonitorConfig;
    states: PriceAlertState[];
  } {
    return {
      config: this.getConfig(),
      states: Array.from(this.priceStates.values()),
    };
  }
}

// ============================
// Actions
// ============================

/**
 * Configure Price Monitoring Action
 * Handles commands like:
 * - "monitor bitcoin"
 * - "watch solana with 10% threshold"
 * - "add ethereum to monitoring"
 */
const configureMonitorAction: Action = {
  name: 'CONFIGURE_PRICE_MONITOR',
  similes: [
    'WATCH_PRICE',
    'MONITOR_TOKEN',
    'TRACK_CRYPTO',
    'SET_PRICE_ALERT',
    'ADD_MONITORING',
  ],
  description:
    'Configure cryptocurrency price monitoring with custom tokens and thresholds',

  validate: async (_runtime: IAgentRuntime, message: Memory, _state: State): Promise<boolean> => {
    const text = message.content.text?.toLowerCase() || '';

    logger.info({ text }, '🔍 [CONFIGURE_PRICE_MONITOR] Validating message...');

    // Trigger on monitoring-related keywords
    const keywords = [
      'monitor',
      'watch',
      'track',
      'alert',
      'price',
      'crypto',
      'bitcoin',
      'ethereum',
      'solana',
      'threshold',
    ];

    const matched = keywords.some((keyword) => text.includes(keyword));
    logger.info({ text, matched, keywords }, `${matched ? '✅' : '❌'} [CONFIGURE_PRICE_MONITOR] Validation result`);

    return matched;
  },

  handler: async (
    runtime: IAgentRuntime,
    message: Memory,
    _state: State,
    _options: any,
    callback: HandlerCallback
  ): Promise<ActionResult> => {
    try {
      logger.info({ messageText: message.content.text }, '🎯 [CONFIGURE_PRICE_MONITOR] Handler called');

      const service = runtime.getService<PriceMonitorService>(
        PriceMonitorService.serviceType
      );
      if (!service) {
        throw new Error('Price Monitor Service not available');
      }

      const text = message.content.text?.toLowerCase() || '';

      // Parse tokens from message
      const tokenKeywords = [
        'bitcoin',
        'btc',
        'ethereum',
        'eth',
        'solana',
        'sol',
        'cardano',
        'ada',
        'polkadot',
        'dot',
        'avalanche',
        'avax',
      ];

      const detectedTokens: string[] = [];
      for (const keyword of tokenKeywords) {
        if (text.includes(keyword)) {
          // Normalize to CoinGecko ID
          const normalizedToken =
            keyword === 'btc'
              ? 'bitcoin'
              : keyword === 'eth'
                ? 'ethereum'
                : keyword === 'sol'
                  ? 'solana'
                  : keyword === 'ada'
                    ? 'cardano'
                    : keyword === 'dot'
                      ? 'polkadot'
                      : keyword === 'avax'
                        ? 'avalanche'
                        : keyword;
          if (!detectedTokens.includes(normalizedToken)) {
            detectedTokens.push(normalizedToken);
          }
        }
      }

      // Parse threshold if specified
      let threshold: number | undefined;
      const thresholdMatch = text.match(/(\d+)%?\s*threshold/);
      if (thresholdMatch) {
        threshold = parseFloat(thresholdMatch[1]) / 100; // Convert to decimal
      }

      // Update configuration
      const updates: Partial<PriceMonitorConfig> = {};
      if (detectedTokens.length > 0) {
        const currentConfig = service.getConfig();
        const newTokens = [...new Set([...currentConfig.tokens, ...detectedTokens])];
        updates.tokens = newTokens;
      }
      if (threshold !== undefined) {
        updates.threshold = threshold;
      }

      if (Object.keys(updates).length > 0) {
        await service.updateConfig(updates);

        const responseText = `Updated price monitoring configuration:\n${
          updates.tokens
            ? `Tokens: ${updates.tokens.map((t) => TOKEN_DISPLAY_NAMES[t] || t).join(', ')}\n`
            : ''
        }${updates.threshold ? `Threshold: ${(updates.threshold * 100).toFixed(1)}%\n` : ''}`;

        await callback({
          text: responseText,
          actions: ['CONFIGURE_PRICE_MONITOR'],
          source: message.content.source,
        });

        return {
          text: 'Price monitoring configured',
          values: {
            success: true,
            configured: true,
            updates,
          },
          data: {
            actionName: 'CONFIGURE_PRICE_MONITOR',
            updates,
          },
          success: true,
        };
      } else {
        // No valid configuration detected
        await callback({
          text: 'I can help you monitor crypto prices. Try: "monitor bitcoin" or "watch ethereum with 10% threshold"',
          source: message.content.source,
        });

        return {
          text: 'Provided monitoring instructions',
          values: {
            success: true,
            configured: false,
          },
          data: {
            actionName: 'CONFIGURE_PRICE_MONITOR',
          },
          success: true,
        };
      }
    } catch (error) {
      logger.error({ error }, 'Error in CONFIGURE_PRICE_MONITOR action');

      await callback({
        text: 'Failed to configure price monitoring. Please try again.',
        source: message.content.source,
      });

      return {
        text: 'Failed to configure price monitoring',
        values: {
          success: false,
          error: 'CONFIGURATION_FAILED',
        },
        data: {
          actionName: 'CONFIGURE_PRICE_MONITOR',
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
          text: 'Can you monitor bitcoin prices for me?',
        },
      },
      {
        name: '{{name2}}',
        content: {
          text: 'Updated price monitoring configuration:\nTokens: Bitcoin\n',
          actions: ['CONFIGURE_PRICE_MONITOR'],
        },
      },
    ],
    [
      {
        name: '{{name1}}',
        content: {
          text: 'Watch solana with a 10% threshold',
        },
      },
      {
        name: '{{name2}}',
        content: {
          text: 'Updated price monitoring configuration:\nTokens: Bitcoin, Ethereum, Solana\nThreshold: 10.0%\n',
          actions: ['CONFIGURE_PRICE_MONITOR'],
        },
      },
    ],
  ],
};

/**
 * Monitor Status Action
 * Handles commands like:
 * - "what are you monitoring?"
 * - "price status"
 * - "show monitoring"
 */
const monitorStatusAction: Action = {
  name: 'MONITOR_STATUS',
  similes: ['CHECK_MONITORING', 'SHOW_PRICES', 'PRICE_STATUS', 'MONITORING_STATUS'],
  description: 'Show current price monitoring configuration and status',

  validate: async (_runtime: IAgentRuntime, message: Memory, _state: State): Promise<boolean> => {
    const text = message.content.text?.toLowerCase() || '';

    logger.info({ text }, '🔍 [MONITOR_STATUS] Validating message...');

    // Trigger on status check keywords
    const hasMonitorKeyword = text.includes('monitor') || text.includes('price') || text.includes('watch');
    const hasStatusKeyword = text.includes('status') || text.includes('what') || text.includes('show') || text.includes('list');
    const matched = hasMonitorKeyword && hasStatusKeyword;

    logger.info({ text, hasMonitorKeyword, hasStatusKeyword, matched }, `${matched ? '✅' : '❌'} [MONITOR_STATUS] Validation result`);

    return matched;
  },

  handler: async (
    runtime: IAgentRuntime,
    message: Memory,
    _state: State,
    _options: any,
    callback: HandlerCallback
  ): Promise<ActionResult> => {
    try {
      logger.info({ messageText: message.content.text }, '🎯 [MONITOR_STATUS] Handler called');

      const service = runtime.getService<PriceMonitorService>(
        PriceMonitorService.serviceType
      );
      if (!service) {
        throw new Error('Price Monitor Service not available');
      }

      const status = service.getStatus();

      // Build status message
      let statusText = '📊 Price Monitoring Status\n\n';
      statusText += `Tokens: ${status.config.tokens.map((t) => TOKEN_DISPLAY_NAMES[t] || t).join(', ')}\n`;
      statusText += `Alert Threshold: ${(status.config.threshold * 100).toFixed(1)}%\n`;
      statusText += `Cooldown: ${(status.config.cooldown / 60000).toFixed(0)} minutes\n`;
      statusText += `Check Interval: ${(status.config.pollInterval / 60000).toFixed(0)} minutes\n\n`;

      if (status.states.length > 0) {
        statusText += 'Current Prices:\n';
        for (const state of status.states) {
          const tokenName = TOKEN_DISPLAY_NAMES[state.token] || state.token;
          const price =
            state.lastPrice > 0
              ? state.lastPrice.toLocaleString('en-US', {
                  style: 'currency',
                  currency: 'USD',
                })
              : 'Loading...';
          const lastAlert =
            state.lastAlertTimestamp > 0
              ? new Date(state.lastAlertTimestamp).toLocaleString()
              : 'Never';
          statusText += `  ${tokenName}: ${price} (Last alert: ${lastAlert})\n`;
        }
      }

      await callback({
        text: statusText,
        actions: ['MONITOR_STATUS'],
        source: message.content.source,
      });

      return {
        text: 'Provided monitoring status',
        values: {
          success: true,
          status,
        },
        data: {
          actionName: 'MONITOR_STATUS',
          status,
        },
        success: true,
      };
    } catch (error) {
      logger.error({ error }, 'Error in MONITOR_STATUS action');

      await callback({
        text: 'Failed to retrieve monitoring status. Please try again.',
        source: message.content.source,
      });

      return {
        text: 'Failed to get monitoring status',
        values: {
          success: false,
          error: 'STATUS_CHECK_FAILED',
        },
        data: {
          actionName: 'MONITOR_STATUS',
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
          text: 'What are you monitoring?',
        },
      },
      {
        name: '{{name2}}',
        content: {
          text: '📊 Price Monitoring Status\n\nTokens: Bitcoin, Ethereum, Solana\nAlert Threshold: 5.0%\nCooldown: 15 minutes\nCheck Interval: 3 minutes\n\nCurrent Prices:\n  Bitcoin: $96,450 (Last alert: Never)\n  Ethereum: $3,421 (Last alert: Never)\n  Solana: $234 (Last alert: Never)',
          actions: ['MONITOR_STATUS'],
        },
      },
    ],
  ],
};

// ============================
// Plugin Definition
// ============================

const priceMonitorPlugin: Plugin = {
  name: 'price-monitor',
  description: 'Cryptocurrency price monitoring and alert system',
  services: [PriceMonitorService],
  actions: [configureMonitorAction, monitorStatusAction],
};

export default priceMonitorPlugin;
