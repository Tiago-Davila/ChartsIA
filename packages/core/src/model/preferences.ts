import { z } from 'zod';
import type { Element } from './diagram.js';
import type { Relation } from './relation.js';
import { FONT_FAMILIES, StyleSchema } from './style.js';

export const DIRECTIONS = ['down', 'right'] as const;
export const SPACINGS = ['compact', 'normal', 'wide'] as const;

/** Tipos de elemento a los que se les puede asignar una paleta por defecto. */
export const PALETTE_KINDS = [
  'class', 'interface', 'enum', 'package',
  'person', 'software-system', 'container', 'component', 'boundary',
  'entity', 'table', 'collection',
] as const;
export type PaletteKind = (typeof PALETTE_KINDS)[number];

const PaletteColorsSchema = StyleSchema.pick({ fillColor: true, borderColor: true, fontColor: true });

/** Un esquema opcional por cada tipo de elemento de la paleta. */
function perKind<T extends z.ZodType>(schema: T) {
  return z.strictObject(Object.fromEntries(PALETTE_KINDS.map((kind) => [kind, schema])) as Record<PaletteKind, T>);
}

export const UmlDetailSchema = z.strictObject({
  types: z.boolean().describe('Mostrar los tipos de atributos, parámetros y retornos'),
  visibility: z.boolean().describe('Mostrar el símbolo de visibilidad (+, -, #, ~)'),
  multiplicities: z.boolean().describe('Mostrar las multiplicidades de las relaciones'),
  methods: z.boolean().describe('Mostrar el compartimento de métodos'),
});
export type UmlDetail = z.infer<typeof UmlDetailSchema>;

/** Preferencias de diagrama: se aplican a los diagramas nuevos y quedan guardadas en cada uno. */
export const PreferencesSchema = z.strictObject({
  direction: z.enum(DIRECTIONS).describe('Sentido del layout: down (arriba a abajo) o right (izquierda a derecha)'),
  elementSpacing: z.enum(SPACINGS).describe('Espacio entre elementos de una misma capa'),
  layerSpacing: z.enum(SPACINGS).describe('Espacio entre capas'),
  fontFamily: z.enum(['default', ...FONT_FAMILIES]).describe('Fuente de los elementos nuevos; default deja la de siempre'),
  palette: perKind(PaletteColorsSchema.optional()).describe('Colores por defecto de cada tipo de elemento'),
  uml: UmlDetailSchema,
  c4Legend: z.boolean().describe('Mostrar la leyenda en los diagramas C4'),
});
export type Preferences = z.infer<typeof PreferencesSchema>;

/** Cambios parciales: `palette` acepta null en un tipo para quitar sus colores. */
export const PreferenceChangesSchema = PreferencesSchema.omit({ palette: true, uml: true })
  .extend({ palette: perKind(PaletteColorsSchema.nullable().optional()), uml: UmlDetailSchema.partial() })
  .partial();
export type PreferenceChanges = z.infer<typeof PreferenceChangesSchema>;

export const DEFAULT_UML_DETAIL: UmlDetail = { types: true, visibility: true, multiplicities: true, methods: true };

export const DEFAULT_PREFERENCES: Preferences = {
  direction: 'down',
  elementSpacing: 'normal',
  layerSpacing: 'normal',
  fontFamily: 'default',
  palette: {},
  uml: DEFAULT_UML_DETAIL,
  c4Legend: true,
};

/** Aplica los cambios sobre las preferencias actuales; el resultado sigue siendo completo. */
export function mergePreferences(base: Preferences, changes: PreferenceChanges): Preferences {
  const palette = { ...base.palette };
  for (const [kind, colors] of Object.entries(changes.palette ?? {}) as [PaletteKind, Preferences['palette'][PaletteKind] | null | undefined][]) {
    if (colors === null) delete palette[kind];
    else if (colors) palette[kind] = colors;
  }
  return { ...base, ...changes, palette, uml: { ...base.uml, ...changes.uml } } as Preferences;
}

/** Al elemento nuevo le suma la fuente y los colores de las preferencias; su propio estilo manda. */
export function styleElement<E extends Element>(element: E, prefs: Preferences): E {
  if (element.kind === 'drawing' || element.kind === 'image') return element;
  const palette = (PALETTE_KINDS as readonly string[]).includes(element.kind) ? prefs.palette[element.kind as PaletteKind] : undefined;
  const base = { ...palette, ...(prefs.fontFamily === 'default' ? {} : { fontFamily: prefs.fontFamily }) };
  if (Object.keys(base).length === 0) return element;
  return { ...element, style: { ...base, ...element.style } };
}

/** A la relación nueva le suma la fuente de las preferencias; su propio estilo manda. */
export function styleRelation(relation: Relation, prefs: Preferences): Relation {
  if (prefs.fontFamily === 'default') return relation;
  return { ...relation, style: { fontFamily: prefs.fontFamily, ...relation.style } };
}

/** Contenido de un diagrama nuevo con las preferencias aplicadas: estilo de cada elemento y relación, y las preferencias guardadas en él. */
export function withPreferences<T extends { elements: Element[]; relations: Relation[] }>(content: T, prefs: Preferences): T & { preferences: Preferences } {
  return {
    ...content,
    elements: content.elements.map((el) => styleElement(el, prefs)),
    relations: content.relations.map((rel) => styleRelation(rel, prefs)),
    preferences: prefs,
  };
}
