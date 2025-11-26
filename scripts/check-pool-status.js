const { ethers } = require('ethers');

// Pool address to check
const POOL_ADDRESS = process.env.POOL_ADDRESS || '';

const LIQUIDITY_POOL_ABI = [
  'function paused() external view returns (bool)',
  'function isActive() external view returns (bool)',
  'function isInFundingPeriod() external view returns (bool)',
  'function getPoolStatus() external view returns (uint8)',
  'function asset() external view returns (address)',
  'function totalAssets() external view returns (uint256)',
  'function totalSupply() external view returns (uint256)',
  'function manager() external view returns (address)',
  'function escrow() external view returns (address)',
];

const STABLE_YIELD_POOL_ABI = [
  'function paused() external view returns (bool)',
  'function asset() external view returns (address)',
  'function totalAssets() external view returns (uint256)',
  'function totalSupply() external view returns (uint256)',
  'function escrow() external view returns (address)',
  'function stableYieldManager() external view returns (address)',
];

const ERC20_ABI = [
  'function name() external view returns (string)',
  'function symbol() external view returns (string)',
  'function decimals() external view returns (uint8)',
  'function balanceOf(address) external view returns (uint256)',
];

async function main() {
  if (!POOL_ADDRESS) {
    console.error('❌ Error: POOL_ADDRESS not provided');
    console.log('Usage: POOL_ADDRESS=0x... node scripts/check-pool-status.js');
    process.exit(1);
  }

  const RPC_URL = process.env.RPC_URL || 'https://sepolia.base.org';
  const provider = new ethers.JsonRpcProvider(RPC_URL);

  console.log('🔍 Checking Pool Status');
  console.log('='.repeat(50));
  console.log('Pool Address:', POOL_ADDRESS);
  console.log('Chain: Base Sepolia (84532)');
  console.log('='.repeat(50));

  try {
    // Try LiquidityPool ABI first
    let poolContract = new ethers.Contract(POOL_ADDRESS, LIQUIDITY_POOL_ABI, provider);
    let isStableYield = false;

    try {
      const manager = await poolContract.manager();
      console.log('\n📊 Pool Type: Liquidity Pool');
      console.log('Manager:', manager);
    } catch {
      // Try StableYieldPool ABI
      poolContract = new ethers.Contract(POOL_ADDRESS, STABLE_YIELD_POOL_ABI, provider);
      const stableYieldManager = await poolContract.stableYieldManager();
      console.log('\n📊 Pool Type: Stable Yield Pool');
      console.log('StableYieldManager:', stableYieldManager);
      isStableYield = true;
    }

    // Check pause status
    const isPaused = await poolContract.paused();
    console.log('\n⏸️  Pause Status:', isPaused ? '🔴 PAUSED' : '✅ Active');

    // Get asset info
    const assetAddress = await poolContract.asset();
    console.log('\n💰 Asset Information:');
    console.log('Asset Address:', assetAddress);

    const assetContract = new ethers.Contract(assetAddress, ERC20_ABI, provider);
    const [assetName, assetSymbol, assetDecimals] = await Promise.all([
      assetContract.name(),
      assetContract.symbol(),
      assetContract.decimals(),
    ]);

    console.log('Asset Name:', assetName);
    console.log('Asset Symbol:', assetSymbol);
    console.log('Asset Decimals:', assetDecimals);

    // Get pool stats
    const [totalAssets, totalSupply] = await Promise.all([
      poolContract.totalAssets(),
      poolContract.totalSupply(),
    ]);

    console.log('\n📈 Pool Statistics:');
    console.log(
      'Total Assets:',
      ethers.formatUnits(totalAssets, assetDecimals),
      assetSymbol,
    );
    console.log('Total Supply (shares):', ethers.formatUnits(totalSupply, 18));

    // Get escrow
    const escrow = await poolContract.escrow();
    console.log('\n🏦 Escrow Address:', escrow);

    // Check escrow balance
    const escrowBalance = await assetContract.balanceOf(escrow);
    console.log('Escrow Balance:', ethers.formatUnits(escrowBalance, assetDecimals), assetSymbol);

    // Additional checks for LiquidityPool
    if (!isStableYield) {
      try {
        const [isActive, isInFunding, poolStatus] = await Promise.all([
          poolContract.isActive(),
          poolContract.isInFundingPeriod(),
          poolContract.getPoolStatus(),
        ]);

        const statusNames = [
          'Pending',
          'Funding',
          'PendingInvestment',
          'Invested',
          'Matured',
          'Withdrawn',
          'Emergency',
          'Cancelled',
        ];

        console.log('\n🎯 Pool State:');
        console.log('Active:', isActive ? '✅ Yes' : '❌ No');
        console.log('In Funding Period:', isInFunding ? '✅ Yes' : '❌ No');
        console.log('Status:', statusNames[poolStatus] || `Unknown (${poolStatus})`);
      } catch (err) {
        console.log('⚠️  Could not fetch additional pool state');
      }
    }

    console.log('\n' + '='.repeat(50));
    if (isPaused) {
      console.log('⚠️  ACTION REQUIRED: Pool is PAUSED');
      console.log('Run: POOL_ADDRESS=' + POOL_ADDRESS + ' node scripts/unpause-pool.js');
    } else {
      console.log('✅ Pool is operational');
    }
    console.log('='.repeat(50));

  } catch (error) {
    console.error('\n❌ Error checking pool status:', error.message);
    throw error;
  }
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });

