const { ethers } = require('ethers');

const POOL_ADDRESS = '0x51E33dbf7Fa275Dc9A9e48c86D373AA7b75745A5';
const TOKEN_ADDRESS = '0x2DD9A8b2c1b73A607ddF16814338c4b942275DDa';
const WALLET_ADDRESS = '0xFeed27E8413d416Df4B26bf7BE275Bf92997413c';

const ERC20_ABI = [
  'function allowance(address owner, address spender) external view returns (uint256)',
  'function symbol() external view returns (string)',
  'function decimals() external view returns (uint8)',
];

async function main() {
  const RPC_URL = 'https://sepolia.base.org';
  const provider = new ethers.JsonRpcProvider(RPC_URL);

  const tokenContract = new ethers.Contract(TOKEN_ADDRESS, ERC20_ABI, provider);
  
  const [allowance, symbol, decimals] = await Promise.all([
    tokenContract.allowance(WALLET_ADDRESS, POOL_ADDRESS),
    tokenContract.symbol(),
    tokenContract.decimals(),
  ]);

  console.log('📊 Allowance Verification');
  console.log('='.repeat(60));
  console.log('Owner:', WALLET_ADDRESS);
  console.log('Spender:', POOL_ADDRESS);
  console.log('Token:', TOKEN_ADDRESS);
  console.log('='.repeat(60));
  console.log('\nRaw Allowance:', allowance.toString());
  
  // Check if it's max uint256
  const maxUint256 = ethers.MaxUint256;
  if (allowance === maxUint256) {
    console.log('Allowance: MAX (Unlimited) ✅');
  } else if (allowance > 0n) {
    console.log('Allowance:', ethers.formatUnits(allowance, decimals), symbol, '✅');
  } else {
    console.log('Allowance: 0', symbol, '❌');
  }
  
  console.log('='.repeat(60));
  
  if (allowance > 0n) {
    console.log('✅ Approval is active! You can now deposit to the pool.');
  } else {
    console.log('❌ No allowance found. The approval may have failed or been reverted.');
  }
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });

