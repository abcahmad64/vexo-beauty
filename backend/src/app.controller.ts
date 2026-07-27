import { Controller, Get } from '@nestjs/common';

import { AppService, BaseAppResponse } from './app.service';

@Controller()
export class AppController {
  constructor(private readonly appService: AppService) {}

  @Get()
  getRoot(): BaseAppResponse {
    return this.appService.getRoot();
  }
}
