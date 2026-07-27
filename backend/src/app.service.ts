import { Injectable } from '@nestjs/common';

import { ConfigService } from '@nestjs/config';

export interface BaseAppResponse {
  success: boolean;
  message: string;
  service: string;
  environment: string;
  timestamp: string;
}

@Injectable()
export class AppService {
  constructor(private readonly configService: ConfigService) {}

  getRoot(): BaseAppResponse {
    return {
      success: true,
      message: 'سرویس فروشگاه وکسو بیوتی با موفقیت فعال است.',
      service: this.getServiceName(),
      environment: this.getEnvironment(),
      timestamp: this.getTimestamp(),
    };
  }

  private getServiceName(): string {
    return this.configService.get<string>('app.name', 'VEXO Beauty Backend');
  }

  private getEnvironment(): string {
    return this.configService.get<string>('app.env', 'development');
  }

  private getTimestamp(): string {
    return new Date().toISOString();
  }
}
