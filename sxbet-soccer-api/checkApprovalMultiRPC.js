require('dotenv').config();
const { ethers } = require('ethers');
const axios = require('axios');

const USDC_ADDRESS = '0x6629Ce1Cf35Cc1329ebB4F63202F3f197b3F050B';
const CHAIN_ID = 4162;

// Multiple RPC endpoints to try
const RPC_ENDPOINTS = [
  'https://rpc.sx.technology',
  'https://rpc.sx-rollup.gelato.digital',
  'https://sx-rollup.rpc.caldera.xyz/http',
  'https://rpc.sx.technology/http'
];

const ERC20_ABI = [
  'function balanceOf(address) view returns (uint256)',
  'function allowance(address owner, address spender) view returns (uint256)',
  'function approve(address spender, uint256 amount) returns (bool)',
  'function name() view returns (string)',
  'function symbol() view returns (string)',
  'function decimals() view returns (uint8)'
];

const EXCHANGE_ABI = [
  'function name() view returns (string)',
  'function version() view returns (string)'
];

async function testRPC(rpcUrl, wallet) {
  try {
    const provider = new ethers.providers.JsonRpcProvider(rpcUrl);
    provider.connection.timeout = 5000; // 5 second timeout
    
    // Test basic connectivity
    const network = await Promise.race([
      provider.getNetwork(),
      new Promise((_, reject) => setTimeout(() => reject(new Error('Timeout')), 5000))
    ]);
    
    if (network.chainId !== CHAIN_ID) {
      return { success: false, error: `Wrong chain ID: ${network.chainId}` };
    }
    
    // Test balance check
    const balance = await Promise.race([
      provider.getBalance(wallet.address),
      new Promise((_, reject) => setTimeout(() => reject(new Error('Timeout')), 5000))
    ]);
    
    return { 
      success: true, 
      provider,
      balance: ethers.utils.formatEther(balance)
    };
  } catch (error) {
    return { success: false, error: error.message };
  }
}

