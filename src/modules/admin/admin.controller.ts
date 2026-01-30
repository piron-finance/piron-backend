import { Controller, Post, Get, Delete, Body, Param, Query, Patch, Put } from '@nestjs/common';
import { AdminService } from './admin.service';
import {
  CreatePoolDto,
  ConfirmPoolDeploymentDto,
  UpdateLockTierDto,
  AddLockTierDto,
} from './dtos/create-pool.dto';
import {
  PausePoolDto,
  ApproveAssetDto,
  CloseEpochDto,
  CancelPoolDto,
  DistributeCouponDto,
} from './dtos/admin-operations.dto';
import { ProcessWithdrawalQueueDto, WithdrawalQueueQueryDto } from './dtos/withdrawal-queue.dto';
import { GetRolePoolsDto } from './dtos/role-management.dto';
import { CreateAssetDto, UpdateAssetDto, AssetQueryDto } from './dtos/asset-management.dto';
import {
  WithdrawTreasuryDto,
  CollectFeesDto,
  UpdateFeeConfigDto,
  EmergencyActionDto,
} from './dtos/treasury-fee.dto';
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

  /**
   * Get all paused pools
   * GET /api/v1/admin/pools/paused
   */
  @Get('pools/paused')
  async getPausedPools() {
    return this.adminService.getPausedPools();
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
  async getActivityLog(
    @Query('page') page?: string,
    @Query('limit') limit?: string,
    @Query('filter') filter?: string,
  ) {
    return this.adminService.getActivityLog(
      page ? parseInt(page, 10) : 1,
      limit ? parseInt(limit, 10) : 20,
      filter,
    );
  }

  // ========== SYSTEM ALERTS ==========

  /**
   * Get system alerts
   * GET /api/v1/admin/alerts
   */
  @Get('alerts')
  async getAlerts() {
    return this.adminService.getAlerts();
  }

  /**
   * Acknowledge an alert
   * POST /api/v1/admin/alerts/:alertId/acknowledge
   */
  @Post('alerts/:alertId/acknowledge')
  async acknowledgeAlert(@Param('alertId') alertId: string, @Body() body: { userId: string }) {
    return this.adminService.acknowledgeAlert(alertId, body.userId);
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
  async distributeCoupon(
    @Param('poolAddress') poolAddress: string,
    @Body() dto: DistributeCouponDto,
  ) {
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
   * Get all roles
   * GET /api/v1/admin/roles
   */
  @Get('roles')
  async getRoles() {
    return this.adminService.getRoles();
  }

  /**
   * Get role metrics
   * GET /api/v1/admin/roles/metrics
   */
  @Get('roles/metrics')
  async getRoleMetrics() {
    return this.adminService.getRoleMetrics();
  }

  /**
   * Grant role
   * POST /api/v1/admin/roles/grant
   */
  @Post('roles/grant')
  async grantRole(@Body() body: { address: string; role: string }) {
    return this.adminService.grantRole(body);
  }

  /**
   * Revoke role
   * POST /api/v1/admin/roles/revoke
   */
  @Post('roles/revoke')
  async revokeRole(@Body() body: { address: string; role: string }) {
    return this.adminService.revokeRole(body);
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

  /**
   * Get known addresses mapping
   * GET /api/v1/admin/addresses/known
   */
  @Get('addresses/known')
  async getKnownAddresses() {
    return this.adminService.getKnownAddresses();
  }

  // ========== STABLE YIELD SPECIFIC: SPV FUND MANAGEMENT ==========

  /**
   * Allocate funds from escrow to SPV for instrument purchases
   * POST /api/v1/admin/pools/:poolAddress/allocate-to-spv
   */
  @Post('pools/:poolAddress/allocate-to-spv')
  async allocateToSPV(
    @Param('poolAddress') poolAddress: string,
    @Body() body: { spvAddress: string; amount: string },
  ) {
    return this.adminService.allocateToSPV({
      poolAddress,
      spvAddress: body.spvAddress,
      amount: body.amount,
    });
  }

  /**
   * Rebalance pool reserves to maintain target ratio
   * POST /api/v1/admin/pools/:poolAddress/rebalance-reserves
   */
  @Post('pools/:poolAddress/rebalance-reserves')
  async rebalancePoolReserves(
    @Param('poolAddress') poolAddress: string,
    @Body() body: { action: 0 | 1; amount: string },
  ) {
    return this.adminService.rebalancePoolReserves({
      poolAddress,
      action: body.action,
      amount: body.amount,
    });
  }

  /**
   * GET /admin/pools/:poolAddress/detail
   * Get comprehensive pool detail for admin (main dashboard)
   */
  @Get('pools/:poolAddress/detail')
  async getAdminPoolDetail(@Param('poolAddress') poolAddress: string) {
    return this.adminService.getAdminPoolDetail(poolAddress);
  }

  /**
   * POST /admin/pools/:poolAddress/close
   * Soft close a pool (orderly wind-down)
   */
  @Post('pools/:poolAddress/close')
  async closePool(@Param('poolAddress') poolAddress: string) {
    return this.adminService.closePool(poolAddress);
  }

  // ========== LOCKED POOL MANAGEMENT ==========
  // NOTE: Static routes MUST come before parameterized routes in NestJS

  /**
   * Get positions ready for maturity
   * GET /api/v1/admin/locked-pools/positions/maturity-ready
   */
  @Get('locked-pools/positions/maturity-ready')
  async getMaturityReadyPositions(@Query('poolAddress') poolAddress?: string) {
    return this.adminService.getMaturityReadyPositions(poolAddress);
  }

  /**
   * Get positions with auto-rollover enabled
   * GET /api/v1/admin/locked-pools/positions/rollover-ready
   */
  @Get('locked-pools/positions/rollover-ready')
  async getRolloverReadyPositions(@Query('poolAddress') poolAddress?: string) {
    return this.adminService.getRolloverReadyPositions(poolAddress);
  }

  /**
   * Batch mature positions
   * POST /api/v1/admin/locked-pools/positions/batch-mature
   */
  @Post('locked-pools/positions/batch-mature')
  async batchMaturePositions(@Body() body: { positionIds: number[] }) {
    return this.adminService.batchMaturePositions(body);
  }

  /**
   * Batch execute rollovers
   * POST /api/v1/admin/locked-pools/positions/batch-rollover
   */
  @Post('locked-pools/positions/batch-rollover')
  async batchExecuteRollovers(@Body() body: { positionIds: number[] }) {
    return this.adminService.batchExecuteRollovers(body);
  }

  /**
   * Check if a position can be matured
   * GET /api/v1/admin/locked-pools/positions/:positionId/can-mature
   */
  @Get('locked-pools/positions/:positionId/can-mature')
  async canMaturePosition(@Param('positionId') positionId: string) {
    return this.adminService.canMaturePosition(parseInt(positionId));
  }

  /**
   * Get locked pool detail with tier statistics
   * GET /api/v1/admin/locked-pools/:poolAddress
   */
  @Get('locked-pools/:poolAddress')
  async getLockedPoolDetail(@Param('poolAddress') poolAddress: string) {
    return this.adminService.getLockedPoolDetail(poolAddress);
  }

  /**
   * Update a lock tier configuration
   * PATCH /api/v1/admin/locked-pools/:poolAddress/tiers/:tierIndex
   */
  @Patch('locked-pools/:poolAddress/tiers/:tierIndex')
  async updateLockTier(
    @Param('poolAddress') poolAddress: string,
    @Param('tierIndex') tierIndex: string,
    @Body() dto: UpdateLockTierDto,
  ) {
    return this.adminService.updateLockTier(poolAddress, parseInt(tierIndex, 10), dto);
  }

  /**
   * Add a new lock tier to an existing locked pool
   * POST /api/v1/admin/locked-pools/:poolAddress/tiers
   */
  @Post('locked-pools/:poolAddress/tiers')
  async addLockTier(@Param('poolAddress') poolAddress: string, @Body() dto: AddLockTierDto) {
    return this.adminService.addLockTier(poolAddress, dto);
  }

  /**
   * Get all positions for a locked pool
   * GET /api/v1/admin/locked-pools/:poolAddress/positions
   */
  @Get('locked-pools/:poolAddress/positions')
  async getLockedPoolPositions(@Param('poolAddress') poolAddress: string) {
    return this.adminService.getLockedPoolPositions(poolAddress);
  }

  /**
   * Set tier active status
   * PUT /api/v1/admin/locked-pools/:poolAddress/tiers/:tierIndex/active
   */
  @Put('locked-pools/:poolAddress/tiers/:tierIndex/active')
  async setTierActive(
    @Param('poolAddress') poolAddress: string,
    @Param('tierIndex') tierIndex: string,
    @Body() body: { isActive: boolean },
  ) {
    return this.adminService.setTierActive({
      poolAddress,
      tierIndex: parseInt(tierIndex),
      ...body,
    });
  }

  /**
   * Update tier APY
   * PUT /api/v1/admin/locked-pools/:poolAddress/tiers/:tierIndex/apy
   */
  @Put('locked-pools/:poolAddress/tiers/:tierIndex/apy')
  async updateTierAPY(
    @Param('poolAddress') poolAddress: string,
    @Param('tierIndex') tierIndex: string,
    @Body() body: { newApyBps: number },
  ) {
    return this.adminService.updateTierAPY({
      poolAddress,
      tierIndex: parseInt(tierIndex),
      ...body,
    });
  }

  /**
   * Activate Locked pool
   * POST /api/v1/admin/locked-pools/:poolAddress/activate
   */
  @Post('locked-pools/:poolAddress/activate')
  async activateLockedPool(@Param('poolAddress') poolAddress: string) {
    return this.adminService.activateLockedPool(poolAddress);
  }

  /**
   * Deactivate Locked pool
   * POST /api/v1/admin/locked-pools/:poolAddress/deactivate
   */
  @Post('locked-pools/:poolAddress/deactivate')
  async deactivateLockedPool(@Param('poolAddress') poolAddress: string) {
    return this.adminService.deactivateLockedPool(poolAddress);
  }

  // ========== SPV ALLOCATION MANAGEMENT ==========

  /**
   * Get all SPV allocations across pools
   * GET /api/v1/admin/spv/allocations
   */
  @Get('spv/allocations')
  async getAllSPVAllocations() {
    return this.adminService.getAllSPVAllocations();
  }

  /**
   * Create a new SPV allocation (returns transaction payload)
   * POST /api/v1/admin/spv/allocations
   */
  @Post('spv/allocations')
  async createSPVAllocation(
    @Body() body: { poolAddress: string; spvAddress: string; amount: string },
  ) {
    return this.adminService.createSPVAllocation(body);
  }

  // ========== SINGLE ASSET POOL MANAGEMENT ==========

  /**
   * Extend pool maturity date
   * POST /api/v1/admin/pools/:poolAddress/extend-maturity
   */
  @Post('pools/:poolAddress/extend-maturity')
  async extendMaturity(
    @Param('poolAddress') poolAddress: string,
    @Body() body: { newMaturityDate: string },
  ) {
    return this.adminService.extendMaturity({ poolAddress, ...body });
  }

  /**
   * Get coupon data for a pool
   * GET /api/v1/admin/pools/:poolAddress/coupons
   */
  @Get('pools/:poolAddress/coupons')
  async getPoolCouponData(@Param('poolAddress') poolAddress: string) {
    return this.adminService.getPoolCouponData(poolAddress);
  }

  // ========== STABLE YIELD POOL MANAGEMENT ==========

  /**
   * Cancel a pending allocation
   * POST /api/v1/admin/allocations/:allocationId/cancel
   */
  @Post('allocations/:allocationId/cancel')
  async cancelAllocation(@Param('allocationId') allocationId: string) {
    return this.adminService.cancelAllocation({ allocationId });
  }

  /**
   * Set pool transaction fee
   * PUT /api/v1/admin/stable-yield/:poolAddress/fee
   */
  @Put('stable-yield/:poolAddress/fee')
  async setPoolTransactionFee(
    @Param('poolAddress') poolAddress: string,
    @Body() body: { feeBps: number },
  ) {
    return this.adminService.setPoolTransactionFee({ poolAddress, ...body });
  }

  /**
   * Set pool reserve configuration
   * PUT /api/v1/admin/stable-yield/:poolAddress/reserve-config
   */
  @Put('stable-yield/:poolAddress/reserve-config')
  async setPoolReserveConfig(
    @Param('poolAddress') poolAddress: string,
    @Body() body: { minAbsoluteReserve: string; reserveRatioBps: number },
  ) {
    return this.adminService.setPoolReserveConfig({ poolAddress, ...body });
  }

  /**
   * Trigger NAV update
   * POST /api/v1/admin/stable-yield/:poolAddress/trigger-nav-update
   */
  @Post('stable-yield/:poolAddress/trigger-nav-update')
  async triggerNAVUpdate(
    @Param('poolAddress') poolAddress: string,
    @Body() body: { reason: string },
  ) {
    return this.adminService.triggerNAVUpdate({ poolAddress, ...body });
  }

  /**
   * Deactivate Stable Yield pool
   * POST /api/v1/admin/stable-yield/:poolAddress/deactivate
   */
  @Post('stable-yield/:poolAddress/deactivate')
  async deactivateStableYieldPool(@Param('poolAddress') poolAddress: string) {
    return this.adminService.deactivateStableYieldPool(poolAddress);
  }
}
