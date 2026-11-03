import { Body, Controller, Get, HttpCode, Post, Put } from '@nestjs/common';
import { type HubSettings, HubSettingsService } from '../config/hub-settings.service.js';

/** Configuración del hub que edita la sección "Hub y datos"; exige token fuera de loopback. */
@Controller('api/hub')
export class HubConfigController {
  constructor(private readonly settings: HubSettingsService) {}

  @Get('config')
  get(): HubSettings {
    return this.settings.get();
  }

  /** Guarda cambios parciales y devuelve la configuración completa. */
  @Put('config')
  set(@Body() body: unknown): Promise<HubSettings> {
    return this.settings.update(body);
  }

  /** Crea un token nuevo; vale desde el próximo arranque del hub. */
  @Post('token')
  @HttpCode(200)
  regenerateToken(): Promise<HubSettings> {
    return this.settings.regenerateToken();
  }
}
