const { PrismaClient } = require('@prisma/client');

const POOL_ADDRESS = '0x51E33dbf7Fa275Dc9A9e48c86D373AA7b75745A5';
const prisma = new PrismaClient();

async function main() {
  console.log('📊 Pool Analytics Check');
  console.log('='.repeat(60));

  const pool = await prisma.pool.findFirst({
    where: {
      poolAddress: POOL_ADDRESS.toLowerCase(),
      chainId: 84532,
    },
    include: {
      analytics: true,
      _count: {
        select: {
          positions: true,
          transactions: true,
        },
      },
    },
  });

  if (!pool) {
    throw new Error('Pool not found');
  }

  console.log('Pool:', pool.name);
  console.log('Address:', pool.poolAddress);
  console.log('\n📈 Analytics:');
  console.log('   TVL:', pool.analytics.totalValueLocked.toString(), pool.assetSymbol);
  console.log('   Total Shares:', pool.analytics.totalShares.toString());
  console.log('   Total Deposits:', pool.analytics.totalDeposits.toString(), pool.assetSymbol);
  console.log('   Net Flow:', pool.analytics.netFlow.toString(), pool.assetSymbol);
  console.log('   Unique Investors:', pool.analytics.uniqueInvestors);
  
  console.log('\n📊 Counts:');
  console.log('   Active Positions:', pool._count.positions);
  console.log('   Transactions:', pool._count.transactions);

  // Get all positions
  const positions = await prisma.poolPosition.findMany({
    where: {
      poolId: pool.id,
      isActive: true,
    },
    include: {
      user: {
        select: {
          walletAddress: true,
        },
      },
    },
  });

  console.log('\n👥 Active Positions:');
  positions.forEach((pos, idx) => {
    console.log(`   ${idx + 1}. ${pos.user.walletAddress}`);
    console.log(`      Deposited: ${pos.totalDeposited} ${pool.assetSymbol}`);
    console.log(`      Shares: ${pos.totalShares}`);
  });

  console.log('\n' + '='.repeat(60));
  console.log('✅ Check complete!');
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });

