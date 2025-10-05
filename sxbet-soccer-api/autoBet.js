require('dotenv').config();
const axios = require('axios');
const { BigNumber, constants, Contract, providers, utils, Wallet } = require('ethers');
const { signTypedData, SignTypedDataVersion } = require('@metamask/eth-sig-util');

/**
 * AUTOMATED BETTING SCRIPT FOR SX.BET
 * ====================================
 * 
 * This script will:
 * 1. Check if TokenTransferProxy is approved (one-time setup)
 * 2. Approve if needed
 * 3. Find today's soccer match
 * 4. Select a random order
 * 5. Place a 5 USDC bet
 */

const API_BASE = 'https://api.sx.bet';
const USDC_ADDRESS = '0x6629Ce1Cf35Cc1329ebB4F63202F3f197b3F050B'; // SX Network USDC
const CHAIN_ID = 4162; // SX Network
const RPC_URL = 'https://rpc.sx-rollup.gelato.digital';

// ERC20 ABI (minimal - just what we need)
const ERC20_ABI = [
  'function approve(address spender, uint256 amount) returns (bool)',
  'function allowance(address owner, address spender) view returns (uint256)',
  'function balanceOf(address account) view returns (uint256)',
  'function nonces(address owner) view returns (uint256)',
  'function name() view returns (string)'
];

let wallet;
let provider;
let metadata;

async function initialize() {
  console.log('🔧 Initializing wallet and provider...');
  
  if (!process.env.PRIVATE_KEY) {
    throw new Error('PRIVATE_KEY not found in .env file');
  }
  
  provider = new providers.JsonRpcProvider(RPC_URL);
  wallet = new Wallet(process.env.PRIVATE_KEY, provider);
  
  console.log(`✅ Wallet address: ${wallet.address}`);
  
  // Get metadata
  const response = await axios.get(`${API_BASE}/metadata`);
  metadata = response.data.data;
  
  console.log(`✅ Executor: ${metadata.executorAddress}`);
  console.log(`✅ TokenTransferProxy: ${metadata.TokenTransferProxy}`);
  console.log(`✅ EIP712FillHasher: ${metadata.EIP712FillHasher}`);
  console.log(`✅ Domain Version: ${metadata.domainVersion}`);
  
  return metadata;
}

async function checkBalance() {
  console.log('\n💰 Checking USDC balance...');
  
  const usdcContract = new Contract(USDC_ADDRESS, ERC20_ABI, wallet);
  const balance = await usdcContract.balanceOf(wallet.address);
  const balanceFormatted = utils.formatUnits(balance, 6); // USDC has 6 decimals
  
  console.log(`   Balance: ${balanceFormatted} USDC`);
  
  if (balance.lt(utils.parseUnits('5', 6))) {
    throw new Error('Insufficient USDC balance. Need at least 5 USDC.');
  }
  
  return balance;
}

async function checkApproval() {
  console.log('\n🔐 Checking TokenTransferProxy approval...');
  
  const usdcContract = new Contract(USDC_ADDRESS, ERC20_ABI, wallet);
  const allowance = await usdcContract.allowance(wallet.address, metadata.TokenTransferProxy);
  
  console.log(`   Current allowance: ${utils.formatUnits(allowance, 6)} USDC`);
  
  return allowance;
}

