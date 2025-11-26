import { Controller, Post, Get, Delete, Body, Param, Query, Patch } from '@nestjs/common';
import { AdminService } from './admin.service';
import { CreatePoolDto, ConfirmPoolDeploymentDto } from './dtos/create-pool.dto';
import { PausePoolDto, ApproveAssetDto } from './dtos/admin-operations.dto';
import { UpdatePoolMetadataDto } from './dtos/update-pool-metadata.dto';

@Controller('admin')
export class AdminController {
  constructor(private readonly adminService: AdminService) {}

  /**
   * Create a new pool
   * POST /api/v1/admin/pools/create
   */
  @Post('pools/create')
  async createPool(@Body() dto: CreatePoolDto) {
    return this.adminService.createPool(dto);
  }

  /**
   * Manually confirm pool deployment (optional - watcher auto-detects)
   * POST /api/v1/admin/pools/confirm-deployment
   */
  @Post('pools/confirm-deployment')
  async confirmDeployment(@Body() dto: ConfirmPoolDeploymentDto) {
    return this.adminService.confirmPoolDeployment(dto);
  }

  /**
   * Get all pools (admin view with grouping)
   * GET /api/v1/admin/pools
   */
  @Get('pools')
  async getAllPools(@Query('includeInactive') includeInactive?: string) {
    return this.adminService.getAllPools(includeInactive === 'true');
  }

  /**
   * Get pool details by ID
   * GET /api/v1/admin/pools/:id
   */
  @Get('pools/:id')
  async getPoolById(@Param('id') id: string) {
    return this.adminService.getPoolById(id);
  }

  /**
   * Update pool metadata
   * PATCH /api/v1/admin/pools/:id
   */
  @Patch('pools/:id')
  async updatePoolMetadata(@Param('id') id: string, @Body() dto: UpdatePoolMetadataDto) {
    return this.adminService.updatePoolMetadata(id, dto);
  }

  /**
   * Cancel a pending pool deployment
   * DELETE /api/v1/admin/pools/:id
   */
  @Delete('pools/:id')
  async cancelPoolDeployment(@Param('id') id: string) {
    return this.adminService.cancelPoolDeployment(id);
  }

  @Post('pools/pause')
  async pausePool(@Body() dto: PausePoolDto) {
    return this.adminService.pausePool(dto);
  }

  @Post('pools/:poolAddress/unpause')
  async unpausePool(@Param('poolAddress') poolAddress: string) {
    return this.adminService.unpausePool(poolAddress);
  }

  @Post('assets/approve')
  async approveAsset(@Body() dto: ApproveAssetDto) {
    return this.adminService.approveAsset(dto);
  }

  @Get('analytics/overview')
  async getAnalyticsOverview() {
    return this.adminService.getAnalyticsOverview();
  }

  @Get('activity')
  async getActivityLog(@Query('page') page?: string, @Query('limit') limit?: string) {
    return this.adminService.getActivityLog(
      page ? parseInt(page, 10) : 1,
      limit ? parseInt(limit, 10) : 20,
    );
  }
}
