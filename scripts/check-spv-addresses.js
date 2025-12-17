#!/usr/bin/env node
/**
 * Check SPV Addresses for Current Pools
 * This script queries the database for all pools and their assigned SPV addresses
 */

const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient({
  log: ['error', 'warn'],
});

async function main() {
  console.log('=== SPV Wallet Addresses for Current Pools ===\n');

  try {
    // Query all pools with their SPV addresses
    const pools = await prisma.pool.findMany({
      where: {
        isActive: true,
        poolType: 'STABLE_YIELD', // SPV addresses are only for Stable Yield pools
      },
      select: {
        id: true,
        name: true,
        poolAddress: true,
        spvAddress: true,
        status: true,
        assetSymbol: true,
        projectedAPY: true,
        chainId: true,
        createdAt: true,
      },
      orderBy: {
        createdAt: 'desc',
      },
    });

    if (pools.length === 0) {
      console.log('No active Stable Yield pools found.');
      return;
    }

    console.log(`Found ${pools.length} active Stable Yield pool(s):\n`);

    pools.forEach((pool, index) => {
      console.log(`${index + 1}. ${pool.name}`);
      console.log(`   Pool Address:  ${pool.poolAddress}`);
      console.log(`   SPV Address:   ${pool.spvAddress || 'NOT ASSIGNED'}`);
      console.log(`   Status:        ${pool.status}`);
      console.log(`   Asset:         ${pool.assetSymbol}`);
      console.log(`   Projected APY: ${pool.projectedAPY}%`);
      console.log(`   Chain ID:      ${pool.chainId}`);
      console.log(`   Created:       ${pool.createdAt.toISOString()}`);
      console.log('');
    });

    // Summary
    console.log('\n=== Summary ===');
    const poolsWithSPV = pools.filter(p => p.spvAddress);
    const poolsWithoutSPV = pools.filter(p => !p.spvAddress);
    
    console.log(`Pools with SPV assigned: ${poolsWithSPV.length}`);
    console.log(`Pools without SPV: ${poolsWithoutSPV.length}`);

    if (poolsWithSPV.length > 0) {
      console.log('\n=== Unique SPV Addresses ===');
      const uniqueSPVs = [...new Set(poolsWithSPV.map(p => p.spvAddress))];
      uniqueSPVs.forEach((spv, index) => {
        const poolCount = poolsWithSPV.filter(p => p.spvAddress === spv).length;
        console.log(`${index + 1}. ${spv} (managing ${poolCount} pool(s))`);
      });
    }

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


