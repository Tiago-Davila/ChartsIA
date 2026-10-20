import { Inject, Injectable } from '@nestjs/common';
import { type CallToolResult } from '@modelcontextprotocol/sdk/types.js';
import { type ExportFormat } from '@chartsia/core/export';
import { type DiagramStyle } from '@chartsia/core/model';
import { type ValidationError } from '@chartsia/core/validation';
import { PublicUrls } from '../common/public-urls.js';
import { APP_CONFIG, type AppConfig } from '../config/config.js';

export interface ToolSuccess {
  structured: Record<string, unknown>;
  summary: string;
  /** Diagrama modificado: añade el enlace al SVG renderizado (principio I). */
  linkDiagramId?: string;
  title?: string;
}

/**
 * Da forma a los resultados de las herramientas (contrato mcp-tools): contenido estructurado,
 * resumen legible con `viewUrl` y, en errores, `isError` con la lista de errores accionables.
 * Construir URLs públicas es responsabilidad de este adaptador, no del dominio.
 */
@Injectable()
export class ToolResultFormatter {
  private readonly urls: PublicUrls;

  constructor(@Inject(APP_CONFIG) config: Pick<AppConfig, 'publicUrl'>) {
    this.urls = new PublicUrls(config);
  }

  viewUrl(diagramId: string): string {
    return this.urls.view(diagramId);
  }

  downloadUrl(diagramId: string, format: ExportFormat, style?: DiagramStyle): string {
    return this.urls.download(diagramId, format, style);
  }

  success(result: ToolSuccess): CallToolResult {
    const content: CallToolResult['content'] = [{ type: 'text', text: result.summary }];
    if (result.linkDiagramId) {
      content.push({
        type: 'resource_link',
        uri: `chartsia://diagrams/${result.linkDiagramId}/export.svg`,
        name: `${result.linkDiagramId}.svg`,
        title: result.title ? `${result.title} (SVG)` : 'Diagrama renderizado (SVG)',
        mimeType: 'image/svg+xml',
      });
    }
    return { content, structuredContent: result.structured };
  }

  failure(errors: ValidationError[]): CallToolResult {
    const lines = errors.map((e) => `- ${e.code} en ${e.path || '/'}: ${e.message} Sugerencia: ${e.hint}`);
    return {
      isError: true,
      content: [{ type: 'text', text: `No se aplicó ningún cambio. Corrige estos errores y vuelve a intentarlo:\n${lines.join('\n')}` }],
      structuredContent: { errors },
    };
  }
}
