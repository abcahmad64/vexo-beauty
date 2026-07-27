import {
  Body,
  Controller,
  Delete,
  ForbiddenException,
  Get,
  Param,
  Patch,
  Post,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiParam,
  ApiTags,
} from '@nestjs/swagger';
import { Request } from 'express';

import { RateLimit } from '../../core/rate-limit/decorators/rate-limit.decorator';

import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';

import { ResolveAiShadowModelRoutingDto } from '../ai/dto/admin-ai-shadow-model-routing.dto';
import {
  CleanupAiShadowRoutingDecisionsDto,
  QueryAiShadowRoutingDecisionsDto,
} from '../ai/dto/admin-ai-shadow-routing-observability.dto';
import {
  AdminCreateAiModelRolloutDto,
  AdminUpdateAiModelRolloutDto,
  QueryAiModelRolloutReportDto,
  QueryAiModelRolloutsDto,
  ResolveAiModelRolloutCohortDto,
} from '../ai/dto/admin-ai-model-rollout.dto';
import {
  AdminAppendAiIncidentEventDto,
  AdminOpenAiIncidentDto,
  QueryAiIncidentTimelinesDto,
} from '../ai/dto/admin-ai-incident-timeline.dto';
import {
  AdminCreateAiBudgetPolicyDto,
  AdminUpdateAiBudgetPolicyDto,
  QueryAiBudgetPoliciesDto,
} from '../ai/dto/admin-ai-budget-policy.dto';
import { QueryAiBudgetUsageDto } from '../ai/dto/query-ai-budget-usage.dto';
import {
  AdminCreateAiAlertRunbookDto,
  AdminUpdateAiAlertRunbookDto,
  QueryAiAlertRunbooksDto,
  ResolveAiAlertRunbooksDto,
} from '../ai/dto/admin-ai-alert-runbook.dto';
import {
  AdminCreateAiSloPolicyDto,
  AdminUpdateAiSloPolicyDto,
  QueryAiSloPoliciesDto,
  QueryAiSloReportDto,
} from '../ai/dto/admin-ai-slo-policy.dto';
import { AiAlertRunbookResolverService } from '../ai/services/ai-alert-runbook-resolver.service';
import { AiAlertRunbookService } from '../ai/services/ai-alert-runbook.service';
import { AiBudgetEnforcementService } from '../ai/services/ai-budget-enforcement.service';
import { AiIncidentTimelineService } from '../ai/services/ai-incident-timeline.service';
import { AiModelRolloutCanaryService } from '../ai/services/ai-model-rollout-canary.service';
import { AiModelRolloutReportService } from '../ai/services/ai-model-rollout-report.service';
import { AiShadowModelRoutingService } from '../ai/services/ai-shadow-model-routing.service';
import { AiShadowRoutingObservabilityService } from '../ai/services/ai-shadow-routing-observability.service';
import { AiBudgetPolicyService } from '../ai/services/ai-budget-policy.service';

import { AiProviderCostReportService } from '../ai/services/ai-provider-cost-report.service';
import { AiSloErrorBudgetService } from '../ai/services/ai-slo-error-budget.service';
import { AiSloPolicyService } from '../ai/services/ai-slo-policy.service';

import { AdminActivityQueryDto } from './dto/admin-activity-query.dto';
import { AdminDashboardQueryDto } from './dto/admin-dashboard-query.dto';
import { CancelAiQueueJobDto } from './dto/cancel-ai-queue-job.dto';
import {
  EnqueueTestAnalyticsJobDto,
  EnqueueTestNotificationJobDto,
} from './dto/enqueue-queue-test.dto';
import { QueryQueueJobsDto } from './dto/query-queue-jobs.dto';
import { QueryAiProviderCostReportDto } from './dto/query-ai-provider-cost-report.dto';
import { AdminQueueService } from './services/admin-queue.service';
import { AdminSchedulerService } from './services/admin-scheduler.service';
import { AdminService } from './services/admin.service';

type RequestUser = {
  id?: string;
  userId?: string;
  sub?: string;
  role?:
    | string
    | {
        name?: string | null;
      };
  roleName?: string | null;
  permissions?: string[];
};

type AuthenticatedRequest = Request & {
  user?: RequestUser;
};

@ApiTags('Admin')
@ApiBearerAuth('access-token')
@RateLimit('admin')
@Controller('admin')
@UseGuards(JwtAuthGuard)
export class AdminController {
  constructor(
    private readonly adminService: AdminService,
    private readonly adminQueueService: AdminQueueService,
    private readonly adminSchedulerService: AdminSchedulerService,
    private readonly aiAlertRunbookService: AiAlertRunbookService,
    private readonly aiAlertRunbookResolver: AiAlertRunbookResolverService,
    private readonly aiBudgetPolicyService: AiBudgetPolicyService,
    private readonly aiIncidentTimelineService: AiIncidentTimelineService,
    private readonly aiModelRolloutCanaryService: AiModelRolloutCanaryService,
    private readonly aiModelRolloutReportService: AiModelRolloutReportService,
    private readonly aiShadowModelRoutingService: AiShadowModelRoutingService,
    private readonly aiShadowRoutingObservabilityService: AiShadowRoutingObservabilityService,
    private readonly aiBudgetEnforcementService: AiBudgetEnforcementService,
    private readonly aiProviderCostReport: AiProviderCostReportService,
    private readonly aiSloPolicyService: AiSloPolicyService,
    private readonly aiSloErrorBudgetService: AiSloErrorBudgetService,
  ) {}

  @Get('dashboard')
  getDashboard(
    @Req() req: AuthenticatedRequest,
    @Query() query: AdminDashboardQueryDto,
  ) {
    this.assertAdminReader(req);

    return this.adminService.getDashboard(query, this.getUserId(req));
  }

  @Get('overview')
  getOverview(
    @Req() req: AuthenticatedRequest,
    @Query() query: AdminDashboardQueryDto,
  ) {
    this.assertAdminReader(req);

    return this.adminService.getOverview(query, this.getUserId(req));
  }

  @Get('health')
  getHealth(@Req() req: AuthenticatedRequest) {
    this.assertAdminReader(req);

    return this.adminService.getHealth(this.getUserId(req));
  }

  @Get('activity')
  getActivity(
    @Req() req: AuthenticatedRequest,
    @Query() query: AdminActivityQueryDto,
  ) {
    this.assertAdminReader(req);

    return this.adminService.getActivity(query, this.getUserId(req));
  }

  @Get('recent-orders')
  getRecentOrders(
    @Req() req: AuthenticatedRequest,
    @Query() query: AdminDashboardQueryDto,
  ) {
    this.assertAdminReader(req);

    return this.adminService.getRecentOrders(query);
  }

  @Get('recent-payments')
  getRecentPayments(
    @Req() req: AuthenticatedRequest,
    @Query() query: AdminDashboardQueryDto,
  ) {
    this.assertAdminReader(req);

    return this.adminService.getRecentPayments(query);
  }

  @Get('recent-users')
  getRecentUsers(@Req() req: AuthenticatedRequest) {
    this.assertAdminReader(req);

    return this.adminService.getRecentUsers();
  }

  @Get('recent-notifications')
  getRecentNotifications(@Req() req: AuthenticatedRequest) {
    this.assertAdminReader(req);

    return this.adminService.getRecentNotifications();
  }

  @Get('ai/routing/shadow/snapshot')
  getAiShadowRoutingSnapshot(@Req() req: AuthenticatedRequest) {
    this.assertAdminAiRoutingReader(req);
    return this.aiShadowModelRoutingService.getSnapshot();
  }

  @Post('ai/routing/shadow/resolve')
  resolveAiShadowRouting(
    @Req() req: AuthenticatedRequest,
    @Body() dto: ResolveAiShadowModelRoutingDto,
  ) {
    this.assertAdminAiRoutingReader(req);
    return this.aiShadowModelRoutingService.resolve(dto);
  }

  @Get('ai/routing/shadow/decisions')
  listAiShadowRoutingDecisions(
    @Req() req: AuthenticatedRequest,
    @Query() query: QueryAiShadowRoutingDecisionsDto,
  ) {
    this.assertAdminAiRoutingReader(req);
    return this.aiShadowRoutingObservabilityService.list(query);
  }

  @Get('ai/routing/shadow/decisions/summary')
  getAiShadowRoutingDecisionSummary(
    @Req() req: AuthenticatedRequest,
    @Query() query: QueryAiShadowRoutingDecisionsDto,
  ) {
    this.assertAdminAiRoutingReader(req);
    return this.aiShadowRoutingObservabilityService.getSummary(query);
  }

  @Get('ai/routing/shadow/decisions/:decisionId')
  getAiShadowRoutingDecision(
    @Req() req: AuthenticatedRequest,
    @Param('decisionId') decisionId: string,
  ) {
    this.assertAdminAiRoutingReader(req);
    return this.aiShadowRoutingObservabilityService.getDetail(decisionId);
  }

  @Post('ai/routing/shadow/decisions/cleanup')
  cleanupAiShadowRoutingDecisions(
    @Req() req: AuthenticatedRequest,
    @Body() dto: CleanupAiShadowRoutingDecisionsDto,
  ) {
    this.assertAdminAiRoutingManager(req);
    return this.aiShadowRoutingObservabilityService.cleanupExpired(
      dto.retentionDays,
    );
  }

  @Get('ai/rollouts')
  getAiModelRollouts(
    @Req() req: AuthenticatedRequest,
    @Query() query: QueryAiModelRolloutsDto,
  ) {
    this.assertAdminAiRolloutReader(req);
    return this.aiModelRolloutCanaryService.findRollouts(query);
  }

