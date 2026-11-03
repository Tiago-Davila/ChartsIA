import { Injectable } from '@nestjs/common';
import { exportDiagram, type ExportFormat, type ExportSettings } from '@chartsia/core/export';
import { DiagramQueryService } from './diagram-query.service.js';
import { PreferencesService } from './preferences.service.js';

/** Tamaño máximo del contenido devuelto en línea por MCP; por encima solo se da la URL. */
export const MAX_INLINE_EXPORT_BYTES = 512 * 1024;

export interface ExportOutput {
  diagramId: string;
  format: ExportFormat;
  mimeType: string;
  filename: string;
  content: string;
  /** El contenido supera `MAX_INLINE_EXPORT_BYTES`: los adaptadores lo omiten. */
  tooLargeToInline: boolean;
}

@Injectable()
export class ExportService {
  constructor(
    private readonly query: DiagramQueryService,
    private readonly preferences: PreferencesService,
  ) {}

  /** Exporta con las preferencias guardadas; el formato y las opciones del pedido tienen prioridad. */
  async export(params: { diagramId?: string; format?: ExportFormat; settings?: Partial<ExportSettings> }): Promise<ExportOutput> {
    const diagram = await this.query.require(params.diagramId);
    const { format, ...saved } = await this.preferences.getExport();
    const result = exportDiagram(diagram, params.format ?? format, { ...saved, ...params.settings });
    return {
      diagramId: diagram.id,
      format: result.format,
      mimeType: result.mimeType,
      filename: result.filename,
      content: result.content,
      tooLargeToInline: Buffer.byteLength(result.content, 'utf8') > MAX_INLINE_EXPORT_BYTES,
    };
  }
}
