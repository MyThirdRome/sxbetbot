require('dotenv').config();
const axios = require('axios');
const Ably = require('ably');
const { ethers } = require('ethers');
const { signTypedData, SignTypedDataVersion } = require('@metamask/eth-sig-util');

const API_BASE = 'https://api.sx.bet';
const USDC_ADDRESS = '0x6629Ce1Cf35Cc1329ebB4F63202F3f197b3F050B';
const CHAIN_ID = 4162;

const wallet = new ethers.Wallet(process.env.PRIVATE_KEY);
const address = wallet.address;
const privateKeyBuffer = Buffer.from(process.env.PRIVATE_KEY.replace('0x', ''), 'hex');

let metadata, domain, types;
let isProcessing = false;
let betSuccessful = false;
let attemptCount = 0;

// Track best odds per market
const marketBestOdds = new Map();

console.clear();
console.log('⚡ ABLY LIVE MONITOR - CONTINUOUS BETTING');
console.log('='.repeat(80));
console.log(`Wallet: ${address}`);
console.log(`Target: 3.0x - 10.0x odds with 1% slippage`);
console.log(`Will run until one successful bet is placed`);
console.log('='.repeat(80));
console.log('');

async function createTokenRequest() {
  const response = await axios.get(`${API_BASE}/user/token`, {
    headers: { 'X-Api-Key': process.env.SX_BET_API_KEY },
  });
  return response.data;
}

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
      resolve(realtime);
    });
    realtime.connection.once('failed', reject);
  });
}

async function initializeSigningComponents() {
  const res = await axios.get(`${API_BASE}/metadata`);
  metadata = res.data.data;
  
  domain = {
    name: 'SX Bet',
    version: metadata.domainVersion,
    chainId: CHAIN_ID,
    verifyingContract: metadata.EIP712FillHasher,
  };
  
  types = {
    EIP712Domain: [
      { name: 'name', type: 'string' },
      { name: 'version', type: 'string' },
      { name: 'chainId', type: 'uint256' },
      { name: 'verifyingContract', type: 'address' },
    ],
    Details: [
      { name: 'action', type: 'string' },
      { name: 'market', type: 'string' },
      { name: 'betting', type: 'string' },
      { name: 'stake', type: 'string' },
      { name: 'worstOdds', type: 'string' },
      { name: 'worstReturning', type: 'string' },
      { name: 'fills', type: 'FillObject' },
    ],
    FillObject: [
      { name: 'stakeWei', type: 'string' },
      { name: 'marketHash', type: 'string' },
      { name: 'baseToken', type: 'string' },
      { name: 'desiredOdds', type: 'string' },
      { name: 'oddsSlippage', type: 'uint256' },
      { name: 'isTakerBettingOutcomeOne', type: 'bool' },
      { name: 'fillSalt', type: 'uint256' },
      { name: 'beneficiary', type: 'address' },
      { name: 'beneficiaryType', type: 'uint8' },
      { name: 'cashOutTarget', type: 'bytes32' },
    ],
  };
}

