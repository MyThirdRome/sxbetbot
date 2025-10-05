require('dotenv').config();
const axios = require('axios');
const Ably = require('ably');

/**
 * REAL-TIME ARBITRAGE SCANNER FOR SX.BET
 * =======================================
 * 
 * Uses Ably websockets for INSTANT updates when orders change.
 * Checks for arbitrage immediately when any order is added/filled/cancelled.
 * 
 * Much faster than polling - detects opportunities in milliseconds!
 */

const API_BASE = 'https://api.sx.bet';
const USDC_ADDRESS = '0x6629Ce1Cf35Cc1329ebB4F63202F3f197b3F050B';

// CONFIGURATION
const MIN_PROFIT_PERCENT = parseFloat(process.env.MIN_PROFIT_PERCENT || '0.5');
const MIN_ORDER_SIZE_USDC = parseFloat(process.env.MIN_ORDER_SIZE_USDC || '1');
const VERBOSE = process.argv.includes('--verbose') || process.argv.includes('-v') || process.env.VERBOSE === 'true';

// State
const markets = new Map(); // marketHash -> market data
const bestOdds = new Map(); // marketHash -> { yesOdds, noOdds }
const eventMarkets = new Map(); // eventId -> { team1, team2, tie }
let totalChecks = 0;
let totalOpportunitiesFound = 0;
let totalUpdates = 0;
let realtime = null;

async function initialize() {
  console.log('🚀 REAL-TIME ARBITRAGE SCANNER FOR SX.BET\n');
  console.log('='.repeat(70));
  console.log('📊 Using Ably websockets for INSTANT updates');
  console.log('⏰ Started:', new Date().toLocaleString());
  console.log(`💰 Minimum Profit Threshold: ${MIN_PROFIT_PERCENT}%`);
  console.log(`📏 Minimum Order Size: ${MIN_ORDER_SIZE_USDC} USDC`);
  console.log(`📢 Verbose Mode: ${VERBOSE ? 'ON (showing all updates)' : 'OFF (use --verbose to enable)'}`);
  console.log('='.repeat(70) + '\n');
}

async function fetchAllSoccerMarkets() {
  console.log('⚽ Fetching all active soccer 1X2 markets...');
  
  try {
    const response = await axios.get(`${API_BASE}/markets/active`, {
      params: {
        sportIds: 5,
        onlyMainLine: true
      }
    });
    
    const allMarkets = response.data.data.markets;
    const eventMap = {};
    
    for (const market of allMarkets) {
      if (market.type !== 1) continue; // Only 1X2 markets
      
      const eventId = market.sportXeventId;
      
      if (!eventMap[eventId]) {
        eventMap[eventId] = {
          eventId,
          teamOneName: market.teamOneName,
          teamTwoName: market.teamTwoName,
          leagueLabel: market.leagueLabel,
          markets: {}
        };
      }
      
      const outcome1 = market.outcomeOneName.toLowerCase();
      
      if (outcome1.includes(market.teamOneName.toLowerCase())) {
        eventMap[eventId].markets.team1 = market;
        markets.set(market.marketHash, market);
      } else if (outcome1.includes(market.teamTwoName.toLowerCase())) {
        eventMap[eventId].markets.team2 = market;
        markets.set(market.marketHash, market);
      } else if (outcome1.includes('draw') || outcome1.includes('tie') || outcome1 === 'x') {
        eventMap[eventId].markets.tie = market;
        markets.set(market.marketHash, market);
      }
    }
    
    // Filter complete events
    const completeEvents = {};
    for (const eventId in eventMap) {
      const event = eventMap[eventId];
      if (event.markets.team1 && event.markets.team2 && event.markets.tie) {
        completeEvents[eventId] = event;
        eventMarkets.set(eventId, event);
      }
    }
    
    console.log(`✅ Found ${Object.keys(completeEvents).length} complete 1X2 events\n`);
    
    return completeEvents;
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
    return { yesOdds: null, noOdds: null };
  }
  
  let bestYesOdds = null;
  let bestNoOdds = null;
  
  for (const order of orders) {
    const makerOdds = parseFloat(order.percentageOdds) / 1e20;
    const decimalOdds = 1 / makerOdds;
    
    const fillAmount = BigInt(order.fillAmount || '0');
    const totalSize = BigInt(order.totalBetSize);
    const available = totalSize - fillAmount;
    const minSize = BigInt(Math.floor(MIN_ORDER_SIZE_USDC * 1000000).toString());
    
    if (available < minSize) continue;
    
    if (order.isMakerBettingOutcomeOne) {
      if (!bestNoOdds || decimalOdds > bestNoOdds) {
        bestNoOdds = decimalOdds;
      }
    } else {
      if (!bestYesOdds || decimalOdds > bestYesOdds) {
        bestYesOdds = decimalOdds;
      }
    }
  }
  
  return { yesOdds: bestYesOdds, noOdds: bestNoOdds };
}