  @Get('ai/rollouts/:rolloutId/report')
  getAiModelRolloutReport(
    @Req() req: AuthenticatedRequest,
    @Param('rolloutId') rolloutId: string,
    @Query() query: QueryAiModelRolloutReportDto,
  ) {
    this.assertAdminAiRolloutReader(req);
    return this.aiModelRolloutReportService.getReport(rolloutId, query);
  }

  @Get('ai/rollouts/:rolloutId/cohort')
  resolveAiModelRolloutCohort(
    @Req() req: AuthenticatedRequest,
    @Param('rolloutId') rolloutId: string,
    @Query() query: ResolveAiModelRolloutCohortDto,
  ) {
    this.assertAdminAiRolloutReader(req);
    return this.aiModelRolloutCanaryService
      .findRollout(rolloutId)
      .then((rollout) =>
        this.aiModelRolloutCanaryService.resolveCohort(
          rollout,
          query.subjectKey,
        ),
      );
  }

  @Post('ai/rollouts')
  createAiModelRollout(
    @Req() req: AuthenticatedRequest,
    @Body() dto: AdminCreateAiModelRolloutDto,
  ) {
    this.assertAdminAiRolloutManager(req);
    return this.aiModelRolloutCanaryService.createRollout(
      dto,
      this.getUserId(req),
    );
  }

  @Patch('ai/rollouts/:rolloutId')
  updateAiModelRollout(
    @Req() req: AuthenticatedRequest,
    @Param('rolloutId') rolloutId: string,
    @Body() dto: AdminUpdateAiModelRolloutDto,
  ) {
    this.assertAdminAiRolloutManager(req);
    return this.aiModelRolloutCanaryService.updateRollout(
      rolloutId,
      dto,
      this.getUserId(req),
    );
  }

  @Delete('ai/rollouts/:rolloutId')
  deleteAiModelRollout(
    @Req() req: AuthenticatedRequest,
    @Param('rolloutId') rolloutId: string,
  ) {
    this.assertAdminAiRolloutManager(req);
    return this.aiModelRolloutCanaryService.deleteRollout(
      rolloutId,
      this.getUserId(req),
    );
  }

  @Get('ai/incidents')
  @ApiOperation({ summary: 'فهرست Incidentهای append-only هوش مصنوعی' })
  getAiIncidents(
    @Req() req: AuthenticatedRequest,
    @Query() query: QueryAiIncidentTimelinesDto,
  ) {
    this.assertAdminAiIncidentReader(req);
    return this.aiIncidentTimelineService.listIncidents(query);
  }

  @Get('ai/incidents/:incidentId')
  @ApiOperation({ summary: 'دریافت Timeline کامل Incident هوش مصنوعی' })
  @ApiParam({ name: 'incidentId', description: 'شناسه Incident' })
  getAiIncident(
    @Req() req: AuthenticatedRequest,
    @Param('incidentId') incidentId: string,
  ) {
    this.assertAdminAiIncidentReader(req);
    return this.aiIncidentTimelineService.getIncident(incidentId);
  }

  @Post('ai/incidents')
  @ApiOperation({ summary: 'ایجاد Incident هوش مصنوعی با رخداد OPENED' })
  openAiIncident(
    @Req() req: AuthenticatedRequest,
    @Body() dto: AdminOpenAiIncidentDto,
  ) {
    this.assertAdminAiIncidentManager(req);
    return this.aiIncidentTimelineService.openIncident(
      dto,
      this.getUserId(req),
    );
  }

  @Post('ai/incidents/:incidentId/events')
  @ApiOperation({ summary: 'افزودن رخداد append-only به Incident هوش مصنوعی' })
  @ApiParam({ name: 'incidentId', description: 'شناسه Incident' })
  appendAiIncidentEvent(
    @Req() req: AuthenticatedRequest,
    @Param('incidentId') incidentId: string,
    @Body() dto: AdminAppendAiIncidentEventDto,
  ) {
    this.assertAdminAiIncidentManager(req);
    return this.aiIncidentTimelineService.appendEvent(
      incidentId,
      dto,
      this.getUserId(req),
    );
  }

  @Get('ai/runbooks')
  @ApiOperation({
    summary: 'دریافت Runbookهای نسخه‌دار هشدار هوش مصنوعی',
    description:
      'Mappingهای Alert به Runbook را از AiGuardrailRule برمی‌گرداند.',
  })
  getAiAlertRunbooks(
    @Req() req: AuthenticatedRequest,
    @Query() query: QueryAiAlertRunbooksDto,
  ) {
    this.assertAdminAiRunbookReader(req);
    return this.aiAlertRunbookService.findRunbooks(query);
  }

  @Get('ai/runbooks/resolve')
  @ApiOperation({
    summary: 'Resolve فقط‌خواندنی Runbook برای یک Alert',
    description:
      'Runbookهای منطبق را بدون اعلان یا اجرای خودکار رتبه‌بندی می‌کند.',
  })
  resolveAiAlertRunbooks(
    @Req() req: AuthenticatedRequest,
    @Query() query: ResolveAiAlertRunbooksDto,
  ) {
    this.assertAdminAiRunbookReader(req);
    return this.aiAlertRunbookResolver.resolve(query);
  }

