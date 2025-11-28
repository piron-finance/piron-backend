#!/usr/bin/env node
/**
 * Script to grant POOL_CREATOR role to an address
 *
 * Usage:
 *   PRIVATE_KEY=0x... node scripts/grant-pool-creator-role.js [ADDRESS]
 */

const { ethers } = require('ethers');

const ACCESS_MANAGER = '0x05b326d12D802DF04b96Fa82335c5b9e7e22EA4b';
const POOL_CREATOR_ROLE = ethers.keccak256(ethers.toUtf8Bytes('POOL_CREATOR'));

const ACCESS_MANAGER_ABI = [
  {
    type: 'function',
    name: 'grantRole',
    inputs: [
      { name: 'role', type: 'bytes32' },
      { name: 'account', type: 'address' },
    ],
    outputs: [],
    stateMutability: 'nonpayable',
  },
  {
    type: 'function',
    name: 'hasRole',
    inputs: [
      { name: 'role', type: 'bytes32' },
      { name: 'account', type: 'address' },
    ],
    outputs: [{ name: '', type: 'bool' }],
    stateMutability: 'view',
  },
];

const RPC_URL =
  process.env.BASE_SEPOLIA_RPC ||
  'https://base-sepolia.g.alchemy.com/v2/JAGk42or-hy7xojfv1p4ZbEXel4QR_gE';
const PRIVATE_KEY = process.env.PRIVATE_KEY;

async function main() {
  console.log('🔐 Grant POOL_CREATOR Role Script\n');

  // Validate private key
  if (!PRIVATE_KEY) {
    console.error('❌ Error: PRIVATE_KEY environment variable not set');
    console.log('\nUsage:');
    console.log('  PRIVATE_KEY=0x... node scripts/grant-pool-creator-role.js [ADDRESS]\n');
    process.exit(1);
  }

  // Get target address (default to signer if not provided)
  const provider = new ethers.JsonRpcProvider(RPC_URL);
  const wallet = new ethers.Wallet(PRIVATE_KEY, provider);
  const targetAddress = process.argv[2] || wallet.address;

  console.log(`📡 RPC: ${RPC_URL}`);
  console.log(`👤 Signer: ${wallet.address}`);
  console.log(`🎯 Target: ${targetAddress}\n`);

  // Validate target address
  try {
    ethers.getAddress(targetAddress);
  } catch (e) {
    console.error('❌ Invalid target address:', targetAddress);
    process.exit(1);
  }

  // Check balance
  const balance = await provider.getBalance(wallet.address);
  console.log(`💰 Balance: ${ethers.formatEther(balance)} ETH`);

  if (balance === 0n) {
    console.error('❌ Error: Signer has no ETH for gas');
    process.exit(1);
  }

  // Connect to AccessManager
  const accessManager = new ethers.Contract(ACCESS_MANAGER, ACCESS_MANAGER_ABI, wallet);

  console.log('\n📋 Configuration:');
  console.log(`   AccessManager: ${ACCESS_MANAGER}`);
  console.log(`   Role: POOL_CREATOR`);
  console.log(`   Role Hash: ${POOL_CREATOR_ROLE}`);

  // Check current status
  console.log('\n🔍 Checking current role status...');
  const hasRole = await accessManager.hasRole(POOL_CREATOR_ROLE, targetAddress);

  if (hasRole) {
    console.log(`✅ ${targetAddress} already has POOL_CREATOR role!`);
    console.log('\n⚠️  No action needed. Exiting...');
    process.exit(0);
  } else {
    console.log(`❌ ${targetAddress} does NOT have POOL_CREATOR role`);
  }

  // Estimate gas
  console.log('\n⚡ Preparing to grant role...');
  try {
    const gasEstimate = await accessManager.grantRole.estimateGas(POOL_CREATOR_ROLE, targetAddress);
    console.log(`   Estimated gas: ${gasEstimate.toString()}`);
  } catch (error) {
    console.error('\n❌ Gas estimation failed:', error.message);
    console.error('   You may not have permission to grant roles.');
    process.exit(1);
  }

  // Send transaction
  console.log('\n📤 Sending grantRole transaction...');
  try {
    const tx = await accessManager.grantRole(POOL_CREATOR_ROLE, targetAddress);

    console.log(`   Transaction hash: ${tx.hash}`);
    console.log(`   Explorer: https://sepolia.basescan.org/tx/${tx.hash}`);
    console.log('\n⏳ Waiting for confirmation...');

    const receipt = await tx.wait(1);

    if (receipt.status === 1) {
      console.log('\n✅ SUCCESS! Role granted.');
      console.log(`   Block: ${receipt.blockNumber}`);
      console.log(`   Gas used: ${receipt.gasUsed.toString()}`);

      // Verify
      const hasRoleNow = await accessManager.hasRole(POOL_CREATOR_ROLE, targetAddress);
      console.log(`\n✅ Verification:`);
      console.log(`   Has POOL_CREATOR role: ${hasRoleNow ? 'YES' : 'NO'}`);

      if (hasRoleNow) {
        console.log('\n🎉 Role grant complete! Address can now create pools.');
      } else {
        console.log('\n⚠️  Warning: Role verification failed!');
      }
    } else {
      console.log('\n❌ Transaction failed');
      process.exit(1);
    }
  } catch (error) {
    console.error('\n❌ Transaction failed:', error.message);
    if (error.data) {
      console.error('   Error data:', error.data);
    }
    process.exit(1);
  }
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error('\n💥 Fatal error:', error);
    process.exit(1);
  });
