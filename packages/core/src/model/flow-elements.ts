import { z } from 'zod';
import { elementBaseShape } from './common.js';
import { FLOW_VARIANTS } from './enums.js';

/** Nodo de flujo: tarjeta con ícono según su variante, título (`name`) y subtítulo opcional (ruta, firma, tabla, endpoint). */
export const FlowNodeElementSchema = z.strictObject({
  ...elementBaseShape,
  kind: z.literal('flow-node'),
  variant: z.enum(FLOW_VARIANTS).describe('component, file, method, service, database, queue, trigger, decision o external'),
  subtitle: z.string().min(1).max(200).optional().describe('Texto bajo el título, p. ej. la ruta del archivo, la firma del método o el endpoint'),
});
