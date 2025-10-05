const axios = require('axios');
const Ably = require('ably');
require('dotenv').config();

const API_BASE_URL = 'https://api.sx.bet';
const SOCCER_SPORT_ID = 5;

// Store orderbook data
const orderbookData = new Map();

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
      console.log('✅ Connected to Ably\n');
      resolve(realtime);
    });
    
    realtime.connection.once('failed', (error) => {
      reject(error);
    });
  });
}

// Convert odds from wei format to decimal
function convertOddsToDecimal(oddsWei) {
  const oddsValue = parseFloat(oddsWei) / Math.pow(10, 20);
  return (oddsValue + 1).toFixed(4);
}

// Convert stake from wei to USDC
function convertStakeToUSDC(stakeWei) {
  // USDC has 6 decimals
  return (parseFloat(stakeWei) / Math.pow(10, 6)).toFixed(2);
}

// Calculate remaining taker space (how much taker can bet)
function calculateRemainingTakerSpace(totalBetSize, fillAmount, percentageOdds) {
  const totalBetSizeBN = parseFloat(totalBetSize);
  const fillAmountBN = parseFloat(fillAmount);
  const percentageOddsBN = parseFloat(percentageOdds);
  
  // remainingTakerSpace = (totalBetSize - fillAmount) * 10^20 / percentageOdds - (totalBetSize - fillAmount)
  const remaining = totalBetSizeBN - fillAmountBN;
  const remainingTakerSpace = (remaining * Math.pow(10, 20) / percentageOddsBN) - remaining;
  
  return remainingTakerSpace;
}

// Get all 1x2 markets for an event
async function get1x2MarketsForEvent(eventId) {
  try {
    const response = await axios.get(`${API_BASE_URL}/markets/active`, {
      params: {
        sportId: SOCCER_SPORT_ID,
        eventId: eventId
      }
    });

    if (response.data.status !== 'success') {
      return null;
    }

    const markets = response.data.data.markets;
    
    // Filter for type 1 (1X2 markets)
    const markets1x2 = markets.filter(m => m.type === 1);
    
    // Organize by outcome type
    const organized = {
      team1: markets1x2.find(m => m.outcomeOneName === m.teamOneName),
      team2: markets1x2.find(m => m.outcomeOneName === m.teamTwoName),
      draw: markets1x2.find(m => m.outcomeOneName === 'Tie')
    };

    return organized;
  } catch (error) {
    console.error('Error fetching markets:', error.message);
    return null;
  }
}

// Get orders for a market with full details
async function getMarketOrders(marketHash) {
  try {
    const response = await axios.get(`${API_BASE_URL}/orders`, {
      params: { marketHashes: marketHash }
    });
    
    if (response.data.status === 'success') {
      return response.data.data;
    }
    return [];
  } catch (error) {
    console.error(`Error fetching orders for ${marketHash}:`, error.message);
    return [];
  }
}

// Organize orders by what the TAKER gets
function organizeOrdersForTaker(orders, market) {
  const organized = {
    betOnOutcomeOne: [],  // Taker bets YES on outcomeOne
    betOnOutcomeTwo: []   // Taker bets YES on outcomeTwo (NO on outcomeOne)
  };

  orders.forEach(order => {
    // Calculate remaining taker space
    const remainingTakerSpaceWei = calculateRemainingTakerSpace(
      order.totalBetSize,
      order.fillAmount,
      order.percentageOdds
    );
    
    const orderDetails = {
      // Order identification
      orderHash: order.orderHash,
      marketHash: order.marketHash,
      
      // What maker is betting
      makerBettingOn: order.isMakerBettingOutcomeOne ? market.outcomeOneName : market.outcomeTwoName,
      makerAddress: order.maker,
      
      // What TAKER gets (opposite of maker)
      takerGets: order.isMakerBettingOutcomeOne ? market.outcomeTwoName : market.outcomeOneName,
      takerBettingOutcomeOne: !order.isMakerBettingOutcomeOne,
      
      // Odds and stake
      oddsDecimal: convertOddsToDecimal(order.percentageOdds),
      oddsWei: order.percentageOdds,
      
      // Maker's stake (from maker's perspective)
      makerStakeUSDC: convertStakeToUSDC(order.totalBetSize),
      makerStakeWei: order.totalBetSize,
      
      // Taker's available space (how much TAKER can bet)
      takerAvailableUSDC: convertStakeToUSDC(remainingTakerSpaceWei.toString()),
      takerAvailableWei: remainingTakerSpaceWei.toString(),
      
      // Fill information
      fillAmount: order.fillAmount,
      fillAmountUSDC: convertStakeToUSDC(order.fillAmount),
      percentageFilled: order.totalBetSize > 0 ? 
        ((parseFloat(order.fillAmount) / parseFloat(order.totalBetSize)) * 100).toFixed(2) : '0.00',
      
      // Token and execution details
      baseToken: order.baseToken,
      executor: order.executor,
      
      // Signature and expiry (needed for filling)
      signature: order.signature,
      salt: order.salt,
      expiry: order.expiry,
      apiExpiry: order.apiExpiry,
      
      // Status
      orderStatus: order.orderStatus,
      sportXeventId: order.sportXeventId,
      
      // Raw order for reference
      rawOrder: order
    };

    // Organize by what TAKER is betting on
    if (order.isMakerBettingOutcomeOne) {
      // Maker bets outcomeOne, so taker gets outcomeTwo
      organized.betOnOutcomeTwo.push(orderDetails);
    } else {
      // Maker bets outcomeTwo, so taker gets outcomeOne
      organized.betOnOutcomeOne.push(orderDetails);
    }
  });

  // Sort by best odds (highest first)
  organized.betOnOutcomeOne.sort((a, b) => parseFloat(b.oddsDecimal) - parseFloat(a.oddsDecimal));
  organized.betOnOutcomeTwo.sort((a, b) => parseFloat(b.oddsDecimal) - parseFloat(a.oddsDecimal));

  return organized;
}

