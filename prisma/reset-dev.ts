/**
 * Development Database Reset Script
 * 
 * Run this when you redeploy contracts to clear stale pool data.
 * This preserves user accounts but clears all pool-related data.
 * 
 * Usage: npm run db:reset:dev
 */

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function resetDevDatabase() {
  console.log('🔄 Resetting development database...\n');

  // Safety check - don't run in production
  if (process.env.NODE_ENV === 'production') {
    console.error('❌ Cannot run reset script in production!');
    process.exit(1);
  }

  try {
    // Delete in order of dependencies (child tables first)
    console.log('Clearing pool-related data...');

    // Transactions & Operations
    const txCount = await prisma.transaction.deleteMany({});
    console.log(`  ✓ Deleted ${txCount.count} transactions`);

    const opCount = await prisma.sPVOperation.deleteMany({});
    console.log(`  ✓ Deleted ${opCount.count} SPV operations`);

    // Positions
    const lockedPosCount = await prisma.lockedPosition.deleteMany({});
    console.log(`  ✓ Deleted ${lockedPosCount.count} locked positions`);

    const poolPosCount = await prisma.poolPosition.deleteMany({});
    console.log(`  ✓ Deleted ${poolPosCount.count} pool positions`);

    // Pool Analytics & History
    const analyticsCount = await prisma.poolAnalytics.deleteMany({});
    console.log(`  ✓ Deleted ${analyticsCount.count} pool analytics`);

    const navCount = await prisma.nAVHistory.deleteMany({});
    console.log(`  ✓ Deleted ${navCount.count} NAV history records`);

    // Instruments & Coupons
    const couponCount = await prisma.couponPayment.deleteMany({});
    console.log(`  ✓ Deleted ${couponCount.count} coupon payments`);

    const instrumentCount = await prisma.instrument.deleteMany({});
    console.log(`  ✓ Deleted ${instrumentCount.count} instruments`);

    // Lock Tiers
    const tierCount = await prisma.lockTier.deleteMany({});
    console.log(`  ✓ Deleted ${tierCount.count} lock tiers`);

    // SPV Preferences
    const prefCount = await prisma.sPVPreference.deleteMany({});
    console.log(`  ✓ Deleted ${prefCount.count} SPV preferences`);

    // Finally, delete pools
    const poolCount = await prisma.pool.deleteMany({});
    console.log(`  ✓ Deleted ${poolCount.count} pools`);

    console.log('\n✅ Development database reset complete!');
    console.log('\n📋 Next steps:');
    console.log('  1. Update addresses in src/contracts/addresses.dev.ts');
    console.log('  2. Restart the server: npm run dev');
    console.log('  3. Create new pools through the admin interface');

  } catch (error) {
    console.error('\n❌ Reset failed:', error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

// Prompt for confirmation
async function main() {
  const args = process.argv.slice(2);
  const force = args.includes('--force') || args.includes('-f');

  if (!force) {
    console.log('⚠️  WARNING: This will delete all pool data from the database!');
    console.log('   User accounts will be preserved.\n');
    console.log('   To proceed, run with --force flag:');
    console.log('   npm run db:reset:dev -- --force\n');
    process.exit(0);
  }

  await resetDevDatabase();
}

main();
