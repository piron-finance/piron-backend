/**
 * Development/Testnet Contract Addresses
 * Base Sepolia - Updated after each fresh deployment
 * 
 * IMPORTANT: When you redeploy contracts, update these addresses
 * and run `npm run db:reset:dev` to clear stale data
 */

export const DEV_ADDRESSES = {
  chainId: 84532,
  network: 'Base Sepolia',
  
  // Last deployment: 2026-02-25
  deploymentVersion: '1.1.0',
  
  // Governance
  accessManager: '0x123Dbe7E9a7f7E98711FD032f9E0C1E4761771C9',
  timelockController: '0x03f80e9b17A8D961AF2C8A527F6604C28723a983',
  upgradeGuardian: '0xeaA01Eb0835D7B4AEed71e9D23ce2E3b14ddAe09',

  // Core Infrastructure
  poolRegistry: '0x096F3405F1c583B1a4678F6fCA5570886BAbE0ba',
  poolFactory: '0xCA31b83bE4774D7F20Cbbe677e1fFcDC484e7FFa',
  manager: '0xe81B962109FA5A2644Eb7150Ae979782F9055314',

  // Stable Yield
  stableYieldManager: '0xb4c02cF73a0F219f491AC65DdEc0e59DF64d339d',
  managedPoolFactory: '0x5a7937701E69A7EFC229161e13488B0addD6d46b',

  // Locked Pool
  lockedPoolManager: '0xbdf5C0D1B39ABAe590620472ee3e33E0D18b2516',

  // Protocol Capital
  yieldReserveEscrow: '0x108538dF32375730021e7cb26Cdab14c4AC39bAA',
  feeManager: '0x38c1764bC2cdcBf85CBF7202BC586AEf04dcF999',

  // Test Assets
  mockUSDC: '0x94ac688dEd59cf284274DbD289AC6acfd2d5721C',
  usdc: '0xdB787674289f636E96864De93c952d0390B5bC58',
  cngn: '0x929A08903C22440182646Bb450a67178Be402f7f',
} as const;
