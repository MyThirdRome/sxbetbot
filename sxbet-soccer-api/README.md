# SX.bet Soccer Fixtures API

A Node.js application to fetch today's soccer fixtures from the sx.bet API using the fixtures endpoint.

## Features

- ✅ Fetches today's soccer fixtures from multiple leagues
- ✅ Displays live match status (Not Started, In Progress, Finished, etc.)
- ✅ Shows match times in both local and UTC formats
- ✅ Groups fixtures by league for easy viewing
- ✅ Supports major soccer leagues worldwide
- ✅ Can fetch active leagues dynamically

## Installation

```bash
npm install
```

## Usage

### 🎉 NEW: Automated Betting (TESTED & WORKING!)

Place automated bets on soccer matches:

```bash
npm run autobet
# or
node autoBet.js
```

**What it does:**
- ✅ Finds active soccer matches with markets
- ✅ Selects order with BEST odds
- ✅ Places a 5 USDC bet automatically
- ✅ Shows transaction details and potential returns

**First test bet successfully placed:**
- Match: Brentford vs Manchester City
- Amount: 5 USDC
- Odds: 5.67x decimal
- Potential Return: 28.35 USDC
- Status: ✅ CONFIRMED

See `AUTO_BET_SUMMARY.md` and `BETTING_GUIDE.md` for complete documentation.

### Fetch Today's Soccer Fixtures

Run the main script to fetch today's soccer fixtures:

```bash
npm start
# or
node fetchSoccerEvents.js
```

This will display all soccer fixtures scheduled for today across major leagues including:
- English Premier League
- La Liga
- Bundesliga
- Serie A
- Ligue 1
- Champions League
- UEFA Nations League
- Portugal Primeira Liga

### Fetch Active Soccer Leagues

To see all currently active soccer leagues with events:

```bash
npm run leagues
# or
node fetchActiveLeagues.js
```

This will show:
- League names and IDs
- Number of events by type (game-lines, 1X2, etc.)
- Total active leagues

### Real-Time Best Odds Monitor (NEW!)

Monitor real-time best odds for today's soccer 1x2 markets:

```bash
npm run realtime
# or
node realtimeBestOdds.js
```

This will:
- Connect to Ably websocket for real-time updates
- Display current best odds for today's soccer 1x2 markets
- Subscribe to market updates
- Subscribe to order book changes
- Show live odds updates as they happen

**Features:**
- ✅ Real-time websocket connection via Ably
- ✅ Automatic best odds calculation
- ✅ Live market status updates
- ✅ Order book monitoring
- ✅ Decimal odds display (e.g., 1.82, 2.50)
- ✅ Monitors up to 10 markets simultaneously

## Configuration

The script uses the following configuration:
- **API Base URL**: `https://api.sx.bet`
- **Soccer Sport ID**: `5`
- **SX Network Chain ID**: `4162`
- **USDC Token Address**: `0x6629Ce1Cf35Cc1329ebB4F63202F3f197b3F050B`

### API Key Setup (Required for Real-Time Features & Betting)

To use the real-time features and automated betting, you need an API key and private key:

1. Get your API key from [sx.bet](https://sx.bet)
2. Create a `.env` file in the project root:
   ```bash
   SX_BET_API_KEY=your_api_key_here
   PRIVATE_KEY=0x...  # Your wallet private key (for betting only)
   ```

The API key is used to authenticate with Ably for websocket connections.
The private key is used to sign transactions for automated betting.

⚠️ **SECURITY**: Never share or commit your private key!

## Output

The script displays:
- Total number of fixtures for today
- For each fixture:
  - 🔴 Live status indicator
  - ⏰ Scheduled status indicator
  - Team names
  - League name
  - Match time (local and UTC)
  - Event ID
  - Match status (Not Started, In Progress, etc.)

## Fixture Status Codes

- **1**: Not Started
- **2**: In Progress (LIVE)
- **3**: Finished
- **4**: Cancelled
- **5**: Postponed
- **6**: Interrupted
- **7**: Abandoned
- **8**: Coverage Lost
- **9**: About to Start

## API Documentation

Full sx.bet API documentation: [https://api.docs.sx.bet](https://api.docs.sx.bet)

## Dependencies

- `axios` - HTTP client for API requests
- `dotenv` - Environment variable management
- `ably` - Real-time websocket support
- `express` - Web dashboard server
- `ethers@5.7.2` - Ethereum library for signing transactions
- `@metamask/eth-sig-util@7.0.3` - EIP712 signature generation

## Example Output

### Fixtures Output
```
TODAY'S SOCCER FIXTURES (27 total)

📋 English Premier League
--------------------------------------------------------------------------------

  1. ⏰ Aston Villa vs Burnley
     Time: 01:00 PM (Sun, 05 Oct 2025 13:00:00 GMT)
     Event ID: L16768980
     Status: Not Started

  2. 🔴 Everton vs Crystal Palace
     Time: 01:00 PM (Sun, 05 Oct 2025 13:00:00 GMT)
     Event ID: L16768982
     Status: In Progress (LIVE)
```

### Real-Time Best Odds Output
```
📊 Brentford vs Manchester City
   League: English Premier League
   Time: 10/5/2025, 3:30:00 PM
   Market Hash: 0x6530ed049122b9d7922348be5bf4cca14a0eb0a652813b885949eabcc884c323
   Best Odds:
      Brentford: 1.82
      Manchester City: 1.17

✅ Connected to Ably
📡 Subscribing to real-time market updates...
✅ Subscribed to market updates channel

🔔 Market Update: Brentford vs Manchester City
   Status: ACTIVE
   Time: 10:47:23 AM

📈 Order Book Update: Brentford vs Manchester City
   Time: 10:47:25 AM
   Updated Best Odds:
      Brentford: 1.85
      Manchester City: 1.15
```
