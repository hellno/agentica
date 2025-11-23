# Price Monitoring Plugin for ElizaOS

A comprehensive cryptocurrency price monitoring plugin that tracks token prices and sends automated alerts to chat rooms when significant price changes occur.

## Features

- **Real-time Price Monitoring**: Polls CoinGecko API every 3 minutes for current cryptocurrency prices
- **Smart Alert System**: Sends notifications only when price changes exceed configured thresholds
- **Cooldown Protection**: Prevents alert spam with configurable cooldown periods
- **Chat-based Configuration**: Users can configure monitoring via natural language commands
- **Default Monitoring**: Automatically starts monitoring BTC, ETH, and SOL on startup
- **Per-agent Memory**: Each agent maintains its own configuration and price state
- **Room Broadcasting**: Alerts are sent to all rooms the agent participates in

## Installation

The plugin is already integrated into the project. It's automatically loaded when the agent starts.

### Files Added

- `/src/price-monitor.ts` - Main plugin implementation
- Updated `/src/index.ts` - Plugin registration
- Updated `/src/character.ts` - Character bio and topics

## Configuration

### Default Settings

```typescript
{
  tokens: ['bitcoin', 'ethereum', 'solana'],  // Tokens to monitor
  threshold: 0.05,                             // 5% price change threshold
  cooldown: 900000,                            // 15 minutes between alerts
  pollInterval: 180000                         // 3 minutes polling interval
}
```

### Supported Tokens

The plugin uses CoinGecko IDs for tokens:

- `bitcoin` (BTC)
- `ethereum` (ETH)
- `solana` (SOL)
- `cardano` (ADA)
- `polkadot` (DOT)
- `avalanche` (AVAX)

To add more tokens, simply use their CoinGecko ID and add the display name to `TOKEN_DISPLAY_NAMES` in the plugin code.

## Usage

### Chat Commands

#### Monitor a Token

```
"monitor bitcoin"
"watch ethereum"
"track solana"
```

The agent will add the token to its monitoring list.

#### Set Custom Threshold

```
"watch bitcoin with 10% threshold"
"monitor solana with 3% threshold"
```

This updates the alert threshold for all monitored tokens.

#### Check Status

```
"what are you monitoring?"
"price status"
"show monitoring"
```

Displays current configuration and latest prices.

### Example Conversations

**Adding a token:**
```
User: Can you monitor bitcoin prices for me?
Agent: Updated price monitoring configuration:
       Tokens: Bitcoin, Ethereum, Solana
```

**Setting threshold:**
```
User: Watch ethereum with a 10% threshold
Agent: Updated price monitoring configuration:
       Tokens: Bitcoin, Ethereum, Solana
       Threshold: 10.0%
```

**Checking status:**
```
User: What are you monitoring?
Agent: 📊 Price Monitoring Status

       Tokens: Bitcoin, Ethereum, Solana
       Alert Threshold: 5.0%
       Cooldown: 15 minutes
       Check Interval: 3 minutes

       Current Prices:
         Bitcoin: $96,450 (Last alert: 2024-01-15 10:30 AM)
         Ethereum: $3,421 (Last alert: Never)
         Solana: $234 (Last alert: Never)
```

### Alert Format

When a price change exceeds the threshold, agents send alerts like:

```
🚨 Bitcoin Price Alert: $96,450 ↑7.2% (was $90,000)
```

## Architecture

### Service Class: `PriceMonitorService`

Extends ElizaOS `Service` class and provides:

- **Configuration Management**: Load/save config from agent memory
- **Price State Tracking**: Store last prices and alert timestamps
- **Background Polling**: Continuous price checking on interval
- **Alert Broadcasting**: Send alerts to all agent rooms

### Actions

1. **CONFIGURE_PRICE_MONITOR**
   - Triggers on: "monitor", "watch", "track", "alert", "price" keywords
   - Parses tokens and thresholds from natural language
   - Updates configuration in memory

2. **MONITOR_STATUS**
   - Triggers on: "status", "what", "show", "list" + monitoring keywords
   - Returns formatted status message with current config and prices

### Memory Storage

The plugin uses ElizaOS memory system with custom table names:

- `price_monitor_config` - Stores configuration (tokens, threshold, cooldown, etc.)
- `price_alert_state` - Stores per-token state (last price, last alert time)
- `messages` - Where alerts are broadcast to rooms

## API Integration

### CoinGecko API

