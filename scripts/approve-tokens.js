const { ethers } = require('ethers');

// Configuration
const POOL_ADDRESS = '0x51E33dbf7Fa275Dc9A9e48c86D373AA7b75745A5';
const TOKEN_ADDRESS = '0x2DD9A8b2c1b73A607ddF16814338c4b942275DDa';
const PRIVATE_KEY = 'ecaf18fce09fefe7c63393a30390300f7dcc47134574eb76dcaa8f688c5df132';

// Amount to approve (default: max uint256 for unlimited approval)
const AMOUNT = process.env.AMOUNT || ethers.MaxUint256.toString();

const ERC20_ABI = [
  'function approve(address spender, uint256 amount) external returns (bool)',
  'function allowance(address owner, address spender) external view returns (uint256)',
  'function symbol() external view returns (string)',
  'function decimals() external view returns (uint8)',
];

async function main() {
  const RPC_URL = 'https://sepolia.base.org';
  const provider = new ethers.JsonRpcProvider(RPC_URL);
  const wallet = new ethers.Wallet(PRIVATE_KEY, provider);

  console.log('🔐 Token Approval Process');
  console.log('='.repeat(60));
  console.log('Wallet:', wallet.address);
  console.log('Token:', TOKEN_ADDRESS);
  console.log('Spender (Pool):', POOL_ADDRESS);
  console.log('='.repeat(60));

  try {
    const tokenContract = new ethers.Contract(TOKEN_ADDRESS, ERC20_ABI, wallet);
    
    const [symbol, decimals] = await Promise.all([
      tokenContract.symbol(),
      tokenContract.decimals(),
    ]);

    // Check current allowance
    const currentAllowance = await tokenContract.allowance(wallet.address, POOL_ADDRESS);
    console.log('\n📊 Current Allowance:', ethers.formatUnits(currentAllowance, decimals), symbol);

    // Determine amount to approve
    let approveAmount = AMOUNT;
    let displayAmount = 'MAX (unlimited)';
    
    if (AMOUNT !== ethers.MaxUint256.toString()) {
      approveAmount = ethers.parseUnits(AMOUNT, decimals);
      displayAmount = AMOUNT + ' ' + symbol;
    }

    console.log('💰 Approving:', displayAmount);
    console.log('\n📝 Sending approval transaction...');

    // Send approval transaction
    const tx = await tokenContract.approve(POOL_ADDRESS, approveAmount);
    console.log('✅ Transaction sent!');
    console.log('   Hash:', tx.hash);
    console.log('   Explorer: https://sepolia.basescan.org/tx/' + tx.hash);

    console.log('\n⏳ Waiting for confirmation...');
    const receipt = await tx.wait();

    if (receipt.status === 1) {
      console.log('✅ Approval confirmed!');
      console.log('   Block:', receipt.blockNumber);
      console.log('   Gas used:', receipt.gasUsed.toString());

      // Verify new allowance
      const newAllowance = await tokenContract.allowance(wallet.address, POOL_ADDRESS);
      console.log('\n📊 New Allowance:', ethers.formatUnits(newAllowance, decimals), symbol);

      console.log('\n' + '='.repeat(60));
      console.log('🎉 SUCCESS! You can now deposit to the pool');
      console.log('='.repeat(60));
    } else {
      console.log('❌ Transaction failed');
      console.log('Receipt:', receipt);
    }

  } catch (error) {
    console.error('\n❌ APPROVAL FAILED');
    console.error('Error:', error.message);

    // Check for specific error types
    if (error.message.includes('EnforcedPause')) {
      console.log('\n⚠️  Error Type: EnforcedPause');
      console.log('The contract is paused. Check which contract is paused:');
      console.log('- Token contract paused?');
      console.log('- Pool contract paused?');
    }
    
    if (error.message.includes('insufficient funds')) {
      console.log('\n⚠️  Error Type: Insufficient Funds');
      console.log('You need more ETH for gas fees');
    }

    if (error.message.includes('execution reverted')) {
      console.log('\n⚠️  Error Type: Transaction Reverted');
      console.log('The contract rejected the transaction');
    }

    // Log full error for debugging
    console.log('\n📋 Full Error Details:');
    console.log(error);

    throw error;
  }
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error('\nExiting with error');
    process.exit(1);
  });

