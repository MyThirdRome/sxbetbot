require('dotenv').config();
const axios = require('axios');
const Ably = require('ably');

/**
 * LIVE ARBITRAGE SCANNER FOR SX.BET
 * ==================================
 * 
 * Continuously monitors all today's soccer 1X2 markets for arbitrage opportunities.
 * 
 * Arbitrage Detection:
 * 1. Team1 Yes + Tie Yes + Team2 Yes < 1.0 = ARBITRAGE
 * 2. Team1 No + Tie Yes + Team2 No < 1.0 = ARBITRAGE
 * 
 * Formula: 1/Odd1 + 1/Odd2 + 1/Odd3 < 1.0
 */

const API_BASE = 'https://api.sx.bet';
const USDC_ADDRESS = '0x6629Ce1Cf35Cc1329ebB4F63202F3f197b3F050B';

// Store market data
const markets = new Map();
const bestOdds = new Map();

async function initialize() {
  console.log('🚀 LIVE ARBITRAGE SCANNER FOR SX.BET\n');
  console.log('='.repeat(70));
  console.log('📊 Monitoring all soccer 1X2 markets for arbitrage opportunities...');
  console.log('⏰ Started:', new Date().toLocaleString());
  console.log('='.repeat(70) + '\n');
}

async function fetchAllSoccerMarkets() {
  console.log('⚽ Fetching all active soccer 1X2 markets...');
  
  try {
    const response = await axios.get(`${API_BASE}/markets/active`, {
      params: {
        sportIds: 5, // Soccer
        onlyMainLine: true
      }
    });
    
    const allMarkets = response.data.data.markets;
    
    // Group by event and filter for 1X2 markets
    const eventMap = {};
    
    for (const market of allMarkets) {
      // 1X2 market types: 1 (1X2), 52 (12), 226 (12 Including Overtime)
      if (market.type === 1 || market.type === 52 || market.type === 226) {
        const eventId = market.sportXEventId;
        
        if (!eventMap[eventId]) {
          eventMap[eventId] = {
            eventId,
            teamOneName: market.teamOneName,
            teamTwoName: market.teamTwoName,
            leagueLabel: market.leagueLabel,
            gameTime: market.gameTime,
            markets: []
          };
        }
        
        eventMap[eventId].markets.push(market);
        markets.set(market.marketHash, market);
      }
    }
    
    const eventCount = Object.keys(eventMap).length;
    const marketCount = allMarkets.filter(m => m.type === 1 || m.type === 52 || m.type === 226).length;
    
    console.log(`✅ Found ${eventCount} soccer events with ${marketCount} 1X2 markets\n`);
    
    return eventMap;
  } catch (error) {
    console.error('❌ Error fetching markets:', error.message);
    return {};
  }
}

async function fetchOrdersForMarket(marketHash) {
  try {
    const response = await axios.get(`${API_BASE}/orders`, {
      params: {
        marketHashes: marketHash,
        baseToken: USDC_ADDRESS
      }
    });
    
    return response.data.data || [];
  } catch (error) {
    return [];
  }
}

function calculateBestOdds(orders) {
  if (!orders || orders.length === 0) {
    return { team1: null, team2: null };
  }
  
  let bestTeam1Odds = null;
  let bestTeam2Odds = null;
  
  for (const order of orders) {
    const makerOdds = parseFloat(order.percentageOdds) / 1e20;
    const decimalOdds = 1 / makerOdds;
    
    // Check if order has enough size (at least 5 USDC)
    const fillAmount = BigInt(order.fillAmount || '0');
    const totalSize = BigInt(order.totalBetSize);
    const available = totalSize - fillAmount;
    const minSize = BigInt('5000000'); // 5 USDC
    
    if (available < minSize) continue;
    
    if (order.isMakerBettingOutcomeOne) {
      // Taker bets on Team 2
      if (!bestTeam2Odds || decimalOdds > bestTeam2Odds) {
        bestTeam2Odds = decimalOdds;
      }
    } else {
      // Taker bets on Team 1
      if (!bestTeam1Odds || decimalOdds > bestTeam1Odds) {
        bestTeam1Odds = decimalOdds;
      }
    }
  }
  
  return { team1: bestTeam1Odds, team2: bestTeam2Odds };
}

