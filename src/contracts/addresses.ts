import { DEV_ADDRESSES } from './addresses.dev';
import { PROD_ADDRESSES } from './addresses.prod';

export const NETWORKS = {
  BASE_SEPOLIA: {
    chainId: 84532,
    name: 'Base Sepolia',
    rpcUrl: process.env.BASE_SEPOLIA_RPC || 'https://sepolia.base.org',
    explorerUrl: 'https://sepolia.basescan.org',
  },
  BASE_MAINNET: {
    chainId: 8453,
    name: 'Base',
    rpcUrl: process.env.BASE_MAINNET_RPC || 'https://mainnet.base.org',
    explorerUrl: 'https://basescan.org',
  },
} as const;

interface NetworkContracts {
  // Governance
  accessManager: string;
  timelockController: string;
  upgradeGuardian: string;

  // Core Infrastructure
  poolRegistry: string;
  poolFactory: string;
  manager: string;

  // Stable Yield
  stableYieldManager: string;
  managedPoolFactory: string;

  // Locked Pool
  lockedPoolManager: string;

  // Protocol Capital
  yieldReserveEscrow: string;
  feeManager: string;

  // Treasury (defaults to timelockController)
  treasury?: string;

  // Assets
  mockUSDC?: string;
  usdc?: string;
  cngn?: string;
}

/**
 * Contract addresses by chain ID
 * 
 * Development (84532): addresses.dev.ts
 * Production (8453): addresses.prod.ts
 */
export const CONTRACT_ADDRESSES: Record<number, NetworkContracts> = {
  // Base Sepolia (Development/Testnet)
  84532: {
    accessManager: DEV_ADDRESSES.accessManager,
    timelockController: DEV_ADDRESSES.timelockController,
    upgradeGuardian: DEV_ADDRESSES.upgradeGuardian,
    poolRegistry: DEV_ADDRESSES.poolRegistry,
    poolFactory: DEV_ADDRESSES.poolFactory,
    manager: DEV_ADDRESSES.manager,
    stableYieldManager: DEV_ADDRESSES.stableYieldManager,
    managedPoolFactory: DEV_ADDRESSES.managedPoolFactory,
    lockedPoolManager: DEV_ADDRESSES.lockedPoolManager,
    yieldReserveEscrow: DEV_ADDRESSES.yieldReserveEscrow,
    feeManager: DEV_ADDRESSES.feeManager,
    mockUSDC: DEV_ADDRESSES.mockUSDC,
    usdc: DEV_ADDRESSES.usdc,
    cngn: DEV_ADDRESSES.cngn,
  },

  // Base Mainnet (Production)
  8453: {
    accessManager: PROD_ADDRESSES.accessManager,
    timelockController: PROD_ADDRESSES.timelockController,
    upgradeGuardian: PROD_ADDRESSES.upgradeGuardian,
    poolRegistry: PROD_ADDRESSES.poolRegistry,
    poolFactory: PROD_ADDRESSES.poolFactory,
    manager: PROD_ADDRESSES.manager,
    stableYieldManager: PROD_ADDRESSES.stableYieldManager,
    managedPoolFactory: PROD_ADDRESSES.managedPoolFactory,
    lockedPoolManager: PROD_ADDRESSES.lockedPoolManager,
    yieldReserveEscrow: PROD_ADDRESSES.yieldReserveEscrow,
    feeManager: PROD_ADDRESSES.feeManager,
    usdc: PROD_ADDRESSES.usdc,
    cngn: PROD_ADDRESSES.cngn,
  },
} as const;

export type ChainId = keyof typeof CONTRACT_ADDRESSES;

export function getContractAddresses(chainId: ChainId) {
  const addresses = CONTRACT_ADDRESSES[chainId];
  if (!addresses) {
    throw new Error(`No contract addresses for chain ${chainId}`);
  }
  return addresses;
}

export function getNetworkConfig(chainId: ChainId) {
  if (chainId === 84532) return NETWORKS.BASE_SEPOLIA;
  if (chainId === 8453) return NETWORKS.BASE_MAINNET;
  throw new Error(`Unsupported chain ${chainId}`);
}

export function getDeploymentInfo() {
  const env = process.env.NODE_ENV || 'development';
  const isProd = env === 'production';
  
  return {
    environment: env,
    chainId: isProd ? 8453 : 84532,
    network: isProd ? NETWORKS.BASE_MAINNET : NETWORKS.BASE_SEPOLIA,
    deploymentVersion: isProd ? PROD_ADDRESSES.deploymentVersion : DEV_ADDRESSES.deploymentVersion,
  };
}