async function approveTokenTransferProxy() {
  console.log('\n✍️  Approving TokenTransferProxy via EIP-2612 Permit...');
  
  try {
    const usdcContract = new Contract(USDC_ADDRESS, ERC20_ABI, wallet);
    const nonce = await usdcContract.nonces(wallet.address);
    const tokenName = await usdcContract.name();
    const approvalAmount = constants.MaxUint256;
    const deadline = Math.floor(Date.now() / 1000) + 7200; // 2 hours from now
    
    console.log(`   Token name: ${tokenName}`);
    console.log(`   Nonce: ${nonce.toString()}`);
    console.log(`   Deadline: ${deadline}`);
    
    // Create EIP-2612 Permit signature
    const erc20PermitPayload = {
      types: {
        EIP712Domain: [
          { name: 'name', type: 'string' },
          { name: 'version', type: 'string' },
          { name: 'chainId', type: 'uint256' },
          { name: 'verifyingContract', type: 'address' }
        ],
        Permit: [
          { name: 'owner', type: 'address' },
          { name: 'spender', type: 'address' },
          { name: 'value', type: 'uint256' },
          { name: 'nonce', type: 'uint256' },
          { name: 'deadline', type: 'uint256' }
        ]
      },
      domain: {
        name: tokenName,
        version: '1',
        chainId: CHAIN_ID,
        verifyingContract: USDC_ADDRESS
      },
      message: {
        owner: wallet.address,
        spender: metadata.TokenTransferProxy,
        value: approvalAmount.toString(),
        nonce: nonce.toNumber(),
        deadline: deadline
      },
      primaryType: 'Permit'
    };
    
    const bufferPrivateKey = Buffer.from(process.env.PRIVATE_KEY.substring(2), 'hex');
    const signature = signTypedData({
      privateKey: bufferPrivateKey,
      data: erc20PermitPayload,
      version: SignTypedDataVersion.V4
    });
    
    console.log('   Signature created, submitting to API...');
    
    // Submit approval to API
    const apiPayload = {
      owner: wallet.address,
      spender: metadata.TokenTransferProxy,
      tokenAddress: USDC_ADDRESS,
      value: approvalAmount.toString(),
      deadline: deadline,
      signature: signature
    };
    
    const response = await axios.post(`${API_BASE}/orders/approve`, apiPayload, {
      headers: { 'Content-Type': 'application/json' }
    });
    
    if (response.data.status === 'success') {
      console.log(`✅ Approval successful!`);
      if (response.data.data.hash) {
        console.log(`   Transaction hash: ${response.data.data.hash}`);
      } else {
        console.log(`   Already approved (no new transaction needed)`);
      }
      return true;
    } else {
      throw new Error('Approval failed: ' + JSON.stringify(response.data));
    }
  } catch (error) {
    console.error('❌ Approval error:', error.message);
    if (error.response) {
      console.error('   API Response:', JSON.stringify(error.response.data, null, 2));
    }
    throw error;
  }
}

async function findMatchWithMarkets() {
  console.log('\n⚽ Finding soccer match with active markets...');
  
  // Get active markets for soccer
  const marketsResponse = await axios.get(`${API_BASE}/markets/active`, {
    params: {
      sportIds: 5, // Soccer
      onlyMainLine: true
    }
  });
  
  const markets = marketsResponse.data.data.markets;
  if (!markets || markets.length === 0) {
    throw new Error('No active soccer markets found');
  }
  
  console.log(`✅ Found ${markets.length} active soccer markets`);
  
  // Group by event
  const eventMap = {};
  for (const market of markets) {
    if (!eventMap[market.sportXEventId]) {
      eventMap[market.sportXEventId] = {
        eventId: market.sportXEventId,
        teamOneName: market.teamOneName,
        teamTwoName: market.teamTwoName,
        leagueLabel: market.leagueLabel,
        markets: []
      };
    }
    eventMap[market.sportXEventId].markets.push(market);
  }
  
  // Find first event with 1X2 or 12 market
  for (const eventId in eventMap) {
    const event = eventMap[eventId];
    const goodMarket = event.markets.find(m => m.type === 1 || m.type === 52 || m.type === 226);
    
    if (goodMarket) {
      console.log(`📍 Selected: ${event.teamOneName} vs ${event.teamTwoName}`);
      console.log(`   League: ${event.leagueLabel}`);
      console.log(`   Event ID: ${event.eventId}`);
      
      return {
        eventId: event.eventId,
        teamOneName: event.teamOneName,
        teamTwoName: event.teamTwoName,
        market: goodMarket
      };
    }
  }
  
  // If no 1X2/12 market, just use first event
  const firstEventId = Object.keys(eventMap)[0];
  const firstEvent = eventMap[firstEventId];
  
  console.log(`📍 Selected: ${firstEvent.teamOneName} vs ${firstEvent.teamTwoName}`);
  console.log(`   League: ${firstEvent.leagueLabel}`);
  console.log(`   Event ID: ${firstEvent.eventId}`);
  
  return {
    eventId: firstEvent.eventId,
    teamOneName: firstEvent.teamOneName,
    teamTwoName: firstEvent.teamTwoName,
    market: firstEvent.markets[0]
  };
}

async function getMarketsForEvent(eventId) {
  console.log(`\n🎯 Fetching markets for event ${eventId}...`);
  
  const response = await axios.get(`${API_BASE}/markets/active`, {
    params: {
      eventId,
      onlyMainLine: true
    }
  });
  
  const markets = response.data.data.markets;
  if (!markets || markets.length === 0) {
    throw new Error('No markets found for this event');
  }
  
  console.log(`✅ Found ${markets.length} markets`);
  
  // Prefer 1X2 market (type 1) or 12 market (type 52 or 226)
  const market = markets.find(m => m.type === 1 || m.type === 52 || m.type === 226) || markets[0];
  
  console.log(`📊 Selected market: ${market.outcomeOneName} vs ${market.outcomeTwoName}`);
  console.log(`   Market Hash: ${market.marketHash}`);
  
  return market;
}

