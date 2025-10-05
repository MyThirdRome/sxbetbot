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

console.log('⚡ ABLY FAST FILL - PRE-SIGNED MODEL');
console.log('======================================================================');
console.log(`Wallet: ${address}\n`);

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
      console.log('✅ Connected to Ably\n');
      resolve(realtime);
    });
    realtime.connection.once('failed', reject);
  });
}

// Pre-initialize signing components (static parts)
async function initializeSigningComponents() {
  const res = await axios.get(`${API_BASE}/metadata`);
  metadata = res.data.data;
  
  // Pre-initialize domain (static)
  domain = {
    name: 'SX Bet',
    version: metadata.domainVersion,
    chainId: CHAIN_ID,
    verifyingContract: metadata.EIP712FillHasher,
  };
  
  // Pre-initialize types (static)
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

// Fast fill with pre-signed model
async function fastFillOrder(order, marketHash, marketInfo) {
  if (isProcessing) return;
  isProcessing = true;
  
  const start = Date.now();
  
  try {
    // Calculate odds
    const percentageOddsWei = parseFloat(order.percentageOdds) / 1e20;
    const decimalOdds = 1 / percentageOddsWei;
    
    console.log(`\n⚡ FAST FILL: ${decimalOdds.toFixed(2)}x`);
    console.log(`   Market: ${marketInfo.teamOneName} vs ${marketInfo.teamTwoName}`);
    console.log(`   Order: ${order.orderHash.substring(0, 20)}...`);
    
    // Only dynamic parts
    const fillSalt = Date.now().toString();
    const stakeWei = '5000000'; // $5 USDC
    const desiredOdds = order.percentageOdds; // Exact odds from order
    const oddsSlippage = 1; // 1% slippage
    const isTakerBettingOutcomeOne = !order.isMakerBettingOutcomeOne;
    
    // Create fill object
    const fillObject = {
      stakeWei,
      marketHash: String(marketHash),
      baseToken: USDC_ADDRESS,
      desiredOdds,
      oddsSlippage,
      isTakerBettingOutcomeOne,
      fillSalt,
      beneficiary: ethers.constants.AddressZero, // Use AddressZero, not wallet address
      beneficiaryType: 0,
      cashOutTarget: ethers.constants.HashZero,
    };
    
    // Create message with Details wrapper
    const message = {
      action: 'N/A',
      market: String(marketHash),
      betting: 'N/A',
      stake: 'N/A',
      worstOdds: 'N/A',
      worstReturning: 'N/A',
      fills: fillObject,
    };
    
    // Sign using pre-initialized domain and types
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
    
    console.log(`   ✅ Signed: ${Date.now() - start}ms`);
    
    // Build API payload (oddsSlippage stays as 1 for API)
    const apiPayload = {
      market: String(marketHash),
      baseToken: USDC_ADDRESS,
      isTakerBettingOutcomeOne,
      stakeWei,
      desiredOdds,
      oddsSlippage: 1, // 1% slippage
      taker: address,
      takerSig: signature,
      fillSalt,
    };
    
    // Submit
    const response = await axios.post(`${API_BASE}/orders/fill/v2`, apiPayload);
    
    const fillData = response.data.data;
    console.log(`\n✅ SUCCESS in ${Date.now() - start}ms`);
    console.log(`   Fill Hash: ${fillData.fillHash}`);
    console.log(`   Odds: ${decimalOdds.toFixed(2)}x`);
    
    if (fillData.betId) {
      console.log(`   Bet ID: ${fillData.betId}`);
    }
    
    // Wait 5 seconds before next bet
    console.log(`\n⏳ Waiting 5 seconds...\n`);
    await new Promise(resolve => setTimeout(resolve, 5000));
    
  } catch (error) {
    console.log(`\n❌ FAILED in ${Date.now() - start}ms`);
    console.log(`   Error: ${error.response?.data?.message || error.message}`);
  } finally {
    isProcessing = false;
  }
}

// Process order update from Ably
async function processOrderUpdate(message, marketHash, marketInfo) {
  const receiveTime = Date.now();
  
  if (!message.data || !Array.isArray(message.data)) return;
  
  for (const order of message.data) {
    // Only ACTIVE orders
    if (order.status !== 'ACTIVE') continue;
    
    // Check required fields
    if (!order.totalBetSize || !order.percentageOdds || order.isMakerBettingOutcomeOne === undefined) continue;
    
    // Calculate available for taker
    const totalBetSize = BigInt(order.totalBetSize);
    const percentageOdds = parseFloat(order.percentageOdds) / 1e20;
    const takerMultiplier = (1 / percentageOdds) - 1;
    const availableUSDC = Number(totalBetSize) * takerMultiplier / 1e6;
    
    // Need at least $5
    if (availableUSDC < 5) continue;
    
    const decimalOdds = 1 / percentageOdds;
    
    // Target: 3.0x to 10.0x
    if (decimalOdds >= 3.0 && decimalOdds <= 10.0) {
      console.log(`\n🎯 TARGET DETECTED: ${decimalOdds.toFixed(2)}x (latency: ${Date.now() - receiveTime}ms)`);
      
      await fastFillOrder(order, marketHash, marketInfo);
      break;
    }
  }
}

async function main() {
  // Initialize signing components (pre-sign static parts)
  console.log('Pre-initializing signing components...');
  await initializeSigningComponents();
  console.log('✅ Domain and types pre-initialized');
  console.log(`   Version: ${domain.version}`);
  console.log(`   Contract: ${domain.verifyingContract}\n`);
  
  // Get active markets
  console.log('Fetching active markets...');
  const marketsRes = await axios.get(`${API_BASE}/markets/active`, {
    params: { sportIds: 5, onlyMainLine: true }
  });
  
  const markets = marketsRes.data.data.markets
    .filter(m => m.type === 1 && m.status === 'ACTIVE')
    .slice(0, 10);
  
  console.log(`✅ Monitoring ${markets.length} markets\n`);
  
  // Initialize Ably
  const realtime = await initializeAbly();
  
  // Subscribe to order book updates
  for (const market of markets) {
    const channelName = `order_book_v2:${USDC_ADDRESS}:${market.marketHash}`;
    const channel = realtime.channels.get(channelName);
    
    channel.subscribe(async (message) => {
      await processOrderUpdate(message, market.marketHash, market);
    });
    
    console.log(`📡 ${market.teamOneName} vs ${market.teamTwoName}`);
  }
  
  console.log('\n✅ Monitoring active. Target: 3-10x odds with 1% slippage\n');
  
  // Keep running
  process.on('SIGINT', () => {
    console.log('\n\n👋 Shutting down...');
    realtime.close();
    process.exit(0);
  });
}

main().catch(console.error);
