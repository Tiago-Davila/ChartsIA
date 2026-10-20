import { type DynamicModule, Module } from '@nestjs/common';
import { APP_FILTER } from '@nestjs/core';
import { AuthModule } from './auth/auth.module.js';
import { DomainExceptionFilter } from './common/domain-exception.filter.js';
import { type AppConfig, loadConfig } from './config/config.js';
import { ConfigModule } from './config/config.module.js';
import { DiagramsModule } from './diagrams/diagrams.module.js';
import { HealthModule } from './health/health.module.js';
import { LiveModule } from './live/live.module.js';
import { McpModule } from './mcp/mcp.module.js';
import { WebStaticModule } from './web/web-static.module.js';

export interface AppModuleOptions {
  config?: AppConfig;
  /** Token exigido (fuera de loopback); `undefined` desactiva la autenticación. */
  token?: string;
}

@Module({})
export class AppModule {
  static forRoot({ config = loadConfig(), token }: AppModuleOptions = {}): DynamicModule {
    return {
      module: AppModule,
      imports: [
        ConfigModule.forRoot(config),
        AuthModule.forRoot(token),
        HealthModule,
        DiagramsModule,
        LiveModule,
        McpModule,
        WebStaticModule.forRoot(config.webDistDir),
      ],
      providers: [{ provide: APP_FILTER, useClass: DomainExceptionFilter }],
    };
  }
}
