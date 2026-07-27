import { Body, Controller, Post } from '@nestjs/common';

import { RateLimit } from '../../core/rate-limit/decorators/rate-limit.decorator';

import {
  PublicAiChatDto,
  PublicAiConsultingDto,
  PublicAiSalesDto,
} from './dto/public-ai-assistant.dto';

import { PublicAiAssistantService } from './services/public-ai-assistant.service';

@Controller('ai/public')
export class AiPublicAssistantController {
  constructor(
    private readonly publicAiAssistantService: PublicAiAssistantService,
  ) {}

  @RateLimit('search')
  @Post('chat')
  chat(@Body() dto: PublicAiChatDto) {
    return this.publicAiAssistantService.publicChat(dto);
  }

  @RateLimit('search')
  @Post('sales')
  sales(@Body() dto: PublicAiSalesDto) {
    return this.publicAiAssistantService.salesAssistant(dto);
  }

  @RateLimit('search')
  @Post('consulting')
  consulting(@Body() dto: PublicAiConsultingDto) {
    return this.publicAiAssistantService.consulting(dto);
  }
}
