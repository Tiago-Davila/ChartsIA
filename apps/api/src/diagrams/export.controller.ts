import { Controller, Get, Param, Query, Res } from '@nestjs/common';
import { type Response } from 'express';
import { ExportPreferenceChangesSchema } from '@chartsia/core/export';
import { DomainValidationError, fromZodError } from '@chartsia/core/validation';
import { ExportService } from './export.service.js';

/** Toma de la query solo las opciones de exportación y pasa "10" a número y "true" a booleano. */
function exportOptionsFrom(query: unknown): Record<string, unknown> {
  const values = (query ?? {}) as Record<string, unknown>;
  return Object.fromEntries(
    Object.keys(ExportPreferenceChangesSchema.shape)
      .filter((key) => key in values)
      .map((key) => {
        const value = values[key];
        return [key, value === 'true' ? true : value === 'false' ? false : typeof value === 'string' && value !== '' && !Number.isNaN(Number(value)) ? Number(value) : value];
      }),
  );
}

@Controller('api/diagrams')
export class ExportController {
  constructor(private readonly exports: ExportService) {}

  @Get(':id/export')
  async export(@Param('id') id: string, @Query() query: unknown, @Res() res: Response): Promise<void> {
    const parsed = ExportPreferenceChangesSchema.safeParse(exportOptionsFrom(query));
    if (!parsed.success) throw new DomainValidationError(fromZodError(parsed.error, '/query'));
    const { format, ...settings } = parsed.data;
    const out = await this.exports.export({ diagramId: id, format, settings });
    res
      .status(200)
      .setHeader('Content-Type', `${out.mimeType}; charset=utf-8`)
      .setHeader('Content-Disposition', `attachment; filename="${out.filename}"`)
      .setHeader('X-Content-Type-Options', 'nosniff')
      .setHeader('Content-Security-Policy', "default-src 'none'; style-src 'unsafe-inline'")
      .send(out.content);
  }
}
