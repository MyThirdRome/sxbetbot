# SX.BET Automated Betting Guide

## ✅ SUCCESSFULLY TESTED!

The automated betting script has been successfully tested and placed a **5 USDC bet** on a live soccer match!

### Test Results:
- **Match**: Brentford vs Manchester City (English Premier League)
- **Bet Amount**: 5 USDC
- **Maker Odds**: 82.38% (what you pay)
- **Decimal Odds**: 1.21x
- **Potential Return**: 6.05 USDC
- **Potential Profit**: 1.05 USDC
- **Fill Hash**: `0xe5428574fbbb9436978a1d3c1f22310ae48b4fed27bd440908bf7d71c0c8e6c4`
- **Status**: ✅ Bet placed successfully!

⚠️ **Note**: Initial calculations were incorrect and have been fixed. See `ODDS_CALCULATION_FIX.md` for details.

---

## 🚀 Quick Start

### Run the automated betting script:
```bash
cd sxbet-soccer-api
node autoBet.js
```

### What it does:
1. ✅ Checks your USDC balance (need at least 5 USDC)
2. ✅ Checks TokenTransferProxy approval (auto-approves if needed)
3. ✅ Finds active soccer matches with markets
4. ✅ Selects the order with BEST odds
5. ✅ Places a 5 USDC bet automatically
6. ✅ Shows transaction details and potential returns

---

## 📋 Requirements

### 1. Wallet Setup
- **Network**: SX Network (Chain ID: 4162)
- **RPC URL**: https://rpc.sx-rollup.gelato.digital
- **Your Wallet**: `0x46F2c45a7729f4da0f1049E2177Ab28859fa1c66`
- **Current Balance**: 22.52 USDC ✅

### 2. Environment Variables
Already configured in `.env`:
```bash
SX_BET_API_KEY=70dea7d3-23b8-4b53-a2d8-5425ddde89e1
PRIVATE_KEY=0x3035515892aae06a78276550076f8a763222d3a81f43a8036a493d773ffcea32
```

⚠️ **SECURITY WARNING**: Never share or commit your private key!

### 3. Dependencies
Already installed:
- `ethers@5.7.2` - Ethereum library for signing
- `@metamask/eth-sig-util@7.0.3` - EIP712 signing
- `axios` - HTTP requests
- `dotenv` - Environment variables

---

## 🎯 How It Works

### Step 1: Initialization
```javascript
// Connects to SX Network
// Loads your wallet from private key
// Fetches metadata (executor, proxy addresses, etc.)
```

### Step 2: Balance & Approval Check
```javascript
// Checks USDC balance (need 5+ USDC)
// Checks if TokenTransferProxy is approved
// Auto-approves if needed (one-time setup)
```

### Step 3: Find Match with Markets
```javascript
// Fetches active soccer markets
// Finds match with 1X2 or 12 market type
// Selects first available match
```

### Step 4: Select Best Order
```javascript
// Filters orders with enough size (5+ USDC available)
// Calculates taker odds for each order
// Selects order with HIGHEST taker odds (best value)
```

### Step 5: Place Bet
```javascript
// Creates EIP712 signature
// Submits to POST /orders/fill/v2
// Returns fill hash and transaction details
```

---

## 📊 Understanding the Output

### Example Output:
```
✅ Selected order with BEST odds:
   Order Hash: 0x05155a18a05f8486e6e67b58211a0bdd37a587d9dadf34cc8f66b6fd367ad40a
   Betting on: Outcome TWO
   Maker odds: 82.38% (what you pay)
   Your decimal odds: 1.21x
   Stake: 5 USDC
   Potential return: 6.05 USDC
   Potential profit: 1.05 USDC
```

**What this means:**
- **Betting on**: Which outcome you're betting on (Team 1, Team 2, or Draw)
- **Maker odds**: 82.38% = implied probability you're paying for
- **Your decimal odds**: 1.21x = multiplier if you win
- **Stake**: Amount you're risking (5 USDC)
- **Potential return**: Total you get back if you win (6.05 USDC)
- **Potential profit**: Net profit if you win (1.05 USDC)

### Odds Calculation:
```
Decimal Odds = 1 / Maker Odds
Return = Stake × Decimal Odds
Profit = Return - Stake

Example:
Maker Odds: 82.38% (0.8238)
Decimal Odds: 1 / 0.8238 = 1.21x
Return: 5 × 1.21 = 6.05 USDC
Profit: 6.05 - 5 = 1.05 USDC
```

---

## 🔧 Customization

### Change Bet Amount
Edit `autoBet.js` line ~280:
```javascript
const stakeWei = '5000000'; // 5 USDC (6 decimals)
// Change to:
const stakeWei = '10000000'; // 10 USDC
```

### Change Odds Slippage
Edit `autoBet.js` line ~290:
```javascript
const oddsSlippage = 5; // 5% slippage tolerance
// Change to:
const oddsSlippage = 10; // 10% slippage (more flexible)
```

