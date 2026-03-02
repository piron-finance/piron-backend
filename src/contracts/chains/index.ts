/**
 * Multi-Chain Registry
 * 
 * Centralizes all chain configurations and provides helpers
 * for working with multiple chains.
 */

import { ChainDeployment, NetworkConfig, ContractAddresses, SupportedChainId } from './types';
import { BASE_SEPOLIA_DEPLOYMENT, BASE_MAINNET_DEPLOYMENT, BASE_SEPOLIA, BASE_MAINNET } from './base';
import { ARBITRUM_SEPOLIA_DEPLOYMENT, ARBITRUM_ONE_DEPLOYMENT, ARBITRUM_SEPOLIA, ARBITRUM_ONE } from './arbitrum';

// Re-export types
export * from './types';

// ============================================================================
// CHAIN REGISTRY
// ============================================================================

/**
 * All supported chain deployments indexed by chainId
 */
export const CHAIN_DEPLOYMENTS: Record<SupportedChainId, ChainDeployment> = {
  // Base
  [BASE_SEPOLIA.chainId]: BASE_SEPOLIA_DEPLOYMENT,
  [BASE_MAINNET.chainId]: BASE_MAINNET_DEPLOYMENT,
  
  // Arbitrum (templates - not deployed)
  [ARBITRUM_SEPOLIA.chainId]: ARBITRUM_SEPOLIA_DEPLOYMENT,
  [ARBITRUM_ONE.chainId]: ARBITRUM_ONE_DEPLOYMENT,
};

/**
 * All network configs indexed by chainId
 */
export const NETWORKS: Record<SupportedChainId, NetworkConfig> = {
  // Base
  [BASE_SEPOLIA.chainId]: BASE_SEPOLIA,
  [BASE_MAINNET.chainId]: BASE_MAINNET,
  
  // Arbitrum
  [ARBITRUM_SEPOLIA.chainId]: ARBITRUM_SEPOLIA,
  [ARBITRUM_ONE.chainId]: ARBITRUM_ONE,
};

/**
 * Chains that are actually deployed and ready to use
 */
export const DEPLOYED_CHAINS: SupportedChainId[] = [
  84532,  // Base Sepolia - deployed
  // Add more as you deploy to new chains
];

/**
 * Testnet to mainnet mapping
 */
export const TESTNET_TO_MAINNET: Record<number, number> = {
  84532: 8453,      // Base Sepolia → Base
  421614: 42161,    // Arbitrum Sepolia → Arbitrum One
};

export const MAINNET_TO_TESTNET: Record<number, number> = {
  8453: 84532,      // Base → Base Sepolia
  42161: 421614,    // Arbitrum One → Arbitrum Sepolia
};

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

/**
 * Check if a chain is supported
 */
export function isSupportedChain(chainId: number): chainId is SupportedChainId {
  return chainId in CHAIN_DEPLOYMENTS;
}

/**
 * Check if contracts are deployed on a chain
 */
export function isDeployedChain(chainId: number): boolean {
  return DEPLOYED_CHAINS.includes(chainId);
}

/**
 * Check if chain is a testnet
 */
export function isTestnet(chainId: number): boolean {
  const network = NETWORKS[chainId];
  return network?.isTestnet ?? false;
}

/**
 * Get network config for a chain
 */
export function getNetwork(chainId: number): NetworkConfig {
  const network = NETWORKS[chainId];
  if (!network) {
    throw new Error(`Unsupported chain: ${chainId}`);
  }
  return network;
}

/**
 * Get contract addresses for a chain
 */
export function getAddresses(chainId: number): ContractAddresses {
  const deployment = CHAIN_DEPLOYMENTS[chainId];
  if (!deployment) {
    throw new Error(`No deployment for chain: ${chainId}`);
  }
  return deployment.addresses;
}

/**
 * Get full deployment info for a chain
 */
export function getDeployment(chainId: number): ChainDeployment {
  const deployment = CHAIN_DEPLOYMENTS[chainId];
  if (!deployment) {
    throw new Error(`No deployment for chain: ${chainId}`);
  }
  return deployment;
}

/**
 * Get the active chain ID based on environment
 * Can be overridden with ACTIVE_CHAIN_ID env var
 */
export function getActiveChainId(): SupportedChainId {
  if (process.env.ACTIVE_CHAIN_ID) {
    const chainId = parseInt(process.env.ACTIVE_CHAIN_ID, 10);
    if (isSupportedChain(chainId)) {
      return chainId;
    }
    console.warn(`Invalid ACTIVE_CHAIN_ID: ${chainId}, falling back to default`);
  }
  
  const env = process.env.NODE_ENV || 'development';
  return env === 'production' ? 8453 : 84532; // Base Mainnet or Base Sepolia
}

/**
 * Get deployment info for the active chain
 */
export function getActiveDeployment(): ChainDeployment & { environment: string } {
  const chainId = getActiveChainId();
  const deployment = getDeployment(chainId);
  
  return {
    ...deployment,
    environment: process.env.NODE_ENV || 'development',
  };
}

/**
 * List all supported chains with their status
 */
export function listChains(): Array<{
  chainId: number;
  name: string;
  isTestnet: boolean;
  isDeployed: boolean;
  version: string;
}> {
  return Object.entries(CHAIN_DEPLOYMENTS).map(([chainId, deployment]) => ({
    chainId: parseInt(chainId, 10),
    name: deployment.network.name,
    isTestnet: deployment.network.isTestnet,
    isDeployed: DEPLOYED_CHAINS.includes(parseInt(chainId, 10)),
    version: deployment.deploymentVersion,
  }));
}

/**
 * Get the corresponding testnet for a mainnet chain (or vice versa)
 */
export function getCounterpartChain(chainId: number): number | null {
  return TESTNET_TO_MAINNET[chainId] || MAINNET_TO_TESTNET[chainId] || null;
}

// ============================================================================
// CONTRACT VERIFICATION (Can we detect deployment?)
// ============================================================================

/**
 * Check if a contract exists on a chain by calling a basic function
 * This helps detect if contracts are deployed on a given chain
 * 
 * NOTE: This requires making an RPC call, so use sparingly
 */
export async function verifyContractExists(
  chainId: number,
  contractAddress: string,
): Promise<boolean> {
  const { JsonRpcProvider } = await import('ethers');
  
  const network = NETWORKS[chainId];
  if (!network) return false;
  
  try {
    const provider = new JsonRpcProvider(network.rpcUrl);
    const code = await provider.getCode(contractAddress);
    // If code is '0x', no contract exists at this address
    return code !== '0x';
  } catch {
    return false;
  }
}

/**
 * Detect which chains a contract is deployed on
 * Checks all supported chains
 */
export async function detectContractChains(contractAddress: string): Promise<number[]> {
  const deployedOn: number[] = [];
  
  for (const chainId of Object.keys(NETWORKS).map(Number)) {
    const exists = await verifyContractExists(chainId, contractAddress);
    if (exists) {
      deployedOn.push(chainId);
    }
  }
  
  return deployedOn;
}
