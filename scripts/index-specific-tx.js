const { ethers } = require('ethers');
const { PrismaClient } = require('@prisma/client');

// Transaction hash to index
const TX_HASH = process.env.TX_HASH || '0x16a13e5aa189cdce6a4b02aa151b96e97b00b06aac6f7202268526bb34351aec';

const STABLE_YIELD_POOL_ABI = [
  'event Deposit(address indexed sender, address indexed owner, uint256 assets, uint256 shares)',
];

const prisma = new PrismaClient();

async function main() {
  console.log('🔄 Indexing Specific Transaction');
  console.log('='.repeat(60));
  console.log('TX Hash:', TX_HASH);
  console.log('='.repeat(60));

  try {
    const RPC_URL = process.env.RPC_URL || 'https://sepolia.base.org';
    const provider = new ethers.JsonRpcProvider(RPC_URL);

    // Get transaction receipt
    console.log('\n📡 Fetching transaction receipt...');
    const receipt = await provider.getTransactionReceipt(TX_HASH);

    if (!receipt) {
      throw new Error('Transaction not found or not confirmed');
    }

    console.log('✅ Transaction found!');
    console.log('   Block:', receipt.blockNumber);
    console.log('   To:', receipt.to);
    console.log('   Status:', receipt.status === 1 ? 'Success' : 'Failed');

    if (receipt.status !== 1) {
      throw new Error('Transaction failed on-chain');
    }

    // Get pool from database
    const pool = await prisma.pool.findFirst({
      where: {
        poolAddress: receipt.to.toLowerCase(),
        chainId: 84532,
      },
    });

    if (!pool) {
      throw new Error(`Pool ${receipt.to} not found in database. Make sure pool is created first.`);
    }

    console.log('\n📊 Pool:', pool.name);

    // Check if already indexed
    const existing = await prisma.transaction.findUnique({
      where: { txHash: TX_HASH },
    });

    if (existing) {
      console.log('\n⏭️  Transaction already indexed!');
      console.log('User:', existing.userId);
      console.log('Amount:', existing.amount);
      return;
    }

    // Parse deposit event from logs
    const poolContract = new ethers.Contract(receipt.to, STABLE_YIELD_POOL_ABI, provider);
    const depositEvent = receipt.logs
      .map(log => {
        try {
          return poolContract.interface.parseLog(log);
        } catch {
          return null;
        }
      })
      .find(event => event && event.name === 'Deposit');

    if (!depositEvent) {
      throw new Error('No Deposit event found in transaction logs');
    }

    const { sender, owner, assets, shares } = depositEvent.args;

    console.log('\n💰 Deposit Details:');
    console.log('   Sender:', sender);
    console.log('   Owner:', owner);
    console.log('   Assets:', ethers.formatUnits(assets, pool.assetDecimals), pool.assetSymbol);
    console.log('   Shares:', ethers.formatUnits(shares, 18));

    // Get block info
    const block = await provider.getBlock(receipt.blockNumber);
    const timestamp = new Date(block.timestamp * 1000);

    console.log('   Timestamp:', timestamp.toISOString());

    // Get or create user
    const user = await prisma.user.upsert({
      where: { walletAddress: owner.toLowerCase() },
      update: {},
      create: {
        walletAddress: owner.toLowerCase(),
        userType: 'REGULAR_USER',
      },
    });

    console.log('\n👤 User:', user.walletAddress);
    console.log('   ID:', user.id);

    const assetsDecimal = ethers.formatUnits(assets, pool.assetDecimals);
    const sharesDecimal = ethers.formatUnits(shares, pool.assetDecimals);

    // Get existing position if any
    const existingPosition = await prisma.poolPosition.findUnique({
      where: {
        userId_poolId: {
          userId: user.id,
          poolId: pool.id,
        },
      },
    });

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

    console.log('\n📈 Position Updated:');
    console.log('   Total Deposited:', position.totalDeposited.toString(), pool.assetSymbol);
    console.log('   Total Shares:', position.totalShares.toString());

    // Create transaction record
    await prisma.transaction.create({
      data: {
        txHash: TX_HASH,
        userId: user.id,
        poolId: pool.id,
        chainId: 84532,
        type: 'DEPOSIT',
        status: 'CONFIRMED',
        amount: parseFloat(assetsDecimal),
        shares: parseFloat(sharesDecimal),
        timestamp,
        blockNumber: BigInt(receipt.blockNumber),
      },
    });

    console.log('\n💾 Transaction Record Created');

    // Update analytics
    const isNewInvestor = !existingPosition || existingPosition.totalDeposited.toNumber() === 0;

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

    console.log('\n📊 Analytics Updated');
    if (isNewInvestor) {
      console.log('   ✨ New investor added to count');
    }

    console.log('\n' + '='.repeat(60));
    console.log('✅ Transaction successfully indexed!');
    console.log('='.repeat(60));

  } catch (error) {
    console.error('\n❌ Error:', error.message);
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });

