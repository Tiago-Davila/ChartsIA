import { Body, Controller, Get, HttpCode, Post, Res } from '@nestjs/common';
import { type Response } from 'express';
import { z } from 'zod';
import { DomainValidationError, fromZodError } from '@chartsia/core/validation';
import { type BackupImportResult, ConflictPolicySchema } from './backup.js';
import { DiagramCommandService } from './diagram-command.service.js';
import { DiagramQueryService } from './diagram-query.service.js';

const ImportBodySchema = z.strictObject({ backup: z.unknown(), onConflict: ConflictPolicySchema.optional() });

/** Respaldo de todos los diagramas y proyectos en un archivo JSON, y su importación. */
@Controller('api/backup')
export class BackupController {
  constructor(
    private readonly query: DiagramQueryService,
    private readonly commands: DiagramCommandService,
  ) {}

  @Get()
  async export(@Res() res: Response): Promise<void> {
    const backup = await this.query.backup();
    res
      .status(200)
      .setHeader('Content-Type', 'application/json; charset=utf-8')
      .setHeader('Content-Disposition', `attachment; filename="chartsia-respaldo-${backup.exportedAt.slice(0, 10)}.json"`)
      .setHeader('X-Content-Type-Options', 'nosniff')
      .send(JSON.stringify(backup, null, 2));
  }

  /** Importa todo o nada; si hay ids repetidos responde 409 hasta que se elija `replace` o `skip`. */
  @Post('import')
  @HttpCode(200)
  import(@Body() body: unknown): Promise<BackupImportResult> {
    const parsed = ImportBodySchema.safeParse(body ?? {});
    if (!parsed.success) throw new DomainValidationError(fromZodError(parsed.error));
    return this.commands.importBackup(parsed.data.backup, parsed.data.onConflict);
  }
}
