# Price Monitor Plugin - Deployment Checklist

Use this checklist when deploying the price monitoring plugin to production.

## Pre-Deployment

### Code Review ✅
- [x] TypeScript compiles without errors
- [x] Build succeeds (`bun run build`)
- [x] No console warnings
- [x] All imports resolved correctly
- [x] Plugin registered in `src/index.ts`
- [x] Character bio updated
- [x] Documentation complete

### Local Testing
- [ ] Start agent in dev mode (`bun run dev`)
- [ ] Verify service loads (check logs for "Starting Price Monitor Service")
- [ ] Test "what are you monitoring?" command
- [ ] Test "monitor bitcoin" command
- [ ] Test "monitor bitcoin with 1% threshold" command
- [ ] Wait 3+ minutes for price poll
- [ ] Verify prices update in status
- [ ] (Optional) Wait for price alert if volatile market

### Configuration Verification
- [ ] Default tokens: BTC, ETH, SOL
- [ ] Default threshold: 5%
- [ ] Default cooldown: 15 minutes
- [ ] Poll interval: 3 minutes
- [ ] CoinGecko API accessible from deployment environment

## Deployment to Modal.com

### Environment Check
- [ ] Modal CLI installed and authenticated
- [ ] Existing ElizaOS deployment working
- [ ] Database (PostgreSQL) configured
- [ ] Required secrets available in Modal

### Deployment Steps

1. **Verify current deployment:**
   ```bash
   modal app logs agentica-platform
   ```

2. **Build locally to catch errors:**
   ```bash
   bun run build
   ```

3. **Deploy to Modal:**
   ```bash
   modal deploy backend/modal_app.py
   ```

4. **Monitor deployment logs:**
   ```bash
   modal app logs agentica-platform --follow
   ```

5. **Look for success indicators:**
   ```
   ✅ "Starting Price Monitor Service"
   ✅ "Initialized with default price monitor config"
   ✅ "Price monitoring polling started"
   ```

### Post-Deployment Verification

1. **Check service health:**
   ```bash
   curl https://*.modal.run/health
   ```

2. **Connect to agent in chat room**

3. **Test basic commands:**
   ```
   what are you monitoring?
   ```

4. **Verify response shows:**
   - Bitcoin, Ethereum, Solana
   - Current prices (not $0)
   - 5% threshold
   - 15 minute cooldown

5. **Test configuration:**
   ```
   monitor cardano with 2% threshold
   what are you monitoring?
   ```

6. **Verify configuration persists:**
   - Restart agent (redeploy)
   - Check status again
   - Should still show Cardano

### Monitoring Setup

1. **Enable logging:**
   ```bash
   modal app logs agentica-platform --follow | grep -i "price"
   ```

2. **Watch for key events:**
   - Price polls (every 3 min): "Fetched current prices"
   - Alerts sent: "Sending price alert"
   - Errors: "Failed to fetch prices"

3. **Set up alerts (optional):**
   - Configure Modal alerts for service failures
   - Monitor API error rates
   - Track memory usage trends

## Production Validation

### Day 1: Initial Monitoring
- [ ] Service running continuously for 24 hours
- [ ] No errors in logs
- [ ] Price polls occurring every 3 minutes
- [ ] At least one alert sent (if market volatile)
- [ ] Configuration commands working
- [ ] Status command responding

### Week 1: Performance Validation
- [ ] Memory usage stable (<100MB overhead)
- [ ] CPU usage minimal (<1% average)
- [ ] No memory leaks detected
- [ ] Database size reasonable (<10KB per agent)
- [ ] CoinGecko API success rate >99%
- [ ] Alert frequency matches market volatility

### User Acceptance
- [ ] Users can add tokens successfully
- [ ] Users can adjust thresholds
- [ ] Alerts appear in chat rooms
- [ ] Alert format is clear and useful
- [ ] No user complaints about spam
- [ ] Cooldown preventing alert floods

## Rollback Plan

If issues occur:

### Quick Rollback (Remove Plugin)

1. **Edit `src/index.ts`:**
   ```typescript
   export const projectAgent: ProjectAgent = {
     character,
     plugins: [], // Remove priceMonitorPlugin
   };
   ```

2. **Redeploy:**
   ```bash
   modal deploy backend/modal_app.py
   ```

