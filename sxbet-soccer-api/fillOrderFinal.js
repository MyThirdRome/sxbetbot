require('dotenv').config();
const axios = require('axios');
const { ethers } = require('ethers');
const { signTypedData, SignTypedDataVersion } = require('@metamask/eth-sig-util');

const API_BASE = 'https://api.sx.bet';
const USDC_ADDRESS = '0x6629Ce1Cf35Cc1329ebB4F63202F3f197b3F050B';
const CHAIN_ID = 4162;
const WORKING_RPC = 'https://rpc.sx-rollup.gelato.digital';

const provider = new ethers.providers.JsonRpcProvider(WORKING_RPC);
const wallet = new ethers.Wallet(process.env.PRIVATE_KEY, provider);

async function fillOrderFinal() {
  console.log('🎯 FILLING ORDER WITH CORRECT DOCUMENTATION STRUCTURE');
  console.log('='.repeat(70));
  console.log('Wallet:', wallet.address);
  console.log('');
  
  // Get metadata
  const metaResponse = await axios.get(`${API_BASE}/metadata`);
  const metadata = metaResponse.data.data;
  
  // Get any active soccer market with orders
  const marketsResp = await axios.get(`${API_BASE}/markets/active`, {
    params: { sportIds: 5, onlyMainLine: true }
  });
  
  const allMarkets = marketsResp.data.data.markets.filter(m => m.type === 1 && m.status === 'ACTIVE');
  
  if (allMarkets.length === 0) {
    console.log('❌ No active markets found');
    return;
  }
  
  // Try to find a market with orders
  let market = null;
  let orders = [];
  
  for (const m of allMarkets.slice(0, 10)) { // Check first 10 markets
    const ordersResp = await axios.get(`${API_BASE}/orders`, {
      params: { marketHashes: m.marketHash, baseToken: USDC_ADDRESS }
    });
    
    const marketOrders = ordersResp.data.data;
    if (marketOrders && marketOrders.length > 0) {
      market = m;
      orders = marketOrders;
      break;
    }
  }
  
  if (!market) {
    console.log('❌ No markets with active orders found');
    return;
  }
  
  console.log('Found market:', market.teamOneName, 'vs', market.teamTwoName);
  console.log('');
  
  // Find best YES order (already fetched above)
  let bestOrder = null;
  let bestOdds = 0;
  
  for (const o of orders) {
    if (o.isMakerBettingOutcomeOne && o.orderStatus === 'ACTIVE') {
      const makerOdds = parseFloat(o.percentageOdds) / 1e20;
      const decimalOdds = 1 / makerOdds;
      const available = BigInt(o.totalBetSize) - BigInt(o.fillAmount || '0');
      
      if (available >= BigInt(5000000) && decimalOdds > bestOdds) {
        bestOdds = decimalOdds;
        bestOrder = o;
      }
    }
  }
  
  if (!bestOrder) {
    console.log('❌ No suitable order found');
    return;
  }
  
  const makerOdds = parseFloat(bestOrder.percentageOdds) / 1e20;
  const decimalOdds = 1 / makerOdds;
  const stakeWei = '5000000'; // 5 USDC
  const fillAmountNum = 5;
  const potentialWin = fillAmountNum * decimalOdds;
  
  console.log('Selected Order:', bestOrder.orderHash);
  console.log('Odds:', decimalOdds.toFixed(2) + 'x');
  console.log('Stake:', fillAmountNum, 'USDC');
  console.log('Potential Win:', potentialWin.toFixed(2), 'USDC');
  console.log('');
  
  const fillSalt = Date.now().toString();
  // Use the exact odds from the order we selected
  const desiredOdds = bestOrder.percentageOdds; // Exact odds from the order
  const oddsSlippage = 1; // 1% slippage - very tight to get exact odds
  
  // Create EIP-712 signature using CORRECT structure from documentation
  console.log('Creating EIP-712 signature with documentation structure...');
  
  const signingPayload = {
    types: {
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
    },
    primaryType: 'Details',
    domain: {
      name: 'SX Bet',
      version: metadata.domainVersion,
      chainId: CHAIN_ID,
      verifyingContract: metadata.EIP712FillHasher,
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
        isTakerBettingOutcomeOne: true,
        fillSalt,
        beneficiary: ethers.constants.AddressZero,
        beneficiaryType: 0,
        cashOutTarget: ethers.constants.HashZero,
      },
    },
  };
  
  const signature = signTypedData({
    privateKey: Buffer.from(process.env.PRIVATE_KEY.replace('0x', ''), 'hex'),
    data: signingPayload,
    version: SignTypedDataVersion.V4,
  });
  
  console.log('✅ Signature created');
  console.log('');
  
  // Build API payload
  const apiPayload = {
    market: market.marketHash,
    baseToken: USDC_ADDRESS,
    isTakerBettingOutcomeOne: true,
    stakeWei,
    desiredOdds,
    oddsSlippage,
    taker: wallet.address,
    takerSig: signature,
    fillSalt,
  };
  
  console.log('📤 SENDING FILL REQUEST:');
  console.log('-'.repeat(70));
  console.log('Market:', market.teamOneName, 'vs', market.teamTwoName);
  console.log('Betting on:', market.teamOneName);
  console.log('Stake:', fillAmountNum, 'USDC');
  console.log('Desired Odds:', decimalOdds.toFixed(2) + 'x');
  console.log('Slippage:', oddsSlippage + '%');
  console.log('');
  
  try {
    console.log('Sending request...');
    const response = await axios.post(`${API_BASE}/orders/fill/v2`, apiPayload, {
      timeout: 30000,
      headers: {
        'Content-Type': 'application/json',
      },
    });
    
    console.log('');
    console.log('✅ SUCCESS!');
    console.log('='.repeat(70));
    console.log(JSON.stringify(response.data, null, 2));
    console.log('');
    
    if (response.data.status === 'success') {
      const result = response.data.data;
      
      console.log('🎉 BET PLACED!');
      console.log('   Fill Hash:', result.fillHash);
      console.log('   Total Filled:', (parseFloat(result.totalFilled) / 1e6).toFixed(2), 'USDC');
      console.log('   Partial Fill:', result.isPartialFill);
      
      if (result.averageOdds) {
        const actualMakerOdds = parseFloat(result.averageOdds) / 1e20;
        const actualDecimalOdds = 1 / actualMakerOdds;
        console.log('   Average Odds:', actualDecimalOdds.toFixed(2) + 'x');
        
        const actualWin = (parseFloat(result.totalFilled) / 1e6) * actualDecimalOdds;
        console.log('   Potential Win:', actualWin.toFixed(2), 'USDC');
        console.log('   Potential Profit:', (actualWin - parseFloat(result.totalFilled) / 1e6).toFixed(2), 'USDC');
      }
    }
    
  } catch (error) {
    console.log('');
    console.log('❌ FAILED');
    console.log('='.repeat(70));
    
    if (error.response) {
      console.log('Status:', error.response.status);
      console.log('Error:', JSON.stringify(error.response.data, null, 2));
      
      if (error.response.data.message) {
        console.log('');
        console.log('Message:', error.response.data.message);
      }
    } else {
      console.log('Error:', error.message);
    }
  }
}

fillOrderFinal().catch(console.error);
