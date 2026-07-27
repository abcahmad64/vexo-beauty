import { Injectable } from '@nestjs/common';

import { AdminCommandCenterQueryDto } from '../dto/admin-command-center-query.dto';

import { AdminActionCenterService } from './admin-action-center.service';
import { AdminEnterpriseDashboardService } from './admin-enterprise-dashboard.service';
import { AdminInsightService } from './admin-insight.service';
import { AdminTimelineService } from './admin-timeline.service';

type CommandCenterStatus =
  'stable' | 'attention_required' | 'high_risk' | 'critical';

type AdminCommandCenterResponse = {
  meta: {
    generatedAt: string;
    requestedBy: string;
    currency: string | null;
    createdFrom: string | null;
    createdTo: string | null;
    chartDays: number | null;
    actionLimit: number;
    timelineLimit: number;
  };
  status: {
    value: CommandCenterStatus;
    label: string;
    score: number;
    message: string;
  };
  dashboard: Awaited<
    ReturnType<AdminEnterpriseDashboardService['getEnterpriseDashboard']>
  >;
  actionCenter: Awaited<
    ReturnType<AdminActionCenterService['getActionCenter']>
  >;
  insights: Awaited<ReturnType<AdminInsightService['getInsights']>>;
  timeline: Awaited<ReturnType<AdminTimelineService['getTimeline']>>;
};

@Injectable()
export class AdminCommandCenterService {
  private readonly defaultActionLimit = 10;

  private readonly defaultTimelineLimit = 50;

  constructor(
    private readonly enterpriseDashboardService: AdminEnterpriseDashboardService,
    private readonly actionCenterService: AdminActionCenterService,
    private readonly insightService: AdminInsightService,
    private readonly timelineService: AdminTimelineService,
  ) {}

  async getCommandCenter(
    query: AdminCommandCenterQueryDto,
    actorId: string,
  ): Promise<AdminCommandCenterResponse> {
    const actionLimit = query.actionLimit ?? this.defaultActionLimit;

    const timelineLimit = query.timelineLimit ?? this.defaultTimelineLimit;

    const [dashboard, actionCenter, insights, timeline] = await Promise.all([
      this.enterpriseDashboardService.getEnterpriseDashboard(
        {
          createdFrom: query.createdFrom,
          createdTo: query.createdTo,
          currency: query.currency,
          chartDays: query.chartDays,
        },
        actorId,
      ),

      this.actionCenterService.getActionCenter(
        {
          limit: actionLimit,
        },
        actorId,
      ),

      this.insightService.getInsights(
        {
          createdFrom: query.createdFrom,
          createdTo: query.createdTo,
          currency: query.currency,
        },
        actorId,
      ),

      this.timelineService.getTimeline(
        {
          limit: timelineLimit,
          createdFrom: query.createdFrom,
          createdTo: query.createdTo,
        },
        actorId,
      ),
    ]);

    return {
      meta: {
        generatedAt: new Date().toISOString(),
        requestedBy: actorId,
        currency: query.currency ?? null,
        createdFrom: query.createdFrom ?? null,
        createdTo: query.createdTo ?? null,
        chartDays: query.chartDays ?? null,
        actionLimit,
        timelineLimit,
      },
      status: this.buildStatus(
        dashboard.risk.score,
        insights.score.value,
        actionCenter.summary.critical,
        actionCenter.summary.error,
      ),
      dashboard,
      actionCenter,
      insights,
      timeline,
    };
  }

  private buildStatus(
    dashboardRiskScore: number,
    insightRiskScore: number,
    criticalActions: number,
    errorActions: number,
  ): AdminCommandCenterResponse['status'] {
    const score = Math.min(
      100,
      Math.max(dashboardRiskScore, insightRiskScore) +
        criticalActions * 10 +
        errorActions * 5,
    );

    if (criticalActions > 0 || score >= 80) {
      return {
        value: 'critical',
        label: 'بحرانی',
        score,
        message: 'وضعیت فروشگاه نیازمند رسیدگی فوری مدیریتی است.',
      };
    }

    if (errorActions > 0 || score >= 50) {
      return {
        value: 'high_risk',
        label: 'ریسک بالا',
        score,
        message: 'چند مورد مهم در عملیات فروشگاه نیاز به بررسی دارد.',
      };
    }

    if (score >= 20) {
      return {
        value: 'attention_required',
        label: 'نیازمند توجه',
        score,
        message: 'وضعیت کلی قابل قبول است اما چند هشدار عملیاتی وجود دارد.',
      };
    }

    return {
      value: 'stable',
      label: 'پایدار',
      score,
      message: 'وضعیت کلی فروشگاه پایدار است.',
    };
  }
}
