import { type FlowVariant } from '../../model/enums.js';

/** Color del ícono y fondo suave de su recuadro, por variante de nodo de flujo. */
export const FLOW_PALETTE: Record<FlowVariant, { accent: string; tint: string }> = {
  component: { accent: '#2563eb', tint: '#dbeafe' },
  file: { accent: '#475569', tint: '#e2e8f0' },
  method: { accent: '#7c3aed', tint: '#ede9fe' },
  service: { accent: '#0891b2', tint: '#cffafe' },
  database: { accent: '#059669', tint: '#d1fae5' },
  queue: { accent: '#d97706', tint: '#fef3c7' },
  trigger: { accent: '#ea580c', tint: '#ffedd5' },
  decision: { accent: '#be185d', tint: '#fce7f3' },
  external: { accent: '#4b5563', tint: '#f3f4f6' },
};