async function scanAllMarkets(eventMap) {
  console.log('🔍 Scanning all markets for best odds...\n');
  
  const eventIds = Object.keys(eventMap);
  let scannedCount = 0;
  
  for (const eventId of eventIds) {
    const event = eventMap[eventId];
    
    // For each market in the event, fetch orders
    for (const market of event.markets) {
      const orders = await fetchOrdersForMarket(market.marketHash);
      const odds = calculateBestOdds(orders);
      
      bestOdds.set(market.marketHash, {
        marketHash: market.marketHash,
        eventId: event.eventId,
        teamOneName: event.teamOneName,
        teamTwoName: event.teamTwoName,
        leagueLabel: event.leagueLabel,
        outcomeOneName: market.outcomeOneName,
        outcomeTwoName: market.outcomeTwoName,
        team1Odds: odds.team1,
        team2Odds: odds.team2,
        lastUpdate: Date.now()
      });
      
      scannedCount++;
    }
    
    // Small delay to avoid rate limiting
    await new Promise(resolve => setTimeout(resolve, 100));
  }
  
  console.log(`✅ Scanned ${scannedCount} markets\n`);
}

function detectArbitrage() {
  console.log('🎯 Checking for arbitrage opportunities...\n');
  
  // Group odds by event
  const eventOdds = {};
  
  for (const [marketHash, data] of bestOdds.entries()) {
    const eventId = data.eventId;
    
    if (!eventOdds[eventId]) {
      eventOdds[eventId] = {
        eventId,
        teamOneName: data.teamOneName,
        teamTwoName: data.teamTwoName,
        leagueLabel: data.leagueLabel,
        markets: {}
      };
    }
    
    // Identify market type by outcome names
    const outcome1 = data.outcomeOneName.toLowerCase();
    const outcome2 = data.outcomeTwoName.toLowerCase();
    
    // Determine if this is Team1, Team2, or Tie market
    if (outcome1.includes(data.teamOneName.toLowerCase()) || outcome1.includes('home')) {
      // This is a Team1 vs Team2 market (or similar)
      eventOdds[eventId].markets.team1_team2 = {
        team1Odds: data.team1Odds,
        team2Odds: data.team2Odds,
        marketHash
      };
    } else if (outcome1.includes('draw') || outcome1.includes('tie') || outcome1.includes('x')) {
      // This is a Tie market
      eventOdds[eventId].markets.tie = {
        tieYesOdds: data.team1Odds, // Betting on tie
        tieNoOdds: data.team2Odds,  // Betting against tie
        marketHash
      };
    }
  }
  
  // Check for arbitrage opportunities
  const opportunities = [];
  
  for (const eventId in eventOdds) {
    const event = eventOdds[eventId];
    const markets = event.markets;
    
    // Need at least team1_team2 market
    if (!markets.team1_team2) continue;
    
    const team1Odds = markets.team1_team2.team1Odds;
    const team2Odds = markets.team1_team2.team2Odds;
    
    // For 1X2 markets, we need to check if we have separate markets for each outcome
    // In sx.bet, 1X2 might be structured differently
    // Let's check what we have
    
    if (team1Odds && team2Odds) {
      // Check if we have tie odds
      if (markets.tie && markets.tie.tieYesOdds) {
        const tieOdds = markets.tie.tieYesOdds;
        
        // Arbitrage check 1: Team1 Yes + Tie Yes + Team2 Yes < 1.0
        const arbValue1 = (1 / team1Odds) + (1 / tieOdds) + (1 / team2Odds);
        
        if (arbValue1 < 1.0) {
          opportunities.push({
            type: 'ARBITRAGE TYPE 1',
            event,
            combination: 'Team1 YES + Tie YES + Team2 YES',
            team1Odds,
            tieOdds,
            team2Odds,
            arbValue: arbValue1,
            profit: ((1 / arbValue1) - 1) * 100
          });
        }
        
        // Arbitrage check 2: Team1 No + Tie Yes + Team2 No < 1.0
        // Team1 No = Team2 or Tie, Team2 No = Team1 or Tie
        // This is more complex and might not be directly available
      }
    }
  }
  
  return opportunities;
}

