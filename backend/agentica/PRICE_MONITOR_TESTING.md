# Price Monitor Plugin - Testing Guide

This guide shows how to test the cryptocurrency price monitoring plugin.

## Quick Verification

### 1. Build the Project

```bash
bun run build
```

Expected output:
```
✅ Build complete!
```

### 2. Start the Agent in Dev Mode

```bash
bun run dev
```

This will start the ElizaOS agent with the price monitor plugin loaded.

### 3. Verify Plugin Loaded

Check the logs for:
```
*** Starting Price Monitor Service ***
Loaded price monitor config from memory
Price monitoring polling started
```

## Manual Testing Scenarios

### Scenario 1: Check Default Monitoring

**Command:**
```
what are you monitoring?
```

**Expected Response:**
```
📊 Price Monitoring Status

Tokens: Bitcoin, Ethereum, Solana
Alert Threshold: 5.0%
Cooldown: 15 minutes
Check Interval: 3 minutes

Current Prices:
  Bitcoin: $96,450 (Last alert: Never)
  Ethereum: $3,421 (Last alert: Never)
  Solana: $234 (Last alert: Never)
```

### Scenario 2: Add a Token

**Command:**
```
monitor cardano
```

**Expected Response:**
```
Updated price monitoring configuration:
Tokens: Bitcoin, Ethereum, Solana, Cardano
```

**Verify:**
```
what are you monitoring?
```

Should now show Cardano in the list.

### Scenario 3: Adjust Threshold

**Command:**
```
watch bitcoin with 1% threshold
```

**Expected Response:**
```
Updated price monitoring configuration:
Tokens: Bitcoin, Ethereum, Solana, Cardano
Threshold: 1.0%
```

**Purpose:** Lower threshold increases alert frequency (good for testing).

### Scenario 4: Wait for Price Alert

After configuring a low threshold (1%), wait for price movements. You should see alerts like:

```
🚨 Bitcoin Price Alert: $97,123 ↑1.2% (was $96,000)
```

**Notes:**
- Polls every 3 minutes
- Requires actual price movement from CoinGecko
- Cooldown prevents spam (15 min between alerts per token)

## Testing CoinGecko API Connection

### Manual API Test

Run this command to verify CoinGecko API access:

```bash
curl "https://api.coingecko.com/api/v3/simple/price?ids=bitcoin,ethereum,solana&vs_currencies=usd"
```

**Expected Response:**
```json
{
  "bitcoin": {"usd": 96450.00},
  "ethereum": {"usd": 3421.50},
  "solana": {"usd": 234.00}
}
```

If this fails:
- Check internet connection
- Verify no firewall blocking CoinGecko
- Check if CoinGecko API is down (rare)

## Troubleshooting Tests

### Plugin Not Loading

**Symptom:** No "Starting Price Monitor Service" in logs

**Check:**
1. Verify `src/index.ts` has `plugins: [priceMonitorPlugin]`
2. Run `bun run build` to rebuild
3. Check for TypeScript errors: `bun run type-check`

### No Price Updates

**Symptom:** Prices show as $0 or "Loading..."

**Check:**
1. Verify CoinGecko API accessible (curl test above)
2. Check logs for "Failed to fetch prices from CoinGecko"
3. Ensure polling interval has elapsed (wait 3+ minutes)

### No Alerts Sent

**Symptom:** Price changes occur but no alerts appear

**Check:**
1. Verify agent is in a room (alerts only sent to rooms)
2. Check cooldown hasn't blocked alert (15 min default)
3. Verify threshold is low enough (try 0.5% for testing)
4. Check logs for "No rooms found to send alerts to"

### Configuration Not Persisting

**Symptom:** Settings reset after agent restart

**Check:**
1. Verify database is configured (ElizaOS uses SQLite by default)
2. Check `data/` directory for database files
3. Ensure memory creation succeeded (check logs for errors)

## Advanced Testing

### Test Alert Logic Manually

You can test the alert threshold logic without waiting for price changes:

1. **Lower threshold to 0.1%:**
   ```
   monitor bitcoin with 0.1% threshold
   ```

2. **Check logs every 3 minutes:**
   - Look for "Sending price alert" messages
   - Very small price fluctuations will trigger alerts

3. **Verify cooldown:**
   - First alert should succeed
   - Second alert within 15 min should be blocked
   - Check logs for cooldown checks

### Test Multiple Tokens

```
monitor bitcoin
monitor ethereum
monitor solana
monitor cardano
what are you monitoring?
```

Should show all 4 tokens with current prices.

### Test Error Handling

**Disconnect from internet** (temporarily):
- Plugin should log "Failed to fetch prices from CoinGecko"
- Service should continue running
- Reconnecting should resume normal operation

## Performance Testing

### Monitor Resource Usage

