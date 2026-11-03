import { z } from 'zod';

export const EXPORT_FORMATS = ['svg', 'drawio', 'excalidraw'] as const;
export type ExportFormat = (typeof EXPORT_FORMATS)[number];

export const BACKGROUNDS = ['transparent', 'white'] as const;

/** Opciones que reciben los exportadores; cada formato usa las que tienen sentido en él. */
export const ExportSettingsSchema = z.strictObject({
  background: z.enum(BACKGROUNDS).describe('Fondo: white o transparent (SVG, draw.io y Excalidraw)'),
  margin: z.number().int().min(0).max(200).describe('Margen en px alrededor del diagrama (solo SVG)'),
  scale: z.number().min(0.25).max(4).describe('Escala del tamaño de la imagen, 1 es el tamaño original (solo SVG)'),
  includeTitle: z.boolean().describe('Dibujar el título del diagrama sobre la imagen (solo SVG)'),
});
export type ExportSettings = z.infer<typeof ExportSettingsSchema>;

/** Preferencias de exportación: las opciones más el formato que se usa si no se pide otro. */
export const ExportPreferencesSchema = ExportSettingsSchema.extend({
  format: z.enum(EXPORT_FORMATS).describe('Formato por defecto: svg, drawio o excalidraw'),
});
export type ExportPreferences = z.infer<typeof ExportPreferencesSchema>;

export const ExportPreferenceChangesSchema = ExportPreferencesSchema.partial();
export type ExportPreferenceChanges = z.infer<typeof ExportPreferenceChangesSchema>;

export const DEFAULT_EXPORT_SETTINGS: ExportSettings = { background: 'white', margin: 24, scale: 1, includeTitle: false };

export const DEFAULT_EXPORT_PREFERENCES: ExportPreferences = { format: 'svg', ...DEFAULT_EXPORT_SETTINGS };

/** Aplica los cambios sobre las preferencias de exportación actuales. */
export function mergeExportPreferences(base: ExportPreferences, changes: ExportPreferenceChanges): ExportPreferences {
  return { ...base, ...changes };
}