async function getOrdersForMarket(marketHash) {
  console.log(`\n📖 Fetching orders for market...`);
  
  const response = await axios.get(`${API_BASE}/orders`, {
    params: {
      marketHashes: marketHash,
      baseToken: USDC_ADDRESS
    }
  });
  
  const orders = response.data.data;
  if (!orders || orders.length === 0) {
    throw new Error('No orders found for this market');
  }
  
  console.log(`✅ Found ${orders.length} orders`);
  
  return orders;
}

function selectBestOrder(orders) {
  console.log('\n🎲 Selecting best order...');
  
  // Filter orders that have enough size available
  const fiveUSDC = BigNumber.from('5000000'); // 5 USDC in wei (6 decimals)
  
  const availableOrders = orders.filter(order => {
    const fillAmount = BigNumber.from(order.fillAmount || '0');
    const totalSize = BigNumber.from(order.totalBetSize);
    const available = totalSize.sub(fillAmount);
    return available.gte(fiveUSDC);
  });
  
  if (availableOrders.length === 0) {
    throw new Error('No orders with enough size available (need at least 5 USDC)');
  }
  
  console.log(`   ${availableOrders.length} orders have sufficient size`);
  
  // Pick order with best taker odds (lowest maker odds = best decimal odds for taker)
  let bestOrder = availableOrders[0];
  let lowestMakerOdds = 1;
  
  for (const order of availableOrders) {
    const makerOdds = parseFloat(order.percentageOdds) / 1e20;
    
    if (makerOdds < lowestMakerOdds) {
      lowestMakerOdds = makerOdds;
      bestOrder = order;
    }
  }
  
  // CORRECT CALCULATION:
  // makerOdds = probability maker receives = what taker PAYS
  // Decimal odds for taker = 1 / makerOdds
  const makerOdds = parseFloat(bestOrder.percentageOdds) / 1e20;
  const decimalOdds = (1 / makerOdds).toFixed(2);
  const potentialReturn = (5 * parseFloat(decimalOdds)).toFixed(2);
  const impliedProbability = (makerOdds * 100).toFixed(2);
  
  console.log(`\n✅ Selected order with BEST odds:`);
  console.log(`   Order Hash: ${bestOrder.orderHash}`);
  console.log(`   Betting on: ${bestOrder.isMakerBettingOutcomeOne ? 'Outcome TWO' : 'Outcome ONE'}`);
  console.log(`   Maker odds: ${impliedProbability}% (what you pay)`);
  console.log(`   Your decimal odds: ${decimalOdds}x`);
  console.log(`   Stake: 5 USDC`);
  console.log(`   Potential return: ${potentialReturn} USDC`);
  console.log(`   Potential profit: ${(potentialReturn - 5).toFixed(2)} USDC`);
  
  return bestOrder;
}

