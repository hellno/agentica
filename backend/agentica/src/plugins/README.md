# Trade Monitor Plugin

A comprehensive ElizaOS plugin for monitoring wallet addresses for DEX trading activity on the Base blockchain.

## Overview

The `trade-monitor` plugin enables your ElizaOS agent to:
- Monitor multiple wallet addresses simultaneously
- Track DEX swaps on Base (Uniswap, Sushiswap, etc.)
- Resolve ENS names and Farcaster usernames to addresses
- Send real-time alerts when new trades are detected
- Cache trade history to avoid duplicate notifications

## Architecture

### Service: `TradeMonitorService`

The core service runs in the background with a configurable polling interval (default: 5 minutes).

**Key Features:**
- **Address Resolution**: Supports ENS names (.eth), Farcaster usernames, and direct Ethereum addresses
- **Trade Discovery**: Queries TheGraph for recent DEX swaps on Base
- **Caching**: Maintains local cache of recent trades to avoid duplicates
- **Alerting**: Broadcasts new trade notifications to all rooms the agent is in
- **Persistence**: Stores configuration and state in ElizaOS memory

### Actions

#### 1. `ADD_TRADE_MONITOR`
Add a wallet address to monitoring.

**Triggers:**
- "monitor vitalik.eth trades"
- "watch dwr for swaps"
- "track 0x123... trading activity"

**Similes:** `WATCH_TRADER`, `MONITOR_WALLET`, `TRACK_ADDRESS`, `WATCH_SWAPS`

#### 2. `LIST_TRADE_MONITORS`
View all monitored addresses and their recent activity.

**Triggers:**
- "what trades are you monitoring?"
- "list monitored wallets"
- "show trade monitoring status"

**Similes:** `SHOW_MONITORED_WALLETS`, `TRADE_MONITORING_STATUS`, `LIST_WATCHED_TRADERS`

#### 3. `REMOVE_TRADE_MONITOR`
Stop monitoring a specific address.

**Triggers:**
- "stop monitoring vitalik.eth"
- "remove 0x123... from trade watch"
- "unwatch dwr"

**Similes:** `STOP_MONITORING_WALLET`, `UNWATCH_TRADER`, `REMOVE_ADDRESS`

## Configuration

### Default Settings

```typescript
{
  addresses: [],              // Monitored wallet addresses
  pollInterval: 300000,       // 5 minutes
  lookbackHours: 24,          // Check last 24 hours
  enableAlerts: true          // Send notifications
}
```

### Environment Variables

No additional environment variables required beyond standard ElizaOS setup.

**Optional (for full functionality):**
- `ALCHEMY_API_KEY` or similar Ethereum provider (for ENS resolution)
- `NEYNAR_API_KEY` (for Farcaster username resolution)
- `ZAPPER_API_KEY` (for transaction metadata enrichment)

## Implementation Status

### ✅ Completed (Scaffolded)

1. **Service Lifecycle**
   - Initialization and cleanup
   - Configuration persistence
   - Polling mechanism

2. **Address Management**
   - Add/remove addresses
   - List monitored addresses
   - Address resolution routing
   - Direct address support

3. **Caching System**
   - Trade cache storage
   - Cache expiration logic
   - Duplicate detection

4. **Alerting System**
   - Alert formatting
   - Room broadcasting
   - Alert configuration

5. **Actions**
   - All three actions fully implemented
   - Validation logic
   - Handler callbacks
   - Example conversations

### 🚧 TODO (Scaffolded with placeholders)

1. **Address Resolution** (`src/plugins/trade-monitor.ts` lines 350-389)
   - `resolveENS()`: ENS name resolution using ethers.js/Viem
   - `resolveFarcaster()`: Farcaster username resolution via Neynar API

2. **Trade Discovery** (`src/plugins/trade-monitor.ts` lines 395-479)
   - `fetchRecentTrades()`: TheGraph query execution
   - `buildGraphQLQuery()`: Complete GraphQL query for Uniswap V3 on Base
   - `parseGraphQLResponse()`: Parse swap data into `TradeTransaction` objects

3. **Metadata Enrichment** (`src/plugins/trade-monitor.ts` lines 485-524)
   - `enrichWithZapperData()`: Zapper API integration
   - `fetchZapperMetadata()`: Retrieve NFT images, labels, transaction interpretation

## Next Steps for Implementation

### Step 1: ENS Resolution (Priority: Medium)

```typescript
// Install dependencies
bun add ethers

// Implement resolveENS
private async resolveENS(ensName: string): Promise<string | null> {
  try {
    const provider = new ethers.providers.JsonRpcProvider(
      process.env.ETHEREUM_RPC_URL || 'https://eth-mainnet.g.alchemy.com/v2/YOUR_KEY'
    );
    const address = await provider.resolveName(ensName);
    return address;
  } catch (error) {
    logger.error({ error, ensName }, 'ENS resolution failed');
    return null;
  }
}
```

### Step 2: Farcaster Resolution (Priority: Medium)

