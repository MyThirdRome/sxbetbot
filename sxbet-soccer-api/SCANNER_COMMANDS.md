# 🎯 ARBITRAGE SCANNER - QUICK COMMANDS

## 🚀 Basic Commands

### **REAL-TIME Scanner (RECOMMENDED - uses websockets):**
```bash
npm run arb-live
# or
node arbScannerRealtime.js
```
**✅ INSTANT detection when orders change!**

### **Polling Scanner (checks every 30 seconds):**
```bash
# Exit after first find
npm run arb

# Keep running continuously
node arbScannerV2.js --keep-running

# Keep running with verbose output
node arbScannerV2.js --keep-running --verbose
```

---

## ⚙️ Configuration Options

### **Minimum Profit Threshold:**
```bash
# Accept any arbitrage (0%+)
MIN_PROFIT_PERCENT=0 node arbScannerV2.js --keep-running

# Only 0.5%+ profit (default)
MIN_PROFIT_PERCENT=0.5 node arbScannerV2.js --keep-running

# Only 1%+ profit (recommended)
MIN_PROFIT_PERCENT=1.0 node arbScannerV2.js --keep-running

# Only 2%+ profit (safer)
MIN_PROFIT_PERCENT=2.0 node arbScannerV2.js --keep-running
```

### **Minimum Order Size:**
```bash
# Minimum 1 USDC per order (default)
MIN_ORDER_SIZE_USDC=1 node arbScannerV2.js --keep-running

# Minimum 5 USDC per order
MIN_ORDER_SIZE_USDC=5 node arbScannerV2.js --keep-running

# Minimum 10 USDC per order
MIN_ORDER_SIZE_USDC=10 node arbScannerV2.js --keep-running
```

### **Combined Settings:**
```bash
# Keep running, 1% min profit, 5 USDC min order, verbose
KEEP_RUNNING=true MIN_PROFIT_PERCENT=1.0 MIN_ORDER_SIZE_USDC=5 node arbScannerV2.js --verbose
```

---

## 🔄 Background Execution

### **Run in background (24/7):**
```bash
# Using nohup
nohup node arbScannerV2.js --keep-running > arb.log 2>&1 &

# With custom settings
nohup bash -c "MIN_PROFIT_PERCENT=1.0 node arbScannerV2.js --keep-running" > arb.log 2>&1 &
```

### **Monitor the log:**
```bash
# Watch live
tail -f arb.log

# View last 100 lines
tail -100 arb.log

# Search for arbitrage
grep "ARBITRAGE OPPORTUNITY" arb.log
```

### **Stop the scanner:**
```bash
# Kill by process name
pkill -f arbScannerV2

# Or find and kill by PID
ps aux | grep arbScannerV2
kill <PID>
```

---

## 📊 What Each Mode Does

### **Default Mode (exits after first find):**
```bash
npm run arb
```
- ✅ Scans every 30 seconds
- ✅ Exits immediately when arbitrage found
- ✅ Good for: Quick checks, testing

### **Keep Running Mode:**
```bash
node arbScannerV2.js --keep-running
```
- ✅ Scans every 30 seconds
- ✅ Continues running after finding arbitrage
- ✅ Shows total opportunities found
- ✅ Good for: 24/7 monitoring, catching multiple opportunities

### **Verbose Mode:**
```bash
node arbScannerV2.js --verbose
```
- ✅ Shows all odds for every market
- ✅ Shows arbitrage calculations
- ✅ More detailed output
- ✅ Good for: Understanding the market, debugging

---

## 🎯 Recommended Setups

### **For Real-Time Monitoring (BEST):**
```bash
# Real-time websocket scanner, 1% minimum profit
nohup bash -c "MIN_PROFIT_PERCENT=1.0 node arbScannerRealtime.js" > arb.log 2>&1 &
```

### **For Testing:**
```bash
# Accept any arbitrage, real-time
MIN_PROFIT_PERCENT=0 node arbScannerRealtime.js
```

### **For Conservative Trading:**
```bash
# 1% minimum profit, real-time, background
nohup bash -c "MIN_PROFIT_PERCENT=1.0 node arbScannerRealtime.js" > arb.log 2>&1 &
```

### **For Aggressive Trading:**
```bash
# 0.5% minimum profit, real-time, background
nohup bash -c "MIN_PROFIT_PERCENT=0.5 node arbScannerRealtime.js" > arb.log 2>&1 &
```

### **For High-Volume Trading:**
```bash
# Accept any arbitrage, larger orders, real-time
nohup bash -c "MIN_PROFIT_PERCENT=0 MIN_ORDER_SIZE_USDC=10 node arbScannerRealtime.js" > arb.log 2>&1 &
```

---

## 📈 Current Status

Your scanner is monitoring:
- **6 complete 1X2 events**
- **18 markets** (3 per event)
- **Scan frequency**: Every 30 seconds

Example output:
```
📊 Brentford vs Manchester City
   Team1 YES: 1.28 | NO: 6.67
   Tie YES: 1.33 | NO: 6.20
   Team2 YES: 2.86 | NO: 1.82
   Type 1: 1.8838 ❌ (need < 1.0)
   Type 2: 1.4500 ❌ (need < 1.0)
```

---

## 🛑 Stop the Scanner

Press **Ctrl+C** to stop gracefully. You'll see:
```
👋 Shutting down arbitrage scanner...
   Total scans performed: 42
   Total arbitrage opportunities found: 3
   Last scan: 10/5/2025, 12:00:00 PM
```

---

## ✅ Quick Reference

| Command | Description |
|---------|-------------|
| `npm run arb` | Run once, exit after first find |
| `node arbScannerV2.js --keep-running` | Keep running continuously |
| `node arbScannerV2.js --verbose` | Show all odds |
| `MIN_PROFIT_PERCENT=1.0 npm run arb` | Set minimum profit |
| `nohup ... > arb.log 2>&1 &` | Run in background |
| `tail -f arb.log` | Monitor log |
| `pkill -f arbScannerV2` | Stop scanner |

---

**Recommended for 24/7 monitoring (REAL-TIME):**
```bash
nohup bash -c "MIN_PROFIT_PERCENT=1.0 node arbScannerRealtime.js" > arb.log 2>&1 &
tail -f arb.log
```

Press **Ctrl+C** to exit the tail, scanner keeps running in background! 🚀

---

## ⚡ Real-Time vs Polling

| Feature | Real-Time (arbScannerRealtime.js) | Polling (arbScannerV2.js) |
|---------|-----------------------------------|---------------------------|
| **Speed** | INSTANT (milliseconds) | 30 seconds delay |
| **Method** | Ably websockets | HTTP polling |
| **Detection** | When order changes | Every 30 seconds |
| **Efficiency** | ✅ Best | ⚠️ Slower |
| **Recommended** | ✅ YES | Only for testing |

**Use Real-Time for actual trading!**