async function placeBet(market, order) {
  console.log('\n💸 Placing bet...');
  
  const stakeWei = '5000000'; // 5 USDC (6 decimals)
  const fillSalt = BigNumber.from(utils.randomBytes(32)).toString();
  
  // Calculate taker odds
  const makerOddsNum = parseFloat(order.percentageOdds) / 1e20;
  const takerOddsNum = 1 - makerOddsNum;
  
  // desiredOdds should be TAKER odds in the protocol format (multiply by 10^20)
  const takerOddsBN = BigNumber.from(Math.floor(takerOddsNum * 1e20).toString());
  const desiredOdds = takerOddsBN.toString();
  const oddsSlippage = 5; // 5% slippage tolerance
  
  // Taker is betting the OPPOSITE of maker
  const isTakerBettingOutcomeOne = !order.isMakerBettingOutcomeOne;
  
  console.log(`   Taker odds: ${(takerOddsNum * 100).toFixed(2)}% (${desiredOdds} in protocol format)`);
  
  console.log(`   Creating EIP712 signature...`);
  
  // Create EIP712 signature for fill
  const signingPayload = {
    types: {
      EIP712Domain: [
        { name: 'name', type: 'string' },
        { name: 'version', type: 'string' },
        { name: 'chainId', type: 'uint256' },
        { name: 'verifyingContract', type: 'address' }
      ],
      Details: [
        { name: 'action', type: 'string' },
        { name: 'market', type: 'string' },
        { name: 'betting', type: 'string' },
        { name: 'stake', type: 'string' },
        { name: 'worstOdds', type: 'string' },
        { name: 'worstReturning', type: 'string' },
        { name: 'fills', type: 'FillObject' }
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
        { name: 'cashOutTarget', type: 'bytes32' }
      ]
    },
    primaryType: 'Details',
    domain: {
      name: 'SX Bet',
      version: metadata.domainVersion,
      chainId: CHAIN_ID,
      verifyingContract: metadata.EIP712FillHasher
    },
    message: {
      action: 'N/A',
      market: market.marketHash,
      betting: 'N/A',
      stake: 'N/A',
      worstOdds: 'N/A',
      worstReturning: 'N/A',
      fills: {
        stakeWei,
        marketHash: market.marketHash,
        baseToken: USDC_ADDRESS,
        desiredOdds,
        oddsSlippage,
        isTakerBettingOutcomeOne,
        fillSalt,
        beneficiary: constants.AddressZero,
        beneficiaryType: 0,
        cashOutTarget: constants.HashZero
      }
    }
  };
  
  const bufferPrivateKey = Buffer.from(process.env.PRIVATE_KEY.substring(2), 'hex');
  const signature = signTypedData({
    privateKey: bufferPrivateKey,
    data: signingPayload,
    version: SignTypedDataVersion.V4
  });
  
  console.log(`   Signature created: ${signature.substring(0, 20)}...`);
  console.log(`   Submitting bet to API...`);
  
  // Submit fill to API
  const apiPayload = {
    market: market.marketHash,
    baseToken: USDC_ADDRESS,
    isTakerBettingOutcomeOne,
    stakeWei,
    desiredOdds,
    oddsSlippage,
    taker: wallet.address,
    takerSig: signature,
    fillSalt
  };
  
  try {
    const response = await axios.post(`${API_BASE}/orders/fill/v2`, apiPayload, {
      headers: { 'Content-Type': 'application/json' }
    });
    
    if (response.data.status === 'success') {
      const result = response.data.data;
      console.log('\n🎉 BET PLACED SUCCESSFULLY! 🎉\n');
      console.log(`   Fill Hash: ${result.fillHash}`);
      console.log(`   Total Filled: ${utils.formatUnits(result.totalFilled, 6)} USDC`);
      
      // CORRECT CALCULATION:
      // averageOdds = maker odds = what taker PAYS
      // Decimal odds for taker = 1 / makerOdds
      const makerOddsActual = parseFloat(result.averageOdds) / 1e20;
      const decimalOddsActual = (1 / makerOddsActual).toFixed(2);
      const stakeAmount = parseFloat(utils.formatUnits(result.totalFilled, 6));
      const actualReturn = (stakeAmount * parseFloat(decimalOddsActual)).toFixed(2);
      const actualProfit = (actualReturn - stakeAmount).toFixed(2);
      
      console.log(`   Maker odds: ${(makerOddsActual * 100).toFixed(2)}% (what you paid)`);
      console.log(`   Your decimal odds: ${decimalOddsActual}x`);
      console.log(`   Partial Fill: ${result.isPartialFill ? 'Yes' : 'No'}`);
      
      console.log(`\n   💰 If you WIN: ${actualReturn} USDC (profit: ${actualProfit} USDC)`);
      console.log(`   📉 If you LOSE: 0 USDC (lose stake: ${stakeAmount.toFixed(2)} USDC)`);
      
      return result;
    } else {
      throw new Error('Bet placement failed: ' + JSON.stringify(response.data));
    }
  } catch (error) {
    console.error('\n❌ BET PLACEMENT FAILED');
    console.error('   Error:', error.message);
    if (error.response) {
      console.error('   API Response:', JSON.stringify(error.response.data, null, 2));
    }
    throw error;
  }
}

async function main() {
  console.log('\n🚀 SX.BET AUTOMATED BETTING SCRIPT\n');
  console.log('='.repeat(60));
  
  try {
    // Step 1: Initialize
    await initialize();
    
    // Step 2: Check balance
    await checkBalance();
    
    // Step 3: Check and approve if needed
    const allowance = await checkApproval();
    const minRequired = utils.parseUnits('5', 6);
    
    if (allowance.lt(minRequired)) {
      console.log('   ⚠️  Insufficient allowance, approving now...');
      await approveTokenTransferProxy();
    } else {
      console.log('   ✅ Already approved!');
    }
    
    // Step 4: Find match with markets
    const matchData = await findMatchWithMarkets();
    const market = matchData.market;
    
    // Step 5: Get orders
    const orders = await getOrdersForMarket(market.marketHash);
    
    // Step 7: Select best order
    const selectedOrder = selectBestOrder(orders);
    
    // Step 8: Place bet
    const result = await placeBet(market, selectedOrder);
    
    console.log('\n' + '='.repeat(60));
    console.log('✅ AUTOMATED BET COMPLETED SUCCESSFULLY!\n');
    
  } catch (error) {
    console.error('\n' + '='.repeat(60));
    console.error('❌ ERROR:', error.message);
    if (error.response) {
      console.error('\nAPI Response:', JSON.stringify(error.response.data, null, 2));
    }
    console.error('='.repeat(60) + '\n');
    process.exit(1);
  }
}

// Run the script
main();
