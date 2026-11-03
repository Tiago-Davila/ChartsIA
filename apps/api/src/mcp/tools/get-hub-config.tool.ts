import { z } from 'zod';
import { type HubSettingsService } from '../../config/hub-settings.service.js';
import { defineTool } from './tool-definition.js';

export const getHubConfigTool = (settings: HubSettingsService) =>
  defineTool({
    name: 'get_hub_config',
    annotations: { title: 'Configuración del hub', readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false },
    description: [
      'Lee la configuración del hub de ChartsIA: carpeta de datos, máximo de elementos por diagrama (maxElements), si escucha en la red (network) y si hay cambios que esperan un reinicio (restartRequired).',
      'Sirve para saber cuántos elementos admite un diagrama antes de crearlo o para contarle a la persona dónde se guardan sus diagramas. Es solo de lectura: la configuración y el token se cambian desde la app, en Configuración > Hub y datos.',
      'Ejemplo de entrada: {}',
    ].join('\n'),
    input: z.strictObject({}),
    output: z.strictObject({ dataDir: z.string(), maxElements: z.number().int(), network: z.boolean(), restartRequired: z.boolean() }),
    run: async () => {
      const s = settings.get();
      const structured = { dataDir: s.dataDir.running, maxElements: s.maxElements.value, network: s.network.running, restartRequired: s.restartRequired };
      return {
        summary: `Carpeta de datos: ${structured.dataDir}. Máximo de elementos por diagrama: ${structured.maxElements}. Acceso desde la red: ${structured.network ? 'sí' : 'no'}.${structured.restartRequired ? ' Hay cambios guardados que se aplican al reiniciar el hub.' : ''}`,
        structured,
      };
    },
  });
