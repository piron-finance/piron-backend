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

  // Assets
  mockUSDC?: string;
  usdc?: string;
  cngn?: string;
}

export const CONTRACT_ADDRESSES: Record<number, NetworkContracts> = {
  // Base Sepolia (84532) - Latest Deployment
  84532: {
    // Governance
    accessManager: '0xD247a5455569C4b8b9914566092cf30DBD46c98d',
    timelockController: '0x2c98f4BcB2e61b07240018aB199A0Be6d9749C10',
    upgradeGuardian: '0xcf279bb0a6D8E108978aF5472537F11Cb10F757e',

    // Core Infrastructure (Proxies)
    poolRegistry: '0xb295a7c89044Cfd884bA89F10D2bdD0Bb2093015',
    poolFactory: '0x8846aDa6da5ABADcedb1Be69BCF4cf2D7c2487A5',
    manager: '0x4035f114754010A17f10B492463a6a3Bf52b9449',

    // Stable Yield Contracts (Proxies)
    stableYieldManager: '0x057C47B36aCCbe6ED96c1BbEBAB34e406c706c97',
    managedPoolFactory: '0x04F02918D73360efD9f2fFEB6a3f8d278396b728',

    // Locked Pool Contracts (Proxy)
    lockedPoolManager: '0xAC9C38942A3991679733DA970810Bb21BA6Cc34F',

    // Test Assets
    mockUSDC: '0x517E901cAe0c557029309A11e400a5bCc3BB65C0',
    usdc: '0xdB787674289f636E96864De93c952d0390B5bC58',
    cngn: '0x929A08903C22440182646Bb450a67178Be402f7f',
  },

  // Base Mainnet (8453) - To be added when deployed
  8453: {
    accessManager: '',
    timelockController: '',
    upgradeGuardian: '',
    poolRegistry: '',
    poolFactory: '',
    manager: '',
    stableYieldManager: '',
    managedPoolFactory: '',
    lockedPoolManager: '',
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
