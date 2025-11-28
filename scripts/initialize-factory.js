#!/usr/bin/env node
/**
 * Script to initialize ManagedPoolFactory
 *
 * This should only be run ONCE after deployment.
 * Requires admin private key to execute.
 *
 * Usage:
 *   PRIVATE_KEY=0x... node scripts/initialize-factory.js
 */

const { ethers } = require('ethers');

// Contract addresses from deployment (kk.txt)
const ADDRESSES = {
  managedPoolFactory: '0x958b320E4cce5B6930b5695Bb9B817Ec01209D4a',
  stableYieldPoolImplementation: '0xDBe01d48171E9852b8A68755612F4672bE93BbaA',
  stableYieldEscrowImplementation: '0x79dA3005E4A6854542e79D2A758E0665c293A858',
  stableYieldManager: '0xE756E61e69cd090Cfe7bF0648c6f488c47629a80',
  poolRegistry: '0x16308CeEB1Ee44Afc7c731B567D3135E1B2752e3',
  accessManager: '0x05b326d12D802DF04b96Fa82335c5b9e7e22EA4b',
  timelockController: '0xD4480D4C5e15CdEab11dbA064d4F610aeb51bC1D',
};

// Minimal ABI for initialize function
const FACTORY_ABI = [
  {
    type: 'function',
    name: 'initialize',
    inputs: [
      { name: '_registry', type: 'address' },
      { name: '_accessManager', type: 'address' },
      { name: '_stableYieldManager', type: 'address' },
      { name: '_timelockController', type: 'address' },
      { name: '_stableYieldPoolImplementation', type: 'address' },
      { name: '_managedPoolEscrowImplementation', type: 'address' },
    ],
    outputs: [],
    stateMutability: 'nonpayable',
  },
  {
    type: 'function',
    name: 'stableYieldPoolImplementation',
    inputs: [],
    outputs: [{ name: '', type: 'address' }],
    stateMutability: 'view',
  },
];

const RPC_URL =
  process.env.BASE_SEPOLIA_RPC ||
  'https://base-sepolia.g.alchemy.com/v2/JAGk42or-hy7xojfv1p4ZbEXel4QR_gE';
const PRIVATE_KEY = process.env.PRIVATE_KEY;

async function main() {
  console.log('🔧 ManagedPoolFactory Initialization Script\n');

  // Validate private key
  if (!PRIVATE_KEY) {
    console.error('❌ Error: PRIVATE_KEY environment variable not set');
    console.log('\nUsage:');
    console.log('  PRIVATE_KEY=0x... node scripts/initialize-factory.js\n');
    process.exit(1);
  }

  // Setup provider and signer
  const provider = new ethers.JsonRpcProvider(RPC_URL);
  const wallet = new ethers.Wallet(PRIVATE_KEY, provider);

  console.log(`📡 RPC: ${RPC_URL}`);
  console.log(`👤 Signer: ${wallet.address}\n`);

  // Check current balance
  const balance = await provider.getBalance(wallet.address);
  console.log(`💰 Balance: ${ethers.formatEther(balance)} ETH`);

  if (balance === 0n) {
    console.error('❌ Error: Signer has no ETH for gas');
    process.exit(1);
  }

  // Connect to factory
  const factory = new ethers.Contract(ADDRESSES.managedPoolFactory, FACTORY_ABI, wallet);

  console.log('\n📋 Configuration:');
  console.log(`   Factory Proxy:       ${ADDRESSES.managedPoolFactory}`);
  console.log(`   PoolRegistry:        ${ADDRESSES.poolRegistry}`);
  console.log(`   AccessManager:       ${ADDRESSES.accessManager}`);
  console.log(`   StableYieldManager:  ${ADDRESSES.stableYieldManager}`);
  console.log(`   TimelockController:  ${ADDRESSES.timelockController}`);
  console.log(`   Pool Implementation: ${ADDRESSES.stableYieldPoolImplementation}`);
  console.log(`   Escrow Implementation: ${ADDRESSES.stableYieldEscrowImplementation}`);

  // Check if already initialized
  console.log('\n🔍 Checking initialization status...');
  try {
    const currentImpl = await factory.stableYieldPoolImplementation();
    console.log(`   Current pool implementation: ${currentImpl}`);
    if (currentImpl !== ethers.ZeroAddress) {
      console.log(`✅ Factory is already initialized!`);
      console.log('\n⚠️  No action needed. Exiting...');
      process.exit(0);
    } else {
      console.log('   Pool implementation is zero address - needs initialization');
    }
  } catch (error) {
    console.log('   Error checking status:', error.message);
    console.log('   Continuing with initialization attempt...');
  }

  console.log('\n⚡ Preparing to initialize factory...');
  console.log('   This will be a one-time operation.');

  // Estimate gas and try to get revert reason
  try {
    const gasEstimate = await factory.initialize.estimateGas(
      ADDRESSES.poolRegistry,
      ADDRESSES.accessManager,
      ADDRESSES.stableYieldManager,
      ADDRESSES.timelockController,
      ADDRESSES.stableYieldPoolImplementation,
      ADDRESSES.stableYieldEscrowImplementation,
    );
    console.log(`   Estimated gas: ${gasEstimate.toString()}`);
  } catch (error) {
    console.error('\n❌ Gas estimation failed:', error.message);

    // Try to get better error info by calling the function
    try {
      await factory.initialize.staticCall(
        ADDRESSES.poolRegistry,
        ADDRESSES.accessManager,
        ADDRESSES.stableYieldManager,
        ADDRESSES.timelockController,
        ADDRESSES.stableYieldPoolImplementation,
        ADDRESSES.stableYieldEscrowImplementation,
      );
    } catch (callError) {
      console.error('   Call error:', callError.message);
      if (callError.data) {
        console.error('   Error data:', callError.data);
      }
      if (callError.reason) {
        console.error('   Revert reason:', callError.reason);
      }
    }

    if (error.message.includes('already initialized')) {
      console.log('   Factory appears to be already initialized.');
      process.exit(0);
    }
    process.exit(1);
  }

  // Send transaction
  console.log('\n📤 Sending initialize transaction...');
  try {
    const tx = await factory.initialize(
      ADDRESSES.poolRegistry,
      ADDRESSES.accessManager,
      ADDRESSES.stableYieldManager,
      ADDRESSES.timelockController,
      ADDRESSES.stableYieldPoolImplementation,
      ADDRESSES.stableYieldEscrowImplementation,
    );

    console.log(`   Transaction hash: ${tx.hash}`);
    console.log(`   Explorer: https://sepolia.basescan.org/tx/${tx.hash}`);
    console.log('\n⏳ Waiting for confirmation...');

    const receipt = await tx.wait(1);

    if (receipt.status === 1) {
      console.log('\n✅ SUCCESS! Factory initialized.');
      console.log(`   Block: ${receipt.blockNumber}`);
      console.log(`   Gas used: ${receipt.gasUsed.toString()}`);

      // Verify initialization
      const poolImpl = await factory.stableYieldPoolImplementation();
      console.log(`\n✅ Verification:`);
      console.log(`   Pool implementation: ${poolImpl}`);

      if (poolImpl === ADDRESSES.stableYieldPoolImplementation) {
        console.log('\n🎉 Initialization complete! Pool creation should now work.');
      } else {
        console.log('\n⚠️  Warning: Pool implementation mismatch!');
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
