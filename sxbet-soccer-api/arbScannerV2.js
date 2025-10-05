require('dotenv').config();
const axios = require('axios');

/**
 * LIVE ARBITRAGE SCANNER FOR SX.BET V2
 * =====================================
 * 
 * Continuously monitors all today's soccer markets for arbitrage opportunities.
 * 
 * In sx.bet, 1X2 markets are structured as binary markets:
 * - Market 1: Team1 vs Not Team1 (Not Team1 = Team2 OR Tie)
 * - Market 2: Team2 vs Not Team2 (Not Team2 = Team1 OR Tie)
 * - Market 3: Tie vs Not Tie (Not Tie = Team1 OR Team2)
 * 
 * Arbitrage Detection:
 * 1. Team1 YES + Tie YES + Team2 YES < 1.0 = ARBITRAGE
 * 2. Team1 NO + Tie YES + Team2 NO < 1.0 = ARBITRAGE
 * 
 * Formula: 1/Odd1 + 1/Odd2 + 1/Odd3 < 1.0
 */

const API_BASE = 'https://api.sx.bet';
const USDC_ADDRESS = '0x6629Ce1Cf35Cc1329ebB4F63202F3f197b3F050B';

// CONFIGURATION
const MIN_PROFIT_PERCENT = parseFloat(process.env.MIN_PROFIT_PERCENT || '0.5'); // Minimum 0.5% profit by default
const MIN_ORDER_SIZE_USDC = parseFloat(process.env.MIN_ORDER_SIZE_USDC || '1'); // Minimum 1 USDC per order
const KEEP_RUNNING = process.env.KEEP_RUNNING === 'true' || process.argv.includes('--keep-running'); // Keep running after finding arbitrage

let scanCount = 0;
let lastScanTime = null;
let totalOpportunitiesFound = 0;

async function initialize() {
  console.log('🚀 LIVE ARBITRAGE SCANNER FOR SX.BET V2\n');
  console.log('='.repeat(70));
  console.log('📊 Monitoring all soccer markets for arbitrage opportunities...');
  console.log('⏰ Started:', new Date().toLocaleString());
  console.log(`💰 Minimum Profit Threshold: ${MIN_PROFIT_PERCENT}%`);
  console.log(`📏 Minimum Order Size: ${MIN_ORDER_SIZE_USDC} USDC`);
  console.log(`🔄 Keep Running: ${KEEP_RUNNING ? 'YES (will continue after finding arbitrage)' : 'NO (will exit after first find)'}`);
  console.log('='.repeat(70) + '\n');
}

async function fetchAllSoccerMarkets() {
  try {
    const response = await axios.get(`${API_BASE}/markets/active`, {
      params: {
        sportIds: 5, // Soccer
        onlyMainLine: true
      }
    });
    
    const allMarkets = response.data.data.markets;
    
    // Group by event
    const eventMap = {};
    
    for (const market of allMarkets) {
      // Only process type 1 (1X2) markets
      if (market.type !== 1) continue;
      
      const eventId = market.sportXeventId;
      
      if (!eventMap[eventId]) {
        eventMap[eventId] = {
          eventId,
          teamOneName: market.teamOneName,
          teamTwoName: market.teamTwoName,
          leagueLabel: market.leagueLabel,
          gameTime: market.gameTime,
          markets: {}
        };
      }
      
      // Identify market type by outcome names
      const outcome1 = market.outcomeOneName.toLowerCase();
      const outcome2 = market.outcomeTwoName.toLowerCase();
      
      if (outcome1.includes(market.teamOneName.toLowerCase())) {
        // Team1 vs Not Team1
        eventMap[eventId].markets.team1 = market;
      } else if (outcome1.includes(market.teamTwoName.toLowerCase())) {
        // Team2 vs Not Team2
        eventMap[eventId].markets.team2 = market;
      } else if (outcome1.includes('draw') || outcome1.includes('tie') || outcome1 === 'x') {
        // Tie vs Not Tie
        eventMap[eventId].markets.tie = market;
      }
    }
    
    // Filter events that have all 3 markets
    const completeEvents = {};
    for (const eventId in eventMap) {
      const event = eventMap[eventId];
      if (event.markets.team1 && event.markets.team2 && event.markets.tie) {
        completeEvents[eventId] = event;
      }
    }
    
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
    
    // Check if order has enough size
    const fillAmount = BigInt(order.fillAmount || '0');
    const totalSize = BigInt(order.totalBetSize);
    const available = totalSize - fillAmount;
    const minSize = BigInt(Math.floor(MIN_ORDER_SIZE_USDC * 1000000).toString()); // Convert USDC to wei
    
    if (available < minSize) continue;
    
    if (order.isMakerBettingOutcomeOne) {
      // Taker bets on Outcome TWO (NO)
      if (!bestNoOdds || decimalOdds > bestNoOdds) {
        bestNoOdds = decimalOdds;
      }
    } else {
      // Taker bets on Outcome ONE (YES)
      if (!bestYesOdds || decimalOdds > bestYesOdds) {
        bestYesOdds = decimalOdds;
      }
    }
  }
  
  return { yesOdds: bestYesOdds, noOdds: bestNoOdds };
}

