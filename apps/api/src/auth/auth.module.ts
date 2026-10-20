import { type DynamicModule, Global, Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { BearerGuard } from './bearer.guard.js';
import { ACCESS_TOKEN } from './token.js';

@Global()
@Module({})
export class AuthModule {
  static forRoot(token: string | undefined): DynamicModule {
    return {
      module: AuthModule,
      providers: [{ provide: ACCESS_TOKEN, useValue: token }, { provide: APP_GUARD, useClass: BearerGuard }],
      exports: [ACCESS_TOKEN],
    };
  }
}
