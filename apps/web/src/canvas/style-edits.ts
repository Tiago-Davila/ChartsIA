import { FONT_SIZE_MAX, FONT_SIZE_MIN, type Style } from '@chartsia/core/model';

/** Algo con estilo que el panel puede cambiar: un elemento o una flecha. */
export interface StyleTarget {
  id: string;
  relation: boolean;
  style?: Style;
}

/** Cambio de estilo ya calculado para un objetivo; `null` borra su estilo. */
export interface StyleUpdate {
  id: string;
  relation: boolean;
  style: Style | null;
}

/** Colores fijos de la paleta del panel. */
export const PALETTE = [
  { name: 'Negro', value: '#000000' },
  { name: 'Blanco', value: '#ffffff' },
  { name: 'Gris', value: '#6b7280' },
  { name: 'Rojo', value: '#dc2626' },
  { name: 'Naranja', value: '#ea580c' },
  { name: 'Amarillo', value: '#facc15' },
  { name: 'Verde', value: '#16a34a' },
  { name: 'Azul', value: '#2563eb' },
  { name: 'Violeta', value: '#7c3aed' },
  { name: 'Rosa', value: '#db2777' },
] as const;

/** Valor de un campo del estilo si todos los objetivos coinciden; `undefined` si difieren o falta. */
export function commonValue<K extends keyof Style>(targets: StyleTarget[], field: K): Style[K] | undefined {
  const first = targets[0]?.style?.[field];
  return targets.every((t) => t.style?.[field] === first) ? first : undefined;
}

/** Estilo completo con un campo cambiado (`undefined` lo quita); `null` si queda vacío. */
export function withField<K extends keyof Style>(style: Style | undefined, field: K, value: Style[K] | undefined): Style | null {
  const { [field]: _old, ...rest } = style ?? {};
  const next: Style = value === undefined ? rest : { ...rest, [field]: value };
  return Object.keys(next).length === 0 ? null : next;
}

/** Cambios que ponen un campo en todos los objetivos conservando el resto del estilo de cada uno. */
export function fieldUpdates<K extends keyof Style>(targets: StyleTarget[], field: K, value: Style[K] | undefined): StyleUpdate[] {
  return targets.map((t) => ({ id: t.id, relation: t.relation, style: withField(t.style, field, value) }));
}

/** Cambios que borran el estilo de los objetivos que lo tienen. */
export function resetUpdates(targets: StyleTarget[]): StyleUpdate[] {
  return targets.filter((t) => t.style).map((t) => ({ id: t.id, relation: t.relation, style: null }));
}

/** Tamaño de fuente válido (entero de 8 a 48) a partir de un texto, o `undefined` si no es un número. */
export function parseFontSize(text: string): number | undefined {
  const n = Math.round(Number(text));
  if (text.trim() === '' || !Number.isFinite(n)) return undefined;
  return Math.min(FONT_SIZE_MAX, Math.max(FONT_SIZE_MIN, n));
}
