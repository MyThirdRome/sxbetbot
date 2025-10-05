const axios = require('axios');
require('dotenv').config();

const API_BASE_URL = 'https://api.sx.bet';
const SOCCER_SPORT_ID = 5;

// Popular soccer leagues
const SOCCER_LEAGUES = [
  { id: 29, name: 'English Premier League' },
  { id: 1114, name: 'La Liga' },
  { id: 244, name: 'Bundesliga' },
  { id: 1113, name: 'Serie A' },
  { id: 1112, name: 'Ligue 1' },
  { id: 30, name: 'Champions League' },
  { id: 1197, name: 'UEFA Nations League' },
  { id: 1236, name: 'Portugal Primeira Liga' }
];

async function getTodaysSoccerEvents() {
  try {
    console.log('Fetching today\'s soccer fixtures from sx.bet API...\n');

    // Get today's date range (start and end of day in UTC)
    const now = new Date();
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const todayEnd = new Date(todayStart);
    todayEnd.setDate(todayEnd.getDate() + 1);

    console.log(`Looking for fixtures on: ${todayStart.toDateString()}\n`);
    console.log('='.repeat(80));

    const allFixtures = [];
    
    // Fetch fixtures from each league
    for (const league of SOCCER_LEAGUES) {
      try {
        const response = await axios.get(`${API_BASE_URL}/fixture/active`, {
          params: {
            leagueId: league.id
          }
        });

        if (response.data.status === 'success' && response.data.data) {
          const fixtures = response.data.data;
          
          // Filter for today's fixtures
          const todaysFixtures = fixtures.filter(fixture => {
            const fixtureDate = new Date(fixture.startDate);
            return fixtureDate >= todayStart && fixtureDate < todayEnd;
          });

          if (todaysFixtures.length > 0) {
            console.log(`\n${league.name}: ${todaysFixtures.length} fixture(s)`);
            todaysFixtures.forEach(fixture => {
              allFixtures.push({
                ...fixture,
                leagueLabel: league.name
              });
            });
          }
        }
      } catch (error) {
        // Skip leagues that error out
        console.log(`  ⚠️  Could not fetch ${league.name}`);
      }
    }

    console.log('\n' + '='.repeat(80));

    
    if (allFixtures.length === 0) {
      console.log('\n❌ No soccer fixtures found for today');
      return [];
    }

    // Sort fixtures by time
    allFixtures.sort((a, b) => new Date(a.startDate) - new Date(b.startDate));

    console.log(`\n\nTODAY'S SOCCER FIXTURES (${allFixtures.length} total)\n`);
    console.log('='.repeat(80));

    // Display results grouped by league
    const fixturesByLeague = {};
    allFixtures.forEach(fixture => {
      if (!fixturesByLeague[fixture.leagueLabel]) {
        fixturesByLeague[fixture.leagueLabel] = [];
      }
      fixturesByLeague[fixture.leagueLabel].push(fixture);
    });

    let fixtureNumber = 1;
    Object.keys(fixturesByLeague).forEach(leagueName => {
      console.log(`\n📋 ${leagueName}`);
      console.log('-'.repeat(80));
      
      fixturesByLeague[leagueName].forEach(fixture => {
        const fixtureDate = new Date(fixture.startDate);
        const timeString = fixtureDate.toLocaleTimeString('en-US', { 
          hour: '2-digit', 
          minute: '2-digit',
          hour12: true 
        });
        
        const statusEmoji = fixture.status === 1 ? '⏰' : 
                           fixture.status === 2 ? '🔴' : 
                           fixture.status === 3 ? '✅' : '⚠️';
        
        console.log(`\n  ${fixtureNumber}. ${statusEmoji} ${fixture.participantOneName} vs ${fixture.participantTwoName}`);
        console.log(`     Time: ${timeString} (${fixtureDate.toUTCString()})`);
        console.log(`     Event ID: ${fixture.eventId}`);
        console.log(`     Status: ${getStatusLabel(fixture.status)}`);
        
        fixtureNumber++;
      });
    });

    console.log('\n' + '='.repeat(80));
    console.log(`\n✅ Total fixtures today: ${allFixtures.length}\n`);

    return allFixtures;

  } catch (error) {
    console.error('Error fetching soccer fixtures:', error.message);
    if (error.response) {
      console.error('Response status:', error.response.status);
      console.error('Response data:', error.response.data);
    }
    throw error;
  }
}

function getStatusLabel(status) {
  const statusMap = {
    1: 'Not Started',
    2: 'In Progress (LIVE)',
    3: 'Finished',
    4: 'Cancelled',
    5: 'Postponed',
    6: 'Interrupted',
    7: 'Abandoned',
    8: 'Coverage Lost',
    9: 'About to Start'
  };
  return statusMap[status] || `Unknown (${status})`;
}

// Run the function
if (require.main === module) {
  getTodaysSoccerEvents()
    .then((fixtures) => {
      if (fixtures.length > 0) {
        console.log('✅ Successfully fetched soccer fixtures');
      }
      process.exit(0);
    })
    .catch((error) => {
      console.error('❌ Failed to fetch soccer fixtures');
      process.exit(1);
    });
}

module.exports = { getTodaysSoccerEvents };
