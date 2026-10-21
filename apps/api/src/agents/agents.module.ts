import { Module } from '@nestjs/common';
import { DiagramsModule } from '../diagrams/diagrams.module.js';
import { AgentRegistry } from './agent-registry.js';
import { AgentsController } from './agents.controller.js';

@Module({
  imports: [DiagramsModule],
  controllers: [AgentsController],
  providers: [AgentRegistry],
  exports: [AgentRegistry],
})
export class AgentsModule {}