async function scanEventForArbitrage(event, verbose = false) {
  // Fetch orders for all 3 markets
  const team1Orders = await fetchOrdersForMarket(event.markets.team1.marketHash);
  const team2Orders = await fetchOrdersForMarket(event.markets.team2.marketHash);
  const tieOrders = await fetchOrdersForMarket(event.markets.tie.marketHash);
  
  const team1Odds = calculateBestOdds(team1Orders);
  const team2Odds = calculateBestOdds(team2Orders);
  const tieOdds = calculateBestOdds(tieOrders);
  
  if (verbose) {
    console.log(`\n   📊 ${event.teamOneName} vs ${event.teamTwoName}`);
    console.log(`      Team1 YES: ${team1Odds.yesOdds ? team1Odds.yesOdds.toFixed(2) : 'N/A'} | NO: ${team1Odds.noOdds ? team1Odds.noOdds.toFixed(2) : 'N/A'}`);
    console.log(`      Tie YES: ${tieOdds.yesOdds ? tieOdds.yesOdds.toFixed(2) : 'N/A'} | NO: ${tieOdds.noOdds ? tieOdds.noOdds.toFixed(2) : 'N/A'}`);
    console.log(`      Team2 YES: ${team2Odds.yesOdds ? team2Odds.yesOdds.toFixed(2) : 'N/A'} | NO: ${team2Odds.noOdds ? team2Odds.noOdds.toFixed(2) : 'N/A'}`);
    
    if (team1Odds.yesOdds && tieOdds.yesOdds && team2Odds.yesOdds) {
      const arbValue1 = (1 / team1Odds.yesOdds) + (1 / tieOdds.yesOdds) + (1 / team2Odds.yesOdds);
      console.log(`      Type 1: ${arbValue1.toFixed(4)} ${arbValue1 < 1.0 ? '✅ ARB!' : ''}`);
    }
    
    if (team1Odds.noOdds && tieOdds.yesOdds && team2Odds.noOdds) {
      const arbValue2 = (1 / team1Odds.noOdds) + (1 / tieOdds.yesOdds) + (1 / team2Odds.noOdds);
      console.log(`      Type 2: ${arbValue2.toFixed(4)} ${arbValue2 < 1.0 ? '✅ ARB!' : ''}`);
    }
  }
  
  const opportunities = [];
  
  // Arbitrage Type 1: Team1 YES + Tie YES + Team2 YES < 1.0
  if (team1Odds.yesOdds && tieOdds.yesOdds && team2Odds.yesOdds) {
    const arbValue1 = (1 / team1Odds.yesOdds) + (1 / tieOdds.yesOdds) + (1 / team2Odds.yesOdds);
    const profitPercent = ((1 / arbValue1) - 1) * 100;
    
    if (arbValue1 < 1.0 && profitPercent >= MIN_PROFIT_PERCENT) {
      opportunities.push({
        type: 'TYPE 1: YES + YES + YES',
        event,
        combination: `${event.teamOneName} YES + Tie YES + ${event.teamTwoName} YES`,
        team1Odds: team1Odds.yesOdds,
        tieOdds: tieOdds.yesOdds,
        team2Odds: team2Odds.yesOdds,
        arbValue: arbValue1,
        profit: profitPercent,
        bets: [
          { market: 'team1', side: 'YES', odds: team1Odds.yesOdds },
          { market: 'tie', side: 'YES', odds: tieOdds.yesOdds },
          { market: 'team2', side: 'YES', odds: team2Odds.yesOdds }
        ]
      });
    }
  }
  
  // Arbitrage Type 2: Team1 NO + Tie YES + Team2 NO < 1.0
  // Team1 NO = Team2 or Tie
  // Team2 NO = Team1 or Tie
  // Tie YES = Tie
  // This covers all outcomes
  if (team1Odds.noOdds && tieOdds.yesOdds && team2Odds.noOdds) {
    const arbValue2 = (1 / team1Odds.noOdds) + (1 / tieOdds.yesOdds) + (1 / team2Odds.noOdds);
    const profitPercent = ((1 / arbValue2) - 1) * 100;
    
    if (arbValue2 < 1.0 && profitPercent >= MIN_PROFIT_PERCENT) {
      opportunities.push({
        type: 'TYPE 2: NO + YES + NO',
        event,
        combination: `${event.teamOneName} NO + Tie YES + ${event.teamTwoName} NO`,
        team1Odds: team1Odds.noOdds,
        tieOdds: tieOdds.yesOdds,
        team2Odds: team2Odds.noOdds,
        arbValue: arbValue2,
        profit: profitPercent,
        bets: [
          { market: 'team1', side: 'NO', odds: team1Odds.noOdds },
          { market: 'tie', side: 'YES', odds: tieOdds.yesOdds },
          { market: 'team2', side: 'NO', odds: team2Odds.noOdds }
        ]
      });
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
  console.log(`   Bet on ${opp.event.teamOneName} (${opp.bets[0].side}): $${stake1.toFixed(2)}`);
  console.log(`   Bet on Tie/Draw (${opp.bets[1].side}): $${stake2.toFixed(2)}`);
  console.log(`   Bet on ${opp.event.teamTwoName} (${opp.bets[2].side}): $${stake3.toFixed(2)}`);
  console.log(`   Total Staked: $${(stake1 + stake2 + stake3).toFixed(2)}\n`);
  
  console.log(`✅ Guaranteed Return: $${guaranteedReturn.toFixed(2)}`);
  console.log(`✅ Guaranteed Profit: $${guaranteedProfit.toFixed(2)}\n`);
  
  console.log(`📋 Market Hashes:`);
  console.log(`   Team1: ${opp.event.markets.team1.marketHash}`);
  console.log(`   Tie: ${opp.event.markets.tie.marketHash}`);
  console.log(`   Team2: ${opp.event.markets.team2.marketHash}\n`);
  
  console.log('='.repeat(70) + '\n');
}

async function scanAllEvents(verbose = false) {
  scanCount++;
  lastScanTime = new Date();
  
  console.log(`🔍 Scan #${scanCount} - ${lastScanTime.toLocaleTimeString()}`);
  
  const eventMap = await fetchAllSoccerMarkets();
  const eventCount = Object.keys(eventMap).length;
  
  console.log(`   Found ${eventCount} complete 1X2 events (with all 3 markets)`);
  
  if (eventCount === 0) {
    console.log('   ⚠️  No complete 1X2 markets found\n');
    return [];
  }
  
  const allOpportunities = [];
  
  for (const eventId in eventMap) {
    const event = eventMap[eventId];
    const opportunities = await scanEventForArbitrage(event, verbose);
    
    if (opportunities.length > 0) {
      allOpportunities.push(...opportunities);
    }
    
    // Small delay to avoid rate limiting
    await new Promise(resolve => setTimeout(resolve, 200));
  }
  
  if (!verbose) {
    console.log(`   Checked ${eventCount} events`);
  }
  console.log(`   Found ${allOpportunities.length} arbitrage opportunities\n`);
  
  return allOpportunities;
}

async function main() {
  await initialize();
  
  // Check if verbose mode is enabled
  const verbose = process.argv.includes('--verbose') || process.argv.includes('-v');
  
  if (verbose) {
    console.log('📢 Verbose mode enabled - showing all odds\n');
  }
  
  // Initial scan
  let opportunities = await scanAllEvents(verbose);
  
  if (opportunities.length > 0) {
    totalOpportunitiesFound += opportunities.length;
    console.log(`🎉 Found ${opportunities.length} arbitrage opportunity(ies)!\n`);
    
    for (const opp of opportunities) {
      displayOpportunity(opp);
    }
    
    if (!KEEP_RUNNING) {
      console.log('✅ Arbitrage opportunity found! Exiting...\n');
      process.exit(0);
    } else {
      console.log(`✅ Arbitrage found! (Total: ${totalOpportunitiesFound}) Continuing to monitor...\n`);
      console.log('='.repeat(70) + '\n');
    }
  } else {
    console.log('⏳ No arbitrage opportunities found yet. Starting continuous monitoring...\n');
    console.log('   Scanning every 30 seconds...');
    console.log('   Press Ctrl+C to stop\n');
    console.log('='.repeat(70) + '\n');
  }
  
  // Periodic re-scan every 30 seconds
  setInterval(async () => {
    opportunities = await scanAllEvents(verbose);
    
    if (opportunities.length > 0) {
      totalOpportunitiesFound += opportunities.length;
      console.log(`\n🎉 Found ${opportunities.length} arbitrage opportunity(ies)!\n`);
      
      for (const opp of opportunities) {
        displayOpportunity(opp);
      }
      
      if (!KEEP_RUNNING) {
        console.log('✅ Arbitrage opportunity found! Exiting...\n');
        process.exit(0);
      } else {
        console.log(`✅ Arbitrage found! (Total: ${totalOpportunitiesFound}) Continuing to monitor...\n`);
        console.log('='.repeat(70) + '\n');
      }
    }
  }, 30000); // Every 30 seconds
}

// Handle graceful shutdown
process.on('SIGINT', () => {
  console.log('\n\n👋 Shutting down arbitrage scanner...');
  console.log(`   Total scans performed: ${scanCount}`);
  console.log(`   Total arbitrage opportunities found: ${totalOpportunitiesFound}`);
  if (lastScanTime) {
    console.log(`   Last scan: ${lastScanTime.toLocaleString()}`);
  }
  console.log('');
  process.exit(0);
});

main();
