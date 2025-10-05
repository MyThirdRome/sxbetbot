# 🎯 ARBITRAGE SCANNER FOR SX.BET

## ✅ Live Arbitrage Detection System

Continuously monitors all soccer 1X2 markets for arbitrage opportunities in real-time.

---

## 🚀 Quick Start

### Run the scanner:
```bash
cd sxbet-soccer-api
npm run arb
# or
node arbScannerV2.js
```

### Run with verbose mode (shows all odds):
```bash
node arbScannerV2.js --verbose
# or
node arbScannerV2.js -v
```

---

## 📊 How It Works

### 1X2 Market Structure in SX.bet

In sx.bet, 1X2 markets are structured as **3 separate binary markets**:

1. **Team1 vs Not Team1**
   - YES = Team1 wins
   - NO = Team2 wins OR Tie

2. **Tie vs Not Tie**
   - YES = Draw/Tie
   - NO = Team1 wins OR Team2 wins

3. **Team2 vs Not Team2**
   - YES = Team2 wins
   - NO = Team1 wins OR Tie

---

## 🎯 Arbitrage Detection

The scanner checks **2 types** of arbitrage opportunities:

### Type 1: YES + YES + YES
```
1/Team1_YES + 1/Tie_YES + 1/Team2_YES < 1.0
```

**Example:**
- Team1 YES: 3.00x → 1/3.00 = 0.3333
- Tie YES: 3.50x → 1/3.50 = 0.2857
- Team2 YES: 3.00x → 1/3.00 = 0.3333
- **Total: 0.9523 < 1.0 ✅ ARBITRAGE!**

**Profit:** (1/0.9523 - 1) × 100 = **5.01%**

### Type 2: NO + YES + NO
```
1/Team1_NO + 1/Tie_YES + 1/Team2_NO < 1.0
```

**Example:**
- Team1 NO: 2.00x → 1/2.00 = 0.5000
- Tie YES: 3.50x → 1/3.50 = 0.2857
- Team2 NO: 2.50x → 1/2.50 = 0.4000
- **Total: 1.1857 > 1.0 ❌ NO ARBITRAGE**

---

## 💰 Stake Distribution

When an arbitrage is found, the scanner calculates optimal stake distribution:

**For $100 total stake:**
```
Stake on Bet 1 = (Total / Odds1) / ArbValue
Stake on Bet 2 = (Total / Odds2) / ArbValue
Stake on Bet 3 = (Total / Odds3) / ArbValue

Guaranteed Return = Total / ArbValue
Guaranteed Profit = Return - Total
```

**Example (5% arbitrage):**
- Total stake: $100
- ArbValue: 0.9523
- Guaranteed return: $100 / 0.9523 = $105.01
- Guaranteed profit: $5.01

**Stake distribution:**
- Bet 1 (Team1 YES @ 3.00x): $35.01
- Bet 2 (Tie YES @ 3.50x): $30.00
- Bet 3 (Team2 YES @ 3.00x): $35.01
- **Total: $100.02**

**No matter which outcome wins, you get $105.01 back!**

---

## 📈 Current Market Status

### Example Output (Verbose Mode):

```
🔍 Scan #1 - 11:51:24 AM
   Found 6 complete 1X2 events (with all 3 markets)

   📊 Brentford vs Manchester City
      Team1 YES: 1.28 | NO: 7.08
      Tie YES: 1.33 | NO: 6.20
      Team2 YES: 2.86 | NO: 1.82
      Type 1: 1.8838 ❌ (need < 1.0)
      Type 2: 1.4413 ❌ (need < 1.0)

   📊 Everton vs Crystal Palace
      Team1 YES: 1.69 | NO: 3.32
      Tie YES: 1.49 | NO: 3.94
      Team2 YES: 1.59 | NO: 3.45
      Type 1: 1.8900 ❌
      Type 2: 1.2612 ❌ (closest to arbitrage!)
```

**Analysis:**
- All values are **> 1.0**, so no arbitrage exists
- Closest to arbitrage: **1.2612** (would need 26% better odds)
- Arbitrage opportunities are **rare** and **fleeting**

---

## 🎉 When Arbitrage is Found

The scanner will display:

