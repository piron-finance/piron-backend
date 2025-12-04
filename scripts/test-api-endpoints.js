const http = require('http');

const BASE_URL = 'http://localhost:3008/api/v1';
const POOL_ADDRESS = '0x51E33dbf7Fa275Dc9A9e48c86D373AA7b75745A5';
const USER_ADDRESS = '0x6e9150717c8a810ddbcb1aa1d459c399efbed2a5';

function makeRequest(path) {
  return new Promise((resolve, reject) => {
    http
      .get(`${BASE_URL}${path}`, (res) => {
        let data = '';
        res.on('data', (chunk) => (data += chunk));
        res.on('end', () => {
          try {
            resolve(JSON.parse(data));
          } catch (e) {
            resolve(data);
          }
        });
      })
      .on('error', reject);
  });
}

async function main() {
  console.log('🧪 Testing API Endpoints');
  console.log('='.repeat(60));

  try {
    // Test 1: Pool Details
    console.log('\n1️⃣  Testing Pool Details');
    console.log(`GET ${BASE_URL}/pools/${POOL_ADDRESS}`);
    const poolDetails = await makeRequest(`/pools/${POOL_ADDRESS}`);

    if (poolDetails.analytics) {
      console.log('✅ Analytics found:');
      console.log('   TVL:', poolDetails.analytics.totalValueLocked);
      console.log('   Shares:', poolDetails.analytics.totalShares);
      console.log('   Investors:', poolDetails.analytics.uniqueInvestors);
    } else {
      console.log('❌ No analytics data');
    }

    // Test 2: Pool Transactions
    console.log('\n2️⃣  Testing Pool Transactions');
    console.log(`GET ${BASE_URL}/pools/${POOL_ADDRESS}/transactions`);
    const poolTxs = await makeRequest(`/pools/${POOL_ADDRESS}/transactions`);

    if (poolTxs.data) {
      console.log(`✅ Found ${poolTxs.data.length} transactions`);
      poolTxs.data.forEach((tx, idx) => {
        console.log(`   ${idx + 1}. ${tx.type}: ${tx.amount} (${tx.txHash.substring(0, 10)}...)`);
      });
    } else {
      console.log('❌ No transaction data');
    }

    // Test 3: User Transactions
    console.log('\n3️⃣  Testing User Transactions');
    console.log(`GET ${BASE_URL}/users/${USER_ADDRESS}/transactions`);
    const userTxs = await makeRequest(`/users/${USER_ADDRESS}/transactions`);

    if (userTxs.data) {
      console.log(`✅ Found ${userTxs.data.length} transactions`);
      userTxs.data.forEach((tx, idx) => {
        console.log(`   ${idx + 1}. ${tx.type}: ${tx.amount} at ${tx.pool?.name || 'Unknown'}`);
      });
    } else {
      console.log('❌ No transaction data');
    }

    // Test 4: User Position
    console.log('\n4️⃣  Testing User Position');
    console.log(`GET ${BASE_URL}/users/${USER_ADDRESS}/positions/${POOL_ADDRESS}`);
    const userPosition = await makeRequest(`/users/${USER_ADDRESS}/positions/${POOL_ADDRESS}`);

    if (userPosition.position) {
      console.log('✅ Position found:');
      console.log('   Deposited:', userPosition.position.totalDeposited);
      console.log('   Shares:', userPosition.position.totalShares);
      console.log('   Current Value:', userPosition.position.currentValue);
    } else {
      console.log('❌ No position data');
    }

    // Test 5: All Pools
    console.log('\n5️⃣  Testing All Pools List');
    console.log(`GET ${BASE_URL}/pools`);
    const allPools = await makeRequest(`/pools`);

    if (allPools.data) {
      console.log(`✅ Found ${allPools.data.length} pools`);
      allPools.data.forEach((pool) => {
        console.log(`   - ${pool.name}`);
        if (pool.analytics) {
          console.log(
            `     TVL: ${pool.analytics.totalValueLocked}, Investors: ${pool.analytics.uniqueInvestors}`,
          );
        } else {
          console.log(`     ❌ No analytics`);
        }
      });
    } else {
      console.log('❌ No pools data');
    }

    console.log('\n' + '='.repeat(60));
    console.log('✅ API Test Complete');
  } catch (error) {
    console.error('\n❌ Error:', error.message);
    throw error;
  }
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
