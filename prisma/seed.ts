import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Starting database seed...\n');

  console.log('📡 Creating networks...');
  const baseSepolia = await prisma.network.upsert({
    where: { chainId: 84532 },
    update: {},
    create: {
      chainId: 84532,
      name: 'Base Sepolia',
      rpcUrl: 'https://sepolia.base.org',
      explorerUrl: 'https://sepolia.basescan.org',
      isTestnet: true,
      isActive: true,
      lastIndexedBlock: BigInt(0),
      indexerStatus: 'STOPPED',
    },
  });

  const baseMainnet = await prisma.network.upsert({
    where: { chainId: 8453 },
    update: {},
    create: {
      chainId: 8453,
      name: 'Base',
      rpcUrl: 'https://mainnet.base.org',
      explorerUrl: 'https://basescan.org',
      isTestnet: false,
      isActive: true,
      lastIndexedBlock: BigInt(0),
      indexerStatus: 'STOPPED',
    },
  });

  console.log(`  ✅ Created ${baseSepolia.name} and ${baseMainnet.name}\n`);

  console.log('💰 Creating assets...');
  const usdc = await prisma.asset.upsert({
    where: {
      chainId_contractAddress: {
        chainId: 84532,
        contractAddress: '0x036CbD53842c5426634e7929541eC2318f3dCF7e',
      },
    },
    update: {},
    create: {
      chainId: 84532,
      contractAddress: '0x036CbD53842c5426634e7929541eC2318f3dCF7e',
      symbol: 'USDC',
      name: 'USD Coin',
      decimals: 6,
      isActive: true,
      isApproved: true,
      riskRating: 'LOW',
    },
  });

  const mockUSDC = await prisma.asset.upsert({
    where: {
      chainId_contractAddress: {
        chainId: 84532,
        contractAddress: '0x2DD9A8b2c1b73A607ddF16814338c4b942275DDa',
      },
    },
    update: {},
    create: {
      chainId: 84532,
      contractAddress: '0x2DD9A8b2c1b73A607ddF16814338c4b942275DDa',
      symbol: 'MockUSDC',
      name: 'Mock USD Coin',
      decimals: 18,
      isActive: true,
      isApproved: true,
      riskRating: 'LOW',
    },
  });

  console.log(`  ✅ Created ${usdc.symbol} and ${mockUSDC.symbol}\n`);

  console.log('═'.repeat(60));
  console.log('✅ Seed completed successfully!');
  console.log('═'.repeat(60));
  console.log('\n📊 Summary:');
  console.log(`   Networks: 2`);
  console.log(`   Assets: 2`);
  console.log(`   Pools: 0 (create via admin dashboard)`);
  console.log(`   Users: 0 (will register via frontend)`);
  console.log('\n💡 Next steps:');
  console.log('   1. Create pools via: POST /api/v1/admin/pools/create');
  console.log('   2. Users will connect wallets and deposit');
  console.log('   3. PoolCreationWatcher will auto-index on-chain events\n');
}

main()
  .catch((e) => {
    console.error('❌ Seed failed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
