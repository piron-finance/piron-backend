/**
 * Production Contract Addresses
 * Base Mainnet
 * 
 * CAUTION: These are production addresses - changes require careful review
 */

export const PROD_ADDRESSES = {
  chainId: 8453,
  network: 'Base Mainnet',
  
  // Deployment version
  deploymentVersion: '0.0.0', // Not yet deployed
  
  // Governance
  accessManager: '',
  timelockController: '',
  upgradeGuardian: '',

  // Core Infrastructure
  poolRegistry: '',
  poolFactory: '',
  manager: '',

  // Stable Yield
  stableYieldManager: '',
  managedPoolFactory: '',

  // Locked Pool
  lockedPoolManager: '',

  // Protocol Capital
  yieldReserveEscrow: '',
  feeManager: '',

  // Assets
  usdc: '', // Circle USDC on Base
  cngn: '',
} as const;
