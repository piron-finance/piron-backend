import { Controller, Get, Param } from '@nestjs/common';
import { 
  getActiveDeployment, 
  listChains, 
  getDeployment,
  isSupportedChain,
  verifyContractExists,
  detectContractChains,
} from '../../contracts/addresses';
import { PrismaService } from '../../prisma.service';

@Controller('health')
export class HealthController {
  constructor(private readonly prisma: PrismaService) {}

  @Get()
  async getHealth() {
    const deployment = getActiveDeployment();
    let dbStatus = 'unknown';
    
    try {
      await this.prisma.$queryRaw`SELECT 1`;
      dbStatus = 'connected';
    } catch {
      dbStatus = 'disconnected';
    }

    return {
      status: 'ok',
      timestamp: new Date().toISOString(),
      environment: deployment.environment,
      database: dbStatus,
    };
  }

  @Get('environment')
  getEnvironment() {
    const deployment = getActiveDeployment();
    
    return {
      environment: deployment.environment,
      chainId: deployment.network.chainId,
      network: deployment.network.name,
      isTestnet: deployment.network.isTestnet,
      deploymentVersion: deployment.deploymentVersion,
      rpcUrl: deployment.network.rpcUrl.replace(/\/v2\/.*/, '/v2/***'),
      explorerUrl: deployment.network.explorerUrl,
    };
  }

  @Get('chains')
  getChains() {
    return {
      active: getActiveDeployment().network.chainId,
      supported: listChains(),
    };
  }

  @Get('chain/:chainId')
  getChain(@Param('chainId') chainIdStr: string) {
    const chainId = parseInt(chainIdStr, 10);
    
    if (!isSupportedChain(chainId)) {
      return {
        error: 'Unsupported chain',
        chainId,
        supported: listChains().map(c => c.chainId),
      };
    }
    
    const deployment = getDeployment(chainId);
    const isActive = chainId === getActiveDeployment().network.chainId;
    
    return {
      chainId,
      name: deployment.network.name,
      isTestnet: deployment.network.isTestnet,
      isActive,
      deploymentVersion: deployment.deploymentVersion,
      explorerUrl: deployment.network.explorerUrl,
    };
  }

  @Get('contracts')
  getContracts() {
    const deployment = getActiveDeployment();
    
    if (deployment.environment === 'production') {
      return {
        message: 'Contract addresses hidden in production',
        chainId: deployment.network.chainId,
      };
    }

    return {
      chainId: deployment.network.chainId,
      network: deployment.network.name,
      version: deployment.deploymentVersion,
      addresses: deployment.addresses,
    };
  }

  @Get('contracts/:chainId')
  getContractsByChain(@Param('chainId') chainIdStr: string) {
    const deployment = getActiveDeployment();
    
    if (deployment.environment === 'production') {
      return { message: 'Contract addresses hidden in production' };
    }

    const chainId = parseInt(chainIdStr, 10);
    
    if (!isSupportedChain(chainId)) {
      return { error: 'Unsupported chain', chainId };
    }
    
    const chainDeployment = getDeployment(chainId);
    
    return {
      chainId,
      network: chainDeployment.network.name,
      version: chainDeployment.deploymentVersion,
      addresses: chainDeployment.addresses,
    };
  }

  @Get('verify/:address')
  async verifyContract(@Param('address') address: string) {
    const deployment = getActiveDeployment();
    
    if (deployment.environment === 'production') {
      return { message: 'Contract verification disabled in production' };
    }

    const deployedOn = await detectContractChains(address);
    
    return {
      address,
      deployedOn: deployedOn.map(chainId => {
        const dep = getDeployment(chainId);
        return {
          chainId,
          network: dep.network.name,
        };
      }),
    };
  }
}