// Display orderbook for a market
function displayMarketOrderbook(market, orders) {
  console.log(`\n${'='.repeat(100)}`);
  console.log(`📊 MARKET: ${market.outcomeOneName} vs ${market.outcomeTwoName}`);
  console.log(`   Event: ${market.teamOneName} vs ${market.teamTwoName}`);
  console.log(`   Market Hash: ${market.marketHash}`);
  console.log(`   League: ${market.leagueLabel}`);
  console.log(`   Game Time: ${new Date(market.gameTime * 1000).toLocaleString()}`);
  console.log(`${'='.repeat(100)}`);

  const organized = organizeOrdersForTaker(orders, market);

  // Display orders for betting YES on outcomeOne
  console.log(`\n🟢 BET YES ON "${market.outcomeOneName}" (${organized.betOnOutcomeOne.length} orders)`);
  console.log(`${'─'.repeat(100)}`);
  
  if (organized.betOnOutcomeOne.length > 0) {
    organized.betOnOutcomeOne.slice(0, 5).forEach((order, idx) => {
      console.log(`\n   ${idx + 1}. Order Hash: ${order.orderHash}`);
      console.log(`      ├─ Taker Gets: ${order.takerGets}`);
      console.log(`      ├─ Odds: ${order.oddsDecimal} (${order.oddsWei} wei)`);
      console.log(`      ├─ 💰 YOU CAN BET: $${order.takerAvailableUSDC} USDC (${order.takerAvailableWei} wei)`);
      console.log(`      ├─ Maker Stake: $${order.makerStakeUSDC} USDC`);
      console.log(`      ├─ Filled: ${order.percentageFilled}% ($${order.fillAmountUSDC} USDC)`);
      console.log(`      ├─ Maker: ${order.makerAddress}`);
      console.log(`      ├─ Base Token: ${order.baseToken}`);
      console.log(`      ├─ Executor: ${order.executor}`);
      console.log(`      ├─ Expiry: ${new Date(order.apiExpiry * 1000).toLocaleString()}`);
      console.log(`      ├─ Status: ${order.orderStatus}`);
      console.log(`      └─ Signature: ${order.signature.substring(0, 20)}...`);
    });
  } else {
    console.log(`   ⚠️  No orders available`);
  }

  // Display orders for betting YES on outcomeTwo (NO on outcomeOne)
  console.log(`\n\n🔴 BET YES ON "${market.outcomeTwoName}" (${organized.betOnOutcomeTwo.length} orders)`);
  console.log(`${'─'.repeat(100)}`);
  
  if (organized.betOnOutcomeTwo.length > 0) {
    organized.betOnOutcomeTwo.slice(0, 5).forEach((order, idx) => {
      console.log(`\n   ${idx + 1}. Order Hash: ${order.orderHash}`);
      console.log(`      ├─ Taker Gets: ${order.takerGets}`);
      console.log(`      ├─ Odds: ${order.oddsDecimal} (${order.oddsWei} wei)`);
      console.log(`      ├─ 💰 YOU CAN BET: $${order.takerAvailableUSDC} USDC (${order.takerAvailableWei} wei)`);
      console.log(`      ├─ Maker Stake: $${order.makerStakeUSDC} USDC`);
      console.log(`      ├─ Filled: ${order.percentageFilled}% ($${order.fillAmountUSDC} USDC)`);
      console.log(`      ├─ Maker: ${order.makerAddress}`);
      console.log(`      ├─ Base Token: ${order.baseToken}`);
      console.log(`      ├─ Executor: ${order.executor}`);
      console.log(`      ├─ Expiry: ${new Date(order.apiExpiry * 1000).toLocaleString()}`);
      console.log(`      ├─ Status: ${order.orderStatus}`);
      console.log(`      └─ Signature: ${order.signature.substring(0, 20)}...`);
    });
  } else {
    console.log(`   ⚠️  No orders available`);
  }

  return organized;
}

