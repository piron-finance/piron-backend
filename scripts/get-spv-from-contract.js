#!/usr/bin/env node
/**
 * Get SPV Addresses from PoolRegistry
 * This script reads SPV addresses directly from the on-chain PoolRegistry
 */

const { ethers } = require('ethers');
const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient({
  log: ['error', 'warn'],
});

// PoolRegistry ABI - getStableYieldPoolData function
const POOL_REGISTRY_ABI = [
  {
    "type": "function",
    "name": "getStableYieldPoolData",
    "inputs": [
      { "name": "poolAddress", "type": "address", "internalType": "address" }
    ],
    "outputs": [
      {
        "name": "",
        "type": "tuple",
        "internalType": "struct IPoolRegistry.StableYieldPoolData",
        "components": [
          { "name": "poolAddress", "type": "address", "internalType": "address" },
          { "name": "escrow", "type": "address", "internalType": "address" },
          { "name": "manager", "type": "address", "internalType": "address" },
          { "name": "asset", "type": "address", "internalType": "address" },
          { "name": "spvAddress", "type": "address", "internalType": "address" },
          { "name": "name", "type": "string", "internalType": "string" },
          { "name": "isActive", "type": "bool", "internalType": "bool" },
          { "name": "createdAt", "type": "uint256", "internalType": "uint256" }
        ]
      }
    ],
    "stateMutability": "view"
  }
];

const POOL_REGISTRY_ADDRESS = '0x16308CeEB1Ee44Afc7c731B567D3135E1B2752e3';

async function main() {
  console.log('=== Getting SPV Addresses from PoolRegistry ===\n');

  try {
    // Setup provider
    const RPC_URL = process.env.BASE_SEPOLIA_RPC_URL || 'https://sepolia.base.org';
    const provider = new ethers.JsonRpcProvider(RPC_URL);
    
    console.log('Connected to:', RPC_URL);
    console.log('Pool Registry:', POOL_REGISTRY_ADDRESS);
    console.log('');

    // Connect to PoolRegistry
    const poolRegistry = new ethers.Contract(
      POOL_REGISTRY_ADDRESS,
      POOL_REGISTRY_ABI,
      provider
    );

    // Query all active Stable Yield pools from DB
    const pools = await prisma.pool.findMany({
      where: {
        isActive: true,
        poolType: 'STABLE_YIELD',
        chainId: 84532,
      },
      select: {
        id: true,
        name: true,
        poolAddress: true,
        escrowAddress: true,
        spvAddress: true, // DB value (might be outdated)
        status: true,
        assetSymbol: true,
        projectedAPY: true,
        createdAt: true,
      },
      orderBy: {
        createdAt: 'desc',
      },
    });

    if (pools.length === 0) {
      console.log('No active Stable Yield pools found in database.');
      return;
    }

    console.log(`Found ${pools.length} active Stable Yield pool(s) in database:\n`);

    const spvAddresses = [];

    for (const [index, pool] of pools.entries()) {
      console.log(`${index + 1}. ${pool.name}`);
      console.log(`   Pool Address:    ${pool.poolAddress}`);
      console.log(`   Escrow Address:  ${pool.escrowAddress || 'NOT SET'}`);
      
      // Only query on-chain if pool has been deployed (has poolAddress)
      if (pool.poolAddress && pool.poolAddress !== '') {
        try {
          // Get pool data from PoolRegistry
          const poolData = await poolRegistry.getStableYieldPoolData(pool.poolAddress);
          
          console.log(`   SPV Address:     ${poolData.spvAddress}`);
          
          // Track unique SPV addresses
          if (poolData.spvAddress && poolData.spvAddress !== ethers.ZeroAddress) {
            spvAddresses.push({
              spv: poolData.spvAddress,
              poolName: pool.name,
              poolAddress: pool.poolAddress
            });
          }
          
          // Check if DB value matches
          if (pool.spvAddress) {
            const matches = pool.spvAddress.toLowerCase() === poolData.spvAddress.toLowerCase();
            if (!matches) {
              console.log(`   ⚠️  DB SPV (${pool.spvAddress}) doesn't match on-chain!`);
            }
          } else {
            console.log(`   ⚠️  SPV not stored in DB - should update!`);
          }
          
        } catch (error) {
          console.log(`   ❌ Error reading from PoolRegistry: ${error.message}`);
        }
      } else {
        console.log(`   SPV Address:     ${pool.spvAddress || 'NOT SET (Pool not deployed yet)'}`);
      }
      
      console.log(`   Status:          ${pool.status}`);
      console.log(`   Asset:           ${pool.assetSymbol}`);
      console.log(`   Projected APY:   ${pool.projectedAPY}%`);
      console.log('');
    }

    console.log('\n=== Summary ===');
    
    if (spvAddresses.length > 0) {
      console.log(`\nPools with SPV assigned: ${spvAddresses.length}`);
      console.log('\n=== Unique SPV Addresses ===');
      
      // Group by SPV address
      const spvMap = {};
      spvAddresses.forEach(item => {
        if (!spvMap[item.spv]) {
          spvMap[item.spv] = [];
        }
        spvMap[item.spv].push(item.poolName);
      });
      
      Object.entries(spvMap).forEach(([spv, poolNames], index) => {
        console.log(`\n${index + 1}. ${spv}`);
        console.log(`   Managing ${poolNames.length} pool(s):`);
        poolNames.forEach(name => console.log(`   - ${name}`));
      });
    } else {
      console.log('No pools with SPV addresses found.');
    }
    
    console.log('\n✅ Check complete!');

  } catch (error) {
    console.error('Error:', error);
    process.exit(1);
  }
}

main()
  .catch((error) => {
    console.error('Fatal error:', error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

