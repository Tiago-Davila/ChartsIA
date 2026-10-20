import { Controller, Get, Param, Query, Res } from '@nestjs/common';
import { type Response } from 'express';
import { z } from 'zod';
import { EXPORT_FORMATS } from '@chartsia/core/export';
import { DomainValidationError, fromZodError } from '@chartsia/core/validation';
import { ExportService } from './export.service.js';

const ExportQuerySchema = z.object({ format: z.enum(EXPORT_FORMATS) });

@Controller('api/diagrams')
export class ExportController {
  constructor(private readonly exports: ExportService) {}

  @Get(':id/export')
  async export(@Param('id') id: string, @Query() query: unknown, @Res() res: Response): Promise<void> {
    const parsed = ExportQuerySchema.safeParse(query);
    if (!parsed.success) throw new DomainValidationError(fromZodError(parsed.error, '/query'));
    const out = await this.exports.export({ diagramId: id, ...parsed.data });
    res
      .status(200)
      .setHeader('Content-Type', `${out.mimeType}; charset=utf-8`)
      .setHeader('Content-Disposition', `attachment; filename="${out.filename}"`)
      .setHeader('X-Content-Type-Options', 'nosniff')
      .setHeader('Content-Security-Policy', "default-src 'none'; style-src 'unsafe-inline'")
      .send(out.content);
  }
}
