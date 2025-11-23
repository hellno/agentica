# Price Monitor Plugin - Quick Start Guide

Get started with cryptocurrency price monitoring in 5 minutes.

## What It Does

Your ElizaOS agent automatically monitors cryptocurrency prices (Bitcoin, Ethereum, Solana) and sends chat alerts when prices change significantly.

**Example Alert:**
```
🚨 Bitcoin Price Alert: $97,450 ↑7.2% (was $90,000)
```

## Automatic Monitoring

**No setup required!** The agent starts monitoring these by default:
- Bitcoin (BTC)
- Ethereum (ETH)
- Solana (SOL)

**Settings:**
- Alert threshold: 5% price change
- Cooldown: 15 minutes between alerts
- Check interval: Every 3 minutes

## Chat Commands

### Check What's Being Monitored

```
what are you monitoring?
```

Response shows current tokens, prices, and settings.

### Add a Token

```
monitor cardano
watch polkadot
track avalanche
```

Supported tokens: bitcoin, ethereum, solana, cardano, polkadot, avalanche

### Change Alert Sensitivity

```
watch bitcoin with 10% threshold
```

**Lower = More alerts** (1% = very sensitive)
**Higher = Fewer alerts** (10% = major changes only)

## Common Use Cases

### Day Trading Setup
```
monitor bitcoin with 1% threshold
```
Get alerts on small price movements.

### Long-term Holding
```
monitor bitcoin with 10% threshold
```
Only notify on significant changes.

### Multi-token Portfolio
```
monitor bitcoin
monitor ethereum
monitor solana
monitor cardano
what are you monitoring?
```

## Understanding Alerts

### Alert Format
```
🚨 [Token] Price Alert: [Price] [Direction][Change]% (was [Old Price])
```

### Alert Triggers
Alert sent when **BOTH** conditions met:
1. Price changed by threshold amount (default 5%)
2. Cooldown period passed (default 15 minutes)

### No Alert Spam
Cooldown prevents flooding:
- First alert: Sent immediately
- Second alert: Must wait 15 minutes
- Continues after cooldown expires

## Troubleshooting

### Not Seeing Alerts?

**Check if price actually changed:**
- Crypto markets can be stable for hours
- Lower threshold to 1% for testing
- Monitor volatile tokens (smaller altcoins)

**Verify cooldown:**
- Alerts limited to once per 15 minutes per token
- Check "Last alert" time in status command

**Confirm agent in room:**
- Alerts only sent to chat rooms
- Agent must be active participant

### Price Shows $0?

**Wait 3 minutes:**
- Prices update every 3 minutes
- First poll happens immediately on startup

**Check CoinGecko API:**
```bash
curl "https://api.coingecko.com/api/v3/simple/price?ids=bitcoin&vs_currencies=usd"
```

### Configuration Not Saving?

**Restart agent:**
- Settings persist to database
- Should reload on restart

**Check logs:**
- Look for "Saved price monitor config"
- Errors indicate database issues

## Tips & Tricks

### Find the Right Threshold

Start with defaults, then adjust:

**Too many alerts?**
```
monitor bitcoin with 7% threshold
```

**Not enough alerts?**
```
monitor bitcoin with 2% threshold
```

### Monitor During Volatility

During major market events:
```
monitor bitcoin with 3% threshold
```

More alerts help track rapid changes.

### Quiet Monitoring

For stable assets or long-term holds:
```
monitor bitcoin with 15% threshold
```

Only major movements trigger alerts.

### Test Configuration

1. Set very low threshold:
   ```
   monitor bitcoin with 0.5% threshold
   ```

2. Wait 3-5 minutes for next poll

3. Should see alert if any price movement

4. Reset to normal:
   ```
   monitor bitcoin with 5% threshold
   ```

## Examples

### Crypto Trader Setup
```
monitor bitcoin with 2% threshold
monitor ethereum with 2% threshold
monitor solana with 3% threshold
what are you monitoring?
```

### Portfolio Tracker Setup
```
monitor bitcoin
monitor ethereum
monitor cardano
monitor polkadot
monitor bitcoin with 5% threshold
```

### Bitcoin Maximalist Setup
```
monitor bitcoin with 3% threshold
what are you monitoring?
```

## Advanced Usage

### Understanding Cooldown

**Scenario:** BTC goes up 5%, then another 5% in 10 minutes

- First alert: ✅ Sent immediately
- Second alert: ❌ Blocked (cooldown)
- Third alert: ✅ Sent after 15 min cooldown

**Result:** You get alerts for significant sustained movements, but not rapid fluctuations.

### Multiple Tokens

Each token has independent cooldown:

- BTC alert at 10:00 AM
- ETH alert at 10:05 AM (not blocked)
- BTC alert at 10:10 AM (blocked until 10:15)
- ETH alert at 10:10 AM (blocked until 10:20)

### Price Change Calculation

Alert triggers on **change from last alert price**, not last seen price:

```
Last alert: $90,000
Current: $94,500
Change: 5% ✅ Alert sent

Next alert needs:
$94,500 * 1.05 = $99,225
OR
$94,500 * 0.95 = $89,775
```

## FAQ

**Q: Can I monitor any cryptocurrency?**
A: Yes, if it's on CoinGecko. Use the CoinGecko ID (e.g., "bitcoin", not "BTC").

**Q: How do I stop monitoring a token?**
A: Currently not supported. Workaround: Set very high threshold (99%).

**Q: Can I get alerts via DM?**
A: No, alerts only go to chat rooms. Agent must be in the room.

**Q: What if CoinGecko is down?**
A: Service continues, skips failed polls, resumes when API returns.

**Q: How much does this cost?**
A: Free! Uses CoinGecko's free public API.

**Q: Can I monitor stocks or forex?**
A: No, only cryptocurrencies supported by CoinGecko.

**Q: Will this work on mobile?**
A: Yes, alerts appear in any chat app (Discord, Telegram, etc.).

## Getting Help

### Check Status First
```
what are you monitoring?
```

Shows current configuration and prices.

### Review Logs

Look for these messages:
- `Starting Price Monitor Service` - Plugin loaded
- `Fetched current prices` - Polling working
- `Sending price alert` - Alert triggered
- `Alert broadcast complete` - Alert sent

### Common Issues

**Issue:** "No configuration found"
**Fix:** Plugin initializes on first run, wait 1 minute

**Issue:** Alerts in wrong timezone
**Fix:** Timestamps use server time, adjust mentally or configure server timezone

**Issue:** Want more frequent updates
**Fix:** 3-minute polling is hardcoded (prevents API rate limits)

## What's Next?

After getting comfortable with basics:

1. **Experiment with thresholds** to find your sweet spot
2. **Add more tokens** to track your portfolio
3. **Adjust during events** (lower threshold for volatility)
4. **Check status daily** to see latest prices

## Limitations

- **Single threshold** for all tokens (can't set BTC 5%, ETH 10%)
- **Percentage only** (can't alert at specific price like $100k)
- **No historical data** (shows only current price)
- **No custom messages** (alert format is fixed)

These may be added in future updates!

## Quick Reference

```
# Status
what are you monitoring?
price status
show monitoring

# Add tokens
monitor [token]
watch [token]
track [token]

# Set threshold
monitor [token] with [X]% threshold
watch [token] with [X]% threshold

# Supported tokens
bitcoin, ethereum, solana, cardano, polkadot, avalanche
(and any other CoinGecko ID)
```

---

**Happy monitoring! 🚀**

For detailed information, see `PRICE_MONITOR_README.md`