  @Post('ai/runbooks')
  @ApiOperation({ summary: 'ایجاد Runbook نسخه‌دار هشدار هوش مصنوعی' })
  createAiAlertRunbook(
    @Req() req: AuthenticatedRequest,
    @Body() dto: AdminCreateAiAlertRunbookDto,
  ) {
    this.assertAdminAiRunbookManager(req);
    return this.aiAlertRunbookService.createRunbook(dto, this.getUserId(req));
  }

  @Patch('ai/runbooks/:runbookId')
  @ApiOperation({ summary: 'ویرایش Runbook هشدار هوش مصنوعی' })
  @ApiParam({ name: 'runbookId', description: 'شناسه Runbook' })
  updateAiAlertRunbook(
    @Req() req: AuthenticatedRequest,
    @Param('runbookId') runbookId: string,
    @Body() dto: AdminUpdateAiAlertRunbookDto,
  ) {
    this.assertAdminAiRunbookManager(req);
    return this.aiAlertRunbookService.updateRunbook(
      runbookId,
      dto,
      this.getUserId(req),
    );
  }

  @Delete('ai/runbooks/:runbookId')
  @ApiOperation({ summary: 'حذف نرم Runbook هشدار هوش مصنوعی' })
  @ApiParam({ name: 'runbookId', description: 'شناسه Runbook' })
  deleteAiAlertRunbook(
    @Req() req: AuthenticatedRequest,
    @Param('runbookId') runbookId: string,
  ) {
    this.assertAdminAiRunbookManager(req);
    return this.aiAlertRunbookService.deleteRunbook(
      runbookId,
      this.getUserId(req),
    );
  }

  @Get('ai/budgets')
  @ApiOperation({
    summary: 'دریافت سیاست‌های بودجه هوش مصنوعی',
    description:
      'سیاست‌های نسخه‌دار بودجه Provider را بدون افشای داده محرمانه برمی‌گرداند.',
  })
  getAiBudgetPolicies(
    @Req() req: AuthenticatedRequest,
    @Query() query: QueryAiBudgetPoliciesDto,
  ) {
    this.assertAdminAiBudgetReader(req);

    return this.aiBudgetPolicyService.findPolicies(query);
  }

  @Get('ai/budgets/usage')
  @ApiOperation({
    summary: 'دریافت مصرف و تعهد بودجه هوش مصنوعی',
    description:
      'مصرف واقعی، رزرو فعال، باقی‌مانده سقف سخت و موارد بدون قیمت را از AiRunLog محاسبه می‌کند.',
  })
  getAiBudgetUsage(
    @Req() req: AuthenticatedRequest,
    @Query() query: QueryAiBudgetUsageDto,
  ) {
    this.assertAdminAiBudgetReader(req);

    return this.aiBudgetEnforcementService.getUsageReport(query);
  }

  @Post('ai/budgets')
  @ApiOperation({
    summary: 'ایجاد سیاست بودجه هوش مصنوعی',
    description: 'یک سیاست نسخه‌دار بودجه را در AiGuardrailRule ثبت می‌کند.',
  })
  createAiBudgetPolicy(
    @Req() req: AuthenticatedRequest,
    @Body() dto: AdminCreateAiBudgetPolicyDto,
  ) {
    this.assertAdminAiBudgetManager(req);

    return this.aiBudgetPolicyService.createPolicy(dto, this.getUserId(req));
  }

  @Patch('ai/budgets/:policyId')
  @ApiOperation({
    summary: 'ویرایش سیاست بودجه هوش مصنوعی',
    description:
      'سیاست موجود را با افزایش نسخه سند و حفظ سابقه زمانی ویرایش می‌کند.',
  })
  @ApiParam({ name: 'policyId', description: 'شناسه سیاست بودجه' })
  updateAiBudgetPolicy(
    @Req() req: AuthenticatedRequest,
    @Param('policyId') policyId: string,
    @Body() dto: AdminUpdateAiBudgetPolicyDto,
  ) {
    this.assertAdminAiBudgetManager(req);

    return this.aiBudgetPolicyService.updatePolicy(
      policyId,
      dto,
      this.getUserId(req),
    );
  }

  @Delete('ai/budgets/:policyId')
  @ApiOperation({
    summary: 'حذف نرم سیاست بودجه هوش مصنوعی',
    description:
      'سیاست را غیرفعال و Soft Delete می‌کند؛ شواهد قبلی AiRunLog حفظ می‌شوند.',
  })
  @ApiParam({ name: 'policyId', description: 'شناسه سیاست بودجه' })
  deleteAiBudgetPolicy(
    @Req() req: AuthenticatedRequest,
    @Param('policyId') policyId: string,
  ) {
    this.assertAdminAiBudgetManager(req);

    return this.aiBudgetPolicyService.deletePolicy(
      policyId,
      this.getUserId(req),
    );
  }