// Display complete 1x2 orderbook
async function displayComplete1x2Orderbook(eventId) {
  console.log(`\n${'█'.repeat(100)}`);
  console.log(`🎯 FETCHING COMPLETE 1X2 ORDERBOOK FOR EVENT: ${eventId}`);
  console.log(`${'█'.repeat(100)}`);

  const markets = await get1x2MarketsForEvent(eventId);
  
  if (!markets) {
    console.log('\n❌ Could not fetch markets');
    return;
  }

  const orderbookData = {
    eventId: eventId,
    team1: null,
    team2: null,
    draw: null
  };

  // Fetch and display Team 1 market
  if (markets.team1) {
    console.log(`\n\n🏠 TEAM 1 MARKET: ${markets.team1.teamOneName}`);
    const orders = await getMarketOrders(markets.team1.marketHash);
    orderbookData.team1 = {
      market: markets.team1,
      orders: displayMarketOrderbook(markets.team1, orders)
    };
  }

  // Fetch and display Team 2 market
  if (markets.team2) {
    console.log(`\n\n✈️  TEAM 2 MARKET: ${markets.team2.teamTwoName}`);
    const orders = await getMarketOrders(markets.team2.marketHash);
    orderbookData.team2 = {
      market: markets.team2,
      orders: displayMarketOrderbook(markets.team2, orders)
    };
  }

  // Fetch and display Draw market
  if (markets.draw) {
    console.log(`\n\n🤝 DRAW MARKET`);
    const orders = await getMarketOrders(markets.draw.marketHash);
    orderbookData.draw = {
      market: markets.draw,
      orders: displayMarketOrderbook(markets.draw, orders)
    };
  }

  console.log(`\n\n${'█'.repeat(100)}`);
  console.log(`✅ ORDERBOOK FETCH COMPLETE`);
  console.log(`${'█'.repeat(100)}\n`);

  return orderbookData;
}

// Subscribe to live orderbook updates
async function subscribeLiveOrderbook(realtime, eventId) {
  const markets = await get1x2MarketsForEvent(eventId);
  
  if (!markets) {
    console.log('❌ Could not fetch markets for subscription');
    return;
  }

  console.log(`\n📡 Subscribing to live orderbook updates...\n`);

  const marketHashes = [
    markets.team1?.marketHash,
    markets.team2?.marketHash,
    markets.draw?.marketHash
  ].filter(Boolean);

  for (const marketHash of marketHashes) {
    const channel = realtime.channels.get(`order_book:${marketHash}`);
    
    channel.subscribe(async (message) => {
      console.log(`\n🔔 ORDER BOOK UPDATE at ${new Date().toLocaleTimeString()}`);
      console.log(`   Market: ${marketHash}`);
      
      // Refetch orders for this market
      const orders = await getMarketOrders(marketHash);
      const market = [markets.team1, markets.team2, markets.draw].find(m => m?.marketHash === marketHash);
      
      if (market) {
        console.log(`   Updated orders: ${orders.length}`);
        // You can display the updated orderbook here if needed
      }
    });
    
    console.log(`✅ Subscribed to: ${marketHash.substring(0, 20)}...`);
  }
}

// Main function
async function main() {
  try {
    console.log('🚀 SX.bet Live Orderbook Viewer\n');
    
    // Get today's first soccer match
    const response = await axios.get(`${API_BASE_URL}/markets/active`, {
      params: {
        sportId: SOCCER_SPORT_ID,
        betGroup: '1X2'
      }
    });

    if (response.data.status !== 'success' || response.data.data.markets.length === 0) {
      console.log('❌ No soccer 1x2 markets found');
      return;
    }

    const firstMarket = response.data.data.markets[0];
    const eventId = firstMarket.sportXeventId;

    console.log(`📍 Selected Event: ${firstMarket.teamOneName} vs ${firstMarket.teamTwoName}`);
    console.log(`   Event ID: ${eventId}\n`);

    // Display complete orderbook
    const orderbookData = await displayComplete1x2Orderbook(eventId);

    // Initialize Ably for live updates
    console.log(`\n📡 Initializing live updates...`);
    const realtime = await initializeAbly();
    
    await subscribeLiveOrderbook(realtime, eventId);

    console.log(`\n✅ Live orderbook monitoring active. Press Ctrl+C to stop.\n`);

    // Keep process running
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

// Run
if (require.main === module) {
  main();
}

module.exports = {
  get1x2MarketsForEvent,
  getMarketOrders,
  organizeOrdersForTaker,
  displayComplete1x2Orderbook,
  convertOddsToDecimal,
  convertStakeToUSDC,
  calculateRemainingTakerSpace
};
