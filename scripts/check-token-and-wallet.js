const { ethers } = require('ethers');

// Configuration
const POOL_ADDRESS = '0x51E33dbf7Fa275Dc9A9e48c86D373AA7b75745A5';
const TOKEN_ADDRESS = '0x2DD9A8b2c1b73A607ddF16814338c4b942275DDa'; // E20M token
const PRIVATE_KEY = 'ecaf18fce09fefe7c63393a30390300f7dcc47134574eb76dcaa8f688c5df132';

const ERC20_ABI = [
  'function name() external view returns (string)',
  'function symbol() external view returns (string)',
  'function decimals() external view returns (uint8)',
  'function balanceOf(address) external view returns (uint256)',
  'function allowance(address owner, address spender) external view returns (uint256)',
  'function approve(address spender, uint256 amount) external returns (bool)',
  'function paused() external view returns (bool)',
];

async function main() {
  const RPC_URL = 'https://sepolia.base.org';
  const provider = new ethers.JsonRpcProvider(RPC_URL);
  const wallet = new ethers.Wallet(PRIVATE_KEY, provider);

  console.log('🔍 Token and Wallet Analysis');
  console.log('='.repeat(60));
  console.log('Wallet Address:', wallet.address);
  console.log('Token Address:', TOKEN_ADDRESS);
  console.log('Pool Address:', POOL_ADDRESS);
  console.log('='.repeat(60));

  try {
    const tokenContract = new ethers.Contract(TOKEN_ADDRESS, ERC20_ABI, provider);

    // Get token info
    const [name, symbol, decimals] = await Promise.all([
      tokenContract.name(),
      tokenContract.symbol(),
      tokenContract.decimals(),
    ]);

    console.log('\n💰 Token Information:');
    console.log('Name:', name);
    console.log('Symbol:', symbol);
    console.log('Decimals:', decimals);

    // Check if token is paused
    try {
      const isPaused = await tokenContract.paused();
      console.log('Token Paused:', isPaused ? '🔴 YES' : '✅ No');
      
      if (isPaused) {
        console.log('\n⚠️  WARNING: The token itself is paused!');
        console.log('This is the issue - you cannot approve or transfer a paused token.');
      }
    } catch (err) {
      console.log('Token Paused: N/A (no pause function)');
    }

    // Check wallet balance
    const balance = await tokenContract.balanceOf(wallet.address);
    console.log('\n👛 Wallet Balance:');
    console.log('Balance:', ethers.formatUnits(balance, decimals), symbol);
    console.log('Balance (wei):', balance.toString());

    if (balance === 0n) {
      console.log('⚠️  WARNING: Wallet has ZERO balance!');
      console.log('You need to mint/get some', symbol, 'tokens first.');
    }

    // Check current allowance
    const allowance = await tokenContract.allowance(wallet.address, POOL_ADDRESS);
    console.log('\n✅ Current Allowance:');
    console.log('Allowance:', ethers.formatUnits(allowance, decimals), symbol);
    console.log('Allowance (wei):', allowance.toString());

    // Get native ETH balance for gas
    const ethBalance = await provider.getBalance(wallet.address);
    console.log('\n⛽ Gas Balance:');
    console.log('ETH Balance:', ethers.formatEther(ethBalance), 'ETH');

    if (ethBalance === 0n) {
      console.log('⚠️  WARNING: No ETH for gas fees!');
      console.log('Get some Base Sepolia ETH from: https://faucet.quicknode.com/base/sepolia');
    }

    // Summary
    console.log('\n' + '='.repeat(60));
    console.log('📋 SUMMARY:');
    
    if (balance === 0n) {
      console.log('❌ Cannot deposit: Wallet has no tokens');
      console.log('\n🔧 SOLUTION: Mint tokens first');
      console.log('   Run: node scripts/mint-test-tokens.js');
    } else if (ethBalance === 0n) {
      console.log('❌ Cannot approve: No ETH for gas');
      console.log('\n🔧 SOLUTION: Get Base Sepolia ETH');
      console.log('   https://faucet.quicknode.com/base/sepolia');
    } else if (allowance >= balance) {
      console.log('✅ Allowance already set - you can deposit now!');
    } else {
      console.log('✅ Ready to approve tokens');
      console.log('\n💡 Next step: Approve tokens for the pool');
    }
    console.log('='.repeat(60));

  } catch (error) {
    console.error('\n❌ Error:', error.message);
    throw error;
  }
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });

