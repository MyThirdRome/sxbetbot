const axios = require('axios');
const Ably = require('ably');
require('dotenv').config();

const API_BASE_URL = 'https://api.sx.bet';
const SOCCER_SPORT_ID = 5;

// Create Ably token request
async function createTokenRequest() {
  try {
    const response = await axios.get(`${API_BASE_URL}/user/token`, {
      headers: {
        'X-Api-Key': process.env.SX_BET_API_KEY,
      },
    });
    return response.data;
  } catch (error) {
    console.error('Error creating token request:', error.message);
    throw error;
  }
}

// Initialize Ably connection
async function initializeAbly() {
  console.log('Initializing Ably connection...\n');
  
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
      console.log('✅ Connected to Ably\n');
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
  // Odds are stored as wei (multiply by 10^20)
  // Decimal odds = (oddsWei / 10^20) + 1
  const oddsValue = parseFloat(oddsWei) / Math.pow(10, 20);
  return (oddsValue + 1).toFixed(2);
}

// Get active orders for a market
async function getMarketOrders(marketHash) {
  try {
    const response = await axios.get(`${API_BASE_URL}/orders`, {
      params: {
        marketHashes: marketHash
      }
    });
    
    if (response.data.status === 'success') {
      return response.data.data;
    }
    return null;
  } catch (error) {
    console.error(`Error fetching orders for ${marketHash}:`, error.message);
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
      // Maker betting outcome one, so taker gets outcome two
      if (!bestOutcomeTwo || decimalOdds > bestOutcomeTwo.odds) {
        bestOutcomeTwo = {
          odds: decimalOdds,
          stake: order.totalBetSize,
          orderHash: order.orderHash
        };
      }
    } else {
      // Maker betting outcome two, so taker gets outcome one
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

// Monitor soccer 1x2 markets
async function monitorSoccer1x2Markets() {
  try {
    // Get today's soccer 1x2 markets
    console.log('Fetching today\'s soccer 1x2 markets...\n');
    
    const response = await axios.get(`${API_BASE_URL}/markets/active`, {
      params: {
        sportId: SOCCER_SPORT_ID,
        betGroup: '1X2'
      }
    });

    if (response.data.status !== 'success') {
      throw new Error('Failed to fetch markets');
    }

    const markets = response.data.data.markets;
    
    // Filter for today's matches
    const now = new Date();
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime() / 1000;
    const todayEnd = todayStart + (24 * 60 * 60);

    const todaysMarkets = markets.filter(market => {
      return market.gameTime >= todayStart && market.gameTime < todayEnd;
    });

    console.log(`Found ${todaysMarkets.length} soccer 1x2 markets today\n`);
    console.log('='.repeat(80));

    if (todaysMarkets.length === 0) {
      console.log('\n❌ No soccer 1x2 markets found for today');
      return [];
    }

    // Display markets with initial odds
    for (const market of todaysMarkets.slice(0, 10)) { // Limit to first 10 for demo
      const gameTime = new Date(market.gameTime * 1000);
      console.log(`\n📊 ${market.teamOneName} vs ${market.teamTwoName}`);
      console.log(`   League: ${market.leagueLabel}`);
      console.log(`   Time: ${gameTime.toLocaleString()}`);
      console.log(`   Market Hash: ${market.marketHash}`);
      
      // Get current orders
      const orders = await getMarketOrders(market.marketHash);
      if (orders && orders.length > 0) {
        const bestOdds = calculateBestOdds(orders);
        console.log(`   Best Odds:`);
        if (bestOdds.outcomeOne) {
          console.log(`      ${market.teamOneName}: ${bestOdds.outcomeOne.odds}`);
        }
        if (bestOdds.outcomeTwo) {
          console.log(`      ${market.teamTwoName}: ${bestOdds.outcomeTwo.odds}`);
        }
      } else {
        console.log(`   ⚠️  No orders available yet`);
      }
    }

    console.log('\n' + '='.repeat(80));
    
    return todaysMarkets;

  } catch (error) {
    console.error('Error monitoring markets:', error.message);
    throw error;
  }
}

// Subscribe to real-time market updates
async function subscribeToMarketUpdates(realtime, markets) {
  console.log('\n📡 Subscribing to real-time market updates...\n');
  
  const channel = realtime.channels.get('markets');
  
  channel.subscribe((message) => {
    const updatedMarkets = Array.isArray(message.data) ? message.data : [message.data];
    
    updatedMarkets.forEach(market => {
      // Check if this is one of our soccer 1x2 markets
      const isRelevant = markets.some(m => m.marketHash === market.marketHash);
      
      if (isRelevant && market.sportId === SOCCER_SPORT_ID) {
        console.log(`\n🔔 Market Update: ${market.teamOneName} vs ${market.teamTwoName}`);
        console.log(`   Status: ${market.status}`);
        console.log(`   Time: ${new Date().toLocaleTimeString()}`);
      }
    });
  });

  console.log('✅ Subscribed to market updates channel');
}

// Subscribe to order book updates for specific markets
async function subscribeToOrderBookUpdates(realtime, markets) {
  console.log('📡 Subscribing to order book updates...\n');
  
  // Subscribe to first 5 markets as example
  const marketsToMonitor = markets.slice(0, 5);
  
  for (const market of marketsToMonitor) {
    const channel = realtime.channels.get(`order_book:${market.marketHash}`);
    
    channel.subscribe(async (message) => {
      console.log(`\n📈 Order Book Update: ${market.teamOneName} vs ${market.teamTwoName}`);
      console.log(`   Time: ${new Date().toLocaleTimeString()}`);
      
      // Fetch updated orders
      const orders = await getMarketOrders(market.marketHash);
      if (orders && orders.length > 0) {
        const bestOdds = calculateBestOdds(orders);
        console.log(`   Updated Best Odds:`);
        if (bestOdds.outcomeOne) {
          console.log(`      ${market.teamOneName}: ${bestOdds.outcomeOne.odds}`);
        }
        if (bestOdds.outcomeTwo) {
          console.log(`      ${market.teamTwoName}: ${bestOdds.outcomeTwo.odds}`);
        }
      }
    });
    
    console.log(`✅ Subscribed to order book for: ${market.teamOneName} vs ${market.teamTwoName}`);
  }
}

// Main function
async function main() {
  try {
    console.log('🚀 Starting SX.bet Real-Time Best Odds Monitor\n');
    console.log('='.repeat(80));
    
    // Get today's markets
    const markets = await monitorSoccer1x2Markets();
    
    if (markets.length === 0) {
      console.log('\nNo markets to monitor. Exiting...');
      process.exit(0);
    }

    // Initialize Ably
    const realtime = await initializeAbly();
    
    // Subscribe to updates
    await subscribeToMarketUpdates(realtime, markets);
    await subscribeToOrderBookUpdates(realtime, markets);
    
    console.log('\n' + '='.repeat(80));
    console.log('\n✅ Monitoring active. Press Ctrl+C to stop.\n');
    
    // Keep the process running
    process.on('SIGINT', () => {
      console.log('\n\n👋 Shutting down...');
      realtime.close();
      process.exit(0);
    });

  } catch (error) {
    console.error('\n❌ Error:', error.message);
    process.exit(1);
  }
}

// Run the script
if (require.main === module) {
  main();
}

module.exports = { 
  initializeAbly, 
  monitorSoccer1x2Markets,
  calculateBestOdds,
  convertOddsToDecimal
};