  @Get('ai/slos')
  @ApiOperation({
    summary: 'دریافت سیاست‌های SLO هوش مصنوعی',
    description:
      'سیاست‌های نسخه‌دار هدف دسترس‌پذیری، تأخیر و Error Budget را برمی‌گرداند.',
  })
  getAiSloPolicies(
    @Req() req: AuthenticatedRequest,
    @Query() query: QueryAiSloPoliciesDto,
  ) {
    this.assertAdminAiSloReader(req);
    return this.aiSloPolicyService.findPolicies(query);
  }

  @Get('ai/slos/report')
  @ApiOperation({
    summary: 'گزارش SLO و Error Budget هوش مصنوعی',
    description:
      'گزارش فقط‌خواندنی دسترس‌پذیری، P95 latency، Burn Rate و بودجه خطای باقی‌مانده را از AiRunLog محاسبه می‌کند.',
  })
  getAiSloReport(
    @Req() req: AuthenticatedRequest,
    @Query() query: QueryAiSloReportDto,
  ) {
    this.assertAdminAiSloReader(req);
    return this.aiSloErrorBudgetService.getReport(query);
  }

  @Post('ai/slos')
  @ApiOperation({ summary: 'ایجاد سیاست SLO هوش مصنوعی' })
  createAiSloPolicy(
    @Req() req: AuthenticatedRequest,
    @Body() dto: AdminCreateAiSloPolicyDto,
  ) {
    this.assertAdminAiSloManager(req);
    return this.aiSloPolicyService.createPolicy(dto, this.getUserId(req));
  }

  @Patch('ai/slos/:policyId')
  @ApiOperation({ summary: 'ویرایش سیاست SLO هوش مصنوعی' })
  @ApiParam({ name: 'policyId', description: 'شناسه سیاست SLO' })
  updateAiSloPolicy(
    @Req() req: AuthenticatedRequest,
    @Param('policyId') policyId: string,
    @Body() dto: AdminUpdateAiSloPolicyDto,
  ) {
    this.assertAdminAiSloManager(req);
    return this.aiSloPolicyService.updatePolicy(
      policyId,
      dto,
      this.getUserId(req),
    );
  }

  @Delete('ai/slos/:policyId')
  @ApiOperation({ summary: 'حذف نرم سیاست SLO هوش مصنوعی' })
  @ApiParam({ name: 'policyId', description: 'شناسه سیاست SLO' })
  deleteAiSloPolicy(
    @Req() req: AuthenticatedRequest,
    @Param('policyId') policyId: string,
  ) {
    this.assertAdminAiSloManager(req);
    return this.aiSloPolicyService.deletePolicy(policyId, this.getUserId(req));
  }

  @Get('ai/provider-costs')
  @ApiOperation({
    summary: 'گزارش مصرف و هزینه Providerهای هوش مصنوعی',
    description:
      'گزارش فقط‌خواندنی مصرف توکن، هزینه Provider، Retry، Fallback و Lineage اجرا را از AiRunLog برمی‌گرداند.',
  })
  getAiProviderCosts(
    @Req() req: AuthenticatedRequest,
    @Query() query: QueryAiProviderCostReportDto,
  ) {
    this.assertAdminAiCostReader(req);

    return this.aiProviderCostReport.getReport(query);
  }

  @Get('queues/status')
  @ApiOperation({
    summary: 'دریافت وضعیت صف‌ها',
    description:
      'وضعیت کلی همه صف‌های BullMQ شامل تعداد Jobهای فعال، منتظر، موفق، ناموفق، تأخیری و متوقف را برمی‌گرداند.',
  })
  getQueueStatus(@Req() req: AuthenticatedRequest) {
    this.assertAdminQueueReader(req);

    return this.adminQueueService.getStatus();
  }

  @Post('queues/test/notification')
  @ApiOperation({
    summary: 'ایجاد Job تست اعلان',
    description:
      'یک Job واقعی برای تست صف اعلان ایجاد می‌کند. این Job از BullMQ عبور کرده و توسط NotificationQueueProcessor پردازش می‌شود.',
  })
  enqueueTestNotificationJob(
    @Req() req: AuthenticatedRequest,
    @Body() dto: EnqueueTestNotificationJobDto,
  ) {
    this.assertAdminQueueManager(req);

    return this.adminQueueService.enqueueTestNotificationJob(
      dto,
      this.getUserId(req),
    );
  }

  @Post('queues/test/analytics')
  @ApiOperation({
    summary: 'ایجاد Job تست آنالیتیکس',
    description:
      'یک Job واقعی برای تست صف آنالیتیکس ایجاد می‌کند. این Job از BullMQ عبور کرده و توسط AnalyticsQueueProcessor پردازش می‌شود.',
  })
  enqueueTestAnalyticsJob(
    @Req() req: AuthenticatedRequest,
    @Body() dto: EnqueueTestAnalyticsJobDto,
  ) {
    this.assertAdminQueueManager(req);

    return this.adminQueueService.enqueueTestAnalyticsJob(
      dto,
      this.getUserId(req),
    );
  }