```bash
# Monitor CPU and memory
top -pid $(pgrep -f elizaos)
```

**Expected:**
- CPU: <1% (mostly idle, spikes during polls)
- Memory: <100MB additional for plugin
- Network: Minimal (1 request per 3 minutes)

### Check Polling Frequency

Monitor logs for polling messages:

```bash
tail -f logs/elizaos.log | grep "Fetched current prices"
```

Should see entries every 3 minutes.

## Integration Testing

### Test with Multiple Rooms

1. **Create/join multiple rooms**
2. **Configure monitoring:**
   ```
   monitor bitcoin with 1% threshold
   ```
3. **Wait for price change**
4. **Verify:** Alert appears in ALL rooms agent is in

### Test Persistence Across Restarts

1. **Configure monitoring:**
   ```
   monitor bitcoin with 2% threshold
   ```
2. **Stop agent** (Ctrl+C)
3. **Restart agent:**
   ```bash
   bun run dev
   ```
4. **Check status:**
   ```
   what are you monitoring?
   ```
5. **Verify:** Configuration persisted (2% threshold still set)

## Automated Testing

### Unit Tests (Future)

Create `src/__tests__/price-monitor.test.ts`:

```typescript
import { describe, it, expect, beforeEach } from 'bun:test';
import { PriceMonitorService } from '../price-monitor';

describe('Price Monitor Plugin', () => {
  describe('Alert Logic', () => {
    it('should trigger alert when threshold exceeded', () => {
      // Mock runtime and test alert conditions
    });

    it('should respect cooldown period', () => {
      // Test cooldown logic
    });
  });

  describe('Configuration', () => {
    it('should parse tokens from natural language', () => {
      // Test action validators
    });
  });

  describe('API Integration', () => {
    it('should fetch prices from CoinGecko', async () => {
      // Test API calls
    });
  });
});
```

Run with: `bun test src/__tests__/price-monitor.test.ts`

## Monitoring in Production

### Health Checks

1. **Check service is running:**
   - Look for periodic "Fetched current prices" logs
   - Verify no continuous errors

2. **Monitor alert frequency:**
   - Track alert messages in logs
   - Ensure not being rate-limited

3. **Database size:**
   - Monitor `price_monitor_config` and `price_alert_state` tables
   - Should remain small (<10KB per agent)

### Logging

Enable debug logging for detailed output:

```bash
LOG_LEVEL=debug bun run dev
```

Key log messages to monitor:
- `Starting Price Monitor Service` - Service initialized
- `Fetched current prices` - Successful API poll
- `Sending price alert` - Alert triggered
- `Alert broadcast complete` - Alert sent to rooms
- `Failed to fetch prices` - API error (investigate if repeated)

## Test Checklist

Before considering the plugin production-ready:

- [ ] Plugin loads successfully on startup
- [ ] Default configuration (BTC, ETH, SOL) works
- [ ] Can add tokens via chat commands
- [ ] Can modify threshold via chat
- [ ] Status command shows correct info
- [ ] Alerts are sent when threshold exceeded
- [ ] Cooldown prevents spam
- [ ] Configuration persists across restarts
- [ ] Price states persist across restarts
- [ ] Works in multiple rooms
- [ ] CoinGecko API errors handled gracefully
- [ ] No memory leaks during extended operation
- [ ] Polling interval is accurate (3 minutes)
- [ ] Alert messages are formatted correctly
- [ ] No TypeScript compilation errors
- [ ] Build succeeds without warnings

## Common Test Issues

### "No rooms found"

**Solution:** Ensure agent is actually in a chat room. In ElizaOS, agents need to be connected to rooms (Discord channels, Telegram chats, etc.) to send messages.

### Alerts Not Visible in Chat

**Solution:** Check that:
1. Alert is being sent (check logs)
2. Room ID is valid
3. Agent has permission to send messages in the room
4. Message is being created in correct table (`messages`)

### API Rate Limiting

**Solution:** CoinGecko free tier allows 30 calls/min:
- Default: 20 calls/hour (safe)
- If monitoring 50+ tokens, increase poll interval
- Consider upgrading to CoinGecko Pro if needed

## Success Criteria

The plugin is working correctly when:

1. ✅ Service starts without errors
2. ✅ Prices update every 3 minutes
3. ✅ Configuration commands work
4. ✅ Status command shows accurate data
5. ✅ Alerts appear in chat when conditions met
6. ✅ No alerts during cooldown period
7. ✅ Settings persist across restarts

## Next Steps

After successful testing:

1. **Deploy to production** (Modal.com, cloud, etc.)
2. **Monitor for 24 hours** to ensure stability
3. **Gather user feedback** on alert frequency
4. **Adjust defaults** based on usage patterns
5. **Add enhancements** from backlog