- **Endpoint**: `https://api.coingecko.com/api/v3/simple/price`
- **Rate Limit**: 30 calls/minute (free tier)
- **No API Key Required**: Uses public API
- **Response Format**:
  ```json
  {
    "bitcoin": { "usd": 96450.00 },
    "ethereum": { "usd": 3421.50 }
  }
  ```

### Polling Strategy

1. Service starts and loads config/state from memory
2. Immediately checks prices on startup
3. Sets up interval to check every 3 minutes
4. For each token:
   - Fetch current price from CoinGecko
   - Compare against last alert price
   - Check if cooldown period has passed
   - If threshold exceeded AND cooldown passed: send alert
   - Update state in memory

## Development

### Adding New Tokens

1. Find the CoinGecko ID for your token at https://www.coingecko.com/
2. Add display name to `TOKEN_DISPLAY_NAMES`:
   ```typescript
   const TOKEN_DISPLAY_NAMES: Record<string, string> = {
     bitcoin: 'Bitcoin',
     your_token: 'Your Token Name',
   };
   ```
3. Users can now monitor it via chat: "monitor your_token"

### Customizing Alert Format

Edit the `sendAlert` method in `PriceMonitorService`:

```typescript
async sendAlert(token: string, price: number, changePercent: number) {
  const alertText = `🚨 ${tokenName} Price Alert: ${formattedPrice} ${direction}${formattedChange}%`;
  // Customize format here
}
```

### Adjusting Polling Interval

Update the default config or allow users to configure via chat:

```typescript
const DEFAULT_CONFIG: PriceMonitorConfig = {
  // ... other settings
  pollInterval: 300000, // 5 minutes instead of 3
};
```

## Troubleshooting

### No Alerts Being Sent

**Check if agent is in any rooms:**
```typescript
// The service logs "No rooms found to send alerts to" if agent isn't in rooms
```

**Verify price threshold is being exceeded:**
```typescript
// Check logs for "Sending price alert" messages
// Ensure threshold is low enough (try 1% for testing)
```

**Check cooldown period:**
```typescript
// Alerts are rate-limited by cooldown (default 15 minutes)
// Reduce cooldown for testing
```

### API Rate Limiting

CoinGecko free tier allows 30 calls/minute. With default settings:
- Polling every 3 minutes = 20 calls/hour
- Well within limits for monitoring 3-10 tokens

If monitoring 20+ tokens, consider increasing poll interval to 5-10 minutes.

### Memory Persistence

ElizaOS persists memory to database automatically. Configuration and state survive agent restarts.

**To reset configuration:**
```typescript
// Delete memories from price_monitor_config table
// Agent will reinitialize with defaults on next start
```

## Testing

### Manual Testing

1. **Start agent in dev mode:**
   ```bash
   bun run dev
   ```

2. **Configure monitoring:**
   ```
   monitor bitcoin with 1% threshold
   ```

3. **Check status:**
   ```
   what are you monitoring?
   ```

4. **Wait for price changes or manually trigger:**
   - Adjust threshold to 0.1% for frequent testing
   - Watch logs for "Sending price alert" messages

### Automated Testing

Add tests in `src/__tests__/price-monitor.test.ts`:

```typescript
import { describe, it, expect } from 'bun:test';
import { PriceMonitorService } from '../price-monitor';

describe('PriceMonitorService', () => {
  it('should calculate price changes correctly', () => {
    // Test alert logic
  });

  it('should respect cooldown periods', () => {
    // Test cooldown
  });
});
```

## Performance Considerations

### Memory Usage

- Minimal: Stores only config (~500 bytes) and state per token (~200 bytes each)
- For 10 tokens: ~2.5KB total memory footprint

### CPU Usage

- Polling runs every 3 minutes
- Each poll: 1 HTTP request + minimal processing
- Negligible CPU impact

### Network Usage

- 1 API call every 3 minutes
- Response size: ~500 bytes for 5 tokens
- Monthly data: ~7MB (well within any limit)

## Future Enhancements

Potential features to add:

1. **Per-token thresholds**: Different alert levels for each token
2. **Price targets**: Alert when price reaches specific value
3. **Volume monitoring**: Track trading volume changes
4. **Custom alert templates**: User-defined message formats
5. **Historical tracking**: Store price history for charts
6. **Multiple alert channels**: Discord, Telegram, Twitter
7. **Advanced conditions**: "Alert if BTC > $100k AND ETH > $5k"

## License

Same as the parent ElizaOS project.

## Support

For issues or questions:
1. Check logs for error messages
2. Verify CoinGecko API is accessible
3. Ensure agent is running in rooms
4. Review configuration with "price status" command
