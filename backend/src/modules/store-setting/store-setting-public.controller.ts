import { Controller, Get } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';

import { RateLimit } from '../../core/rate-limit/decorators/rate-limit.decorator';
import { AdminStoreSettingService } from './services/admin-store-setting.service';

@ApiTags('Storefront Site Settings')
@Controller('store-settings')
export class StoreSettingPublicController {
  constructor(private readonly settings: AdminStoreSettingService) {}

  @Get('public')
  @RateLimit('public')
  @ApiOperation({ summary: 'Read active public storefront settings' })
  getPublicSettings() {
    return this.settings.getPublicSettings();
  }
}
