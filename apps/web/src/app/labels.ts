import { type DiagramType, type FlowVariant } from '@chartsia/core/model';

export const DIAGRAM_TYPE_LABELS: Record<DiagramType, string> = {
  class: 'Clases',
  'c4-context': 'C4 · Contexto',
  'c4-container': 'C4 · Contenedores',
  'c4-component': 'C4 · Componentes',
  er: 'Entidad-relación',
  nosql: 'NoSQL · Documentos',
  flow: 'Flujo de sistema',
};

export const FLOW_VARIANT_LABELS: Record<FlowVariant, string> = {
  component: 'Componente',
  file: 'Archivo',
  method: 'Método',
  service: 'Servicio',
  database: 'Base de datos',
  queue: 'Cola',
  trigger: 'Disparador',
  decision: 'Decisión',
  external: 'Externo',
};

const dateFormat = new Intl.DateTimeFormat('es', { dateStyle: 'short', timeStyle: 'short' });

export function formatDate(iso: string): string {
  const date = new Date(iso);
  return Number.isNaN(date.getTime()) ? '' : dateFormat.format(date);
}
