const { ethers } = require('ethers');
const { PrismaClient } = require('@prisma/client');

// Configuration
const POOL_ADDRESS = process.env.POOL_ADDRESS || '0x51E33dbf7Fa275Dc9A9e48c86D373AA7b75745A5';
const FROM_BLOCK = process.env.FROM_BLOCK ? parseInt(process.env.FROM_BLOCK) : null;
const TO_BLOCK = process.env.TO_BLOCK ? parseInt(process.env.TO_BLOCK) : null;

const STABLE_YIELD_POOL_ABI = [
  'event Deposit(address indexed sender, address indexed owner, uint256 assets, uint256 shares)',
  'function asset() external view returns (address)',
];

const prisma = new PrismaClient();

async function main() {
  console.log('🔄 Manual Deposit Re-indexer');
  console.log('='.repeat(60));
  console.log('Pool Address:', POOL_ADDRESS);
  console.log('Block Range:', FROM_BLOCK || 'auto', '->', TO_BLOCK || 'current');
  console.log('='.repeat(60));

  try {
    // Get pool from database
    const pool = await prisma.pool.findFirst({
      where: {
        poolAddress: POOL_ADDRESS.toLowerCase(),
        chainId: 84532,
      },
    });

    if (!pool) {
      throw new Error(`Pool ${POOL_ADDRESS} not found in database`);
    }

    console.log('\n📊 Pool:', pool.name);
    console.log('Type:', pool.poolType);

    // Setup provider and contract
    const RPC_URL = process.env.RPC_URL || 'https://sepolia.base.org';
    const provider = new ethers.JsonRpcProvider(RPC_URL);
    const poolContract = new ethers.Contract(POOL_ADDRESS, STABLE_YIELD_POOL_ABI, provider);

    // Determine block range
    const currentBlock = await provider.getBlockNumber();
    const fromBlock = FROM_BLOCK || currentBlock - 1000;
    const toBlock = TO_BLOCK || currentBlock;

    console.log('\n🔍 Scanning blocks:', fromBlock, '->', toBlock);

    // Get deposit events
    const depositFilter = poolContract.filters.Deposit();
    const events = await poolContract.queryFilter(depositFilter, fromBlock, toBlock);

    console.log(`\n💰 Found ${events.length} deposit event(s)`);

    if (events.length === 0) {
      console.log('No deposits to index');
      return;
    }

    // Process each event
    let indexed = 0;
    let skipped = 0;

    for (const event of events) {
      const { sender, owner, assets, shares } = event.args;
      const txHash = event.transactionHash;

      // Check if already indexed
      const existing = await prisma.transaction.findUnique({
        where: { txHash },
      });

      if (existing) {
        console.log(`⏭️  Skipped (already indexed): ${txHash.substring(0, 10)}...`);
        skipped++;
        continue;
      }

      // Get block info
      const block = await provider.getBlock(event.blockNumber);
      const timestamp = new Date(block.timestamp * 1000);

      // Get or create user
      const user = await prisma.user.upsert({
        where: { walletAddress: owner.toLowerCase() },
        update: {},
        create: {
          walletAddress: owner.toLowerCase(),
          userType: 'REGULAR_USER',
        },
      });

      const assetsDecimal = ethers.formatUnits(assets, pool.assetDecimals);
      const sharesDecimal = ethers.formatUnits(shares, pool.assetDecimals);

      // Create or update position
      const position = await prisma.poolPosition.upsert({
        where: {
          userId_poolId: {
            userId: user.id,
            poolId: pool.id,
          },
        },
        update: {
          totalDeposited: {
            increment: parseFloat(assetsDecimal),
          },
          totalShares: {
            increment: parseFloat(sharesDecimal),
          },
          currentValue: {
            increment: parseFloat(assetsDecimal),
          },
          lastDepositTime: timestamp,
          isActive: true,
        },
        create: {
          userId: user.id,
          poolId: pool.id,
          totalDeposited: parseFloat(assetsDecimal),
          totalWithdrawn: 0,
          totalShares: parseFloat(sharesDecimal),
          currentValue: parseFloat(assetsDecimal),
          unrealizedReturn: 0,
          realizedReturn: 0,
          isActive: true,
          lastDepositTime: timestamp,
        },
      });

      // Create transaction record
      await prisma.transaction.create({
        data: {
          txHash,
          userId: user.id,
          poolId: pool.id,
          chainId: 84532,
          type: 'DEPOSIT',
          status: 'CONFIRMED',
          amount: parseFloat(assetsDecimal),
          shares: parseFloat(sharesDecimal),
          timestamp,
          blockNumber: BigInt(event.blockNumber),
        },
      });

      // Update analytics
      const isNewInvestor =
        parseFloat(assetsDecimal) === parseFloat(position.totalDeposited.toString());

      await prisma.poolAnalytics.update({
        where: { poolId: pool.id },
        data: {
          totalValueLocked: {
            increment: parseFloat(assetsDecimal),
          },
          totalShares: {
            increment: parseFloat(sharesDecimal),
          },
          totalDeposits: {
            increment: parseFloat(assetsDecimal),
          },
          netFlow: {
            increment: parseFloat(assetsDecimal),
          },
          uniqueInvestors: isNewInvestor ? { increment: 1 } : undefined,
        },
      });

      console.log(`✅ Indexed: ${owner.substring(0, 8)}... → ${assetsDecimal} ${pool.assetSymbol}`);
      indexed++;
    }

    console.log('\n' + '='.repeat(60));
    console.log('📊 Summary:');
    console.log('   Indexed:', indexed);
    console.log('   Skipped:', skipped);
    console.log('   Total:', events.length);
    console.log('='.repeat(60));
  } catch (error) {
    console.error('\n❌ Error:', error.message);
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

main()
  .then(() => {
    console.log('\n✅ Re-indexing complete!');
    process.exit(0);
  })
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