async function attemptFill(order, marketHash, marketInfo) {
  if (isProcessing || betSuccessful) return;
  isProcessing = true;
  
  const start = Date.now();
  attemptCount++;
  
  try {
    const percentageOddsWei = parseFloat(order.percentageOdds) / 1e20;
    const decimalOdds = 1 / percentageOddsWei;
    
    const timestamp = new Date().toLocaleTimeString();
    console.log(`\n[${timestamp}] 🎯 ATTEMPT #${attemptCount}: ${decimalOdds.toFixed(2)}x`);
    console.log(`   Market: ${marketInfo.teamOneName} vs ${marketInfo.teamTwoName}`);
    console.log(`   Order: ${order.orderHash.substring(0, 30)}...`);
    
    const fillSalt = Date.now().toString();
    const stakeWei = '5000000';
    const desiredOdds = order.percentageOdds;
    const oddsSlippage = 1;
    const isTakerBettingOutcomeOne = !order.isMakerBettingOutcomeOne;
    
    const fillObject = {
      stakeWei,
      marketHash: String(marketHash),
      baseToken: USDC_ADDRESS,
      desiredOdds,
      oddsSlippage,
      isTakerBettingOutcomeOne,
      fillSalt,
      beneficiary: ethers.constants.AddressZero,
      beneficiaryType: 0,
      cashOutTarget: ethers.constants.HashZero,
    };
    
    const message = {
      action: 'N/A',
      market: String(marketHash),
      betting: 'N/A',
      stake: 'N/A',
      worstOdds: 'N/A',
      worstReturning: 'N/A',
      fills: fillObject,
    };
    
    const signingPayload = {
      types,
      primaryType: 'Details',
      domain,
      message,
    };
    
    const signature = signTypedData({
      privateKey: privateKeyBuffer,
      data: signingPayload,
      version: SignTypedDataVersion.V4,
    });
    
    const signTime = Date.now() - start;
    console.log(`   ✍️  Signed in ${signTime}ms`);
    
    const apiPayload = {
      market: String(marketHash),
      baseToken: USDC_ADDRESS,
      isTakerBettingOutcomeOne,
      stakeWei,
      desiredOdds,
      oddsSlippage: 1,
      taker: address,
      takerSig: signature,
      fillSalt,
    };
    
    const response = await axios.post(`${API_BASE}/orders/fill/v2`, apiPayload);
    
    const totalTime = Date.now() - start;
    const fillData = response.data.data;
    
    console.log(`\n${'='.repeat(80)}`);
    console.log(`✅ SUCCESS! BET PLACED IN ${totalTime}ms`);
    console.log(`${'='.repeat(80)}`);
    console.log(`   Fill Hash: ${fillData.fillHash}`);
    console.log(`   Odds: ${decimalOdds.toFixed(2)}x`);
    console.log(`   Stake: $5 USDC`);
    console.log(`   Potential Win: $${(5 * decimalOdds).toFixed(2)} USDC`);
    if (fillData.betId) {
      console.log(`   Bet ID: ${fillData.betId}`);
    }
    console.log(`${'='.repeat(80)}`);
    console.log(`\n🎉 Mission accomplished! Total attempts: ${attemptCount}`);
    
    betSuccessful = true;
    
    // Exit after 2 seconds
    setTimeout(() => {
      process.exit(0);
    }, 2000);
    
  } catch (error) {
    const totalTime = Date.now() - start;
    const errorMsg = error.response?.data?.message || error.message;
    console.log(`   ❌ Failed in ${totalTime}ms: ${errorMsg}`);
  } finally {
    isProcessing = false;
  }
}