  @Get('queues/:queueName/jobs')
  @ApiOperation({
    summary: 'دریافت Jobهای یک صف',
    description:
      'لیست Jobهای یک صف را بر اساس وضعیت، محدوده و ترتیب نمایش برمی‌گرداند.',
  })
  @ApiParam({
    name: 'queueName',
    description:
      'نام صف مانند notification، analytics، order، invoice، media، ai یا dead-letter',
  })
  getQueueJobs(
    @Req() req: AuthenticatedRequest,
    @Param('queueName') queueName: string,
    @Query() query: QueryQueueJobsDto,
  ) {
    this.assertAdminQueueReader(req);

    return this.adminQueueService.getJobs(queueName, query);
  }

  @Get('queues/:queueName/jobs/:jobId')
  @ApiOperation({
    summary: 'دریافت جزئیات Job',
    description:
      'جزئیات کامل یک Job شامل داده ورودی، خروجی، خطا، وضعیت، تعداد تلاش و Stacktrace را برمی‌گرداند.',
  })
  @ApiParam({
    name: 'queueName',
    description: 'نام صف',
  })
  @ApiParam({
    name: 'jobId',
    description: 'شناسه Job',
  })
  getQueueJobDetails(
    @Req() req: AuthenticatedRequest,
    @Param('queueName') queueName: string,
    @Param('jobId') jobId: string,
  ) {
    this.assertAdminQueueReader(req);

    return this.adminQueueService.getJobDetails(queueName, jobId);
  }

  @Post('queues/ai/jobs/:jobId/cancel')
  @ApiOperation({
    summary: 'لغو کنترل‌شده اجرای هوش مصنوعی',
    description:
      'درخواست لغو idempotent را با حفظ شواهد Job ثبت می‌کند و برای Job فعال سیگنال cooperative cancellation می‌فرستد.',
  })
  cancelAiQueueJob(
    @Req() req: AuthenticatedRequest,
    @Param('jobId') jobId: string,
    @Body() dto: CancelAiQueueJobDto,
  ) {
    this.assertAdminQueueManager(req);

    return this.adminQueueService.cancelAiExecution(
      jobId,
      this.getUserId(req),
      dto.reason,
    );
  }

  @Post('queues/dead-letter/jobs/:jobId/replay')
  @ApiOperation({
    summary: 'Replay کنترل‌شده Dead Letter',
    description:
      'Job اصلی ثبت‌شده در Dead Letter Queue را با شناسه قطعی، Retry Budget تازه و Metadata حسابرسی مجدداً وارد صف اصلی می‌کند. رکورد Dead Letter حذف نمی‌شود.',
  })
  @ApiParam({
    name: 'jobId',
    description: 'شناسه Job ثبت خطا در Dead Letter Queue',
  })
  replayDeadLetterJob(
    @Req() req: AuthenticatedRequest,
    @Param('jobId') jobId: string,
  ) {
    this.assertAdminQueueManager(req);

    return this.adminQueueService.replayDeadLetterJob(
      jobId,
      this.getUserId(req),
    );
  }

  @Post('queues/:queueName/jobs/:jobId/retry')
  @ApiOperation({
    summary: 'اجرای مجدد Job شکست‌خورده',
    description: 'یک Job شکست‌خورده را برای اجرای مجدد وارد صف می‌کند.',
  })
  retryQueueJob(
    @Req() req: AuthenticatedRequest,
    @Param('queueName') queueName: string,
    @Param('jobId') jobId: string,
  ) {
    this.assertAdminQueueManager(req);

    return this.adminQueueService.retryJob(queueName, jobId);
  }

  @Delete('queues/:queueName/jobs/:jobId')
  @ApiOperation({
    summary: 'حذف Job از صف',
    description: 'یک Job مشخص را از صف حذف می‌کند.',
  })
  removeQueueJob(
    @Req() req: AuthenticatedRequest,
    @Param('queueName') queueName: string,
    @Param('jobId') jobId: string,
  ) {
    this.assertAdminQueueManager(req);

    return this.adminQueueService.removeJob(queueName, jobId);
  }

  @Post('queues/:queueName/pause')
  @ApiOperation({
    summary: 'توقف صف',
    description: 'پردازش یک صف مشخص را متوقف می‌کند.',
  })
  pauseQueue(
    @Req() req: AuthenticatedRequest,
    @Param('queueName') queueName: string,
  ) {
    this.assertAdminQueueManager(req);

    return this.adminQueueService.pauseQueue(queueName);
  }

  @Post('queues/:queueName/resume')
  @ApiOperation({
    summary: 'فعال‌سازی مجدد صف',
    description: 'پردازش یک صف متوقف‌شده را دوباره فعال می‌کند.',
  })
  resumeQueue(
    @Req() req: AuthenticatedRequest,
    @Param('queueName') queueName: string,
  ) {
    this.assertAdminQueueManager(req);

    return this.adminQueueService.resumeQueue(queueName);
  }

