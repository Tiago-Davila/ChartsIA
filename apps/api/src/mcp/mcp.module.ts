import { Module } from '@nestjs/common';
import { AgentsModule } from '../agents/agents.module.js';
import { DiagramsModule } from '../diagrams/diagrams.module.js';
import { McpServerFactory } from './mcp-server.factory.js';
import { McpController } from './mcp.controller.js';
import { ToolResultFormatter } from './tool-result.js';

@Module({
  imports: [DiagramsModule, AgentsModule],
  controllers: [McpController],
  providers: [McpServerFactory, ToolResultFormatter],
  exports: [McpServerFactory],
})
export class McpModule {}
