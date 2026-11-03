import { type ExportFormat, type ExportSettings } from '@chartsia/core/export';
import { type AppConfig } from '../config/config.js';

/** URLs públicas del hub; las construyen los adaptadores (MCP, REST), nunca el dominio. */
export class PublicUrls {
  constructor(private readonly config: Pick<AppConfig, 'publicUrl'>) {}

  view(diagramId: string): string {
    return `${this.config.publicUrl}/d/${encodeURIComponent(diagramId)}`;
  }

  /** Enlace de descarga; las opciones recibidas viajan en la URL y las demás salen de las preferencias guardadas. */
  download(diagramId: string, format: ExportFormat, settings: Partial<ExportSettings> = {}): string {
    const query = new URLSearchParams({ format, ...Object.fromEntries(Object.entries(settings).map(([key, value]) => [key, String(value)])) });
    return `${this.config.publicUrl}/api/diagrams/${encodeURIComponent(diagramId)}/export?${query}`;
  }
}
