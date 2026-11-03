import { Module } from '@nestjs/common';
import { HealthController } from './health.controller.js';
import { HubController } from './hub.controller.js';

@Module({ controllers: [HealthController, HubController] })
export class HealthModule {}