async function updateMarketOdds(marketHash) {
  const orders = await fetchOrdersForMarket(marketHash);
  const odds = calculateBestOdds(orders);
  bestOdds.set(marketHash, odds);
  return odds;
}

function checkArbitrageForEvent(eventId, showDetails = false) {
  totalChecks++;
  
  const event = eventMarkets.get(eventId);
  if (!event) return null;
  
  const team1Odds = bestOdds.get(event.markets.team1.marketHash);
  const team2Odds = bestOdds.get(event.markets.team2.marketHash);
  const tieOdds = bestOdds.get(event.markets.tie.marketHash);
  
  if (!team1Odds || !team2Odds || !tieOdds) return null;
  
  if (showDetails || VERBOSE) {
    console.log(`\n   📊 ${event.teamOneName} vs ${event.teamTwoName}`);
    console.log(`      Team1 YES: ${team1Odds.yesOdds ? team1Odds.yesOdds.toFixed(2) : 'N/A'} | NO: ${team1Odds.noOdds ? team1Odds.noOdds.toFixed(2) : 'N/A'}`);
    console.log(`      Tie YES: ${tieOdds.yesOdds ? tieOdds.yesOdds.toFixed(2) : 'N/A'} | NO: ${tieOdds.noOdds ? tieOdds.noOdds.toFixed(2) : 'N/A'}`);
    console.log(`      Team2 YES: ${team2Odds.yesOdds ? team2Odds.yesOdds.toFixed(2) : 'N/A'} | NO: ${team2Odds.noOdds ? team2Odds.noOdds.toFixed(2) : 'N/A'}`);
  }
  
  const opportunities = [];
  
  // Type 1: YES + YES + YES
  if (team1Odds.yesOdds && tieOdds.yesOdds && team2Odds.yesOdds) {
    const arbValue = (1 / team1Odds.yesOdds) + (1 / tieOdds.yesOdds) + (1 / team2Odds.yesOdds);
    const profitPercent = ((1 / arbValue) - 1) * 100;
    
    if (showDetails || VERBOSE) {
      const status = arbValue < 1.0 ? (profitPercent >= MIN_PROFIT_PERCENT ? '✅ ARB!' : '⚠️ ARB (below threshold)') : '❌';
      console.log(`      Type 1: ${arbValue.toFixed(4)} ${status}`);
    }
    
    if (arbValue < 1.0 && profitPercent >= MIN_PROFIT_PERCENT) {
      opportunities.push({
        type: 'TYPE 1: YES + YES + YES',
        event,
        combination: `${event.teamOneName} YES + Tie YES + ${event.teamTwoName} YES`,
        team1Odds: team1Odds.yesOdds,
        tieOdds: tieOdds.yesOdds,
        team2Odds: team2Odds.yesOdds,
        arbValue,
        profit: profitPercent,
        timestamp: new Date()
      });
    }
  }
  
  // Type 2: NO + YES + NO
  if (team1Odds.noOdds && tieOdds.yesOdds && team2Odds.noOdds) {
    const arbValue = (1 / team1Odds.noOdds) + (1 / tieOdds.yesOdds) + (1 / team2Odds.noOdds);
    const profitPercent = ((1 / arbValue) - 1) * 100;
    
    if (showDetails || VERBOSE) {
      const status = arbValue < 1.0 ? (profitPercent >= MIN_PROFIT_PERCENT ? '✅ ARB!' : '⚠️ ARB (below threshold)') : '❌';
      console.log(`      Type 2: ${arbValue.toFixed(4)} ${status}`);
    }
    
    if (arbValue < 1.0 && profitPercent >= MIN_PROFIT_PERCENT) {
      opportunities.push({
        type: 'TYPE 2: NO + YES + NO',
        event,
        combination: `${event.teamOneName} NO + Tie YES + ${event.teamTwoName} NO`,
        team1Odds: team1Odds.noOdds,
        tieOdds: tieOdds.yesOdds,
        team2Odds: team2Odds.noOdds,
        arbValue,
        profit: profitPercent,
        timestamp: new Date()
      });
    }
  }
  
  return opportunities;
}

function displayOpportunity(opp) {
  console.log('\n' + '🎉'.repeat(35));
  console.log('💰 ARBITRAGE OPPORTUNITY FOUND! 💰');
  console.log('🎉'.repeat(35) + '\n');
  
  console.log(`⏰ Time: ${opp.timestamp.toLocaleTimeString()}`);
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
  
  console.log(`📋 Market Hashes:`);
  console.log(`   Team1: ${opp.event.markets.team1.marketHash}`);
  console.log(`   Tie: ${opp.event.markets.tie.marketHash}`);
  console.log(`   Team2: ${opp.event.markets.team2.marketHash}\n`);
  
  console.log('='.repeat(70) + '\n');
}

