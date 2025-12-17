import { Controller, Post, Get, Body, Param, Query, Patch } from '@nestjs/common';
import { SpvService } from './spv.service';
import { AllocateToSPVDto, AddInstrumentDto, MatureInstrumentDto } from './dtos/spv-operations.dto';
import { WithdrawFundsDto, ConfirmInvestmentDto } from './dtos/spv-investment.dto';
import { RecordCouponDto, CouponScheduleQueryDto } from './dtos/spv-coupon.dto';
import { BatchMatureDto } from './dtos/spv-batch.dto';
import { TriggerNAVUpdateDto } from './dtos/spv-nav.dto';
import { InstrumentsQueryDto } from './dtos/spv-instruments.dto';

@Controller('spv')
export class SpvController {
  constructor(private readonly spvService: SpvService) {}

  // ❌ REMOVED: allocateToSPV moved to admin controller
  // Use: POST /admin/pools/:poolAddress/allocate-to-spv

  @Post('pools/:poolAddress/instruments/add')
  async addInstrument(@Body() dto: AddInstrumentDto) {
    return this.spvService.addInstrument(dto);
  }

  @Post('pools/:poolAddress/instruments/:instrumentId/mature')
  async matureInstrument(
    @Param('poolAddress') poolAddress: string,
    @Param('instrumentId') instrumentId: string,
  ) {
    return this.spvService.matureInstrument({ poolAddress, instrumentId });
  }

  @Get('pools/:poolAddress/instruments')
  async getPoolInstruments(@Param('poolAddress') poolAddress: string) {
    return this.spvService.getPoolInstruments(poolAddress);
  }

  @Get('operations')
  async getOperations(
    @Query('page') page?: string,
    @Query('limit') limit?: string,
    @Query('status') status?: string,
  ) {
    return this.spvService.getOperations(
      page ? parseInt(page, 10) : 1,
      limit ? parseInt(limit, 10) : 20,
      status,
    );
  }

  @Get('analytics/overview')
  async getAnalyticsOverview() {
    return this.spvService.getAnalyticsOverview();
  }

  @Get('analytics/maturities')
  async getMaturities(@Query('days') days?: string) {
    return this.spvService.getMaturities(days ? parseInt(days, 10) : 90);
  }

  @Get('pools')
  async getPools(@Query('includeInactive') includeInactive?: string) {
    return this.spvService.getPools(includeInactive === 'true');
  }

  @Get('pools/:poolAddress')
  async getPoolById(@Param('poolAddress') poolAddress: string) {
    return this.spvService.getPoolById(poolAddress);
  }

  // ========== PHASE 1: INVESTMENT FLOW ==========

  /**
   * Get pools pending SPV investment
   * GET /spv/investments/pending
   */
  @Get('investments/pending')
  async getPendingInvestments() {
    return this.spvService.getPendingInvestments();
  }

  /**
   * Withdraw funds from escrow for investment
   * POST /spv/pools/:poolAddress/withdraw-funds
   */
  @Post('pools/:poolAddress/withdraw-funds')
  async withdrawFunds(@Param('poolAddress') poolAddress: string, @Body() dto: WithdrawFundsDto) {
    return this.spvService.withdrawFunds({ ...dto, poolAddress });
  }

  /**
   * Confirm off-chain investment completed
   * POST /spv/investments/confirm
   */
  @Post('investments/confirm')
  async confirmInvestment(@Body() dto: ConfirmInvestmentDto) {
    return this.spvService.confirmInvestment(dto);
  }

  // ========== PHASE 2: INSTRUMENT & COUPON MANAGEMENT ==========

  /**
   * Get enhanced instruments portfolio with filters
   * GET /spv/instruments?status={}&poolId={}&type={}&maturityRange={}&sortBy={}
   */
  @Get('instruments')
  async getInstruments(@Query() query: InstrumentsQueryDto) {
    return this.spvService.getInstruments(query);
  }

  /**
   * Batch mature instruments
   * POST /spv/instruments/batch-mature
   */
  @Post('instruments/batch-mature')
  async batchMatureInstruments(@Body() dto: BatchMatureDto) {
    return this.spvService.batchMatureInstruments(dto);
  }