```typescript
// Implement resolveFarcaster
private async resolveFarcaster(username: string): Promise<string[]> {
  try {
    const response = await fetch(
      `https://api.neynar.com/v2/farcaster/user/by_username?username=${username}`,
      {
        headers: {
          'api_key': process.env.NEYNAR_API_KEY || '',
        },
      }
    );

    const data = await response.json();
    const addresses: string[] = [];

    // Add custody address
    if (data.result.user.custody_address) {
      addresses.push(data.result.user.custody_address);
    }

    // Add verified addresses
    if (data.result.user.verified_addresses?.eth_addresses) {
      addresses.push(...data.result.user.verified_addresses.eth_addresses);
    }

    return addresses;
  } catch (error) {
    logger.error({ error, username }, 'Farcaster resolution failed');
    return [];
  }
}
```

### Step 3: TheGraph Integration (Priority: High)

```typescript
// Implement fetchRecentTrades
private async fetchRecentTrades(address: string): Promise<TradeTransaction[]> {
  const sinceTimestamp = Math.floor(Date.now() / 1000) - this.serviceConfig.lookbackHours * 3600;

  const query = this.buildGraphQLQuery(address, sinceTimestamp);

  try {
    const response = await fetch(BASE_GRAPH_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ query }),
    });

    const data = await response.json();
    return this.parseGraphQLResponse(data);
  } catch (error) {
    logger.error({ error, address }, 'Failed to fetch trades from TheGraph');
    return [];
  }
}

// Complete buildGraphQLQuery
private buildGraphQLQuery(address: string, sinceTimestamp: number): string {
  return `
    query GetRecentSwaps {
      swaps(
        first: 100,
        orderBy: timestamp,
        orderDirection: desc,
        where: {
          origin: "${address.toLowerCase()}",
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
          id
          token0 { symbol decimals }
          token1 { symbol decimals }
        }
        amount0
        amount1
        amountUSD
      }
    }
  `;
}

// Implement parseGraphQLResponse
private parseGraphQLResponse(response: any): TradeTransaction[] {
  if (!response?.data?.swaps) return [];

  return response.data.swaps.map((swap: any) => {
    const isToken0In = parseFloat(swap.amount0) < 0;

    return {
      txHash: swap.transaction.id,
      timestamp: parseInt(swap.transaction.timestamp),
      trader: swap.origin,
      protocol: 'Uniswap V3',
      tokenIn: isToken0In ? swap.pool.token0.symbol : swap.pool.token1.symbol,
      tokenOut: isToken0In ? swap.pool.token1.symbol : swap.pool.token0.symbol,
      amountIn: Math.abs(parseFloat(isToken0In ? swap.amount0 : swap.amount1)),
      amountOut: Math.abs(parseFloat(isToken0In ? swap.amount1 : swap.amount0)),
      valueUSD: parseFloat(swap.amountUSD),
    };
  });
}
```

### Step 4: Zapper Enrichment (Priority: Low)

```typescript
// Implement fetchZapperMetadata
private async fetchZapperMetadata(txHash: string): Promise<any> {
  try {
    const response = await fetch(
      `https://api.zapper.xyz/v2/transactions/${txHash}?network=base`,
      {
        headers: {
          'Authorization': `Basic ${process.env.ZAPPER_API_KEY}`,
        },
      }
    );

    const data = await response.json();

    return {
      nftImageUrl: data.nftImageUrl,
      labels: data.labels,
      interpretation: data.interpretation,
    };
  } catch (error) {
    logger.warn({ error, txHash }, 'Zapper metadata fetch failed');
    return null;
  }
}
```

## Testing

### Manual Testing

```typescript
// In ElizaOS chat interface:

// 1. Add address to monitoring
"monitor vitalik.eth trades"
"watch 0xd8dA6BF26964aF9D7eEd9e03E53415D37aA96045 for swaps"

// 2. Check status
"what trades are you monitoring?"
"list monitored wallets"

// 3. Remove address
"stop monitoring vitalik.eth"
```

### Integration Testing

```bash
# Start ElizaOS in development mode
bun run dev

# Check service initialization
# Expected log: "Trade Monitor Service initialized"

# Verify polling started
# Expected log: "Trade monitoring polling started"
```

## Memory Tables

The plugin uses the following memory tables:

| Table Name | Purpose | Schema |
|------------|---------|--------|
| `trade_monitor_config` | Service configuration | `{ config: TradeMonitorConfig }` |
| `trade_cache` | Cached trade data per address | `{ address: string, cache: TradeCache }` |
| `resolved_addresses` | Address resolution mappings | `{ resolved: ResolvedAddress }` |
| `messages` | Trade alerts broadcast to rooms | Standard message format |

## Performance Considerations

- **Polling Interval**: Default 5 minutes balances responsiveness with API rate limits
- **Lookback Period**: 24 hours prevents missing trades while limiting data volume
- **Cache Size**: Stores last 20 trades per address (configurable)
- **Query Limit**: Fetches max 100 swaps per address per check

## API Rate Limits

- **TheGraph**: ~1000 queries/day on free tier
- **Neynar**: Varies by plan
- **Zapper**: 100 requests/minute on free tier

## Security Considerations

- No private keys or sensitive data stored
- Read-only blockchain data access
- API keys stored in environment variables
- Input validation on all address inputs

## Contributing

To extend this plugin:

1. Add new DEX protocols by updating `parseGraphQLResponse()`
2. Support additional blockchains by creating protocol-specific subgraph URLs
3. Add custom alert formatting in `sendTradeAlert()`
4. Implement advanced filtering (token pairs, trade size thresholds)

## License

Same as ElizaOS core (MIT)

---

**Status**: Fully scaffolded, ready for implementation of external API integrations.

**Created**: 2025-01-22
**Version**: 1.0.0-scaffolded
