import { type DynamicModule, Module } from '@nestjs/common';
import { type AppConfig, loadConfig } from './config/config.js';
import { ConfigModule } from './config/config.module.js';
import { HealthModule } from './health/health.module.js';

@Module({})
export class AppModule {
  static forRoot(config: AppConfig = loadConfig()): DynamicModule {
    return {
      module: AppModule,
      imports: [ConfigModule.forRoot(config), HealthModule],
    };
  }
}
