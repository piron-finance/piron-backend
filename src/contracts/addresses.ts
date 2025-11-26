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
  manager: string;
  stableYieldManager: string;
  poolRegistry: string;
  poolFactory: string;
  managedPoolFactory: string;
  feeManager: string;
  mockUSDC?: string;
  usdc?: string;
  cngn?: string;
  accessManager: string;
  timelockController: string;
  upgradeGuardian: string;
}

export const CONTRACT_ADDRESSES: Record<number, NetworkContracts> = {
  // Base Sepolia (84532)
  84532: {
    // Governance
    accessManager: '0x05b326d12D802DF04b96Fa82335c5b9e7e22EA4b',
    timelockController: '0xD4480D4C5e15CdEab11dbA064d4F610aeb51bC1D',
    upgradeGuardian: '0x546a7adb0077bC6EA21c8dCf27E257FB58bF42ea',

    // Core Contracts (Proxies - use these!)
    manager: '0x056dAC51BF925e88d5d9eA3394D70b55A1691Da2',
    poolRegistry: '0x16308CeEB1Ee44Afc7c731B567D3135E1B2752e3',
    poolFactory: '0x4A7E6245CA1AaE0E0f159A8aF23b336542a30aF0',

    // Stable Yield Contracts (Proxies)
    stableYieldManager: '0xE756E61e69cd090Cfe7bF0648c6f488c47629a80',
    managedPoolFactory: '0x958b320E4cce5B6930b5695Bb9B817Ec01209D4a',

    // Supporting
    feeManager: '0x10815459d81F88F3176FaAf81CF7be256FdFe94A',

    // Assets
    mockUSDC: '0x2DD9A8b2c1b73A607ddF16814338c4b942275DDa', // MockERC20 from deployment
    usdc: '0xdB787674289f636E96864De93c952d0390B5bC58',
    cngn: '0x929A08903C22440182646Bb450a67178Be402f7f',
  },

  // Base Mainnet (8453) - To be added when deployed
  8453: {
    accessManager: '',
    timelockController: '',
    upgradeGuardian: '',
    manager: '',
    poolRegistry: '',
    poolFactory: '',
    stableYieldManager: '',
    managedPoolFactory: '',
    feeManager: '',
    mockUSDC: '',
    usdc: '',
    cngn: '',
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

// 1. Frontend → POST /api/v1/admin/pools/create
// 2. Backend validates DTO
// 3. Backend calls PoolCreationValidator.validate()
// 4. ⚠️  HANGS HERE → blockchain.isAssetApproved() (RPC call to Base Sepolia)
// 5. (Should) Fetch asset symbol & decimals from ERC20 contract
// 6. (Should) Create pool record in DB with PENDING_DEPLOYMENT status
// 7. (Should) Build unsigned transaction data
// 8. (Should) Return {poolId, pool, transaction} to frontend
// 9. Frontend signs & sends transaction
// 10. Frontend calls /api/v1/admin/pools/confirm-deployment
// 11. PoolCreationWatcher auto-detects deployment → updates pool to FUNDING
