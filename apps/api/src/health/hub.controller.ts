import { Controller, Get, Inject } from '@nestjs/common';
import { APP_CONFIG, type AppConfig } from '../config/config.js';
import { VERSION } from '../version.js';

/** Datos del hub que muestra la sección General de la configuración; exige token fuera de loopback. */
@Controller('api/hub')
export class HubController {
  constructor(@Inject(APP_CONFIG) private readonly config: AppConfig) {}

  @Get()
  info(): { version: string; port: number; dataDir: string } {
    return { version: VERSION, port: this.config.port, dataDir: this.config.dataDir };
  }
}