3. **Verify service stopped:**
   - No "Price Monitor Service" in logs
   - Commands no longer work (expected)

### Partial Rollback (Disable Polling)

If you want to keep commands but stop polling:

1. **Set very high poll interval in code:**
   ```typescript
   pollInterval: 86400000 // 24 hours
   ```

2. **Redeploy**

3. **Polling effectively disabled**

### Data Cleanup (Optional)

If reverting completely:

1. **Delete plugin tables:**
   ```sql
   DELETE FROM memories WHERE tableName = 'price_monitor_config';
   DELETE FROM memories WHERE tableName = 'price_alert_state';
   ```

2. **Clear from character:**
   - Remove bio entry
   - Remove topics

## Common Issues & Solutions

### Service Not Starting

**Symptom:** No "Starting Price Monitor Service" in logs

**Check:**
- Plugin imported in `src/index.ts`
- TypeScript build succeeded
- No runtime errors during initialization

**Fix:**
```bash
bun run type-check
bun run build
modal deploy backend/modal_app.py
```

### Prices Not Updating

**Symptom:** Status shows $0 or stale prices

**Check:**
- Internet access from Modal container
- CoinGecko API responding
- Polling interval elapsed (3 min)

**Test:**
```bash
# From Modal container
curl "https://api.coingecko.com/api/v3/simple/price?ids=bitcoin&vs_currencies=usd"
```

### No Alerts Sent

**Symptom:** Price changes but no alerts

**Check:**
- Agent is in chat rooms
- Threshold low enough
- Cooldown not blocking
- Price actually changed by threshold

**Debug:**
- Lower threshold to 0.5%
- Check logs for "shouldSendAlert" checks
- Verify room IDs in database

### Memory Leak

**Symptom:** Memory usage increasing over time

**Check:**
- Polling interval cleared on stop
- No circular references
- State map not growing unbounded

**Monitor:**
```bash
# Watch memory usage
modal app stats agentica-platform
```

### API Rate Limiting

**Symptom:** "429 Too Many Requests" from CoinGecko

**Check:**
- Not monitoring too many tokens (>50)
- Poll interval not too short
- No other services hitting API

**Fix:**
- Increase poll interval to 5-10 minutes
- Reduce number of monitored tokens
- Upgrade to CoinGecko Pro API

## Success Criteria

Deployment is successful when:

✅ **Service Health**
- Service starts without errors
- Runs continuously for 24+ hours
- Polling occurs every 3 minutes
- No memory leaks or resource issues

✅ **Functionality**
- Default monitoring active (BTC, ETH, SOL)
- Configuration commands work
- Status command accurate
- Alerts sent when conditions met
- Cooldown prevents spam

✅ **Reliability**
- Configuration persists across restarts
- Price states persist correctly
- Graceful handling of API failures
- No crashes or service interruptions

✅ **User Experience**
- Commands respond quickly
- Alerts are clear and actionable
- No false positives or spam
- Threshold adjustments work

## Next Steps After Deployment

1. **Monitor for 48 hours**
   - Watch logs for errors
   - Verify alert frequency
   - Check user feedback

2. **Gather metrics**
   - Alert count per day
   - API success rate
   - Memory/CPU usage
   - User engagement

3. **Optimize if needed**
   - Adjust default threshold
   - Tune cooldown period
   - Add/remove default tokens

4. **Document learnings**
   - Note any issues encountered
   - Update troubleshooting guide
   - Share best practices

5. **Plan enhancements**
   - Review user feature requests
   - Prioritize improvements
   - Schedule next iteration

## Emergency Contacts

**Issue:** Production outage
**Action:** Rollback immediately (see Rollback Plan)

**Issue:** API rate limiting
**Action:** Increase poll interval via config

**Issue:** User complaints about spam
**Action:** Increase default threshold to 7-10%

**Issue:** Memory/CPU issues
**Action:** Check for runaway polling, restart service

## Sign-Off

Deployment completed by: _________________

Date: _________________

Environment: _________________

Verification status:
- [ ] All pre-deployment checks passed
- [ ] Deployment successful
- [ ] Post-deployment verification complete
- [ ] Production validation in progress
- [ ] No critical issues detected

Notes:
_____________________________________________
_____________________________________________
_____________________________________________
