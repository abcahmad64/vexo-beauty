import { Module } from '@nestjs/common';

import { CoreCacheModule } from '../../core/cache/cache.module';

import { CoreQueueModule } from '../../core/queue/queue.module';

import { PrismaModule } from '../../core/prisma/prisma.module';

import { AiController } from './ai.controller';

import { AiPublicAssistantController } from './ai-public-assistant.controller';

import { AI_PROVIDER } from './constants/ai-provider.tokens';

import { AiEventHandler } from './events/ai.event.handler';

import { AiEventPublisher } from './events/ai.event.publisher';

import { AiQueueProcessor } from './processors/ai-queue.processor';

import { OllamaAiProvider } from './providers/ollama-ai.provider';

import { RecommendationController } from './recommendation/recommendation.controller';

import { RecommendationService } from './recommendation/services/recommendation.service';

import { AiAgentRegistryService } from './services/ai-agent-registry.service';

import { AiAlertRunbookResolverService } from './services/ai-alert-runbook-resolver.service';

import { AiAlertRunbookService } from './services/ai-alert-runbook.service';

import { AiBudgetEnforcementService } from './services/ai-budget-enforcement.service';

import { AiBudgetPolicyService } from './services/ai-budget-policy.service';

import { AiCircuitBreakerService } from './services/ai-circuit-breaker.service';

import { AiContextService } from './services/ai-context.service';

import { AiExecutionContextService } from './services/ai-execution-context.service';

import { AiGuardrailService } from './services/ai-guardrail.service';

import { AiHybridRetrievalService } from './services/ai-hybrid-retrieval.service';

import { AiIncidentTimelineService } from './services/ai-incident-timeline.service';

import { AiModelRolloutCanaryService } from './services/ai-model-rollout-canary.service';

import { AiModelRolloutReportService } from './services/ai-model-rollout-report.service';

import { AiKnowledgeRetrievalService } from './services/ai-knowledge-retrieval.service';

import { AiModelRouterService } from './services/ai-model-router.service';

import { AiRerankerClientService } from './services/ai-reranker-client.service';

import { AiRuntimeCoordinatorService } from './services/ai-runtime-coordinator.service';

import { AiRuntimeHealthService } from './services/ai-runtime-health.service';

import { AiOrchestratorService } from './services/ai-orchestrator.service';

import { AiPermissionGuardService } from './services/ai-permission-guard.service';

import { AiProviderCostReportService } from './services/ai-provider-cost-report.service';

import { AiResponseValidatorService } from './services/ai-response-validator.service';

import { AiRunLogService } from './services/ai-run-log.service';

import { AiShadowModelRoutingService } from './services/ai-shadow-model-routing.service';

import { AiShadowRoutingObservabilityService } from './services/ai-shadow-routing-observability.service';

import { AiSloErrorBudgetService } from './services/ai-slo-error-budget.service';

import { AiSloPolicyService } from './services/ai-slo-policy.service';

import { AiService } from './services/ai.service';

import { AiToolRegistryService } from './services/ai-tool-registry.service';

import { CatalogResearchBootstrapService } from './services/catalog-research-bootstrap.service';

import { CatalogWebResearchService } from './services/catalog-web-research.service';

import { OfficialProductPageResolverService } from './services/official-product-page-resolver.service';

import { OllamaClientService } from './services/ollama-client.service';

import { PublicAiAssistantService } from './services/public-ai-assistant.service';

@Module({
  imports: [PrismaModule, CoreCacheModule, CoreQueueModule],
  controllers: [
    AiController,
    AiPublicAssistantController,
    RecommendationController,
  ],
  providers: [
    AiService,
    AiContextService,
    AiExecutionContextService,
    RecommendationService,
    PublicAiAssistantService,

    AiAgentRegistryService,
    AiAlertRunbookResolverService,
    AiAlertRunbookService,
    AiBudgetEnforcementService,
    AiBudgetPolicyService,
    AiCircuitBreakerService,
    AiModelRouterService,
    AiRuntimeCoordinatorService,
    AiRerankerClientService,
    AiHybridRetrievalService,
    AiIncidentTimelineService,
    AiModelRolloutCanaryService,
    AiModelRolloutReportService,
    AiKnowledgeRetrievalService,
    AiRuntimeHealthService,
    OllamaClientService,
    AiRunLogService,
    AiShadowModelRoutingService,
    AiShadowRoutingObservabilityService,
    AiSloErrorBudgetService,
    AiSloPolicyService,
    AiGuardrailService,
    AiResponseValidatorService,
    AiOrchestratorService,
    AiToolRegistryService,
    AiPermissionGuardService,
    AiProviderCostReportService,
    CatalogResearchBootstrapService,
    CatalogWebResearchService,
    OfficialProductPageResolverService,

    AiEventPublisher,
    AiEventHandler,
    AiQueueProcessor,

    {
      provide: AI_PROVIDER,
      useClass: OllamaAiProvider,
    },
    {
      provide: OllamaAiProvider,
      useExisting: AI_PROVIDER,
    },
  ],
  exports: [
    AiService,
    AiContextService,
    AiExecutionContextService,
    RecommendationService,
    PublicAiAssistantService,

    AiAgentRegistryService,
    AiAlertRunbookResolverService,
    AiAlertRunbookService,
    AiBudgetEnforcementService,
    AiBudgetPolicyService,
    AiCircuitBreakerService,
    AiModelRouterService,
    AiRuntimeCoordinatorService,
    AiRerankerClientService,
    AiHybridRetrievalService,
    AiIncidentTimelineService,
    AiModelRolloutCanaryService,
    AiModelRolloutReportService,
    AiKnowledgeRetrievalService,
    AiRuntimeHealthService,
    OllamaClientService,
    AiRunLogService,
    AiShadowModelRoutingService,
    AiShadowRoutingObservabilityService,
    AiSloErrorBudgetService,
    AiSloPolicyService,
    AiGuardrailService,
    AiResponseValidatorService,
    AiOrchestratorService,
    AiToolRegistryService,
    AiPermissionGuardService,
    AiProviderCostReportService,
    CatalogWebResearchService,
    OfficialProductPageResolverService,

    AiEventPublisher,
    AiQueueProcessor,
    AI_PROVIDER,
  ],
})
export class AiModule {}