```
🎉🎉🎉🎉🎉🎉🎉🎉🎉🎉🎉🎉🎉🎉🎉🎉🎉🎉🎉🎉🎉🎉🎉🎉🎉🎉🎉🎉🎉🎉🎉🎉🎉🎉🎉
💰 ARBITRAGE OPPORTUNITY FOUND! 💰
🎉🎉🎉🎉🎉🎉🎉🎉🎉🎉🎉🎉🎉🎉🎉🎉🎉🎉🎉🎉🎉🎉🎉🎉🎉🎉🎉🎉🎉🎉🎉🎉🎉🎉🎉

📍 Match: Team A vs Team B
🏆 League: English Premier League
📊 Type: TYPE 1: YES + YES + YES
🎯 Combination: Team A YES + Tie YES + Team B YES

📈 Odds:
   Team A: 3.00x
   Tie/Draw: 3.50x
   Team B: 3.00x

🔢 Arbitrage Calculation:
   1/3.00 + 1/3.50 + 1/3.00
   = 0.3333 + 0.2857 + 0.3333
   = 0.9523 < 1.0 ✅

💵 Profit Margin: 5.01%

💰 Stake Distribution (for $100 total):
   Bet on Team A (YES): $35.01
   Bet on Tie/Draw (YES): $30.00
   Bet on Team B (YES): $35.01
   Total Staked: $100.02

✅ Guaranteed Return: $105.01
✅ Guaranteed Profit: $5.01

📋 Market Hashes:
   Team1: 0x...
   Tie: 0x...
   Team2: 0x...
```

The scanner will then **exit automatically** after finding an opportunity.

---

## ⚙️ Configuration

### Scan Frequency:
- **Initial scan**: Immediate on startup
- **Continuous scans**: Every 30 seconds
- Can be modified in code: `setInterval(..., 30000)`

### Minimum Order Size:
- **Current**: 1 USDC minimum per order
- Can be modified in code: `const minSize = BigInt('1000000')`

### Markets Monitored:
- **All soccer 1X2 markets** with complete data
- Requires all 3 markets (Team1, Tie, Team2)
- Only markets with available orders

---

## 🔍 Understanding the Numbers

### Why are all values > 1.0?

**Market efficiency:**
- Bookmakers set odds to ensure profit
- Total implied probability > 100%
- This is the "overround" or "vig"

**Example:**
```
Team1: 1.28x → 78.13% implied
Tie: 1.33x → 75.19% implied
Team2: 2.86x → 34.97% implied
Total: 188.29% (should be 100%)
```

The extra 88.29% is the bookmaker's profit margin.

### When does arbitrage occur?

**Rare conditions:**
1. **Market inefficiency** - Different bookmakers have different odds
2. **Rapid odds changes** - Market hasn't adjusted yet
3. **Low liquidity** - Not enough orders to balance the market
4. **Information asymmetry** - Some bettors have better information

**In sx.bet:**
- Peer-to-peer betting (no bookmaker)
- Market makers set their own odds
- Arbitrage can occur between different market makers
- Usually corrects within seconds

---

## 📊 Statistics

### Current Monitoring:
- **6 complete 1X2 events** found
- **18 markets** monitored (3 per event)
- **Scan frequency**: Every 30 seconds
- **Status**: No arbitrage opportunities found yet

### Expected Arbitrage Frequency:
- **Very rare** in efficient markets
- Typically **< 0.1%** of scans
- Usually **< 1% profit margin** when found
- Disappears within **seconds** once discovered

---

## 🚀 Next Steps

### When Arbitrage is Found:

1. **Act FAST** - Opportunities disappear quickly
2. **Calculate stakes** - Use the provided distribution
3. **Place all 3 bets simultaneously** - Use the automated betting script
4. **Verify execution** - Check all bets were filled
5. **Monitor outcome** - Collect guaranteed profit

### Automated Execution:

You can modify `autoBet.js` to automatically place arbitrage bets:

```javascript
// When arbitrage is found
const opp = opportunities[0];

// Place bet 1
await placeBet(opp.event.markets.team1, stake1, 'YES');

// Place bet 2
await placeBet(opp.event.markets.tie, stake2, 'YES');

// Place bet 3
await placeBet(opp.event.markets.team2, stake3, 'YES');
```

---

## ⚠️ Important Notes

### Risks:
1. **Execution risk** - Orders may be filled/cancelled before you bet
2. **Slippage** - Odds may change while placing bets
3. **Partial fills** - May not get full stake on all bets
4. **Market suspension** - Markets may close suddenly

### Best Practices:
1. **Monitor continuously** - Run scanner 24/7
2. **Act immediately** - Speed is critical
3. **Diversify** - Don't put all capital in one arbitrage
4. **Verify** - Always check bets were placed correctly
5. **Track results** - Monitor actual vs expected returns

---

## 📚 Resources

### Files:
- **`arbScannerV2.js`** - Main arbitrage scanner
- **`autoBet.js`** - Automated betting script
- **`ARBITRAGE_GUIDE.md`** - This guide

### Commands:
```bash
# Run scanner
npm run arb

# Run with verbose output
node arbScannerV2.js --verbose

# Run automated betting
npm run autobet
```

---

## ✅ Summary

The arbitrage scanner:
- ✅ Monitors all soccer 1X2 markets continuously
- ✅ Checks 2 types of arbitrage combinations
- ✅ Calculates optimal stake distribution
- ✅ Shows guaranteed profit margins
- ✅ Exits automatically when opportunity found
- ✅ Provides market hashes for automated betting

**Current Status:** Running and monitoring 6 events. No arbitrage found yet (normal).

**Keep it running** - Arbitrage opportunities are rare but profitable when found! 🎯
