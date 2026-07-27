import { Module } from '@nestjs/common';
import {
  JwtModule,
  type JwtModuleOptions,
  type JwtSignOptions,
} from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';

import { PrismaModule } from '../../core/prisma/prisma.module';
import { NotificationModule } from '../notification/notification.module';
import { AuthController } from './auth.controller';
import { CustomerAuthController } from './customer-auth.controller';
import { AuthConstants } from './constants/auth.constants';
import { AuthEventHandler } from './events/auth.event.handler';
import { AuthEventPublisher } from './events/auth.event.publisher';
import { JwtAuthGuard } from './guards/jwt-auth.guard';
import { OptionalJwtAuthGuard } from './guards/optional-jwt-auth.guard';
import { AuthService } from './services/auth.service';
import { CustomerAuthService } from './services/customer-auth.service';
import { JwtStrategy } from './strategies/jwt.strategy';

function createJwtModuleOptions(): JwtModuleOptions {
  const signOptions: JwtSignOptions = {
    expiresIn:
      AuthConstants.ACCESS_TOKEN_EXPIRES_IN as JwtSignOptions['expiresIn'],
  };

  return {
    secret: AuthConstants.ACCESS_SECRET,
    signOptions,
  };
}

@Module({
  imports: [
    PrismaModule,
    NotificationModule,
    PassportModule.register({
      defaultStrategy: 'jwt',
    }),
    JwtModule.registerAsync({
      useFactory: createJwtModuleOptions,
    }),
  ],
  controllers: [AuthController, CustomerAuthController],
  providers: [
    AuthService,
    CustomerAuthService,
    JwtStrategy,
    JwtAuthGuard,
    OptionalJwtAuthGuard,
    AuthEventPublisher,
    AuthEventHandler,
  ],
  exports: [
    AuthService,
    CustomerAuthService,
    JwtAuthGuard,
    OptionalJwtAuthGuard,
    JwtModule,
  ],
})
export class AuthModule {}
