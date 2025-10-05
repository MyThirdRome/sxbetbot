const express = require('express');
const axios = require('axios');
const Ably = require('ably');
require('dotenv').config();

const app = express();
const API_BASE_URL = 'https://api.sx.bet';
const SOCCER_SPORT_ID = 5;

let marketsData = [];
let realtimeConnection = null;

// Create Ably token request
async function createTokenRequest() {
  const response = await axios.get(`${API_BASE_URL}/user/token`, {
    headers: {
      'X-Api-Key': process.env.SX_BET_API_KEY,
    },
  });
  return response.data;
}

// Initialize Ably connection
async function initializeAbly() {
  const realtime = new Ably.Realtime({
    authCallback: async (tokenParams, callback) => {
      try {
        const tokenRequest = await createTokenRequest();
        callback(null, tokenRequest);
      } catch (error) {
        callback(error, null);
      }
    },
  });

  return new Promise((resolve, reject) => {
    realtime.connection.once('connected', () => {
      console.log('✅ Connected to Ably');
      resolve(realtime);
    });
    
    realtime.connection.once('failed', (error) => {
      console.error('❌ Failed to connect to Ably:', error);
      reject(error);
    });
  });
}

// Convert odds from wei format to decimal
function convertOddsToDecimal(oddsWei) {
  const oddsValue = parseFloat(oddsWei) / Math.pow(10, 20);
  return (oddsValue + 1).toFixed(2);
}

// Get active orders for a market
async function getMarketOrders(marketHash) {
  try {
    const response = await axios.get(`${API_BASE_URL}/orders`, {
      params: { marketHashes: marketHash }
    });
    
    if (response.data.status === 'success') {
      return response.data.data;
    }
    return null;
  } catch (error) {
    return null;
  }
}

// Calculate best odds from orders
function calculateBestOdds(orders) {
  if (!orders || orders.length === 0) {
    return { outcomeOne: null, outcomeTwo: null };
  }

  let bestOutcomeOne = null;
  let bestOutcomeTwo = null;

  orders.forEach(order => {
    const decimalOdds = parseFloat(convertOddsToDecimal(order.percentageOdds));
    
    if (order.isMakerBettingOutcomeOne) {
      if (!bestOutcomeTwo || decimalOdds > bestOutcomeTwo.odds) {
        bestOutcomeTwo = {
          odds: decimalOdds,
          stake: order.totalBetSize,
          orderHash: order.orderHash
        };
      }
    } else {
      if (!bestOutcomeOne || decimalOdds > bestOutcomeOne.odds) {
        bestOutcomeOne = {
          odds: decimalOdds,
          stake: order.totalBetSize,
          orderHash: order.orderHash
        };
      }
    }
  });

  return { outcomeOne: bestOutcomeOne, outcomeTwo: bestOutcomeTwo };
}

// Fetch today's soccer 1x2 markets
async function fetchTodaysMarkets() {
  try {
    const response = await axios.get(`${API_BASE_URL}/markets/active`, {
      params: {
        sportId: SOCCER_SPORT_ID,
        betGroup: '1X2'
      }
    });

    if (response.data.status !== 'success') {
      return [];
    }

    const markets = response.data.data.markets;
    
    const now = new Date();
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime() / 1000;
    const todayEnd = todayStart + (24 * 60 * 60);

    const todaysMarkets = markets.filter(market => {
      return market.gameTime >= todayStart && market.gameTime < todayEnd;
    });

    // Fetch odds for each market
    const marketsWithOdds = [];
    for (const market of todaysMarkets.slice(0, 20)) {
      const orders = await getMarketOrders(market.marketHash);
      const bestOdds = calculateBestOdds(orders);
      
      marketsWithOdds.push({
        ...market,
        bestOdds,
        lastUpdate: new Date().toISOString()
      });
    }

    return marketsWithOdds;
  } catch (error) {
    console.error('Error fetching markets:', error.message);
    return [];
  }
}

