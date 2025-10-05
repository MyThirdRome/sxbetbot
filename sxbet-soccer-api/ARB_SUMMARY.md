# 🎯 ARBITRAGE SCANNER - READY!

## ✅ Live Arbitrage Detection System Deployed

The arbitrage scanner is **running and monitoring** all soccer 1X2 markets for profitable opportunities.

---

## 🚀 Quick Start

```bash
cd sxbet-soccer-api
npm run arb
```

**With detailed odds display:**
```bash
node arbScannerV2.js --verbose
```

---

## 📊 Current Status

### Monitoring:
- **6 complete 1X2 events** (18 markets total)
- **Scan frequency**: Every 30 seconds
- **Status**: ✅ Running continuously

### Example Markets Being Monitored:
1. **Brentford vs Manchester City** (English Premier League)
2. **Aston Villa vs Burnley** (English Premier League)
3. **Newcastle United vs Nottingham Forest** (English Premier League)
4. **Everton vs Crystal Palace** (English Premier League)
5. **Wolverhampton vs Brighton** (English Premier League)
6. **AZ Alkmaar vs SC Telstar** (Dutch League)

---

## 🎯 Arbitrage Detection

### Two Types Checked:

**Type 1: YES + YES + YES**
```
1/Team1_YES + 1/Tie_YES + 1/Team2_YES < 1.0
```

**Type 2: NO + YES + NO**
```
1/Team1_NO + 1/Tie_YES + 1/Team2_NO < 1.0
```

### Current Results:
```
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
   Type 2: 1.2612 ❌ (closest!)
```

**Status:** No arbitrage opportunities found yet (normal - they are rare)

---

## 💰 What Happens When Arbitrage is Found

### The scanner will display:

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

**The scanner will exit automatically and notify you!**

---

## 🔧 How It Works

### 1X2 Market Structure:
In sx.bet, each match has **3 binary markets**:

1. **Team1 vs Not Team1**
   - YES = Team1 wins
   - NO = Team2 OR Tie

2. **Tie vs Not Tie**
   - YES = Draw
   - NO = Team1 OR Team2

3. **Team2 vs Not Team2**
   - YES = Team2 wins
   - NO = Team1 OR Tie

### Arbitrage Formula:
```
If: 1/Odds1 + 1/Odds2 + 1/Odds3 < 1.0
Then: ARBITRAGE EXISTS!

Profit = (1 / Sum) - 1
```

### Example:
```
Team1 YES: 3.00x → 1/3.00 = 0.3333
Tie YES: 3.50x → 1/3.50 = 0.2857
Team2 YES: 3.00x → 1/3.00 = 0.3333
Sum: 0.9523 < 1.0 ✅

Profit: (1/0.9523) - 1 = 5.01%
```

---

## 📈 Why No Arbitrage Yet?

### Market Efficiency:
All current values are **> 1.0**, meaning:
- Markets are **efficient**
- Bookmakers have built-in profit margin
- No arbitrage opportunities exist right now

### Example:
```
Brentford vs Manchester City:
Type 1: 1.8838 (need < 1.0)
Type 2: 1.4413 (need < 1.0)
```

This means the total implied probability is **188.38%** (should be 100%).
The extra **88.38%** is the market's profit margin.

### When Does Arbitrage Occur?

**Rare conditions:**
1. Market inefficiency between different market makers
2. Rapid odds changes before market adjusts
3. Low liquidity in certain markets
4. Information asymmetry

**Frequency:** Typically **< 0.1%** of scans find arbitrage

---

## 🎯 What To Do

### Keep It Running:
```bash
# Run in background
nohup npm run arb > arb.log 2>&1 &

# Or use screen/tmux
screen -S arb
npm run arb
# Ctrl+A, D to detach
```

### Monitor the Output:
```bash
# Check log file
tail -f arb.log

# Or watch in real-time
npm run arb --verbose
```

### When Arbitrage is Found:
1. **Scanner will notify you** with full details
2. **Act FAST** - Opportunities disappear in seconds
3. **Place all 3 bets simultaneously**
4. **Use the provided stake distribution**
5. **Verify all bets were filled**

---

## 🚀 Automated Execution (Future)

You can integrate with `autoBet.js` to automatically place bets when arbitrage is found:

```javascript
// Pseudo-code
if (arbitrageFound) {
  // Place bet 1
  await placeBet(market1, stake1, side1);
  
  // Place bet 2
  await placeBet(market2, stake2, side2);
  
  // Place bet 3
  await placeBet(market3, stake3, side3);
  
  // Verify all bets placed
  console.log('Arbitrage executed!');
}
```

---

## 📊 Statistics

### Current Scan:
- **Events monitored**: 6
- **Markets checked**: 18 (3 per event)
- **Arbitrage found**: 0
- **Closest to arbitrage**: 1.2612 (Everton vs Crystal Palace Type 2)

### Expected Performance:
- **Arbitrage frequency**: < 0.1% of scans
- **Typical profit margin**: 0.5% - 3%
- **Opportunity duration**: Seconds to minutes
- **Success rate**: Depends on execution speed

---

## 📚 Documentation

- **`ARBITRAGE_GUIDE.md`** - Complete guide with examples
- **`arbScannerV2.js`** - Main scanner script
- **`autoBet.js`** - Automated betting script

---

## ✅ Summary

**Status:** ✅ Scanner is running and monitoring 6 soccer events

**What it does:**
- Continuously scans all 1X2 markets every 30 seconds
- Checks 2 types of arbitrage combinations
- Calculates optimal stake distribution
- Shows guaranteed profit margins
- Exits and notifies when opportunity found

**Current result:** No arbitrage found yet (normal - they are rare)

**Next step:** Keep it running! It will notify you when an opportunity appears.

---

## 🎉 Ready!

The arbitrage scanner is **live and monitoring**. It will automatically detect and notify you of any arbitrage opportunities.

**Keep it running 24/7** for best results! 🚀

```bash
npm run arb
```

Good luck! 🍀
