import { Module } from '@nestjs/common';
import { HubSettingsService } from '../config/hub-settings.service.js';
import { PersistenceModule } from '../diagrams/persistence/persistence.module.js';
import { HealthController } from './health.controller.js';
import { HubConfigController } from './hub-config.controller.js';
import { HubController } from './hub.controller.js';

@Module({
  imports: [PersistenceModule],
  controllers: [HealthController, HubController, HubConfigController],
  providers: [HubSettingsService],
  exports: [HubSettingsService],
})
export class HealthModule {}
