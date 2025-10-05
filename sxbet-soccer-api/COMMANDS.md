# 🚀 SX.BET COMMANDS REFERENCE

## Quick Commands

### Arbitrage Scanner
```bash
# Run arbitrage scanner (exits after first find)
npm run arb

# Run with verbose output (shows all odds)
node arbScannerV2.js --verbose

# Keep running even after finding arbitrage
node arbScannerV2.js --keep-running

# Keep running with verbose output
node arbScannerV2.js --keep-running --verbose

# Run with custom minimum profit (e.g., 1% minimum)
MIN_PROFIT_PERCENT=1.0 npm run arb

# Keep running with custom settings
KEEP_RUNNING=true MIN_PROFIT_PERCENT=1.0 npm run arb
```

### Automated Betting
```bash
# Place a single 5 USDC bet automatically
npm run autobet

# Or run directly
node autoBet.js
```

### Live Orderbook Monitor
```bash
# View live orderbook with real-time updates
npm run orderbook

# Or run directly
node liveOrderbook.js
```

### Real-time Best Odds
```bash
# Monitor real-time best odds
npm run realtime

# Or run directly
node realtimeBestOdds.js
```

### Fetch Today's Fixtures
```bash
# Get today's soccer fixtures
npm start

# Or run directly
node fetchSoccerEvents.js
```

### Fetch Active Leagues
```bash
# Get all active soccer leagues
npm run leagues

# Or run directly
node fetchActiveLeagues.js
```

---

## Configuration

### Environment Variables (.env file)

```bash
# API Key (required for websocket features)
SX_BET_API_KEY=your_api_key_here

# Private Key (required for automated betting)
PRIVATE_KEY=0x...

# Arbitrage Scanner Settings
MIN_PROFIT_PERCENT=0.5        # Minimum profit % (default: 0.5%)
MIN_ORDER_SIZE_USDC=1          # Minimum order size (default: 1 USDC)
```

### Arbitrage Scanner Configuration

**Minimum Profit Threshold:**
- **Default**: 0.5% (any arbitrage with 0.5%+ profit)
- **Recommended**: 1-2% (to cover fees and slippage)
- **Conservative**: 3-5% (safer but fewer opportunities)

**Examples:**
```bash
# Accept any arbitrage (0%+)
MIN_PROFIT_PERCENT=0 npm run arb

# Only 1%+ profit
MIN_PROFIT_PERCENT=1.0 npm run arb

# Only 2%+ profit
MIN_PROFIT_PERCENT=2.0 npm run arb

# Only 5%+ profit (very rare)
MIN_PROFIT_PERCENT=5.0 npm run arb
```

**Minimum Order Size:**
```bash
# Minimum 1 USDC per order (default)
MIN_ORDER_SIZE_USDC=1 npm run arb

# Minimum 5 USDC per order
MIN_ORDER_SIZE_USDC=5 npm run arb

# Minimum 10 USDC per order
MIN_ORDER_SIZE_USDC=10 npm run arb
```

---

## Running in Background

### Using nohup:
```bash
# Run arbitrage scanner in background
nohup npm run arb > arb.log 2>&1 &

# Check the log
tail -f arb.log

# Stop the scanner
pkill -f arbScannerV2
```

### Using screen:
```bash
# Start a screen session
screen -S arb

# Run the scanner
npm run arb

# Detach: Ctrl+A, then D

# Reattach later
screen -r arb

# Kill the session
screen -X -S arb quit
```

### Using tmux:
```bash
# Start a tmux session
tmux new -s arb

# Run the scanner
npm run arb

# Detach: Ctrl+B, then D

# Reattach later
tmux attach -t arb

# Kill the session
tmux kill-session -t arb
```

---

## Testing & Development

### Test Odds Calculation:
```bash
# Verify odds calculations are correct
node testOddsCalculation.js
```

### View Package Scripts:
```bash
# See all available npm scripts
npm run
```

---

## Common Workflows

### 1. Monitor for Arbitrage (24/7)
```bash
# Run in background with 1% minimum profit
screen -S arb
MIN_PROFIT_PERCENT=1.0 npm run arb
# Ctrl+A, D to detach
```

### 2. Quick Manual Bet
```bash
# Place a single bet
npm run autobet
```

### 3. Monitor Live Odds
```bash
# Watch live orderbook
npm run orderbook
```

### 4. Check Today's Matches
```bash
# See what's available
npm start
```

---

## Troubleshooting

### Check if scanner is running:
```bash
ps aux | grep arbScanner
```

### View recent log output:
```bash
tail -100 arb.log
```

### Kill all scanner processes:
```bash
pkill -f arbScannerV2
```

### Restart scanner:
```bash
pkill -f arbScannerV2
nohup npm run arb > arb.log 2>&1 &
```

---

## Summary

**Main Commands:**
- `npm run arb` - Run arbitrage scanner
- `npm run autobet` - Place automated bet
- `npm run orderbook` - View live orderbook
- `npm run realtime` - Monitor real-time odds
- `npm start` - View today's fixtures

**Configuration:**
- Edit `.env` file for persistent settings
- Use environment variables for one-time changes
- `MIN_PROFIT_PERCENT` controls arbitrage threshold
- `MIN_ORDER_SIZE_USDC` controls minimum order size

**Background Execution:**
- Use `nohup`, `screen`, or `tmux`
- Monitor with `tail -f arb.log`
- Stop with `pkill -f arbScannerV2`