async function checkApprovalWithMultiRPC() {
  console.log('🔍 CHECKING USDC APPROVAL WITH MULTIPLE RPC ENDPOINTS');
  console.log('='.repeat(70));
  
  const wallet = new ethers.Wallet(process.env.PRIVATE_KEY);
  console.log('Wallet:', wallet.address);
  console.log('');
  
  // Get metadata
  console.log('Fetching metadata...');
  const metaResponse = await axios.get('https://api.sx.bet/metadata');
  const metadata = metaResponse.data.data;
  
  const tokenTransferProxy = metadata.TokenTransferProxy;
  const eip712FillHasher = metadata.EIP712FillHasher;
  
  console.log('TokenTransferProxy:', tokenTransferProxy);
  console.log('EIP712FillHasher:', eip712FillHasher);
  console.log('');
  
  // Try each RPC endpoint
  console.log('Testing RPC endpoints...');
  console.log('-'.repeat(70));
  
  let workingProvider = null;
  let workingRPC = null;
  
  for (const rpc of RPC_ENDPOINTS) {
    process.stdout.write(`Testing ${rpc}... `);
    const result = await testRPC(rpc, wallet);
    
    if (result.success) {
      console.log(`✅ Working! (SX Balance: ${result.balance})`);
      workingProvider = result.provider;
      workingRPC = rpc;
      break;
    } else {
      console.log(`❌ Failed: ${result.error}`);
    }
  }
  
  console.log('');
  
  if (!workingProvider) {
    console.log('❌ ALL RPC ENDPOINTS FAILED!');
    console.log('');
    console.log('Cannot check approval status or balances.');
    console.log('Please try again later or use https://sx.bet to approve manually.');
    return;
  }
  
  console.log(`✅ Using RPC: ${workingRPC}`);
  console.log('');
  
  // Connect wallet to working provider
  const connectedWallet = wallet.connect(workingProvider);
  
  // Validate USDC contract
  console.log('Validating USDC contract...');
  console.log('-'.repeat(70));
  const usdc = new ethers.Contract(USDC_ADDRESS, ERC20_ABI, workingProvider);
  
  try {
    const [name, symbol, decimals] = await Promise.all([
      usdc.name(),
      usdc.symbol(),
      usdc.decimals()
    ]);
    
    console.log('✅ USDC Contract Valid:');
    console.log('   Name:', name);
    console.log('   Symbol:', symbol);
    console.log('   Decimals:', decimals);
    console.log('   Address:', USDC_ADDRESS);
  } catch (error) {
    console.log('❌ USDC contract validation failed:', error.message);
    console.log('   The USDC address might be incorrect.');
    return;
  }
  console.log('');
  
  // Validate TokenTransferProxy contract
  console.log('Validating TokenTransferProxy contract...');
  console.log('-'.repeat(70));
  
  try {
    // Check if contract exists by getting code
    const code = await workingProvider.getCode(tokenTransferProxy);
    
    if (code === '0x') {
      console.log('❌ TokenTransferProxy has no code - not a contract!');
      console.log('   Address:', tokenTransferProxy);
      return;
    }
    
    console.log('✅ TokenTransferProxy is a valid contract');
    console.log('   Address:', tokenTransferProxy);
    console.log('   Code size:', code.length, 'bytes');
  } catch (error) {
    console.log('❌ TokenTransferProxy validation failed:', error.message);
    return;
  }
  console.log('');
  
  // Validate EIP712FillHasher contract
  console.log('Validating EIP712FillHasher contract...');
  console.log('-'.repeat(70));
  
  try {
    const code = await workingProvider.getCode(eip712FillHasher);
    
    if (code === '0x') {
      console.log('❌ EIP712FillHasher has no code - not a contract!');
      console.log('   Address:', eip712FillHasher);
      return;
    }
    
    console.log('✅ EIP712FillHasher is a valid contract');
    console.log('   Address:', eip712FillHasher);
    console.log('   Code size:', code.length, 'bytes');
  } catch (error) {
    console.log('❌ EIP712FillHasher validation failed:', error.message);
    return;
  }
  console.log('');
  
  // Check balances
  console.log('Checking balances...');
  console.log('-'.repeat(70));
  
  try {
    const sxBalance = await workingProvider.getBalance(wallet.address);
    console.log('SX Balance:', ethers.utils.formatEther(sxBalance), 'SX');
    
    const usdcBalance = await usdc.balanceOf(wallet.address);
    console.log('USDC Balance:', ethers.utils.formatUnits(usdcBalance, 6), 'USDC');
    console.log('');
    
    if (sxBalance.eq(0)) {
      console.log('⚠️  No SX for gas! You need SX to:');
      console.log('   - Approve the TokenTransferProxy');
      console.log('   - Send any transactions');
      console.log('');
    }
    
    if (usdcBalance.eq(0)) {
      console.log('⚠️  No USDC! You need USDC to place bets.');
      console.log('');
    }
  } catch (error) {
    console.log('❌ Failed to check balances:', error.message);
    return;
  }
  
  // Check allowance
  console.log('Checking USDC allowance...');
  console.log('-'.repeat(70));
  
  try {
    const allowance = await usdc.allowance(wallet.address, tokenTransferProxy);
    console.log('Current Allowance:', ethers.utils.formatUnits(allowance, 6), 'USDC');
    console.log('');
    
    if (allowance.gt(0)) {
      console.log('✅ ALREADY APPROVED!');
      console.log('   TokenTransferProxy can spend up to', ethers.utils.formatUnits(allowance, 6), 'USDC');
      console.log('   You can now place bets!');
      console.log('');
      
      // Check if it's max approval
      if (allowance.eq(ethers.constants.MaxUint256)) {
        console.log('   (Unlimited approval - MaxUint256)');
      }
    } else {
      console.log('❌ NOT APPROVED');
      console.log('   Allowance is 0 - TokenTransferProxy cannot spend your USDC');
      console.log('');
      console.log('TO APPROVE:');
      console.log('   Option 1: Go to https://sx.bet and make a test bet');
      console.log('   Option 2: Run the approval script (requires SX for gas)');
      console.log('');
      
      // Check if we have gas to approve
      const sxBalance = await workingProvider.getBalance(wallet.address);
      if (sxBalance.gt(0)) {
        console.log('   You have SX for gas. Would you like to approve now?');
        console.log('   Run: node approveUSDC.js');
      } else {
        console.log('   ⚠️  You need SX for gas before you can approve.');
      }
    }
  } catch (error) {
    console.log('❌ Failed to check allowance:', error.message);
    return;
  }
  
  console.log('');
  console.log('='.repeat(70));
  console.log('SUMMARY');
  console.log('='.repeat(70));
  console.log('Working RPC:', workingRPC);
  console.log('USDC Contract: ✅ Valid');
  console.log('TokenTransferProxy: ✅ Valid');
  console.log('EIP712FillHasher: ✅ Valid');
}

checkApprovalWithMultiRPC().catch(console.error);
