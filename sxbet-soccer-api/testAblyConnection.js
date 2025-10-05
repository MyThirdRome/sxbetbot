require('dotenv').config();
const axios = require('axios');
const Ably = require('ably');

const API_BASE = 'https://api.sx.bet';
const USDC_ADDRESS = '0x6629Ce1Cf35Cc1329ebB4F63202F3f197b3F050B';

console.log('🔌 ABLY CONNECTION TEST');
console.log('======================================================================\n');

async function createTokenRequest() {
  const response = await axios.get(`${API_BASE}/user/token`, {
    headers: { 'X-Api-Key': process.env.SX_BET_API_KEY },
  });
  return response.data;
}

async function initializeAbly() {
  console.log('Initializing Ably connection...');
  
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
      console.log('✅ Connected to Ably');
      console.log(`   Connection ID: ${realtime.connection.id}`);
      console.log(`   Connection state: ${realtime.connection.state}\n`);
      resolve(realtime);
    });
    
    realtime.connection.once('failed', (error) => {
      console.log('❌ Connection failed:', error);
      reject(error);
    });
    
    realtime.connection.on('disconnected', () => {
      console.log('⚠️  Disconnected from Ably');
    });
    
    realtime.connection.on('suspended', () => {
      console.log('⚠️  Connection suspended');
    });
  });
}

async function main() {
  try {
    // Initialize Ably
    const realtime = await initializeAbly();
    
    // Test ping
    console.log('Testing connection with ping...');
    const pingStart = Date.now();
    
    realtime.connection.ping((err, responseTime) => {
      if (err) {
        console.log('❌ Ping failed:', err);
      } else {
        console.log(`✅ Ping successful: ${responseTime}ms`);
        console.log(`   Total round-trip: ${Date.now() - pingStart}ms\n`);
      }
    });
    
    // Wait for ping result
    await new Promise(resolve => setTimeout(resolve, 2000));
    
    // Get a market to subscribe to
    console.log('Fetching active market...');
    const marketsRes = await axios.get(`${API_BASE}/markets/active`, {
      params: { sportIds: 5, onlyMainLine: true }
    });
    
    const market = marketsRes.data.data.markets.find(m => m.type === 1 && m.status === 'ACTIVE');
    
    if (!market) {
      console.log('❌ No active markets found');
      realtime.close();
      return;
    }
    
    console.log(`✅ Found market: ${market.teamOneName} vs ${market.teamTwoName}`);
    console.log(`   Market hash: ${market.marketHash}\n`);
    
    // Subscribe using correct channel format: order_book_v2:{token}:{marketHash}
    const channelName = `order_book_v2:${USDC_ADDRESS}:${market.marketHash}`;
    console.log(`📡 Subscribing to channel: ${channelName}\n`);
    
    const channel = realtime.channels.get(channelName);
    
    channel.on('attached', () => {
      console.log('✅ Channel attached successfully');
    });
    
    channel.on('failed', (error) => {
      console.log('❌ Channel failed:', error);
    });
    
    channel.subscribe((message) => {
      const receiveTime = Date.now();
      console.log(`\n📨 UPDATE RECEIVED at ${new Date(receiveTime).toLocaleTimeString()}.${receiveTime % 1000}`);
      console.log(`   Message name: ${message.name || 'unknown'}`);
      console.log(`   Message timestamp: ${message.timestamp}`);
      console.log(`   Data type: ${typeof message.data}`);
      
      if (Array.isArray(message.data)) {
        console.log(`   Orders in update: ${message.data.length}`);
        
        // Show first order details
        if (message.data.length > 0) {
          const order = message.data[0];
          const decimalOdds = 1 / parseFloat(order.percentageOdds);
          const available = BigInt(order.fillAmount) - BigInt(order.filled || 0);
          console.log(`   First order: ${decimalOdds.toFixed(2)}x, Available: $${(Number(available) / 1e6).toFixed(2)}`);
        }
      } else {
        console.log(`   Data:`, JSON.stringify(message.data).substring(0, 200));
      }
    });
    
    console.log('✅ Subscribed to order book updates');
    console.log('\n⏳ Waiting for updates (will run for 2 minutes)...\n');
    
    // Keep running for 2 minutes
    await new Promise(resolve => setTimeout(resolve, 120000));
    
    console.log('\n⏱️  Test complete. Closing connection...');
    realtime.close();
    
  } catch (error) {
    console.error('\n❌ Error:', error.message);
    process.exit(1);
  }
}

main();
