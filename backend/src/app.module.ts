import { Logger, Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';

import { AppController } from './app.controller';
import { AppService } from './app.service';
import configuration from './config/configuration';
import { validateEnv } from './config/env.validation';
import { CoreModule } from './core/core.module';
import { AddressModule } from './modules/address/address.module';
import { AdminModule } from './modules/admin/admin.module';
import { AdminSecurityModule } from './modules/admin-security/admin-security.module';
import { AiAdminModule } from './modules/ai/ai-admin.module';
import { AiModule } from './modules/ai/ai.module';
import { AnalyticsModule } from './modules/analytics/analytics.module';
import { AttributeModule } from './modules/attribute/attribute.module';
import { AuditModule } from './modules/audit/audit.module';
import { AuthModule } from './modules/auth/auth.module';
import { BrandModule } from './modules/brand/brand.module';
import { CartModule } from './modules/cart/cart.module';
import { CategoryModule } from './modules/category/category.module';
import { CollectionModule } from './modules/collection/collection.module';
import { ContentModule } from './modules/content/content.module';
import { CouponModule } from './modules/coupon/coupon.module';
import { HealthModule } from './modules/health/health.module';
import { HomepageModule } from './modules/homepage/homepage.module';
import { ImportExportModule } from './modules/import-export/import-export.module';
import { InventoryModule } from './modules/inventory/inventory.module';
import { InvoiceModule } from './modules/invoice/invoice.module';
import { MediaModule } from './modules/media/media.module';
import { NotificationModule } from './modules/notification/notification.module';
import { OrderModule } from './modules/order/order.module';
import { PaymentModule } from './modules/payment/payment.module';
import { ProductModule } from './modules/product/product.module';
import { RbacModule } from './modules/rbac/rbac.module';
import { RefundModule } from './modules/refund/refund.module';
import { ReportModule } from './modules/report/report.module';
import { ReviewModule } from './modules/review/review.module';
import { SearchAdminModule } from './modules/search/search-admin.module';
import { SearchModule } from './modules/search/search.module';
import { ShipmentModule } from './modules/shipment/shipment.module';
import { StoreSettingModule } from './modules/store-setting/store-setting.module';
import { SupportModule } from './modules/support/support.module';
import { UserModule } from './modules/user/user.module';
import { VariantModule } from './modules/variant/variant.module';
import { WarehouseModule } from './modules/warehouse/warehouse.module';
import { WishlistModule } from './modules/wishlist/wishlist.module';

function resolveEnvFilePath(): string[] {
  const nodeEnv = process.env.NODE_ENV || 'development';

  return [`.env.${nodeEnv}.local`, `.env.${nodeEnv}`, '.env.local', '.env'];
}

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      cache: true,
      expandVariables: true,
      envFilePath: resolveEnvFilePath(),
      validate: validateEnv,
      load: [configuration],
    }),

    CoreModule,
    HealthModule,

    AuthModule,
    RbacModule,
    UserModule,
    AddressModule,

    ProductModule,
    CategoryModule,
    BrandModule,
    AttributeModule,
    CollectionModule,
    HomepageModule,
    VariantModule,
    MediaModule,
    InventoryModule,
    WarehouseModule,

    CartModule,
    WishlistModule,
    CouponModule,
    OrderModule,
    PaymentModule,
    RefundModule,
    InvoiceModule,
    ShipmentModule,

    ReviewModule,
    SearchModule,
    SearchAdminModule,
    NotificationModule,
    AnalyticsModule,
    ReportModule,

    ContentModule,
    StoreSettingModule,
    SupportModule,

    AdminSecurityModule,
    ImportExportModule,
    AdminModule,
    AiModule,
    AiAdminModule,
    AuditModule,
  ],
  controllers: [AppController],
  providers: [Logger, AppService],
})
export class AppModule {}
