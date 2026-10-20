import { Module } from '@nestjs/common';
import { DiagramsModule } from '../diagrams/diagrams.module.js';
import { LiveGateway } from './live.gateway.js';

@Module({ imports: [DiagramsModule], providers: [LiveGateway] })
export class LiveModule {}
