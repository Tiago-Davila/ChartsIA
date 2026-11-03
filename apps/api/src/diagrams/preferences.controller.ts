import { Body, Controller, Get, Put } from '@nestjs/common';
import { type Preferences } from '@chartsia/core/model';
import { DiagramCommandService } from './diagram-command.service.js';

/** API de preferencias de la app: misma ruta de escritura que la herramienta `set_preferences`. */
@Controller('api/preferences')
export class PreferencesController {
  constructor(private readonly commands: DiagramCommandService) {}

  @Get()
  get(): Promise<Preferences> {
    return this.commands.getPreferences();
  }

  /** Aplica cambios parciales y devuelve las preferencias completas. */
  @Put()
  set(@Body() body: unknown): Promise<Preferences> {
    return this.commands.setPreferences(body);
  }
}
