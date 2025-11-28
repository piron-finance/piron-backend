const { ethers } = require('ethers');

// Configuration
const POOL_ADDRESS = '0x51E33dbf7Fa275Dc9A9e48c86D373AA7b75745A5';
const PRIVATE_KEY = 'ecaf18fce09fefe7c63393a30390300f7dcc47134574eb76dcaa8f688c5df132';
const DEPOSIT_AMOUNT = process.env.AMOUNT || '100'; // 100 tokens by default

const STABLE_YIELD_POOL_ABI = [
  'function deposit(uint256 assets, address receiver) external returns (uint256)',
  'function asset() external view returns (address)',
  'function balanceOf(address) external view returns (uint256)',
  'function paused() external view returns (bool)',
];

const ERC20_ABI = [
  'function symbol() external view returns (string)',
  'function decimals() external view returns (uint8)',
  'function balanceOf(address) external view returns (uint256)',
  'function allowance(address owner, address spender) external view returns (uint256)',
];

async function main() {
  const RPC_URL = 'https://sepolia.base.org';
  const provider = new ethers.JsonRpcProvider(RPC_URL);
  const wallet = new ethers.Wallet(PRIVATE_KEY, provider);

  console.log('💸 Test Deposit to Pool');
  console.log('='.repeat(60));
  console.log('Wallet:', wallet.address);
  console.log('Pool:', POOL_ADDRESS);
  console.log('Amount:', DEPOSIT_AMOUNT);
  console.log('='.repeat(60));

  try {
    const poolContract = new ethers.Contract(POOL_ADDRESS, STABLE_YIELD_POOL_ABI, wallet);

    // Get asset token
    const assetAddress = await poolContract.asset();
    const tokenContract = new ethers.Contract(assetAddress, ERC20_ABI, provider);

    const [symbol, decimals] = await Promise.all([
      tokenContract.symbol(),
      tokenContract.decimals(),
    ]);

    console.log('\n💰 Token:', symbol);

    // Check balances before
    const balanceBefore = await tokenContract.balanceOf(wallet.address);
    const sharesBefore = await poolContract.balanceOf(wallet.address);
    const allowance = await tokenContract.allowance(wallet.address, POOL_ADDRESS);

    console.log('\n📊 Before Deposit:');
    console.log('Token Balance:', ethers.formatUnits(balanceBefore, decimals), symbol);
    console.log('Pool Shares:', ethers.formatUnits(sharesBefore, 18));
    console.log('Allowance:', allowance === ethers.MaxUint256 ? 'MAX' : ethers.formatUnits(allowance, decimals));

    // Check if pool is paused
    const isPaused = await poolContract.paused();
    if (isPaused) {
      throw new Error('Pool is paused!');
    }

    // Prepare deposit
    const depositAmountWei = ethers.parseUnits(DEPOSIT_AMOUNT, decimals);
    console.log('\n📝 Depositing:', DEPOSIT_AMOUNT, symbol);

    // Execute deposit
    const tx = await poolContract.deposit(depositAmountWei, wallet.address);
    console.log('✅ Transaction sent!');
    console.log('   Hash:', tx.hash);
    console.log('   Explorer: https://sepolia.basescan.org/tx/' + tx.hash);

    console.log('\n⏳ Waiting for confirmation...');
    const receipt = await tx.wait();

    if (receipt.status === 1) {
      console.log('✅ Deposit confirmed!');
      console.log('   Block:', receipt.blockNumber);
      console.log('   Gas used:', receipt.gasUsed.toString());

      // Check balances after
      const balanceAfter = await tokenContract.balanceOf(wallet.address);
      const sharesAfter = await poolContract.balanceOf(wallet.address);

      console.log('\n📊 After Deposit:');
      console.log('Token Balance:', ethers.formatUnits(balanceAfter, decimals), symbol);
      console.log('Pool Shares:', ethers.formatUnits(sharesAfter, 18));

      const tokenSpent = balanceBefore - balanceAfter;
      const sharesReceived = sharesAfter - sharesBefore;

      console.log('\n📈 Changes:');
      console.log('Tokens Spent:', ethers.formatUnits(tokenSpent, decimals), symbol);
      console.log('Shares Received:', ethers.formatUnits(sharesReceived, 18));

      console.log('\n' + '='.repeat(60));
      console.log('🎉 DEPOSIT SUCCESSFUL!');
      console.log('='.repeat(60));
    } else {
      console.log('❌ Transaction failed');
      console.log('Receipt:', receipt);
    }

  } catch (error) {
    console.error('\n❌ DEPOSIT FAILED');
    console.error('Error:', error.message);

    if (error.message.includes('EnforcedPause')) {
      console.log('\n⚠️  Pool is paused');
    }
    
    if (error.message.includes('insufficient allowance')) {
      console.log('\n⚠️  Insufficient allowance - run approve-tokens.js first');
    }

    if (error.message.includes('insufficient balance')) {
      console.log('\n⚠️  Insufficient token balance');
    }

    console.log('\n📋 Full Error:');
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