  @Get('scheduler/status')
  @ApiOperation({
    summary: 'دریافت وضعیت Scheduler',
    description:
      'وضعیت فعال‌بودن Scheduler، Taskهای ثبت‌شده، Cron و Timezone را برمی‌گرداند.',
  })
  getSchedulerStatus(@Req() req: AuthenticatedRequest) {
    this.assertAdminSchedulerReader(req);

    return this.adminSchedulerService.getStatus();
  }

  @Post('scheduler/tasks/:taskName/run')
  @ApiOperation({
    summary: 'اجرای دستی Task زمان‌بندی‌شده',
    description: 'یک Task زمان‌بندی‌شده مشخص را به‌صورت دستی اجرا می‌کند.',
  })
  @ApiParam({
    name: 'taskName',
    description:
      'نام Task مانند scheduler.media-cleanup یا scheduler.queue-health',
  })
  runSchedulerTask(
    @Req() req: AuthenticatedRequest,
    @Param('taskName') taskName: string,
  ) {
    this.assertAdminSchedulerManager(req);

    return this.adminSchedulerService.runTask(taskName);
  }

  private getUserId(req: AuthenticatedRequest): string {
    const userId = req.user?.id ?? req.user?.userId ?? req.user?.sub;

    if (!userId) {
      throw new ForbiddenException('شناسه کاربر احراز هویت‌شده یافت نشد.');
    }

    return userId;
  }

  private assertAdminReader(req: AuthenticatedRequest): void {
    if (this.hasAdminRole(req)) {
      return;
    }

    if (
      this.hasAnyPermission(req, [
        'admin:*',
        'admin:read',
        'dashboard:*',
        'dashboard:read',
        'analytics:*',
        'analytics:read',
        'reports:*',
        'reports:read',
      ])
    ) {
      return;
    }

    throw new ForbiddenException(
      'شما مجوز دسترسی به داشبورد مدیریت را ندارید.',
    );
  }

  private assertAdminAiRoutingReader(req: AuthenticatedRequest): void {
    if (this.hasAdminRole(req)) return;
    if (this.hasAnyPermission(req, ['admin:*', 'ai:*', 'ai:routing:read']))
      return;
    throw new ForbiddenException(
      'شما مجوز مشاهده تصمیم Shadow Routing را ندارید.',
    );
  }

  private assertAdminAiRoutingManager(req: AuthenticatedRequest): void {
    if (this.hasAdminRole(req)) return;
    if (this.hasAnyPermission(req, ['admin:*', 'ai:*', 'ai:routing:manage']))
      return;
    throw new ForbiddenException(
      'شما مجوز مدیریت تاریخچه Shadow Routing را ندارید.',
    );
  }

  private assertAdminAiRolloutReader(req: AuthenticatedRequest): void {
    if (this.hasAdminRole(req)) return;
    if (
      this.hasAnyPermission(req, [
        'admin:*',
        'ai:*',
        'ai:rollout:read',
        'ai:rollout:manage',
      ])
    )
      return;
    throw new ForbiddenException('شما مجوز مشاهده Rollout مدل را ندارید.');
  }

  private assertAdminAiRolloutManager(req: AuthenticatedRequest): void {
    if (this.hasAdminRole(req)) return;
    if (this.hasAnyPermission(req, ['admin:*', 'ai:*', 'ai:rollout:manage']))
      return;
    throw new ForbiddenException('شما مجوز مدیریت Rollout مدل را ندارید.');
  }

  private assertAdminAiIncidentReader(req: AuthenticatedRequest): void {
    if (this.hasAdminRole(req)) return;
    if (
      this.hasAnyPermission(req, [
        'admin:*',
        'ai:*',
        'ai:incident:read',
        'ai:incident:manage',
      ])
    )
      return;
    throw new ForbiddenException(
      'شما مجوز مشاهده Timeline رخدادهای هوش مصنوعی را ندارید.',
    );
  }

  private assertAdminAiIncidentManager(req: AuthenticatedRequest): void {
    if (this.hasAdminRole(req)) return;
    if (this.hasAnyPermission(req, ['admin:*', 'ai:*', 'ai:incident:manage']))
      return;
    throw new ForbiddenException(
      'شما مجوز ثبت رخداد Incident هوش مصنوعی را ندارید.',
    );
  }

  private assertAdminAiRunbookReader(req: AuthenticatedRequest): void {
    if (this.hasAdminRole(req)) return;
    if (
      this.hasAnyPermission(req, [
        'admin:*',
        'ai:*',
        'ai:runbook:read',
        'ai:runbook:manage',
      ])
    )
      return;
    throw new ForbiddenException(
      'شما مجوز مشاهده Runbookهای هشدار هوش مصنوعی را ندارید.',
    );
  }

