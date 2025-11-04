import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Starting database seed...\n');

  // ============================================================================
  // 1. Create Networks
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
      name: 'Base Mainnet',
      rpcUrl: 'https://mainnet.base.org',
      explorerUrl: 'https://basescan.org',
      isTestnet: false,
      isActive: true,
      lastIndexedBlock: BigInt(0),
      indexerStatus: 'STOPPED',
    },
  });
  console.log('✅ Networks created\n');

  // ============================================================================
  // 2. Create Assets
  // ============================================================================
  console.log('💰 Creating assets...');
  const usdc = await prisma.asset.upsert({
    where: {
      chainId_address: { chainId: 84532, address: '0x036CbD53842c5426634e7929541eC2318f3dCF7e' },
    },
    update: {},
    create: {
      chainId: 84532,
      address: '0x036CbD53842c5426634e7929541eC2318f3dCF7e',
      symbol: 'USDC',
      name: 'USD Coin',
      decimals: 6,
      country: 'United States',
      region: 'North America',
      isStablecoin: true,
      isApproved: true,
      currentPrice: 1.0,
      logoUrl: 'https://cryptologos.cc/logos/usd-coin-usdc-logo.png',
    },
  });

  const cngn = await prisma.asset.upsert({
    where: {
      chainId_address: { chainId: 84532, address: '0x1234567890123456789012345678901234567890' },
    },
    update: {},
    create: {
      chainId: 84532,
      address: '0x1234567890123456789012345678901234567890',
      symbol: 'cNGN',
      name: 'Canza NGN Stablecoin',
      decimals: 18,
      country: 'Nigeria',
      region: 'West Africa',
      isStablecoin: true,
      isApproved: true,
      currentPrice: 0.00067, // 1 NGN = ~$0.00067
      logoUrl: 'https://example.com/cngn-logo.png',
    },
  });
  console.log('✅ Assets created\n');

  // ============================================================================
  // 3. Create Users
  // ============================================================================
  console.log('👥 Creating users...');
  const users = await Promise.all([
    prisma.user.upsert({
      where: { walletAddress: '0x1111111111111111111111111111111111111111' },
      update: {},
      create: {
        walletAddress: '0x1111111111111111111111111111111111111111',
        email: 'alice@example.com',
        userType: 'REGULAR_USER',
        kycStatus: 'APPROVED',
        region: 'NIGERIA',
        isActive: true,
        lastLoginAt: new Date(),
        profile: {
          create: {
            firstName: 'Alice',
            lastName: 'Johnson',
            dateOfBirth: new Date('1995-06-15'),
            phoneNumber: '+2348012345678',
            country: 'Nigeria',
            city: 'Lagos',
            riskTolerance: 'MEDIUM',
            preferredAssets: ['USDC', 'cNGN'],
          },
        },
      },
    }),
    prisma.user.upsert({
      where: { walletAddress: '0x2222222222222222222222222222222222222222' },
      update: {},
      create: {
        walletAddress: '0x2222222222222222222222222222222222222222',
        email: 'bob@example.com',
        userType: 'REGULAR_USER',
        kycStatus: 'APPROVED',
        region: 'GHANA',
        isActive: true,
        profile: {
          create: {
            firstName: 'Bob',
            lastName: 'Mensah',
            dateOfBirth: new Date('1990-03-22'),
            phoneNumber: '+233501234567',
            country: 'Ghana',
            city: 'Accra',
            riskTolerance: 'HIGH',
            preferredAssets: ['USDC'],
          },
        },
      },
    }),
    prisma.user.upsert({
      where: { walletAddress: '0x3333333333333333333333333333333333333333' },
      update: {},
      create: {
        walletAddress: '0x3333333333333333333333333333333333333333',
        email: 'admin@piron.finance',
        userType: 'ADMIN',
        kycStatus: 'APPROVED',
        region: 'UNITED_KINGDOM',
        isActive: true,
        profile: {
          create: {
            firstName: 'Admin',
            lastName: 'User',
            country: 'United Kingdom',
            city: 'London',
          },
        },
      },
    }),
  ]);
  console.log(`✅ ${users.length} users created\n`);

  // ============================================================================
  // 4. Create Pools
  // ============================================================================
  console.log('🏊 Creating pools...');

  // Pool 1: Nigerian T-Bill (Single-Asset, Discounted)
  const pool1 = await prisma.pool.upsert({
    where: {
      chainId_poolAddress: {
        chainId: 84532,
        poolAddress: '0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
      },
    },
    update: {},
    create: {
      chainId: 84532,
      poolAddress: '0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
      poolType: 'SINGLE_ASSET',
      name: 'Nigerian 91-Day T-Bill - Dec 2025',
      description:
        'Short-term Nigerian treasury bill with 15% discount rate. Fully backed by the Central Bank of Nigeria.',
      managerAddress: '0xmanager1111111111111111111111111111111111',
      escrowAddress: '0xescrow11111111111111111111111111111111111',
      assetAddress: usdc.address,
      assetSymbol: 'USDC',
      assetDecimals: 6,
      minInvestment: 100,
      instrumentType: 'DISCOUNTED',
      targetRaise: 500000,
      epochEndTime: new Date('2025-11-15T23:59:59Z'),
      maturityDate: new Date('2026-02-15T00:00:00Z'),
      discountRate: 1500, // 15% in basis points
      status: 'FUNDING',
      isActive: true,
      isFeatured: true,
      country: 'Nigeria',
      region: 'West Africa',
      issuer: 'Central Bank of Nigeria',
      issuerLogo: 'https://example.com/cbn-logo.png',
      securityType: 'Treasury Bill',
      cusip: 'NGT91D2025',
      riskRating: 'AA-',
      minimumKYCLevel: 'APPROVED',
      displayOrder: 1,
      tags: ['T-Bill', 'Short-term', 'Low Risk', 'Nigeria'],
      createdOnChain: new Date('2025-10-01T10:00:00Z'),
    },
  });

  // Pool 2: UK Government Bond (Single-Asset, Interest-Bearing)
  const pool2 = await prisma.pool.upsert({
    where: {
      chainId_poolAddress: {
        chainId: 84532,
        poolAddress: '0xbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb',
      },
    },
    update: {},
    create: {
      chainId: 84532,
      poolAddress: '0xbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb',
      poolType: 'SINGLE_ASSET',
      name: 'UK Gilt 5-Year Bond - 2030',
      description: '5-year UK government bond paying 4.25% annual coupon, semi-annual payments.',
      managerAddress: '0xmanager2222222222222222222222222222222222',
      escrowAddress: '0xescrow22222222222222222222222222222222222',
      assetAddress: usdc.address,
      assetSymbol: 'USDC',
      assetDecimals: 6,
      minInvestment: 1000,
      instrumentType: 'INTEREST_BEARING',
      targetRaise: 2000000,
      epochEndTime: new Date('2025-11-30T23:59:59Z'),
      maturityDate: new Date('2030-11-15T00:00:00Z'),
      status: 'FUNDING',
      isActive: true,
      isFeatured: true,
      country: 'United Kingdom',
      region: 'Europe',
      issuer: 'UK Government',
      issuerLogo: 'https://example.com/uk-gov-logo.png',
      securityType: 'Government Bond',
      isin: 'GB00BDCHBW20',
      riskRating: 'AAA',
      minimumKYCLevel: 'APPROVED',
      displayOrder: 2,
      tags: ['Bond', 'Long-term', 'AAA Rated', 'UK'],
      createdOnChain: new Date('2025-10-15T10:00:00Z'),
    },
  });

  // Pool 3: Stable Yield Pool
  const pool3 = await prisma.pool.upsert({
    where: {
      chainId_poolAddress: {
        chainId: 84532,
        poolAddress: '0xcccccccccccccccccccccccccccccccccccccccc',
      },
    },
    update: {},
    create: {
      chainId: 84532,
      poolAddress: '0xcccccccccccccccccccccccccccccccccccccccc',
      poolType: 'STABLE_YIELD',
      name: 'Piron Stable Yield Fund',
      description:
        'Diversified portfolio of African and European government securities. Flexible deposits and withdrawals.',
      managerAddress: '0xmanager3333333333333333333333333333333333',
      escrowAddress: '0xescrow33333333333333333333333333333333333',
      assetAddress: usdc.address,
      assetSymbol: 'USDC',
      assetDecimals: 6,
      minInvestment: 50,
      status: 'INVESTED',
      isActive: true,
      isFeatured: true,
      country: 'Multi-Country',
      region: 'Global',
      issuer: 'Piron Finance',
      issuerLogo: 'https://piron.finance/logo.png',
      securityType: 'Money Market Fund',
      riskRating: 'A+',
      minimumKYCLevel: 'APPROVED',
      displayOrder: 3,
      tags: ['Flexible', 'Diversified', 'Stable Yield', 'Multi-Asset'],
      createdOnChain: new Date('2025-09-01T10:00:00Z'),
    },
  });
  console.log('✅ Pools created\n');

  // ============================================================================
  // 5. Create Pool Analytics
  // ============================================================================
  console.log('📊 Creating pool analytics...');
  await Promise.all([
    prisma.poolAnalytics.upsert({
      where: { poolId: pool1.id },
      update: {},
      create: {
        poolId: pool1.id,
        totalValueLocked: 125000,
        totalShares: 125000,
        uniqueInvestors: 15,
        activeInvestors: 15,
        totalDeposits: 125000,
        totalWithdrawals: 0,
        netFlow: 125000,
        apy: 15.5,
        volume24h: 12000,
        depositors24h: 3,
        volume7d: 45000,
        newInvestors7d: 8,
      },
    }),
    prisma.poolAnalytics.upsert({
      where: { poolId: pool2.id },
      update: {},
      create: {
        poolId: pool2.id,
        totalValueLocked: 450000,
        totalShares: 450000,
        uniqueInvestors: 28,
        activeInvestors: 28,
        totalDeposits: 450000,
        totalWithdrawals: 0,
        netFlow: 450000,
        apy: 4.25,
        volume24h: 35000,
        depositors24h: 5,
        volume7d: 120000,
        newInvestors7d: 12,
      },
    }),
    prisma.poolAnalytics.upsert({
      where: { poolId: pool3.id },
      update: {},
      create: {
        poolId: pool3.id,
        totalValueLocked: 1500000,
        totalShares: 1485000,
        navPerShare: 1.01,
        uniqueInvestors: 142,
        activeInvestors: 98,
        totalDeposits: 1650000,
        totalWithdrawals: 165000,
        netFlow: 1485000,
        apy: 12.8,
        volume24h: 85000,
        depositors24h: 12,
        withdrawals24h: 3,
        volume7d: 340000,
        newInvestors7d: 23,
      },
    }),
  ]);
  console.log('✅ Pool analytics created\n');

  // ============================================================================
  // 6. Create User Positions
  // ============================================================================
  console.log('💼 Creating user positions...');
  await Promise.all([
    // Alice's positions
    prisma.poolPosition.upsert({
      where: { userId_poolId: { userId: users[0].id, poolId: pool1.id } },
      update: {},
      create: {
        userId: users[0].id,
        poolId: pool1.id,
        totalShares: 5000,
        totalDeposited: 5000,
        totalWithdrawn: 0,
        currentValue: 5000,
        unrealizedReturn: 0,
        isActive: true,
        firstDepositTime: new Date('2025-11-01T14:22:00Z'),
        lastDepositTime: new Date('2025-11-01T14:22:00Z'),
      },
    }),
    prisma.poolPosition.upsert({
      where: { userId_poolId: { userId: users[0].id, poolId: pool3.id } },
      update: {},
      create: {
        userId: users[0].id,
        poolId: pool3.id,
        totalShares: 10000,
        totalDeposited: 10000,
        totalWithdrawn: 0,
        currentValue: 10100,
        unrealizedReturn: 100,
        isActive: true,
        firstDepositTime: new Date('2025-10-15T10:00:00Z'),
        lastDepositTime: new Date('2025-10-20T16:30:00Z'),
      },
    }),
    // Bob's position
    prisma.poolPosition.upsert({
      where: { userId_poolId: { userId: users[1].id, poolId: pool2.id } },
      update: {},
      create: {
        userId: users[1].id,
        poolId: pool2.id,
        totalShares: 15000,
        totalDeposited: 15000,
        totalWithdrawn: 0,
        currentValue: 15000,
        unrealizedReturn: 0,
        isActive: true,
        firstDepositTime: new Date('2025-10-25T09:15:00Z'),
        lastDepositTime: new Date('2025-10-25T09:15:00Z'),
      },
    }),
  ]);
  console.log('✅ User positions created\n');

  // ============================================================================
  // 7. Create Sample Transactions
  // ============================================================================
  console.log('📝 Creating transactions...');
  await Promise.all([
    prisma.transaction.create({
      data: {
        userId: users[0].id,
        poolId: pool1.id,
        type: 'DEPOSIT',
        txHash: '0xtxhash111111111111111111111111111111111111111111111111111111111111',
        chainId: 84532,
        amount: 5000,
        shares: 5000,
        fee: 3, // 0.06%
        from: users[0].walletAddress,
        to: pool1.poolAddress,
        blockNumber: BigInt(12345678),
        gasUsed: BigInt(150000),
        gasPrice: BigInt(1000000000),
        status: 'CONFIRMED',
        timestamp: new Date('2025-11-01T14:22:00Z'),
      },
    }),
    prisma.transaction.create({
      data: {
        userId: users[0].id,
        poolId: pool3.id,
        type: 'DEPOSIT',
        txHash: '0xtxhash222222222222222222222222222222222222222222222222222222222222',
        chainId: 84532,
        amount: 10000,
        shares: 9900,
        fee: 6,
        from: users[0].walletAddress,
        to: pool3.poolAddress,
        blockNumber: BigInt(12340000),
        gasUsed: BigInt(145000),
        gasPrice: BigInt(1000000000),
        status: 'CONFIRMED',
        timestamp: new Date('2025-10-15T10:00:00Z'),
      },
    }),
    prisma.transaction.create({
      data: {
        userId: users[1].id,
        poolId: pool2.id,
        type: 'DEPOSIT',
        txHash: '0xtxhash333333333333333333333333333333333333333333333333333333333333',
        chainId: 84532,
        amount: 15000,
        shares: 15000,
        fee: 9,
        from: users[1].walletAddress,
        to: pool2.poolAddress,
        blockNumber: BigInt(12350000),
        gasUsed: BigInt(148000),
        gasPrice: BigInt(1000000000),
        status: 'CONFIRMED',
        timestamp: new Date('2025-10-25T09:15:00Z'),
      },
    }),
  ]);
  console.log('✅ Transactions created\n');

  // ============================================================================
  // Final Summary
  // ============================================================================
  console.log('✨ Database seeding completed successfully!\n');
  console.log('📊 Summary:');
  console.log(`   • 2 Networks (Base Sepolia, Base Mainnet)`);
  console.log(`   • 2 Assets (USDC, cNGN)`);
  console.log(`   • 3 Users (2 regular, 1 admin)`);
  console.log(`   • 3 Pools (1 T-Bill, 1 Bond, 1 Stable Yield)`);
  console.log(`   • 3 Pool positions`);
  console.log(`   • 3 Transactions`);
  console.log(`   • Pool analytics for all pools\n`);
  console.log('🚀 Ready to test API endpoints!');
}

main()
  .catch((e) => {
    console.error('❌ Seeding failed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
