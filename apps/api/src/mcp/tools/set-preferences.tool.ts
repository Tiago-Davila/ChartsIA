import { PreferenceChangesSchema, PreferencesSchema } from '@chartsia/core/model';
import { type DiagramCommandService } from '../../diagrams/diagram-command.service.js';
import { defineTool } from './tool-definition.js';

export const setPreferencesTool = (commands: DiagramCommandService) =>
  defineTool({
    name: 'set_preferences',
    annotations: { title: 'Preferencias de diagrama', readOnlyHint: false, destructiveHint: false, idempotentHint: true, openWorldHint: false },
    description: [
      'Lee o cambia las preferencias de diagrama de la persona: dirección del layout (down o right), espacio entre elementos y entre capas (compact, normal o wide), fuente y colores por tipo de elemento (palette), detalle UML (uml: types, visibility, multiplicities, methods) y leyenda C4 (c4Legend).',
      'Solo envía los campos que cambian; los demás se conservan. Con {} no cambia nada y devuelve las preferencias actuales. En palette, un tipo con colores {"fillColor","borderColor","fontColor"} (#rrggbb) reemplaza los suyos y null los quita.',
      'Las preferencias se guardan en el hub y se aplican a los diagramas que se creen después, también a lo que se agregue a ellos; los diagramas existentes no cambian. Úsala solo si la persona pide un cambio de preferencias; para ajustar un diagrama ya creado usa apply_changes.',
      'Ejemplo de entrada: {"direction":"right","uml":{"methods":false}}',
    ].join('\n'),
    input: PreferenceChangesSchema,
    output: PreferencesSchema,
    run: async (changes) => {
      const preferences = await commands.setPreferences(changes);
      return {
        summary: `Preferencias de diagrama guardadas; valen para los diagramas nuevos.\n${JSON.stringify(preferences)}`,
        structured: preferences as unknown as Record<string, unknown>,
      };
    },
  });
