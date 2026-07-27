import {
  Controller,
  Delete,
  Req,
  UnauthorizedException,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';

import type { AuthenticatedRequest } from '../../core/interfaces/authenticated-request.interface';
import { RateLimit } from '../../core/rate-limit/decorators/rate-limit.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';

import { MediaService } from './services/media.service';

@ApiTags('Media')
@Controller('media')
export class AvatarController {
  constructor(private readonly mediaService: MediaService) {}

  @RateLimit('sensitive')
  @UseGuards(JwtAuthGuard)
  @Delete('me/avatar')
  @ApiBearerAuth('access-token')
  @ApiOperation({
    summary: 'حذف آواتار کاربر فعلی',
    description:
      'آواتار کاربر احرازهویت‌شده را حذف و فایل مدیریت‌شده قبلی را پاک می‌کند.',
  })
  removeMyAvatar(@Req() req: AuthenticatedRequest) {
    const userId = this.getUserId(req);

    return this.mediaService.removeUserAvatar(userId, userId);
  }

  private getUserId(req: AuthenticatedRequest): string {
    if (!req.user?.id) {
      throw new UnauthorizedException('کاربر احرازهویت‌شده یافت نشد.');
    }

    return req.user.id;
  }
}