function updateMarketDisplay(marketInfo, orders) {
  const marketKey = marketInfo.marketHash;
  
  // Find best odds for this market
  let bestOdds = { outcome1: null, outcome2: null };
  
  for (const order of orders) {
    if (order.status !== 'ACTIVE') continue;
    if (!order.totalBetSize || !order.percentageOdds) continue;
    
    const totalBetSize = BigInt(order.totalBetSize);
    const percentageOdds = parseFloat(order.percentageOdds) / 1e20;
    const takerMultiplier = (1 / percentageOdds) - 1;
    const availableUSDC = Number(totalBetSize) * takerMultiplier / 1e6;
    
    if (availableUSDC < 5) continue;
    
    const decimalOdds = 1 / percentageOdds;
    
    // Taker gets opposite of maker
    if (order.isMakerBettingOutcomeOne) {
      // Taker gets outcome 2
      if (!bestOdds.outcome2 || decimalOdds > bestOdds.outcome2.odds) {
        bestOdds.outcome2 = { odds: decimalOdds, available: availableUSDC };
      }
    } else {
      // Taker gets outcome 1
      if (!bestOdds.outcome1 || decimalOdds > bestOdds.outcome1.odds) {
        bestOdds.outcome1 = { odds: decimalOdds, available: availableUSDC };
      }
    }
  }
  
  // Store and display if changed
  const prevBest = marketBestOdds.get(marketKey);
  const currentBest = JSON.stringify(bestOdds);
  
  if (prevBest !== currentBest) {
    marketBestOdds.set(marketKey, currentBest);
    
    const timestamp = new Date().toLocaleTimeString();
    console.log(`\n[${timestamp}] 📊 ${marketInfo.teamOneName} vs ${marketInfo.teamTwoName}`);
    
    if (bestOdds.outcome1) {
      const indicator = bestOdds.outcome1.odds >= 3.0 && bestOdds.outcome1.odds <= 10.0 ? '🎯' : '  ';
      console.log(`   ${indicator} ${marketInfo.outcomeOneName}: ${bestOdds.outcome1.odds.toFixed(2)}x ($${bestOdds.outcome1.available.toFixed(0)} available)`);
    }
    
    if (bestOdds.outcome2) {
      const indicator = bestOdds.outcome2.odds >= 3.0 && bestOdds.outcome2.odds <= 10.0 ? '🎯' : '  ';
      console.log(`   ${indicator} ${marketInfo.outcomeTwoName}: ${bestOdds.outcome2.odds.toFixed(2)}x ($${bestOdds.outcome2.available.toFixed(0)} available)`);
    }
  }
}

async function processOrderUpdate(message, marketHash, marketInfo) {
  if (betSuccessful) return;
  
  if (!message.data || !Array.isArray(message.data)) return;
  
  // Update display
  updateMarketDisplay(marketInfo, message.data);
  
  // Try to fill if we find target odds
  for (const order of message.data) {
    if (order.status !== 'ACTIVE') continue;
    if (!order.totalBetSize || !order.percentageOdds || order.isMakerBettingOutcomeOne === undefined) continue;
    
    const totalBetSize = BigInt(order.totalBetSize);
    const percentageOdds = parseFloat(order.percentageOdds) / 1e20;
    const takerMultiplier = (1 / percentageOdds) - 1;
    const availableUSDC = Number(totalBetSize) * takerMultiplier / 1e6;
    
    if (availableUSDC < 5) continue;
    
    const decimalOdds = 1 / percentageOdds;
    
    if (decimalOdds >= 3.0 && decimalOdds <= 10.0) {
      await attemptFill(order, marketHash, marketInfo);
      if (betSuccessful) break;
    }
  }
}

async function main() {
  console.log('🔧 Initializing...\n');
  
  await initializeSigningComponents();
  console.log('✅ Signing components ready');
  
  const marketsRes = await axios.get(`${API_BASE}/markets/active`, {
    params: { sportIds: 5, onlyMainLine: true }
  });
  
  const markets = marketsRes.data.data.markets
    .filter(m => m.type === 1 && m.status === 'ACTIVE')
    .slice(0, 10);
  
  console.log(`✅ Monitoring ${markets.length} markets`);
  
  const realtime = await initializeAbly();
  console.log('✅ Connected to Ably');
  
  console.log('\n' + '='.repeat(80));
  console.log('LIVE MARKET MONITORING');
  console.log('='.repeat(80));
  
  for (const market of markets) {
    const channelName = `order_book_v2:${USDC_ADDRESS}:${market.marketHash}`;
    const channel = realtime.channels.get(channelName);
    
    channel.subscribe(async (message) => {
      await processOrderUpdate(message, market.marketHash, market);
    });
    
    console.log(`📡 ${market.teamOneName} vs ${market.teamTwoName}`);
  }
  
  console.log('\n🔴 LIVE - Watching for 3-10x odds...\n');
  
  process.on('SIGINT', () => {
    console.log('\n\n👋 Shutting down...');
    console.log(`Total attempts: ${attemptCount}`);
    realtime.close();
    process.exit(0);
  });
}

main().catch(error => {
  console.error('\n❌ Fatal error:', error.message);
  process.exit(1);
});
