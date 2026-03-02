import { ChainDeployment, NetworkConfig, ContractAddresses } from './types';

/**
 * Base Chain Configuration
 * - Testnet: Base Sepolia (84532)
 * - Mainnet: Base (8453)
 */

// ============================================================================
// NETWORK CONFIGS
// ============================================================================

export const BASE_SEPOLIA: NetworkConfig = {
  chainId: 84532,
  name: 'Base Sepolia',
  shortName: 'base-sepolia',
  rpcUrl: process.env.BASE_SEPOLIA_RPC || 'https://sepolia.base.org',
  explorerUrl: 'https://sepolia.basescan.org',
  explorerApiUrl: 'https://api-sepolia.basescan.org/api',
  isTestnet: true,
  nativeCurrency: {
    name: 'Ethereum',
    symbol: 'ETH',
    decimals: 18,
  },
};

export const BASE_MAINNET: NetworkConfig = {
  chainId: 8453,
  name: 'Base',
  shortName: 'base',
  rpcUrl: process.env.BASE_MAINNET_RPC || 'https://mainnet.base.org',
  explorerUrl: 'https://basescan.org',
  explorerApiUrl: 'https://api.basescan.org/api',
  isTestnet: false,
  nativeCurrency: {
    name: 'Ethereum',
    symbol: 'ETH',
    decimals: 18,
  },
};

// ============================================================================
// CONTRACT ADDRESSES
// ============================================================================

const BASE_SEPOLIA_ADDRESSES: ContractAddresses = {
  // Last deployment: 2026-02-25
  accessManager: '0x123Dbe7E9a7f7E98711FD032f9E0C1E4761771C9',
  timelockController: '0x03f80e9b17A8D961AF2C8A527F6604C28723a983',
  upgradeGuardian: '0xeaA01Eb0835D7B4AEed71e9D23ce2E3b14ddAe09',
  poolRegistry: '0x096F3405F1c583B1a4678F6fCA5570886BAbE0ba',
  poolFactory: '0xCA31b83bE4774D7F20Cbbe677e1fFcDC484e7FFa',
  manager: '0xe81B962109FA5A2644Eb7150Ae979782F9055314',
  stableYieldManager: '0xb4c02cF73a0F219f491AC65DdEc0e59DF64d339d',
  managedPoolFactory: '0x5a7937701E69A7EFC229161e13488B0addD6d46b',
  lockedPoolManager: '0xbdf5C0D1B39ABAe590620472ee3e33E0D18b2516',
  yieldReserveEscrow: '0x108538dF32375730021e7cb26Cdab14c4AC39bAA',
  feeManager: '0x38c1764bC2cdcBf85CBF7202BC586AEf04dcF999',
  mockUSDC: '0x94ac688dEd59cf284274DbD289AC6acfd2d5721C',
  usdc: '0xdB787674289f636E96864De93c952d0390B5bC58',
  cngn: '0x929A08903C22440182646Bb450a67178Be402f7f',
};

const BASE_MAINNET_ADDRESSES: ContractAddresses = {
  // Not yet deployed - placeholders
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
  usdc: '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913', // Official USDC on Base
};

// ============================================================================
// DEPLOYMENTS
// ============================================================================

export const BASE_SEPOLIA_DEPLOYMENT: ChainDeployment = {
  network: BASE_SEPOLIA,
  addresses: BASE_SEPOLIA_ADDRESSES,
  deploymentVersion: '1.1.0',
  deployedAt: '2026-02-25',
};

export const BASE_MAINNET_DEPLOYMENT: ChainDeployment = {
  network: BASE_MAINNET,
  addresses: BASE_MAINNET_ADDRESSES,
  deploymentVersion: '0.0.0', // Not deployed yet
};
