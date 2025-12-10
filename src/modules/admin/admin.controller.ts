import { Controller, Post, Get, Delete, Body, Param, Query, Patch } from '@nestjs/common';
import { AdminService } from './admin.service';
import { CreatePoolDto, ConfirmPoolDeploymentDto } from './dtos/create-pool.dto';
import { PausePoolDto, ApproveAssetDto, CloseEpochDto, CancelPoolDto, DistributeCouponDto } from './dtos/admin-operations.dto';
import { ProcessWithdrawalQueueDto, WithdrawalQueueQueryDto } from './dtos/withdrawal-queue.dto';
import { GetRolePoolsDto } from './dtos/role-management.dto';
import { CreateAssetDto, UpdateAssetDto, AssetQueryDto } from './dtos/asset-management.dto';
import { WithdrawTreasuryDto, CollectFeesDto, UpdateFeeConfigDto, EmergencyActionDto } from './dtos/treasury-fee.dto';
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

  /**
   * Close epoch for a pool
   * POST /api/v1/admin/pools/:poolAddress/close-epoch
   */
  @Post('pools/:poolAddress/close-epoch')
  async closeEpoch(@Param('poolAddress') poolAddress: string, @Body() dto?: any) {
    return this.adminService.closeEpoch({ poolAddress, ...dto });
  }

  /**
   * Cancel a pool
   * POST /api/v1/admin/pools/:poolAddress/cancel
   */
  @Post('pools/:poolAddress/cancel')
  async cancelPool(@Param('poolAddress') poolAddress: string, @Body() dto: CancelPoolDto) {
    return this.adminService.cancelPool({ ...dto, poolAddress });
  }

  /**
   * Distribute coupon payment
   * POST /api/v1/admin/pools/:poolAddress/distribute-coupons
   */
  @Post('pools/:poolAddress/distribute-coupons')
  async distributeCoupon(@Param('poolAddress') poolAddress: string, @Body() dto: DistributeCouponDto) {
    return this.adminService.distributeCoupon({ ...dto, poolAddress });
  }

  // ========== WITHDRAWAL QUEUES ==========

  /**
   * Get withdrawal queues
   * GET /api/v1/admin/withdrawal-queues?poolId={}&status={}
   */
  @Get('withdrawal-queues')
  async getWithdrawalQueues(@Query() query: WithdrawalQueueQueryDto) {
    return this.adminService.getWithdrawalQueues(query);
  }

  /**
   * Process withdrawal queue for a pool
   * POST /api/v1/admin/withdrawal-queues/:poolAddress/process
   */
  @Post('withdrawal-queues/:poolAddress/process')
  async processWithdrawalQueue(
    @Param('poolAddress') poolAddress: string,
    @Body() dto: ProcessWithdrawalQueueDto,
  ) {
    return this.adminService.processWithdrawalQueue({ ...dto, poolAddress });
  }

  // ========== ROLE MANAGEMENT ==========

  /**
   * Get role metrics
   * GET /api/v1/admin/roles/metrics
   */
  @Get('roles/metrics')
  async getRoleMetrics() {
    return this.adminService.getRoleMetrics();
  }

  /**
   * Get pools for a specific role
   * GET /api/v1/admin/roles/:roleName/pools?status={}&needsAction={}
   */
  @Get('roles/:roleName/pools')
  async getRolePools(@Param('roleName') roleName: string, @Query() query: any) {
    return this.adminService.getRolePools({ roleName, ...query });
  }

  // ========== ASSET MANAGEMENT ==========

  /**
   * Get all assets
   * GET /api/v1/admin/assets?status={}&region={}
   */
  @Get('assets')
  async getAssets(@Query() query: AssetQueryDto) {
    return this.adminService.getAssets(query);
  }

  /**
   * Create new asset
   * POST /api/v1/admin/assets
   */
  @Post('assets')
  async createAsset(@Body() dto: CreateAssetDto) {
    return this.adminService.createAsset(dto);
  }

  /**
   * Update asset metadata
   * PUT /api/v1/admin/assets/:assetId
   */
  @Patch('assets/:assetId')
  async updateAsset(@Param('assetId') assetId: string, @Body() dto: UpdateAssetDto) {
    return this.adminService.updateAsset(assetId, dto);
  }

  /**
   * Revoke/Delete asset
   * DELETE /api/v1/admin/assets/:assetId
   */
  @Delete('assets/:assetId')
  async deleteAsset(@Param('assetId') assetId: string) {
    return this.adminService.deleteAsset(assetId);
  }

  // ========== TREASURY MANAGEMENT ==========

  /**
   * Get treasury overview
   * GET /api/v1/admin/treasury
   */
  @Get('treasury')
  async getTreasuryOverview() {
    return this.adminService.getTreasuryOverview();
  }

  /**
   * Withdraw from treasury
   * POST /api/v1/admin/treasury/withdraw
   */
  @Post('treasury/withdraw')
  async withdrawTreasury(@Body() dto: WithdrawTreasuryDto) {
    return this.adminService.withdrawTreasury(dto);
  }

  // ========== FEE MANAGEMENT ==========

  /**
   * Get fee configuration and stats
   * GET /api/v1/admin/fees
   */
  @Get('fees')
  async getFees() {
    return this.adminService.getFees();
  }

  /**
   * Collect fees from a pool
   * POST /api/v1/admin/fees/collect
   */
  @Post('fees/collect')
  async collectFees(@Body() dto: CollectFeesDto) {
    return this.adminService.collectFees(dto);
  }

  /**
   * Update fee configuration
   * PUT /api/v1/admin/fees/config
   */
  @Patch('fees/config')
  async updateFeeConfig(@Body() dto: UpdateFeeConfigDto) {
    return this.adminService.updateFeeConfig(dto);
  }

  // ========== EMERGENCY OPERATIONS ==========

  /**
   * Pause protocol
   * POST /api/v1/admin/emergency/pause-protocol
   */
  @Post('emergency/pause-protocol')
  async pauseProtocol(@Body() dto: { reason: string }) {
    return this.adminService.executeEmergencyAction({
      action: 'PAUSE',
      reason: dto.reason,
    });
  }

  /**
   * Unpause protocol
   * POST /api/v1/admin/emergency/unpause-protocol
   */
  @Post('emergency/unpause-protocol')
  async unpauseProtocol(@Body() dto: { reason: string }) {
    return this.adminService.executeEmergencyAction({
      action: 'UNPAUSE',
      reason: dto.reason,
    });
  }

  /**
   * Force close epoch
   * POST /api/v1/admin/emergency/force-close-epoch
   */
  @Post('emergency/force-close-epoch')
  async forceCloseEpoch(@Body() dto: { poolAddress: string; reason: string }) {
    return this.adminService.executeEmergencyAction({
      action: 'FORCE_CLOSE_EPOCH',
      poolAddress: dto.poolAddress,
      reason: dto.reason,
    });
  }

  // ========== SYSTEM STATUS ==========

  /**
   * Get system status
   * GET /api/v1/admin/system/status
   */
  @Get('system/status')
  async getSystemStatus() {
    return this.adminService.getSystemStatus();
  }
}
