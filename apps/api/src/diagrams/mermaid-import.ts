import { importMermaidClassDiagram, MermaidImportError, type MermaidImportResult } from '@chartsia/core/import';
import { DomainValidationError, validationError } from '@chartsia/core/validation';

/** Adapta errores de sintaxis del importador al contrato común REST/MCP del hub. */
export function parseMermaidImport(source: string, title?: string): MermaidImportResult {
  try {
    return importMermaidClassDiagram(source, title);
  } catch (error) {
    if (!(error instanceof MermaidImportError)) throw error;
    const message = error.line ? 'Línea ' + error.line + ': ' + error.message : error.message;
    throw new DomainValidationError([
      validationError(
        'SCHEMA_VIOLATION',
        '/source',
        'No se pudo importar el diagrama Mermaid. ' + message,
        'Corrige la sintaxis classDiagram indicada. Se aceptan hasta 256 Ki caracteres; las directivas visuales se omiten y las interactivas nunca se ejecutan.',
      ),
    ]);
  }
}