function displayOpportunity(opp) {
  console.log('\n' + '🎉'.repeat(35));
  console.log('💰 ARBITRAGE OPPORTUNITY FOUND! 💰');
  console.log('🎉'.repeat(35) + '\n');
  
  console.log(`📍 Match: ${opp.event.teamOneName} vs ${opp.event.teamTwoName}`);
  console.log(`🏆 League: ${opp.event.leagueLabel}`);
  console.log(`📊 Type: ${opp.type}`);
  console.log(`🎯 Combination: ${opp.combination}\n`);
  
  console.log(`📈 Odds:`);
  console.log(`   ${opp.event.teamOneName}: ${opp.team1Odds.toFixed(2)}x`);
  console.log(`   Tie/Draw: ${opp.tieOdds.toFixed(2)}x`);
  console.log(`   ${opp.event.teamTwoName}: ${opp.team2Odds.toFixed(2)}x\n`);
  
  console.log(`🔢 Arbitrage Calculation:`);
  console.log(`   1/${opp.team1Odds.toFixed(2)} + 1/${opp.tieOdds.toFixed(2)} + 1/${opp.team2Odds.toFixed(2)}`);
  console.log(`   = ${(1/opp.team1Odds).toFixed(4)} + ${(1/opp.tieOdds).toFixed(4)} + ${(1/opp.team2Odds).toFixed(4)}`);
  console.log(`   = ${opp.arbValue.toFixed(4)} < 1.0 ✅\n`);
  
  console.log(`💵 Profit Margin: ${opp.profit.toFixed(2)}%\n`);
  
  // Calculate stake distribution for $100 total
  const totalStake = 100;
  const stake1 = (totalStake / opp.team1Odds) / opp.arbValue;
  const stake2 = (totalStake / opp.tieOdds) / opp.arbValue;
  const stake3 = (totalStake / opp.team2Odds) / opp.arbValue;
  const guaranteedReturn = totalStake / opp.arbValue;
  const guaranteedProfit = guaranteedReturn - totalStake;
  
  console.log(`💰 Stake Distribution (for $${totalStake} total):`);
  console.log(`   Bet on ${opp.event.teamOneName}: $${stake1.toFixed(2)}`);
  console.log(`   Bet on Tie/Draw: $${stake2.toFixed(2)}`);
  console.log(`   Bet on ${opp.event.teamTwoName}: $${stake3.toFixed(2)}`);
  console.log(`   Total Staked: $${(stake1 + stake2 + stake3).toFixed(2)}\n`);
  
  console.log(`✅ Guaranteed Return: $${guaranteedReturn.toFixed(2)}`);
  console.log(`✅ Guaranteed Profit: $${guaranteedProfit.toFixed(2)}\n`);
  
  console.log('='.repeat(70) + '\n');
}

async function connectWebsocket() {
  console.log('🔌 Connecting to Ably websocket for live updates...\n');
  
  try {
    const tokenResponse = await axios.get(`${API_BASE}/user/token`, {
      headers: {
        'X-Api-Key': process.env.SX_BET_API_KEY
      }
    });
    
    const realtime = new Ably.Realtime({
      authCallback: async (tokenParams, callback) => {
        try {
          const tokenRequest = await axios.get(`${API_BASE}/user/token`, {
            headers: {
              'X-Api-Key': process.env.SX_BET_API_KEY
            }
          });
          callback(null, tokenRequest.data);
        } catch (error) {
          callback(error, null);
        }
      }
    });
    
    await new Promise((resolve, reject) => {
      realtime.connection.once('connected', resolve);
      realtime.connection.once('failed', reject);
    });
    
    console.log('✅ Connected to Ably websocket\n');
    
    // Subscribe to order book updates for all markets
    for (const [marketHash, market] of markets.entries()) {
      const channel = realtime.channels.get(`order_book_v2:${USDC_ADDRESS}:${marketHash}`);
      
      channel.subscribe((message) => {
        // Update odds when orders change
        updateMarketOdds(marketHash, message.data);
      });
    }
    
    console.log(`📡 Subscribed to ${markets.size} market channels\n`);
    
    return realtime;
  } catch (error) {
    console.error('❌ Failed to connect to websocket:', error.message);
    return null;
  }
}

function updateMarketOdds(marketHash, orderUpdates) {
  // This will be called when orders change
  // We'll recalculate best odds and check for arbitrage
  
  // For now, we'll do periodic full scans
  // Real-time updates would require more complex state management
}

async function main() {
  await initialize();
  
  // Initial scan
  const eventMap = await fetchAllSoccerMarkets();
  await scanAllMarkets(eventMap);
  
  // Check for arbitrage
  let opportunities = detectArbitrage();
  
  if (opportunities.length > 0) {
    console.log(`🎉 Found ${opportunities.length} arbitrage opportunity(ies)!\n`);
    
    for (const opp of opportunities) {
      displayOpportunity(opp);
    }
  } else {
    console.log('⏳ No arbitrage opportunities found yet. Starting continuous monitoring...\n');
    
    // Connect to websocket for live updates
    const realtime = await connectWebsocket();
    
    // Periodic re-scan every 30 seconds
    setInterval(async () => {
      console.log(`⏰ ${new Date().toLocaleTimeString()} - Re-scanning markets...`);
      
      const eventMap = await fetchAllSoccerMarkets();
      await scanAllMarkets(eventMap);
      
      opportunities = detectArbitrage();
      
      if (opportunities.length > 0) {
        console.log(`\n🎉 Found ${opportunities.length} arbitrage opportunity(ies)!\n`);
        
        for (const opp of opportunities) {
          displayOpportunity(opp);
        }
        
        // Exit after finding first opportunity
        process.exit(0);
      } else {
        console.log('   No arbitrage found. Continuing to monitor...\n');
      }
    }, 30000); // Every 30 seconds
  }
}

// Handle graceful shutdown
process.on('SIGINT', () => {
  console.log('\n\n👋 Shutting down arbitrage scanner...');
  process.exit(0);
});

main();
