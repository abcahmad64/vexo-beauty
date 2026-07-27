import { Controller, Get, Param } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';

import { Public } from '../../core/decorators/public.decorator';
import { RateLimit } from '../../core/rate-limit/decorators/rate-limit.decorator';
import { AdminContentService } from './services/admin-content.service';

@ApiTags('Public Content')
@Public()
@RateLimit('public')
@Controller('content')
export class ContentPublicController {
  constructor(private readonly contentService: AdminContentService) {}

  @Get('pages/:slug')
  @ApiOperation({ summary: 'دریافت صفحه عمومی منتشرشده با شناسه متنی' })
  findPublishedPage(@Param('slug') slug: string) {
    return this.contentService.findPublishedPage(slug);
  }
}
