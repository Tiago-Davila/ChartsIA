import { Controller, Get } from '@nestjs/common';
import { AgentRegistry, type ConnectedAgent } from './agent-registry.js';

/** Agentes MCP que se han conectado al hub; lo consume la pantalla de configuración. */
@Controller('api/agents')
export class AgentsController {
  constructor(private readonly registry: AgentRegistry) {}

  @Get()
  list(): { agents: ConnectedAgent[] } {
    return { agents: this.registry.list() };
  }
}