  /**
   * Record coupon payment received
   * POST /spv/instruments/:instrumentId/record-coupon
   */
  @Post('instruments/:instrumentId/record-coupon')
  async recordCoupon(@Param('instrumentId') instrumentId: string, @Body() dto: RecordCouponDto) {
    // TODO: Get SPV user ID from auth context
    const spvUserId = 'spv-user-id';
    return this.spvService.recordCoupon(instrumentId, dto, spvUserId);
  }

  /**
   * Get coupon payment schedule
   * GET /spv/coupons/schedule?poolId={}&range={}&status={}
   */
  @Get('coupons/schedule')
  async getCouponSchedule(@Query() query: CouponScheduleQueryDto) {
    return this.spvService.getCouponSchedule(query);
  }

  // ========== PHASE 3: NAV & LIQUIDITY ==========

  /**
   * Trigger manual NAV update
   * POST /spv/pools/:poolAddress/trigger-nav-update
   */
  @Post('pools/:poolAddress/trigger-nav-update')
  async triggerNAVUpdate(
    @Param('poolAddress') poolAddress: string,
    @Body() dto: TriggerNAVUpdateDto,
  ) {
    // TODO: Get SPV user ID from auth context
    const spvUserId = 'spv-user-id';
    return this.spvService.triggerNAVUpdate(poolAddress, dto, spvUserId);
  }

  /**
   * Get liquidity status for a pool
   * GET /spv/pools/:poolAddress/liquidity-status
   */
  @Get('pools/:poolAddress/liquidity-status')
  async getLiquidityStatus(@Param('poolAddress') poolAddress: string) {
    return this.spvService.getLiquidityStatus(poolAddress);
  }

  // ========== PHASE 4: ENHANCED ANALYTICS ==========

  /**
   * Get comprehensive SPV analytics (replaces basic overview)
   * GET /spv/analytics/enhanced
   */
  @Get('analytics/enhanced')
  async getEnhancedAnalytics() {
    return this.spvService.getEnhancedAnalytics();
  }

  // ========== PHASE 5: FEE COLLECTION ==========

  /**
   * Get collectible fees
   * GET /spv/fees/collectible
   */
  @Get('fees/collectible')
  async getCollectibleFees() {
    return this.spvService.getCollectibleFees();
  }

  /**
   * Collect fees from a pool
   * POST /spv/fees/collect
   */
  @Post('fees/collect')
  async collectFees(@Body() body: { poolAddress: string; feeType: string }) {
    return this.spvService.collectFees(body.poolAddress, body.feeType);
  }

  /**
   * SPV returns matured instrument proceeds to pool
   * POST /spv/pools/:poolAddress/receive-maturity
   */
  @Post('pools/:poolAddress/receive-maturity')
  async receiveSPVMaturity(
    @Param('poolAddress') poolAddress: string,
    @Body() dto: { amount: string },
  ) {
    // TODO: Get SPV user ID from auth context
    const spvUserId = 'spv-user-id';
    return this.spvService.receiveSPVMaturity(poolAddress, dto.amount, spvUserId);
  }

  /**
   * POST /spv/preferences/investment-threshold
   * Set investment threshold for SPV
   */
  @Post('preferences/investment-threshold')
  async setInvestmentThreshold(@Body() dto: any, @Query('spvAddress') spvAddress: string) {
    return this.spvService.setInvestmentThreshold(dto, spvAddress);
  }

  /**
   * GET /spv/alerts
   * Get investment alerts for SPV
   */
  @Get('alerts')
  async getInvestmentAlerts(@Query() query: any, @Query('spvAddress') spvAddress: string) {
    return this.spvService.getInvestmentAlerts(query, spvAddress);
  }

  /**
   * GET /spv/preferences
   * Get all SPV preferences
   */
  @Get('preferences')
  async getPreferences(@Query('spvAddress') spvAddress: string) {
    return this.spvService.getPreferences(spvAddress);
  }

  /**
   * GET /spv/pools/:poolAddress/detail
   * Get comprehensive pool detail for SPV (main dashboard)
   */
  @Get('pools/:poolAddress/detail')
  async getSPVPoolDetail(
    @Param('poolAddress') poolAddress: string,
    @Query('spvAddress') spvAddress: string,
  ) {
    return this.spvService.getSPVPoolDetail(poolAddress, spvAddress);
  }
}
