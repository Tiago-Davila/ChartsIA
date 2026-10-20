import { Controller, Get } from '@nestjs/common';
import { Public } from '../auth/bearer.guard.js';
import { VERSION } from '../version.js';

@Public()
@Controller('api/health')
export class HealthController {
  @Get()
  health(): { status: 'ok'; version: string } {
    return { status: 'ok', version: VERSION };
  }
}