### Filter by League
Edit `findMatchWithMarkets()` function to filter by specific league:
```javascript
const markets = marketsResponse.data.data.markets.filter(m => 
  m.leagueLabel === 'English Premier League'
);
```

---

## 🎲 Betting Strategy Options

### 1. Best Odds Strategy (Current)
Selects order with highest taker odds (best value)
```javascript
// Already implemented in selectBestOrder()
```

### 2. Random Order Strategy
Picks any random order with sufficient size
```javascript
const randomOrder = availableOrders[Math.floor(Math.random() * availableOrders.length)];
```

### 3. Favorite Team Strategy
Filter orders by specific team
```javascript
const favoriteTeamOrders = orders.filter(order => 
  market.teamOneName === 'Manchester City' && !order.isMakerBettingOutcomeOne
);
```

### 4. Underdog Strategy
Bet on team with higher odds (higher potential return)
```javascript
// Select order with highest decimal odds
let bestOrder = availableOrders[0];
let highestDecimalOdds = 0;

for (const order of availableOrders) {
  const makerOdds = parseFloat(order.percentageOdds) / 1e20;
  const takerOdds = 1 - makerOdds;
  const decimalOdds = 1 / takerOdds;
  
  if (decimalOdds > highestDecimalOdds) {
    highestDecimalOdds = decimalOdds;
    bestOrder = order;
  }
}
```

---

## 📈 Next Steps

### 1. Monitor Your Bets
Check your bet status on [sx.bet](https://sx.bet):
- Connect wallet: `0x46F2c45a7729f4da0f1049E2177Ab28859fa1c66`
- View active bets in "My Bets" section
- Track match progress and live scores

### 2. Automate Multiple Bets
Create a loop to place multiple bets:
```javascript
for (let i = 0; i < 3; i++) {
  const matchData = await findMatchWithMarkets();
  const orders = await getOrdersForMarket(matchData.market.marketHash);
  const selectedOrder = selectBestOrder(orders);
  await placeBet(matchData.market, selectedOrder);
  
  // Wait 5 seconds between bets
  await new Promise(resolve => setTimeout(resolve, 5000));
}
```

### 3. Add Live Betting
Monitor live matches and place bets during the game:
```javascript
// Subscribe to live score updates via Ably
// Place bets when odds change favorably
// See liveOrderbook.js for websocket example
```

### 4. Implement Risk Management
Add checks to limit total exposure:
```javascript
const MAX_DAILY_STAKE = 50; // Max 50 USDC per day
const MAX_BETS_PER_DAY = 10; // Max 10 bets per day
const MIN_ODDS = 1.5; // Only bet on odds >= 1.5x
```

---

## 🔍 Troubleshooting

### Error: "Insufficient USDC balance"
**Solution**: Bridge more USDC to SX Network
- Use official SX Network bridge
- Or get testnet funds from SX Discord

### Error: "NO_MATCHING_ORDERS"
**Solution**: Odds changed or order was filled
- Script will automatically retry with next best order
- Increase `oddsSlippage` for more flexibility

### Error: "INSUFFICIENT_SPACE"
**Solution**: Order is being filled by someone else
- Wait a few seconds and try again
- Script will find next available order

### Error: "ODDS_STALE"
**Solution**: Market odds changed significantly
- Increase `oddsSlippage` tolerance
- Or wait for market to stabilize

---

## 📚 API Documentation

Full sx.bet API docs: [https://api.docs.sx.bet](https://api.docs.sx.bet)

### Key Endpoints Used:
- `GET /metadata` - Get contract addresses and config
- `GET /markets/active` - Get active betting markets
- `GET /orders` - Get available orders for a market
- `POST /orders/approve` - Approve TokenTransferProxy (one-time)
- `POST /orders/fill/v2` - Place a bet (fill orders)

### Key Concepts:
- **Market Hash**: Unique identifier for a betting market
- **Order Hash**: Unique identifier for a specific order
- **Fill Hash**: Unique identifier for your bet transaction
- **Maker**: Person offering the bet (bookmaker)
- **Taker**: Person taking the bet (you)
- **Maker Odds**: Odds the maker receives
- **Taker Odds**: Odds you receive (1 - maker odds)

---

## 🎉 Success!

You've successfully set up automated betting on SX.bet! 

**Your first bet:**
- ✅ 5 USDC placed
- ✅ Brentford vs Manchester City
- ✅ Potential return: 28.35 USDC
- ✅ Fill hash: `0xe5428574fbbb9436978a1d3c1f22310ae48b4fed27bd440908bf7d71c0c8e6c4`

**Next steps:**
1. Monitor your bet on [sx.bet](https://sx.bet)
2. Customize the script for your strategy
3. Automate multiple bets
4. Add risk management
5. Implement live betting

Good luck! 🍀
