/** Paleta C4 de referencia (C4-PlantUML / `mxC4` de draw.io). */
export const C4_PALETTE = {
  person: { fill: '#08427B', stroke: '#073B6F', text: '#ffffff' },
  'software-system': { fill: '#1168BD', stroke: '#0B4884', text: '#ffffff' },
  container: { fill: '#438DD5', stroke: '#3C7FC0', text: '#ffffff' },
  component: { fill: '#85BBF0', stroke: '#78A8D8', text: '#000000' },
  external: { fill: '#999999', stroke: '#8A8A8A', text: '#ffffff' },
  boundary: { fill: 'none', stroke: '#444444', text: '#444444' },
} as const;

export type C4PaletteKey = keyof typeof C4_PALETTE;

export function c4Colors(kind: 'person' | 'software-system' | 'container' | 'component', external?: boolean) {
  return external ? C4_PALETTE.external : C4_PALETTE[kind];
}
