const axios = require('axios');
require('dotenv').config();

const API_BASE_URL = 'https://api.sx.bet';
const SOCCER_SPORT_ID = 5;

async function getActiveSoccerLeagues() {
  try {
    console.log('Fetching active soccer leagues from sx.bet API...\n');

    const response = await axios.get(`${API_BASE_URL}/leagues/active`, {
      params: {
        sportId: SOCCER_SPORT_ID
      }
    });

    if (response.data.status !== 'success') {
      throw new Error('API request failed');
    }

    const leagues = response.data.data;
    
    console.log(`Found ${leagues.length} active soccer leagues\n`);
    console.log('='.repeat(80));

    leagues.forEach((league, index) => {
      console.log(`\n${index + 1}. ${league.label} (ID: ${league.leagueId})`);
      console.log(`   Sport ID: ${league.sportId}`);
      
      if (league.eventsByType) {
        const eventTypes = Object.entries(league.eventsByType);
        console.log(`   Event Types:`);
        eventTypes.forEach(([type, count]) => {
          console.log(`      - ${type}: ${count} events`);
        });
      }
    });

    console.log('\n' + '='.repeat(80));
    console.log(`\nTotal active soccer leagues: ${leagues.length}\n`);

    return leagues;

  } catch (error) {
    console.error('Error fetching active leagues:', error.message);
    if (error.response) {
      console.error('Response status:', error.response.status);
      console.error('Response data:', error.response.data);
    }
    throw error;
  }
}

// Run the function
if (require.main === module) {
  getActiveSoccerLeagues()
    .then(() => {
      console.log('✅ Successfully fetched active soccer leagues');
      process.exit(0);
    })
    .catch((error) => {
      console.error('❌ Failed to fetch active soccer leagues');
      process.exit(1);
    });
}

module.exports = { getActiveSoccerLeagues };
