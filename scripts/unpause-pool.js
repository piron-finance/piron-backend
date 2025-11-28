const { ethers } = require('ethers');

// Contract addresses from deployment
const MANAGER_ADDRESS = '0x056dAC51BF925e88d5d9eA3394D70b55A1691Da2';

// Pool address to unpause (you'll need to provide this)
const POOL_ADDRESS = process.env.POOL_ADDRESS || ''; // Add your pool address here

const MANAGER_ABI = [
  'function unpausePool(address poolAddress) external',
  'function pausePool(address poolAddress) external',
  'function poolStatus(address pool) external view returns (uint8)',
];

const LIQUIDITY_POOL_ABI = [
  'function paused() external view returns (bool)',
  'function pause() external',
  'function unpause() external',
];

async function main() {
  // Validate input
  if (!POOL_ADDRESS) {
    console.error('❌ Error: POOL_ADDRESS not provided');
    console.log('Usage: POOL_ADDRESS=0x... PRIVATE_KEY=0x... node scripts/unpause-pool.js');
    process.exit(1);
  }

  // Setup provider and wallet
  const RPC_URL = process.env.RPC_URL || 'https://sepolia.base.org';
  const PRIVATE_KEY = process.env.PRIVATE_KEY || 'ecaf18fce09fefe7c63393a30390300f7dcc47134574eb76dcaa8f688c5df132';

  const provider = new ethers.JsonRpcProvider(RPC_URL);
  const wallet = new ethers.Wallet(PRIVATE_KEY, provider);

  console.log('🔍 Checking pool pause status...');
  console.log('Admin Address:', wallet.address);
  console.log('Pool Address:', POOL_ADDRESS);
  console.log('Manager Address:', MANAGER_ADDRESS);

  // Check if pool is paused
  const poolContract = new ethers.Contract(POOL_ADDRESS, LIQUIDITY_POOL_ABI, provider);
  
  try {
    const isPaused = await poolContract.paused();
    console.log(`\nPool paused status: ${isPaused}`);

    if (!isPaused) {
      console.log('✅ Pool is not paused. No action needed.');
      return;
    }

    console.log('\n⚠️  Pool is PAUSED. Attempting to unpause...');

    // Connect to Manager contract
    const managerContract = new ethers.Contract(MANAGER_ADDRESS, MANAGER_ABI, wallet);

    // Unpause the pool through the manager
    console.log('📝 Sending unpause transaction...');
    const tx = await managerContract.unpausePool(POOL_ADDRESS);
    console.log('Transaction hash:', tx.hash);
    
    console.log('⏳ Waiting for confirmation...');
    const receipt = await tx.wait();
    
    if (receipt.status === 1) {
      console.log('✅ Pool successfully unpaused!');
      console.log('Block:', receipt.blockNumber);
      
      // Verify pause status
      const newStatus = await poolContract.paused();
      console.log('New pause status:', newStatus);
    } else {
      console.log('❌ Transaction failed');
    }

  } catch (error) {
    console.error('❌ Error:', error.message);
    
    if (error.message.includes('AccessDenied') || error.message.includes('Unauthorized')) {
      console.log('\n⚠️  Access Denied: The wallet does not have permission to unpause pools.');
      console.log('Required: POOL_MANAGER_ROLE or ADMIN_ROLE in AccessManager');
      console.log('Current wallet:', wallet.address);
    }
    
    if (error.message.includes('ExpectedPause')) {
      console.log('\n✅ Pool is already unpaused!');
    }

    throw error;
  }
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });

