/**
 * Test script to verify odds calculations are correct
 */

console.log('🧪 TESTING ODDS CALCULATIONS\n');
console.log('='.repeat(60));

// Example from the actual bet placed
const makerOddsProtocol = '82380000000000000000'; // From API response
const makerOdds = parseFloat(makerOddsProtocol) / 1e20;

console.log('\n📊 Example from actual bet:');
console.log(`   Maker odds (protocol): ${makerOddsProtocol}`);
console.log(`   Maker odds (decimal): ${makerOdds}`);
console.log(`   Maker odds (percentage): ${(makerOdds * 100).toFixed(2)}%`);

// OLD INCORRECT CALCULATION
const takerOddsOLD = 1 - makerOdds;
const decimalOddsOLD = 1 / takerOddsOLD;
const returnOLD = 5 * decimalOddsOLD;

console.log('\n❌ OLD INCORRECT CALCULATION:');
console.log(`   Taker odds: ${(takerOddsOLD * 100).toFixed(2)}%`);
console.log(`   Decimal odds: ${decimalOddsOLD.toFixed(2)}x`);
console.log(`   Return on 5 USDC: ${returnOLD.toFixed(2)} USDC`);
console.log(`   Profit: ${(returnOLD - 5).toFixed(2)} USDC`);

// NEW CORRECT CALCULATION
const decimalOddsNEW = 1 / makerOdds;
const returnNEW = 5 * decimalOddsNEW;

console.log('\n✅ NEW CORRECT CALCULATION:');
console.log(`   Maker odds: ${(makerOdds * 100).toFixed(2)}% (what you pay)`);
console.log(`   Decimal odds: ${decimalOddsNEW.toFixed(2)}x`);
console.log(`   Return on 5 USDC: ${returnNEW.toFixed(2)} USDC`);
console.log(`   Profit: ${(returnNEW - 5).toFixed(2)} USDC`);

console.log('\n' + '='.repeat(60));

// Verify with known examples
console.log('\n🔍 VERIFICATION WITH KNOWN EXAMPLES:\n');

const examples = [
  { makerOdds: 0.50, expectedDecimal: 2.00, description: 'Even odds (50/50)' },
  { makerOdds: 0.75, expectedDecimal: 1.33, description: 'Favorite (75% chance)' },
  { makerOdds: 0.25, expectedDecimal: 4.00, description: 'Underdog (25% chance)' },
  { makerOdds: 0.8238, expectedDecimal: 1.21, description: 'Your actual bet' }
];

examples.forEach((example, index) => {
  const calculated = 1 / example.makerOdds;
  const match = Math.abs(calculated - example.expectedDecimal) < 0.01 ? '✅' : '❌';
  
  console.log(`${index + 1}. ${example.description}`);
  console.log(`   Maker odds: ${(example.makerOdds * 100).toFixed(2)}%`);
  console.log(`   Expected decimal: ${example.expectedDecimal.toFixed(2)}x`);
  console.log(`   Calculated decimal: ${calculated.toFixed(2)}x`);
  console.log(`   ${match} ${match === '✅' ? 'CORRECT' : 'INCORRECT'}\n`);
});

console.log('='.repeat(60));

// Explain the correct formula
console.log('\n📚 CORRECT FORMULA EXPLANATION:\n');
console.log('In sx.bet API:');
console.log('  - percentageOdds = MAKER odds (implied probability)');
console.log('  - This is what the TAKER pays (probability of outcome)');
console.log('  - Decimal odds for TAKER = 1 / makerOdds');
console.log('  - Return = Stake × Decimal odds');
console.log('  - Profit = Return - Stake');
console.log('\nExample:');
console.log('  - Maker odds: 82.38% (0.8238)');
console.log('  - Decimal odds: 1 / 0.8238 = 1.21x');
console.log('  - Stake: 5 USDC');
console.log('  - Return: 5 × 1.21 = 6.05 USDC');
console.log('  - Profit: 6.05 - 5 = 1.05 USDC ✅');

console.log('\n' + '='.repeat(60) + '\n');