async function connectWebsocket(eventMap) {
  console.log('🔌 Connecting to Ably websocket...\n');
  
  try {
    realtime = new Ably.Realtime({
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
      setTimeout(() => reject(new Error('Connection timeout')), 10000);
    });
    
    console.log('✅ Connected to Ably websocket\n');
    
    // Subscribe to order book updates for all markets
    let subscribedCount = 0;
    
    for (const [eventId, event] of eventMarkets.entries()) {
      const marketHashes = [
        event.markets.team1.marketHash,
        event.markets.team2.marketHash,
        event.markets.tie.marketHash
      ];
      
      for (const marketHash of marketHashes) {
        const channel = realtime.channels.get(`order_book_v2:${USDC_ADDRESS}:${marketHash}`);
        
        channel.subscribe(async (message) => {
          totalUpdates++;
          
          // Get market info
          const market = markets.get(marketHash);
          const marketName = market ? `${market.outcomeOneName} vs ${market.outcomeTwoName}` : marketHash.substring(0, 10);
          
          if (VERBOSE) {
            console.log(`\n🔔 [${new Date().toLocaleTimeString()}] Order update: ${marketName}`);
          }
          
          // Order book changed - recalculate odds
          await updateMarketOdds(marketHash);
          
          // Check for arbitrage
          const opportunities = checkArbitrageForEvent(eventId, VERBOSE);
          
          if (opportunities && opportunities.length > 0) {
            totalOpportunitiesFound += opportunities.length;
            
            for (const opp of opportunities) {
              displayOpportunity(opp);
            }
            
            console.log(`📊 Total updates: ${totalUpdates} | Checks: ${totalChecks} | Opportunities: ${totalOpportunitiesFound}\n`);
          } else if (VERBOSE) {
            console.log(`   ✓ No arbitrage (Updates: ${totalUpdates}, Checks: ${totalChecks})`);
          }
        });
        
        subscribedCount++;
      }
    }
    
    console.log(`📡 Subscribed to ${subscribedCount} market channels`);
    console.log(`🔔 Listening for real-time order updates...\n`);
    console.log('='.repeat(70) + '\n');
    
    // Initial odds fetch for all markets
    console.log('📊 Fetching initial odds for all markets...\n');
    
    for (const [eventId, event] of eventMarkets.entries()) {
      await updateMarketOdds(event.markets.team1.marketHash);
      await updateMarketOdds(event.markets.team2.marketHash);
      await updateMarketOdds(event.markets.tie.marketHash);
      
      // Check for arbitrage on initial load
      const opportunities = checkArbitrageForEvent(eventId, true); // Show details on initial load
      
      if (opportunities && opportunities.length > 0) {
        totalOpportunitiesFound += opportunities.length;
        
        for (const opp of opportunities) {
          displayOpportunity(opp);
        }
      }
    }
    
    console.log('\n✅ Initial odds loaded. Monitoring for changes...\n');
    console.log('💡 Arbitrage will be detected INSTANTLY when orders change!\n');
    
    if (VERBOSE) {
      console.log('📢 Verbose mode: Showing all order updates and calculations\n');
    } else {
      console.log('💡 Tip: Use --verbose flag to see all order updates\n');
    }
    
    console.log('Press Ctrl+C to stop\n');
    console.log('='.repeat(70) + '\n');
    
    return realtime;
  } catch (error) {
    console.error('❌ Failed to connect to websocket:', error.message);
    return null;
  }
}

async function main() {
  await initialize();
  
  // Fetch all markets
  const eventMap = await fetchAllSoccerMarkets();
  
  if (Object.keys(eventMap).length === 0) {
    console.log('❌ No complete 1X2 events found. Exiting...\n');
    process.exit(1);
  }
  
  // Connect to websocket for real-time updates
  await connectWebsocket(eventMap);
  
  // Keep alive
  setInterval(() => {
    const now = new Date();
    console.log(`⏰ ${now.toLocaleTimeString()} - Still monitoring... (Updates: ${totalUpdates}, Checks: ${totalChecks}, Opportunities: ${totalOpportunitiesFound})`);
  }, 60000); // Status update every minute
}

// Handle graceful shutdown
process.on('SIGINT', () => {
  console.log('\n\n👋 Shutting down real-time arbitrage scanner...');
  console.log(`   Total order updates received: ${totalUpdates}`);
  console.log(`   Total checks performed: ${totalChecks}`);
  console.log(`   Total arbitrage opportunities found: ${totalOpportunitiesFound}`);
  
  if (realtime) {
    realtime.close();
  }
  
  console.log('');
  process.exit(0);
});

main();
