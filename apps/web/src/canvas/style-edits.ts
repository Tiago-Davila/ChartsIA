import { DRAWING_WIDTH_PX, FONT_SIZE_MAX, FONT_SIZE_MIN, HIGHLIGHTER_WIDTH_PX, LINE_WIDTHS, type Style, type StyleLineWidth } from '@chartsia/core/model';

/** Algo con estilo que el panel puede cambiar: un elemento o una flecha. */
export interface StyleTarget {
  id: string;
  relation: boolean;
  style?: Style;
}

/** Trazo del lápiz o del marcador seleccionado: solo el panel de grosor lo cambia. */
export interface DrawingTarget {
  id: string;
  strokeWidth: number;
  highlighter?: boolean;
}

/** Tabla de grosores en px según el trazo sea de lápiz o de marcador. */
function widthTable(d: DrawingTarget): Record<StyleLineWidth, number> {
  return d.highlighter ? HIGHLIGHTER_WIDTH_PX : DRAWING_WIDTH_PX;
}

/** Cambio ya calculado para un objetivo: su estilo (`null` lo borra) o el grosor de un trazo. */
export type StyleUpdate = { id: string; relation: boolean; style: Style | null } | { id: string; relation: false; strokeWidth: number };

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

/** Nombre en español de cada grosor. */
export const WIDTH_LABELS: Record<StyleLineWidth, string> = { thin: 'Fino', medium: 'Medio', thick: 'Grueso' };

/** Grosor que muestra el panel si todos los objetivos y trazos coinciden; sin estilo cuenta como medio. */
export function commonWidth(targets: StyleTarget[], drawings: DrawingTarget[]): StyleLineWidth | undefined {
  const widths = [
    ...targets.map((t) => t.style?.lineWidth ?? 'medium'),
    ...drawings.map((d) => LINE_WIDTHS.find((name) => widthTable(d)[name] === d.strokeWidth)),
  ];
  return widths.every((w) => w === widths[0]) ? widths[0] : undefined;
}

/** Cambios que ponen un grosor: `lineWidth` en el estilo de los objetivos y `strokeWidth` en los trazos. */
export function widthUpdates(targets: StyleTarget[], drawings: DrawingTarget[], width: StyleLineWidth): StyleUpdate[] {
  return [
    ...fieldUpdates(targets, 'lineWidth', width),
    ...drawings.map((d): StyleUpdate => ({ id: d.id, relation: false, strokeWidth: widthTable(d)[width] })),
  ];
}

/** Estilo guardado por "Copiar estilo"; vive en memoria del módulo, así sobrevive a cerrar el menú. */
let copied: Style | undefined;

/** Guarda el estilo del objetivo para pegarlo después; un objetivo sin estilo guarda uno vacío. */
export function copyStyleOf(target: StyleTarget): void {
  copied = target.style ?? {};
}

/** Estilo copiado por última vez, o `undefined` si todavía no se copió ninguno. */
export function copiedStyle(): Style | undefined {
  return copied;
}

/** Cambios que pegan el estilo: cada objetivo queda con ese estilo completo; de los trazos solo se toma el grosor. */
export function pasteUpdates(targets: StyleTarget[], drawings: DrawingTarget[], style: Style): StyleUpdate[] {
  const next = Object.keys(style).length === 0 ? null : style;
  return [
    ...targets.map((t): StyleUpdate => ({ id: t.id, relation: t.relation, style: next })),
    ...(style.lineWidth ? widthUpdates([], drawings, style.lineWidth) : []),
  ];
}
