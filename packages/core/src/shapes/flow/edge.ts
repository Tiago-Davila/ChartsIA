import { type FlowEdgeType } from '../../model/enums.js';
import { type RelationStyle } from '../uml/markers.js';

/**
 * Trazo de cada tipo de conexión de flujo. En `read` la punta va en el origen: los datos
 * vuelven a quien lee; en `write` va en el destino.
 */
export const FLOW_EDGE_STYLES: Record<FlowEdgeType, Omit<RelationStyle, 'width'>> = {
  call: { color: '#3e4c59', end: 'arrow-filled' },
  import: { color: '#7b8794', dash: [2, 4], end: 'arrow-open' },
  read: { color: '#2563eb', start: 'arrow-open' },
  write: { color: '#c2410c', end: 'arrow-filled' },
  event: { color: '#7c3aed', dash: [8, 4], end: 'arrow-open' },
  data: { color: '#0f766e', dash: [10, 3, 2, 3], end: 'arrow-filled' },
};
