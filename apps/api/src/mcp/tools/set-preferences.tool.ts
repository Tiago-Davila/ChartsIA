import { ExportPreferenceChangesSchema, ExportPreferencesSchema } from '@chartsia/core/export';
import { PreferenceChangesSchema, PreferencesSchema } from '@chartsia/core/model';
import { type DiagramCommandService } from '../../diagrams/diagram-command.service.js';
import { defineTool } from './tool-definition.js';

export const setPreferencesTool = (commands: DiagramCommandService) =>
  defineTool({
    name: 'set_preferences',
    annotations: { title: 'Preferencias de diagrama y exportación', readOnlyHint: false, destructiveHint: false, idempotentHint: true, openWorldHint: false },
    description: [
      'Lee o cambia las preferencias de la persona. De diagrama: dirección del layout (down o right), espacio entre elementos y entre capas (compact, normal o wide), fuente y colores por tipo de elemento (palette), detalle UML (uml: types, visibility, multiplicities, methods) y leyenda C4 (c4Legend).',
      'De exportación (campo export): formato por defecto (format: svg, drawio o excalidraw), fondo (background: white o transparent), margen en px (margin, solo SVG), escala (scale, solo SVG) e includeTitle para dibujar el título sobre la imagen (solo SVG). export_diagram las usa cuando no se le pasan otras.',
      'Solo envía los campos que cambian; los demás se conservan. Con {} no cambia nada y devuelve las preferencias actuales. En palette, un tipo con colores {"fillColor","borderColor","fontColor"} (#rrggbb) reemplaza los suyos y null los quita.',
      'Las de diagrama se guardan en el hub y se aplican a los diagramas que se creen después, también a lo que se agregue a ellos; los diagramas existentes no cambian. Las de exportación valen para las exportaciones siguientes. Úsala solo si la persona pide un cambio de preferencias; para ajustar un diagrama ya creado usa apply_changes.',
      'Ejemplo de entrada: {"direction":"right","uml":{"methods":false},"export":{"background":"transparent"}}',
    ].join('\n'),
    input: PreferenceChangesSchema.extend({ export: ExportPreferenceChangesSchema.optional() }),
    output: PreferencesSchema.extend({ export: ExportPreferencesSchema }),
    run: async ({ export: exportChanges, ...changes }) => {
      const preferences = { ...(await commands.setPreferences(changes)), export: await commands.setExportPreferences(exportChanges) };
      return {
        summary: `Preferencias guardadas; las de diagrama valen para los diagramas nuevos y las de exportación para las exportaciones siguientes.\n${JSON.stringify(preferences)}`,
        structured: preferences as unknown as Record<string, unknown>,
      };
    },
  });
