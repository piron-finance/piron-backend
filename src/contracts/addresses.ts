/**
 * Contract Addresses - Multi-Chain Support
 * 
 * This file provides backward-compatible exports while using the new
 * chain-based architecture under the hood.
 * 
 * For new code, prefer importing directly from './chains'
 */

// Re-export everything from the new chain system
export {
  // Types
  NetworkConfig,
  ContractAddresses,
  ChainDeployment,
  SupportedChainId,
  
  // Registry
  CHAIN_DEPLOYMENTS,
  NETWORKS,
  DEPLOYED_CHAINS,
  
  // Helpers
  isSupportedChain,
  isDeployedChain,
  isTestnet,
  getNetwork,
  getAddresses,
  getDeployment,
  getActiveChainId,
  getActiveDeployment,
  listChains,
  getCounterpartChain,
  
  // Contract verification
  verifyContractExists,
  detectContractChains,
} from './chains';

// Import for backward compatibility aliases
import {
  NETWORKS as CHAIN_NETWORKS,
  getAddresses,
  getNetwork,
  getActiveChainId,
  getActiveDeployment,
  ContractAddresses,
} from './chains';

// ============================================================================
// BACKWARD COMPATIBILITY (deprecated - use chains/* instead)
// ============================================================================

/** @deprecated Use getAddresses(chainId) instead */
export const CONTRACT_ADDRESSES: Record<number, ContractAddresses> = {
  get 84532() { return getAddresses(84532); },
  get 8453() { return getAddresses(8453); },
};

/** @deprecated Use chains/base.ts exports instead */
export const DEV_ADDRESSES = getAddresses(84532);
export const PROD_ADDRESSES = getAddresses(8453);

export type ChainId = 84532 | 8453;

/** @deprecated Use getAddresses(chainId) instead */
export function getContractAddresses(chainId: ChainId) {
  return getAddresses(chainId);
}

/** @deprecated Use getNetwork(chainId) instead */
export function getNetworkConfig(chainId: ChainId) {
  return getNetwork(chainId);
}

/** @deprecated Use getActiveDeployment() instead */
export function getDeploymentInfo() {
  const deployment = getActiveDeployment();
  return {
    environment: deployment.environment,
    chainId: deployment.network.chainId,
    network: deployment.network,
    deploymentVersion: deployment.deploymentVersion,
    addresses: deployment.addresses,
  };
}

/** @deprecated NetworkContracts is now ContractAddresses */
export type NetworkContracts = ContractAddresses;
