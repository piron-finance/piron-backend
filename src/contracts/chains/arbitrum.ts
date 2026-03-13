import { ChainDeployment, NetworkConfig, ContractAddresses } from './types';

/**
 * Arbitrum Chain Configuration
 * - Testnet: Arbitrum Sepolia (421614)
 * - Mainnet: Arbitrum One (42161)
 * 
 * STATUS: Not deployed - template only
 */

// ============================================================================
// NETWORK CONFIGS
// ============================================================================

export const ARBITRUM_SEPOLIA: NetworkConfig = {
  chainId: 421614,
  name: 'Arbitrum Sepolia',
  shortName: 'arb-sepolia',
  rpcUrl: process.env.ARBITRUM_SEPOLIA_RPC || 'https://sepolia-rollup.arbitrum.io/rpc',
  explorerUrl: 'https://sepolia.arbiscan.io',
  explorerApiUrl: 'https://api-sepolia.arbiscan.io/api',
  isTestnet: true,
  nativeCurrency: {
    name: 'Ethereum',
    symbol: 'ETH',
    decimals: 18,
  },
};

export const ARBITRUM_ONE: NetworkConfig = {
  chainId: 42161,
  name: 'Arbitrum One',
  shortName: 'arbitrum',
  rpcUrl: process.env.ARBITRUM_RPC || 'https://arb1.arbitrum.io/rpc',
  explorerUrl: 'https://arbiscan.io',
  explorerApiUrl: 'https://api.arbiscan.io/api',
  isTestnet: false,
  nativeCurrency: {
    name: 'Ethereum',
    symbol: 'ETH',
    decimals: 18,
  },
};

// ============================================================================
// CONTRACT ADDRESSES (Placeholders - update when deployed)
// ============================================================================

const ARBITRUM_SEPOLIA_ADDRESSES: ContractAddresses = {
  accessManager: '0x0000000000000000000000000000000000000000',
  timelockController: '0x0000000000000000000000000000000000000000',
  upgradeGuardian: '0x0000000000000000000000000000000000000000',
  poolRegistry: '0x0000000000000000000000000000000000000000',
  poolFactory: '0x0000000000000000000000000000000000000000',
  manager: '0x0000000000000000000000000000000000000000',
  stableYieldManager: '0x0000000000000000000000000000000000000000',
  managedPoolFactory: '0x0000000000000000000000000000000000000000',
  lockedPoolManager: '0x0000000000000000000000000000000000000000',
  yieldReserveEscrow: '0x0000000000000000000000000000000000000000',
  feeManager: '0x0000000000000000000000000000000000000000',
};

const ARBITRUM_ONE_ADDRESSES: ContractAddresses = {
  accessManager: '0x0000000000000000000000000000000000000000',
  timelockController: '0x0000000000000000000000000000000000000000',
  upgradeGuardian: '0x0000000000000000000000000000000000000000',
  poolRegistry: '0x0000000000000000000000000000000000000000',
  poolFactory: '0x0000000000000000000000000000000000000000',
  manager: '0x0000000000000000000000000000000000000000',
  stableYieldManager: '0x0000000000000000000000000000000000000000',
  managedPoolFactory: '0x0000000000000000000000000000000000000000',
  lockedPoolManager: '0x0000000000000000000000000000000000000000',
  yieldReserveEscrow: '0x0000000000000000000000000000000000000000',
  feeManager: '0x0000000000000000000000000000000000000000',
  usdc: '0xaf88d065e77c8cC2239327C5EDb3A432268e5831', // Official USDC on Arbitrum
};

// ============================================================================
// DEPLOYMENTS
// ============================================================================

export const ARBITRUM_SEPOLIA_DEPLOYMENT: ChainDeployment = {
  network: ARBITRUM_SEPOLIA,
  addresses: ARBITRUM_SEPOLIA_ADDRESSES,
  deploymentVersion: '0.0.0', // Not deployed
};

export const ARBITRUM_ONE_DEPLOYMENT: ChainDeployment = {
  network: ARBITRUM_ONE,
  addresses: ARBITRUM_ONE_ADDRESSES,
  deploymentVersion: '0.0.0', // Not deployed
};
