# SX.bet Live Monitor - Deployment Guide

## Overview

The Live Monitor watches soccer markets in real-time via Ably websockets and automatically places bets when it finds odds in the 3-10x range with 1% slippage.

## Features

✅ **Real-time monitoring** - Ably websocket connection for instant order updates
✅ **Live display** - Shows market odds updating in real-time
✅ **Target indicators** - 🎯 marks odds in target range (3-10x)
✅ **Fast execution** - Pre-signed model: 2-50ms signing time
✅ **Continuous operation** - Runs until one successful bet is placed
✅ **Attempt tracking** - Shows all betting attempts with timing

## Requirements

- Node.js 16+ 
- npm or yarn
- SX.bet API key
- Wallet with USDC on SX Network

## Installation

1. **Clone/upload the project to your server**

```bash
cd sxbet-soccer-api
```

2. **Install dependencies**

```bash
npm install
```

3. **Configure environment**

Create `.env` file:

```bash
PRIVATE_KEY=0xYourPrivateKeyHere
SX_BET_API_KEY=your_api_key_here
```

⚠️ **Security**: Never commit `.env` to git. Keep your private key secure.

## Running the Monitor

### Option 1: Direct Run

```bash
node ablyLiveMonitor.js
```

### Option 2: With Auto-Restart (Recommended)

```bash
./runLiveMonitor.sh
```

This script will:
- Check for dependencies
- Run the monitor
- Auto-restart on errors
- Stop when a bet is successfully placed

### Option 3: Background Process with PM2

```bash
# Install PM2 globally
npm install -g pm2

# Start monitor
pm2 start ablyLiveMonitor.js --name "sxbet-monitor"

# View logs
pm2 logs sxbet-monitor

# Stop monitor
pm2 stop sxbet-monitor

# Restart monitor
pm2 restart sxbet-monitor
```

### Option 4: Screen Session (for SSH)

```bash
# Start screen session
screen -S sxbet

# Run monitor
node ablyLiveMonitor.js

# Detach: Press Ctrl+A then D

# Reattach later
screen -r sxbet
```

## What You'll See

### Initialization
```
⚡ ABLY LIVE MONITOR - CONTINUOUS BETTING
================================================================================
Wallet: 0x46F2c45a7729f4da0f1049E2177Ab28859fa1c66
Target: 3.0x - 10.0x odds with 1% slippage
Will run until one successful bet is placed
================================================================================

🔧 Initializing...
✅ Signing components ready
✅ Monitoring 10 markets
✅ Connected to Ably
```

### Live Market Updates
```
[4:31:16 PM] 📊 Brentford vs Manchester City
   🎯 Manchester City: 6.72x ($17478 available)
      Brentford: 1.28x ($4491 available)
```

- 🎯 = Odds in target range (3-10x)
- Shows available liquidity in USDC

### Betting Attempts
```
[4:31:17 PM] 🎯 ATTEMPT #1: 6.72x
   Market: Brentford vs Manchester City
   Order: 0x11296078e2e78b5ebce07c8a48c8...
   ✍️  Signed in 49ms
   ❌ Failed in 6275ms: NO_MATCHING_ORDERS
```

### Success
```
================================================================================
✅ SUCCESS! BET PLACED IN 245ms
================================================================================
   Fill Hash: 0x02f0ea187caf3e4db726267a778c29a2c4c8262e2b381dd8fb03443b2db3c826
   Odds: 6.72x
   Stake: $5 USDC
   Potential Win: $33.60 USDC
   Bet ID: 12345
================================================================================

🎉 Mission accomplished! Total attempts: 15
```

## Configuration

Edit `ablyLiveMonitor.js` to customize:

### Bet Amount
```javascript
const stakeWei = '5000000'; // $5 USDC (change to desired amount)
```

### Odds Range
```javascript
if (decimalOdds >= 3.0 && decimalOdds <= 10.0) {
  // Change 3.0 and 10.0 to your preferred range
}
```

### Slippage
```javascript
const oddsSlippage = 1; // 1% slippage (increase for more flexibility)
```

### Number of Markets
```javascript
.slice(0, 10); // Monitor first 10 markets (increase if needed)
```

## Monitoring & Logs

### View Real-time Output
```bash
# If using PM2
pm2 logs sxbet-monitor --lines 100

# If using screen
screen -r sxbet
```

### Save Logs to File
```bash
node ablyLiveMonitor.js 2>&1 | tee monitor.log
```

## Troubleshooting

### "NO_MATCHING_ORDERS" errors
- **Normal**: High-odds orders fill quickly (6+ seconds API response time)
- **Solution**: Script keeps trying automatically
- Orders in 3-10x range are highly competitive

### "TAKER_SIGNATURE_MISMATCH"
- Check your PRIVATE_KEY is correct in `.env`
- Ensure no extra spaces or quotes

### Connection Issues
- Check internet connection
- Verify SX_BET_API_KEY is valid
- Check if SX.bet API is accessible

### No Markets Found
- Check if there are active soccer games
- Try different sport IDs or time of day

## Performance Metrics

**Timing Breakdown:**
- Ably update received: < 1ms
- Sign transaction: 2-50ms (first sign slower, then 2-4ms)
- API submission: 150-6500ms (varies by order availability)

**Success Rate:**
- Depends on market competition
- High-odds orders (6-10x) fill very quickly
- Lower odds (3-5x) have better success rate

## Safety Features

✅ **1% slippage** - Tight control on odds
✅ **Single bet limit** - Stops after one success
✅ **Error handling** - Graceful failure recovery
✅ **No auto-restart on success** - Prevents accidental multiple bets

## Stopping the Monitor

### If running directly
Press `Ctrl+C`

### If using PM2
```bash
pm2 stop sxbet-monitor
```

### If using screen
```bash
screen -r sxbet
# Then press Ctrl+C
```

### If using runLiveMonitor.sh
Press `Ctrl+C` (may need to press twice)

## Next Steps

After successful bet:
1. Check your bet on SX.bet dashboard
2. Monitor the game outcome
3. Restart monitor for next bet if desired

## Support

For issues or questions:
- Check SX.bet API documentation: https://api.docs.sx.bet
- Review error messages in console output
- Verify wallet has sufficient USDC balance

## License

Use at your own risk. Ensure you understand the betting mechanics and risks involved.