  private assertAdminAiRunbookManager(req: AuthenticatedRequest): void {
    if (this.hasAdminRole(req)) return;
    if (this.hasAnyPermission(req, ['admin:*', 'ai:*', 'ai:runbook:manage']))
      return;
    throw new ForbiddenException(
      'شما مجوز مدیریت Runbookهای هشدار هوش مصنوعی را ندارید.',
    );
  }

  private assertAdminAiBudgetReader(req: AuthenticatedRequest): void {
    if (this.hasAdminRole(req)) {
      return;
    }

    if (
      this.hasAnyPermission(req, [
        'admin:*',
        'ai:*',
        'ai:budget:read',
        'ai:budget:manage',
      ])
    ) {
      return;
    }

    throw new ForbiddenException(
      'شما مجوز مشاهده سیاست و مصرف بودجه هوش مصنوعی را ندارید.',
    );
  }

  private assertAdminAiBudgetManager(req: AuthenticatedRequest): void {
    if (this.hasAdminRole(req)) {
      return;
    }

    if (this.hasAnyPermission(req, ['admin:*', 'ai:*', 'ai:budget:manage'])) {
      return;
    }

    throw new ForbiddenException(
      'شما مجوز مدیریت سیاست بودجه هوش مصنوعی را ندارید.',
    );
  }

  private assertAdminAiSloReader(req: AuthenticatedRequest): void {
    if (this.hasAdminRole(req)) {
      return;
    }

    if (
      this.hasAnyPermission(req, [
        'admin:*',
        'ai:*',
        'ai:slo:read',
        'ai:slo:manage',
      ])
    ) {
      return;
    }

    throw new ForbiddenException(
      'شما مجوز مشاهده سیاست‌ها و گزارش SLO هوش مصنوعی را ندارید.',
    );
  }

  private assertAdminAiSloManager(req: AuthenticatedRequest): void {
    if (this.hasAdminRole(req)) {
      return;
    }

    if (this.hasAnyPermission(req, ['admin:*', 'ai:*', 'ai:slo:manage'])) {
      return;
    }

    throw new ForbiddenException(
      'شما مجوز مدیریت سیاست‌های SLO هوش مصنوعی را ندارید.',
    );
  }

  private assertAdminAiCostReader(req: AuthenticatedRequest): void {
    if (this.hasAdminRole(req)) {
      return;
    }

    if (
      this.hasAnyPermission(req, [
        'admin:*',
        'admin:read',
        'ai:*',
        'ai:read',
        'analytics:*',
        'analytics:read',
        'reports:*',
        'reports:read',
      ])
    ) {
      return;
    }

    throw new ForbiddenException(
      'شما مجوز مشاهده گزارش هزینه هوش مصنوعی را ندارید.',
    );
  }

  private assertAdminQueueReader(req: AuthenticatedRequest): void {
    if (this.hasAdminRole(req)) {
      return;
    }

    if (
      this.hasAnyPermission(req, [
        'admin:*',
        'admin:read',
        'queue:*',
        'queue:read',
      ])
    ) {
      return;
    }

    throw new ForbiddenException('شما مجوز مشاهده وضعیت صف‌ها را ندارید.');
  }

  private assertAdminQueueManager(req: AuthenticatedRequest): void {
    if (this.hasAdminRole(req)) {
      return;
    }

    if (
      this.hasAnyPermission(req, [
        'admin:*',
        'admin:manage',
        'queue:*',
        'queue:manage',
      ])
    ) {
      return;
    }

    throw new ForbiddenException('شما مجوز مدیریت صف‌ها را ندارید.');
  }

  private assertAdminSchedulerReader(req: AuthenticatedRequest): void {
    if (this.hasAdminRole(req)) {
      return;
    }

    if (
      this.hasAnyPermission(req, [
        'admin:*',
        'admin:read',
        'scheduler:*',
        'scheduler:read',
      ])
    ) {
      return;
    }

    throw new ForbiddenException(
      'شما مجوز مشاهده وضعیت زمان‌بندی‌ها را ندارید.',
    );
  }

  private assertAdminSchedulerManager(req: AuthenticatedRequest): void {
    if (this.hasAdminRole(req)) {
      return;
    }

    if (
      this.hasAnyPermission(req, [
        'admin:*',
        'admin:manage',
        'scheduler:*',
        'scheduler:manage',
        'scheduler:run',
      ])
    ) {
      return;
    }

    throw new ForbiddenException('شما مجوز مدیریت زمان‌بندی‌ها را ندارید.');
  }

  private hasAdminRole(req: AuthenticatedRequest): boolean {
    const role =
      req.user?.roleName ??
      (typeof req.user?.role === 'string'
        ? req.user.role
        : req.user?.role?.name) ??
      null;

    return role === 'ADMIN' || role === 'SUPER_ADMIN';
  }

  private hasAnyPermission(
    req: AuthenticatedRequest,
    permissions: string[],
  ): boolean {
    const userPermissions = req.user?.permissions ?? [];

    return permissions.some((permission) =>
      userPermissions.includes(permission),
    );
  }
}
