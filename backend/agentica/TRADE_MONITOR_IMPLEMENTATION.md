# Trade Monitor Plugin - Implementation Guide

## Summary

Created a fully scaffolded ElizaOS plugin for monitoring wallet addresses and detecting DEX trading activity on the Base blockchain.

**Files Created:**
- `/src/plugins/trade-monitor.ts` (1,319 lines)
- `/src/plugins/README.md` (comprehensive documentation)

**Files Modified:**
- `/src/index.ts` (added plugin export and registration)
- `/src/character.ts` (updated bio and topics)

## What's Implemented ✅

### 1. Complete Service Architecture

**TradeMonitorService** (`Service` class):
- ✅ Lifecycle management (`start()`, `stop()`, `initialize()`)
- ✅ Configuration persistence (load/save/update)
- ✅ Address management (add/remove/list)
- ✅ Resolved address storage and retrieval
- ✅ Trade caching system
- ✅ Background polling mechanism (5-minute intervals)
- ✅ Alert broadcasting to all rooms

### 2. Three Complete Actions

#### `ADD_TRADE_MONITOR`
- ✅ Natural language validation
- ✅ Address parsing (ENS, Farcaster, direct 0x)
- ✅ Integration with service.addAddress()
- ✅ User-friendly response formatting
- ✅ Example conversations

#### `LIST_TRADE_MONITORS`
- ✅ Status display with all monitored addresses
- ✅ Recent trade information from cache
- ✅ Configuration summary
- ✅ Formatted output

#### `REMOVE_TRADE_MONITOR`
- ✅ Address removal logic
- ✅ Confirmation messages
- ✅ Cache cleanup

### 3. Data Structures

All TypeScript interfaces defined:
- `TradeMonitorConfig` - Service configuration
- `ResolvedAddress` - Address resolution metadata
- `TradeTransaction` - DEX trade data
- `TradeCache` - Per-address cache

### 4. Memory Persistence

Three memory tables:
- `trade_monitor_config` - Configuration storage
- `trade_cache` - Trade history per address
- `resolved_addresses` - Address mappings

## What Needs Implementation 🚧

**12 TODO markers** for external API integrations:

### Priority 1: Trade Discovery (Core Functionality)

**Location:** Lines 395-479

#### `fetchRecentTrades()`
- Execute GraphQL query against TheGraph
- Handle response parsing
- Error handling and retries

#### `buildGraphQLQuery()`
- Complete Uniswap V3 swap query
- Add support for multiple DEX protocols
- Optimize for Base blockchain

#### `parseGraphQLResponse()`
- Parse swap events into TradeTransaction objects
- Determine token in/out from amounts
- Extract protocol information from pool data

**Implementation Effort:** ~2-3 hours

**Dependencies:**
- TheGraph Base subgraph URL: `https://api.studio.thegraph.com/query/48211/uniswap-v3-base/version/latest`
- No API key required for basic queries

### Priority 2: Address Resolution (User Experience)

**Location:** Lines 350-389

#### `resolveENS()`
- Use ethers.js or Viem to resolve .eth names
- Connect to Ethereum mainnet provider
- Handle resolution failures gracefully

**Implementation Effort:** ~30 minutes

**Dependencies:**
```bash
bun add ethers
# or
bun add viem
```

**Environment Variables:**
```bash
ETHEREUM_RPC_URL=https://eth-mainnet.g.alchemy.com/v2/YOUR_KEY
# or use public endpoints
```

#### `resolveFarcaster()`
- Call Neynar API to look up username
- Extract custody address + verified addresses
- Return array of all associated addresses

**Implementation Effort:** ~1 hour

**Dependencies:**
```bash
NEYNAR_API_KEY=your_key_here
```

### Priority 3: Metadata Enrichment (Nice-to-Have)

**Location:** Lines 485-524

#### `enrichWithZapperData()`
- Call Zapper transaction endpoint
- Extract NFT images and labels
- Add interpretation to alerts

#### `fetchZapperMetadata()`
- Zapper API authentication
- Response parsing
- Fallback handling

**Implementation Effort:** ~1 hour

**Dependencies:**
```bash
ZAPPER_API_KEY=your_key_here
```

**Note:** This is optional and can be skipped for MVP.

## Quick Start Guide

### 1. Test Current Implementation

The plugin is already integrated and will start with ElizaOS:

```bash
cd /Users/hellno/dev/misc/agentica/backend/agentica
bun run dev
```

**Expected logs:**
```
Starting Trade Monitor Service
Loaded trade monitor config from memory
Trade Monitor Service initialized
Trade monitoring polling started
```

### 2. Test Actions (Without External APIs)

In ElizaOS chat:

```
User: "monitor 0xd8dA6BF26964aF9D7eEd9e03E53415D37aA96045 for trades"
Agent: ✅ Now monitoring trade activity for:
  • 0xd8dA6BF2... (direct)

I'll alert you when new DEX swaps are detected on Base.

User: "what trades are you monitoring?"
Agent: 📊 Trade Monitoring Status

Monitored Addresses (1):
  • 0xd8dA6BF2... (direct)
    Address: 0xd8dA6BF...
    Last Trade: No recent activity

Check Interval: 5 minutes
Lookback Period: 24 hours
Alerts: Enabled
```

**Note:** Trade fetching will log warnings until TheGraph integration is implemented.

### 3. Implement Trade Discovery (Minimum Viable)

**File:** `/Users/hellno/dev/misc/agentica/backend/agentica/src/plugins/trade-monitor.ts`

