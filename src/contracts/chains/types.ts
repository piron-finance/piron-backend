/**
 * Core types for multi-chain support
 */

export interface NetworkConfig {
  chainId: number;
  name: string;
  shortName: string;
  rpcUrl: string;
  explorerUrl: string;
  explorerApiUrl?: string;
  isTestnet: boolean;
  nativeCurrency: {
    name: string;
    symbol: string;
    decimals: number;
  };
}

export interface ContractAddresses {
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

  // Treasury (defaults to timelockController if not set)
  treasury?: string;

  // Stablecoins - chain specific
  usdc?: string;
  usdt?: string;
  dai?: string;
  
  // Other tokens
  mockUSDC?: string;
  cngn?: string;
}

export interface ChainDeployment {
  network: NetworkConfig;
  addresses: ContractAddresses;
  deploymentVersion: string;
  deployedAt?: string;
}

export type SupportedChainId = number;
