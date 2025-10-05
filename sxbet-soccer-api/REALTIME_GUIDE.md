# Real-Time Best Odds Monitor - Complete Guide

## Overview

The real-time best odds monitor connects to sx.bet's Ably websocket API to provide live updates on soccer 1x2 market odds.

## Features

✅ **Real-Time Websocket Connection**
- Connects to Ably using your sx.bet API key
- Maintains persistent connection for live updates
- Automatic reconnection on disconnect

✅ **Best Odds Calculation**
- Fetches active orders for each market
- Calculates best available odds for both outcomes
- Converts odds from wei format to decimal (e.g., 1.82, 2.50)

✅ **Live Market Updates**
- Subscribes to `markets` channel for market status changes
- Monitors market activation, deactivation, and settlements
- Filters updates for relevant soccer 1x2 markets

✅ **Order Book Monitoring**
- Subscribes to `order_book:{marketHash}` channels
- Receives updates when new orders are placed
- Recalculates best odds on order book changes

## How It Works

### 1. Authentication

The script uses your API key to get an Ably token:

```javascript
const response = await axios.get('https://api.sx.bet/user/token', {
  headers: {
    'X-Api-Key': process.env.SX_BET_API_KEY,
  },
});
```

### 2. Market Discovery

Fetches today's soccer 1x2 markets:

```javascript
const response = await axios.get('https://api.sx.bet/markets/active', {
  params: {
    sportId: 5,      // Soccer
    betGroup: '1X2'  // 1x2 markets only
  }
});
```

### 3. Odds Calculation

For each market, fetches active orders and calculates best odds:

```javascript
// Get orders
const orders = await axios.get('https://api.sx.bet/orders', {
  params: { marketHashes: marketHash }
});

// Calculate best odds
// Maker betting outcome one → Taker gets outcome two
// Maker betting outcome two → Taker gets outcome one
```

### 4. Websocket Subscriptions

**Market Updates Channel:**
```javascript
const channel = realtime.channels.get('markets');
channel.subscribe((message) => {
  // Handle market status changes
});
```

**Order Book Channels:**
```javascript
const channel = realtime.channels.get(`order_book:${marketHash}`);
channel.subscribe((message) => {
  // Handle order book updates
});
```

## Understanding the Output

### Market Information
```
📊 Brentford vs Manchester City
   League: English Premier League
   Time: 10/5/2025, 3:30:00 PM
   Market Hash: 0x6530ed049122b9d7922348be5bf4cca14a0eb0a652813b885949eabcc884c323
```

### Best Odds Display
```
   Best Odds:
      Brentford: 1.82    ← Decimal odds for Brentford to win
      Manchester City: 1.17  ← Decimal odds for Manchester City to win
```

**Decimal Odds Explained:**
- `1.82` means: Bet $100, win $182 (profit $82)
- `1.17` means: Bet $100, win $117 (profit $17)

### Real-Time Updates

**Market Update:**
```
🔔 Market Update: Brentford vs Manchester City
   Status: ACTIVE
   Time: 10:47:23 AM
```

**Order Book Update:**
```
📈 Order Book Update: Brentford vs Manchester City
   Time: 10:47:25 AM
   Updated Best Odds:
      Brentford: 1.85  ← Odds improved!
      Manchester City: 1.15
```

## Ably Channels Reference

### Available Channels

1. **`markets`** - All market updates
   - New markets added
   - Market status changes
   - Market settlements

2. **`order_book:{marketHash}`** - Specific market order book
   - New orders placed
   - Orders filled
   - Orders cancelled

3. **`main_line`** - Main line changes
   - For markets with multiple lines (spreads, totals)

4. **`live_scores:{eventId}`** - Live score updates
   - Real-time scores
   - Period information

5. **`recent_trades`** - All trades
   - Trade executions
   - Settlement updates

## Odds Conversion

### From Wei to Decimal

sx.bet stores odds in wei format (multiplied by 10^20):

```javascript
// Example: 82000000000000000000 wei
const oddsWei = "82000000000000000000";
const oddsValue = parseFloat(oddsWei) / Math.pow(10, 20);
// oddsValue = 0.82

const decimalOdds = oddsValue + 1;
// decimalOdds = 1.82
```

### Understanding Maker vs Taker

- **Maker**: Places an order on the order book
- **Taker**: Fills an existing order

**Important:** 
- If maker bets outcome one → taker gets outcome two at those odds
- If maker bets outcome two → taker gets outcome one at those odds

## Limitations

1. **Market Limit**: Script monitors first 10 markets by default
   - Can be adjusted in code
   - Too many subscriptions may cause disconnection

2. **Rate Limits**: Ably has connection limits
   - One connection per script instance
   - Multiple channels multiplexed through single connection

3. **API Key**: Required for websocket access
   - Get from sx.bet dashboard
   - Keep secure in `.env` file

## Troubleshooting

### Connection Issues

**Error: "Ably.Realtime.Promise is not a constructor"**
- Fixed in current version
- Use `new Ably.Realtime()` instead

**Error: "401 Unauthorized"**
- Check API key is correct in `.env`
- Verify API key is active on sx.bet

### No Markets Found

**"No soccer 1x2 markets found for today"**
- Check if there are games scheduled
- Try different `betGroup` (e.g., 'game-lines')
- Verify `sportId` is correct (5 for soccer)

### No Odds Available

**"No orders available yet"**
- Market may be new
- No market makers have placed orders yet
- Try again closer to game time

## Advanced Usage

### Monitor Specific Leagues

Modify the market filter:

```javascript
const todaysMarkets = markets.filter(market => {
  const isToday = market.gameTime >= todayStart && market.gameTime < todayEnd;
  const isEPL = market.leagueId === 29; // English Premier League
  return isToday && isEPL;
});
```

### Custom Odds Display

Add implied probability:

```javascript
function getImpliedProbability(decimalOdds) {
  return (1 / decimalOdds * 100).toFixed(2) + '%';
}

console.log(`Brentford: ${odds} (${getImpliedProbability(odds)} implied)`);
// Output: Brentford: 1.82 (54.95% implied)
```

### Save Odds History

Log odds to file:

```javascript
const fs = require('fs');

function logOdds(market, odds) {
  const entry = {
    timestamp: new Date().toISOString(),
    market: market.teamOneName + ' vs ' + market.teamTwoName,
    odds: odds
  };
  
  fs.appendFileSync('odds_history.json', JSON.stringify(entry) + '\n');
}
```

## API Reference

### Key Functions

**`createTokenRequest()`**
- Gets Ably authentication token
- Uses sx.bet API key
- Returns token for Ably connection

**`initializeAbly()`**
- Creates Ably realtime connection
- Handles authentication
- Returns connected realtime instance

**`getMarketOrders(marketHash)`**
- Fetches active orders for a market
- Returns array of order objects

**`calculateBestOdds(orders)`**
- Processes orders to find best odds
- Returns `{ outcomeOne, outcomeTwo }`

**`convertOddsToDecimal(oddsWei)`**
- Converts wei format to decimal odds
- Returns string with 2 decimal places

## Next Steps

1. **Add Database Storage**: Store odds history for analysis
2. **Implement Alerts**: Notify when odds reach target values
3. **Add More Markets**: Monitor spreads, totals, etc.
4. **Build Dashboard**: Create web UI for visualization
5. **Arbitrage Detection**: Compare odds across markets

## Resources

- [sx.bet API Documentation](https://api.docs.sx.bet)
- [Ably Documentation](https://ably.com/documentation)
- [sx.bet Discord](https://discord.gg/Ry8yjAD5YG)