// Update odds for a specific market
async function updateMarketOdds(marketHash) {
  const marketIndex = marketsData.findIndex(m => m.marketHash === marketHash);
  if (marketIndex === -1) return;

  const orders = await getMarketOrders(marketHash);
  const bestOdds = calculateBestOdds(orders);
  
  marketsData[marketIndex].bestOdds = bestOdds;
  marketsData[marketIndex].lastUpdate = new Date().toISOString();
}

// Setup websocket subscriptions
async function setupWebsockets() {
  if (!realtimeConnection) {
    realtimeConnection = await initializeAbly();
  }

  // Subscribe to market updates
  const marketsChannel = realtimeConnection.channels.get('markets');
  marketsChannel.subscribe((message) => {
    console.log('Market update received');
  });

  // Subscribe to order book updates for each market
  marketsData.forEach(market => {
    const channel = realtimeConnection.channels.get(`order_book:${market.marketHash}`);
    channel.subscribe(async (message) => {
      console.log(`Order book update for ${market.teamOneName} vs ${market.teamTwoName}`);
      await updateMarketOdds(market.marketHash);
    });
  });
}

// HTML Dashboard
app.get('/', (req, res) => {
  const html = `
<!DOCTYPE html>
<html>
<head>
  <title>SX.bet Live Soccer Odds</title>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <style>
    * {
      margin: 0;
      padding: 0;
      box-sizing: border-box;
    }
    
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, Cantarell, sans-serif;
      background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
      min-height: 100vh;
      padding: 20px;
    }
    
    .container {
      max-width: 1400px;
      margin: 0 auto;
    }
    
    .header {
      background: white;
      padding: 30px;
      border-radius: 15px;
      box-shadow: 0 10px 30px rgba(0,0,0,0.2);
      margin-bottom: 30px;
      text-align: center;
    }
    
    .header h1 {
      color: #333;
      font-size: 2.5em;
      margin-bottom: 10px;
    }
    
    .header .subtitle {
      color: #666;
      font-size: 1.1em;
    }
    
    .status {
      display: inline-block;
      padding: 8px 16px;
      background: #10b981;
      color: white;
      border-radius: 20px;
      font-size: 0.9em;
      margin-top: 15px;
      animation: pulse 2s infinite;
    }
    
    @keyframes pulse {
      0%, 100% { opacity: 1; }
      50% { opacity: 0.7; }
    }
    
    .markets-grid {
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(400px, 1fr));
      gap: 20px;
    }
    
    .market-card {
      background: white;
      border-radius: 15px;
      padding: 25px;
      box-shadow: 0 5px 15px rgba(0,0,0,0.1);
      transition: transform 0.2s, box-shadow 0.2s;
    }
    
    .market-card:hover {
      transform: translateY(-5px);
      box-shadow: 0 10px 25px rgba(0,0,0,0.15);
    }
    
    .market-header {
      border-bottom: 2px solid #f0f0f0;
      padding-bottom: 15px;
      margin-bottom: 15px;
    }
    
    .teams {
      font-size: 1.3em;
      font-weight: 600;
      color: #333;
      margin-bottom: 8px;
    }
    
    .league {
      color: #666;
      font-size: 0.9em;
      display: flex;
      align-items: center;
      gap: 5px;
    }
    
    .time {
      color: #999;
      font-size: 0.85em;
      margin-top: 5px;
    }
    
    .odds-container {
      display: flex;
      gap: 10px;
      margin-top: 15px;
    }
    
    .odds-box {
      flex: 1;
      background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
      color: white;
      padding: 15px;
      border-radius: 10px;
      text-align: center;
    }
    
    .odds-label {
      font-size: 0.85em;
      opacity: 0.9;
      margin-bottom: 5px;
    }
    
    .odds-value {
      font-size: 1.8em;
      font-weight: 700;
    }
    
    .no-odds {
      background: #f3f4f6;
      color: #6b7280;
    }
    
    .last-update {
      text-align: center;
      color: #999;
      font-size: 0.8em;
      margin-top: 15px;
      padding-top: 15px;
      border-top: 1px solid #f0f0f0;
    }
    
    .loading {
      text-align: center;
      padding: 50px;
      color: white;
      font-size: 1.2em;
    }
    
    @media (max-width: 768px) {
      .markets-grid {
        grid-template-columns: 1fr;
      }
      
      .header h1 {
        font-size: 1.8em;
      }
    }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>⚽ SX.bet Live Soccer Odds</h1>
      <p class="subtitle">Real-time best odds for today's 1x2 markets</p>
      <div class="status">🔴 LIVE</div>
    </div>
    
    <div id="markets" class="loading">Loading markets...</div>
  </div>
  
  <script>
    async function fetchMarkets() {
      try {
        const response = await fetch('/api/markets');
        const markets = await response.json();
        
        const container = document.getElementById('markets');
        
        if (markets.length === 0) {
          container.innerHTML = '<div class="loading">No markets available for today</div>';
          return;
        }
        
        container.className = 'markets-grid';
        container.innerHTML = markets.map(market => {
          const gameTime = new Date(market.gameTime * 1000);
          const lastUpdate = new Date(market.lastUpdate);
          
          const odds1 = market.bestOdds.outcomeOne;
          const odds2 = market.bestOdds.outcomeTwo;
          
          return \`
            <div class="market-card">
              <div class="market-header">
                <div class="teams">\${market.teamOneName} vs \${market.teamTwoName}</div>
                <div class="league">🏆 \${market.leagueLabel}</div>
                <div class="time">⏰ \${gameTime.toLocaleString()}</div>
              </div>
              
              <div class="odds-container">
                <div class="odds-box \${!odds1 ? 'no-odds' : ''}">
                  <div class="odds-label">\${market.teamOneName}</div>
                  <div class="odds-value">\${odds1 ? odds1.odds.toFixed(2) : 'N/A'}</div>
                </div>
                
                <div class="odds-box \${!odds2 ? 'no-odds' : ''}">
                  <div class="odds-label">\${market.teamTwoName}</div>
                  <div class="odds-value">\${odds2 ? odds2.odds.toFixed(2) : 'N/A'}</div>
                </div>
              </div>
              
              <div class="last-update">
                Updated: \${lastUpdate.toLocaleTimeString()}
              </div>
            </div>
          \`;
        }).join('');
        
      } catch (error) {
        console.error('Error fetching markets:', error);
        document.getElementById('markets').innerHTML = 
          '<div class="loading">Error loading markets. Please refresh.</div>';
      }
    }
    
    // Initial fetch
    fetchMarkets();
    
    // Refresh every 10 seconds
    setInterval(fetchMarkets, 10000);
  </script>
</body>
</html>
  `;
  
  res.send(html);
});

// API endpoint for markets data
app.get('/api/markets', (req, res) => {
  res.json(marketsData);
});

// Start server
async function startServer() {
  try {
    console.log('🚀 Starting SX.bet Live Odds Dashboard...\n');
    
    // Start Express server FIRST
    const PORT = process.env.PORT || 3000;
    app.listen(PORT, () => {
      console.log(`✅ Dashboard running on port ${PORT}`);
      console.log(`🌐 Open your browser to view live odds\n`);
    });
    
    // Fetch initial markets in background
    console.log('📊 Fetching today\'s markets...');
    marketsData = await fetchTodaysMarkets();
    console.log(`✅ Found ${marketsData.length} markets\n`);
    
    // Setup websockets
    console.log('📡 Setting up websocket connections...');
    await setupWebsockets();
    console.log('✅ Websockets connected\n');
    
    // Refresh markets every 5 minutes
    setInterval(async () => {
      console.log('🔄 Refreshing markets...');
      marketsData = await fetchTodaysMarkets();
      console.log(`✅ Updated ${marketsData.length} markets`);
    }, 5 * 60 * 1000);
    
  } catch (error) {
    console.error('❌ Error starting server:', error);
    process.exit(1);
  }
}

startServer();