**Lines to edit:** 395-479

Replace the TODO sections with working code. Reference implementation provided in `/src/plugins/README.md`.

**Minimal working version:**

```typescript
private async fetchRecentTrades(address: string): Promise<TradeTransaction[]> {
  const sinceTimestamp = Math.floor(Date.now() / 1000) - this.serviceConfig.lookbackHours * 3600;
  const query = this.buildGraphQLQuery(address, sinceTimestamp);

  try {
    const response = await fetch(BASE_GRAPH_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ query }),
    });

    if (!response.ok) {
      throw new Error(`TheGraph API error: ${response.status}`);
    }

    const data = await response.json();
    return this.parseGraphQLResponse(data);
  } catch (error) {
    logger.error({ error, address }, 'Failed to fetch trades from TheGraph');
    return [];
  }
}
```

### 4. Test Live Trade Monitoring

After implementing TheGraph integration:

```bash
# Find an active trader on Base
# Monitor their address
# Wait for the next poll (up to 5 minutes)
# Check logs for trade detection
```

**Expected alert:**
```
🔄 New Trade Detected!

Trader: 0xabc123...
Protocol: Uniswap V3
Swap: WETH → USDC
Value: $1,234.56
Tx: 0x789def...
```

## Testing Strategy

### Unit Tests (Recommended)

Create `/src/plugins/trade-monitor.test.ts`:

```typescript
import { describe, expect, test } from 'bun:test';
import { TradeMonitorService } from './trade-monitor.ts';

describe('TradeMonitorService', () => {
  test('resolveAddress - direct address', async () => {
    // Test direct Ethereum address detection
  });

  test('parseGraphQLResponse - valid swap data', async () => {
    // Test parsing of TheGraph response
  });

  test('shouldRefetch - cache expiration', () => {
    // Test cache freshness logic
  });
});
```

### Integration Tests

```bash
# Start ElizaOS
bun run dev

# In another terminal, send test messages
curl -X POST http://localhost:3000/api/chat \
  -H "Content-Type: application/json" \
  -d '{
    "message": "monitor 0x1234... for trades"
  }'
```

## Performance Tuning

### Adjust Polling Interval

**For development (faster feedback):**
```typescript
const DEFAULT_CONFIG: TradeMonitorConfig = {
  addresses: [],
  pollInterval: 60000, // 1 minute
  lookbackHours: 1,    // Last hour only
  enableAlerts: true,
};
```

**For production (API limits):**
```typescript
const DEFAULT_CONFIG: TradeMonitorConfig = {
  addresses: [],
  pollInterval: 300000, // 5 minutes (default)
  lookbackHours: 24,
  enableAlerts: true,
};
```

### Monitor Multiple DEX Protocols

Add SushiSwap, Curve, etc. by:
1. Adding their Base subgraph URLs
2. Updating `fetchRecentTrades()` to query multiple sources
3. Merging and deduplicating results

## Deployment Checklist

Before deploying to production:

- [ ] Implement `fetchRecentTrades()` with TheGraph
- [ ] Implement `parseGraphQLResponse()`
- [ ] (Optional) Implement `resolveENS()`
- [ ] (Optional) Implement `resolveFarcaster()`
- [ ] Test with known active addresses
- [ ] Verify alerts are sent to rooms
- [ ] Configure appropriate poll interval
- [ ] Set up monitoring/logging for service health
- [ ] Document any API keys needed in `.env.example`

## Common Issues & Solutions

### Issue: "Trade Monitor Service not available"
**Cause:** Service not registered in character plugins
**Fix:** Verify `/src/index.ts` includes `tradeMonitorPlugin` in `plugins` array

### Issue: No trades detected for known active address
**Cause:** TheGraph query not implemented or incorrect
**Fix:** Check logs for "GraphQL query execution not yet implemented" warning

### Issue: "ENS resolution not yet implemented"
**Cause:** Optional feature not yet implemented
**Fix:** Use direct 0x addresses until ENS support is added

### Issue: Cache growing too large
**Cause:** Many addresses with high trade volume
**Fix:** Reduce `cachedTrades` slice from 20 to 10 in `checkAddressForNewTrades()`

## Next Steps

### Immediate (Required for MVP)
1. Implement TheGraph integration (2-3 hours)
2. Test with real Base addresses
3. Verify alerts work correctly

### Short-term (Improve UX)
4. Add ENS resolution (~30 min)
5. Add Farcaster resolution (~1 hour)
6. Write unit tests

### Long-term (Enhancements)
7. Add Zapper metadata enrichment
8. Support multiple chains (Ethereum, Arbitrum, Optimism)
9. Add filtering by token pairs or trade size
10. Create a web dashboard for monitoring

## Resources

- **TheGraph Base Subgraph:** https://thegraph.com/explorer/subgraphs/base
- **Uniswap V3 Subgraph Docs:** https://docs.uniswap.org/api/subgraph/overview
- **Neynar API Docs:** https://docs.neynar.com/
- **Zapper API Docs:** https://docs.zapper.xyz/
- **ElizaOS Services Guide:** https://elizaos.github.io/eliza/docs/core/services

## Support

For questions or issues:
1. Check `/src/plugins/README.md` for detailed documentation
2. Review ElizaOS core `price-monitor.ts` for reference patterns
3. Search ElizaOS Discord for similar implementations

---

**Plugin Status:** ✅ Scaffolded and integrated, ready for API implementation

**Last Updated:** 2025-01-22
**Version:** 1.0.0-scaffolded
