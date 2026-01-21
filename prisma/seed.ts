import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Starting database seed...\n');

  // ============================================================================
  // NETWORKS
  // ============================================================================
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
      isActive: false,
      lastIndexedBlock: BigInt(0),
      indexerStatus: 'STOPPED',
    },
  });

  console.log(`  ✅ Created ${baseSepolia.name} and ${baseMainnet.name}\n`);

  // ============================================================================
  // ASSETS (Base Sepolia)
  // ============================================================================
  console.log('💰 Creating assets...');

  // MockUSDC - Our test token (deployed with contracts)
  const mockUSDC = await prisma.asset.upsert({
    where: {
      chainId_address: {
        chainId: 84532,
        address: '0x517e901cae0c557029309a11e400a5bcc3bb65c0',
      },
    },
    update: {},
    create: {
      chainId: 84532,
      address: '0x517e901cae0c557029309a11e400a5bcc3bb65c0',
      symbol: 'MockUSDC',
      name: 'Mock USD Coin',
      decimals: 6,
      isApproved: true,
    },
  });

  // USDC - Base Sepolia USDC
  const usdc = await prisma.asset.upsert({
    where: {
      chainId_address: {
        chainId: 84532,
        address: '0xdb787674289f636e96864de93c952d0390b5bc58',
      },
    },
    update: {},
    create: {
      chainId: 84532,
      address: '0xdb787674289f636e96864de93c952d0390b5bc58',
      symbol: 'USDC',
      name: 'USD Coin',
      decimals: 6,
      isApproved: true,
    },
  });

  // cNGN - Naira stablecoin
  const cngn = await prisma.asset.upsert({
    where: {
      chainId_address: {
        chainId: 84532,
        address: '0x929a08903c22440182646bb450a67178be402f7f',
      },
    },
    update: {},
    create: {
      chainId: 84532,
      address: '0x929a08903c22440182646bb450a67178be402f7f',
      symbol: 'cNGN',
      name: 'cNGN Stablecoin',
      decimals: 6,
      isApproved: true,
    },
  });

  console.log(`  ✅ Created ${mockUSDC.symbol}, ${usdc.symbol}, and ${cngn.symbol}\n`);

  // ============================================================================
  // SUMMARY
  // ============================================================================
  console.log('═'.repeat(60));
  console.log('✅ Seed completed successfully!');
  console.log('═'.repeat(60));
  console.log('\n📊 Summary:');
  console.log(`   Networks: 2 (Base Sepolia active, Base Mainnet inactive)`);
  console.log(`   Assets: 3 (MockUSDC, USDC, cNGN)`);
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
