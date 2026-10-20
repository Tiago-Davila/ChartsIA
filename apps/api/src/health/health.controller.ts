import { Controller, Get } from '@nestjs/common';
import { VERSION } from '../version.js';

@Controller('api/health')
export class HealthController {
  @Get()
  health(): { status: 'ok'; version: string } {
    return { status: 'ok', version: VERSION };
  }
}
