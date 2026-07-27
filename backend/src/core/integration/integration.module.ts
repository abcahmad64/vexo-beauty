import { Global, Module } from '@nestjs/common';

import { CoreCacheModule } from '../cache/cache.module';
import { CoreQueueModule } from '../queue/queue.module';
import { InvoiceIntegrationHandler } from './handlers/invoice.integration.handler';
import { OrderIntegrationHandler } from './handlers/order.integration.handler';
import { PaymentIntegrationHandler } from './handlers/payment.integration.handler';
import { RefundIntegrationHandler } from './handlers/refund.integration.handler';
import { ShipmentIntegrationHandler } from './handlers/shipment.integration.handler';
import { AnalyticsOrchestrator } from './orchestrators/analytics.orchestrator';
import { CacheOrchestrator } from './orchestrators/cache.orchestrator';
import { NotificationOrchestrator } from './orchestrators/notification.orchestrator';

@Global()
@Module({
  imports: [CoreCacheModule, CoreQueueModule],
  providers: [
    NotificationOrchestrator,
    AnalyticsOrchestrator,
    CacheOrchestrator,
    OrderIntegrationHandler,
    PaymentIntegrationHandler,
    ShipmentIntegrationHandler,
    InvoiceIntegrationHandler,
    RefundIntegrationHandler,
  ],
  exports: [NotificationOrchestrator, AnalyticsOrchestrator, CacheOrchestrator],
})
export class IntegrationModule {}
