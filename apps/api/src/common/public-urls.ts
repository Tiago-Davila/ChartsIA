import { type ExportFormat } from '@chartsia/core/export';
import { type DiagramStyle } from '@chartsia/core/model';
import { type AppConfig } from '../config/config.js';

/** URLs públicas del hub; las construyen los adaptadores (MCP, REST), nunca el dominio. */
export class PublicUrls {
  constructor(private readonly config: Pick<AppConfig, 'publicUrl'>) {}

  view(diagramId: string): string {
    return `${this.config.publicUrl}/d/${encodeURIComponent(diagramId)}`;
  }

  download(diagramId: string, format: ExportFormat, style?: DiagramStyle): string {
    const query = new URLSearchParams({ format, ...(style ? { style } : {}) });
    return `${this.config.publicUrl}/api/diagrams/${encodeURIComponent(diagramId)}/export?${query}`;
  }
}
