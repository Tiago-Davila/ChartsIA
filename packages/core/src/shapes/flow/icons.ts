import { type FlowVariant } from '../../model/enums.js';
import { type Primitive } from '../types.js';

/** Lado de la cuadrícula en que se dibujan los íconos. */
const GRID = 24;

type IconPart = { path: string } | { ellipse: [cx: number, cy: number, rx: number, ry: number] } | { rect: [x: number, y: number, width: number, height: number, rx: number] };

const ICONS: Record<FlowVariant, IconPart[]> = {
  component: [{ path: 'M12 3 L20 7.5 L20 16.5 L12 21 L4 16.5 L4 7.5 Z' }, { path: 'M4 7.5 L12 12 L20 7.5' }, { path: 'M12 12 L12 21' }],
  file: [{ path: 'M6 3 L14 3 L19 8 L19 21 L6 21 Z' }, { path: 'M14 3 L14 8 L19 8' }, { path: 'M9 13 L16 13' }, { path: 'M9 17 L16 17' }],
  method: [
    { path: 'M10 4 C7 4 8 8 8 10 C8 11.5 6 12 5 12 C6 12 8 12.5 8 14 C8 16 7 20 10 20' },
    { path: 'M14 4 C17 4 16 8 16 10 C16 11.5 18 12 19 12 C18 12 16 12.5 16 14 C16 16 17 20 14 20' },
  ],
  service: [{ rect: [4, 4, 16, 7, 2] }, { rect: [4, 13, 16, 7, 2] }, { path: 'M8 7.5 L8.5 7.5' }, { path: 'M8 16.5 L8.5 16.5' }],
  database: [
    { ellipse: [12, 6, 7, 3] },
    { path: 'M5 6 L5 18 C5 19.7 8.1 21 12 21 C15.9 21 19 19.7 19 18 L19 6' },
    { path: 'M5 12 C5 13.7 8.1 15 12 15 C15.9 15 19 13.7 19 12' },
  ],
  queue: [{ path: 'M4 6 L14 6' }, { path: 'M4 12 L14 12' }, { path: 'M4 18 L14 18' }, { path: 'M17 8 L21 12 L17 16' }],
  trigger: [{ path: 'M13 3 L5 13 L11 13 L10 21 L19 10 L13 10 Z' }],
  decision: [{ path: 'M12 21 L12 12' }, { path: 'M12 12 L6 5' }, { path: 'M12 12 L18 5' }, { path: 'M6 9 L6 5 L10 5' }, { path: 'M14 5 L18 5 L18 9' }],
  external: [{ ellipse: [12, 12, 9, 9] }, { path: 'M3 12 L21 12' }, { path: 'M12 3 C8 7 8 17 12 21 C16 17 16 7 12 3' }],
};

/** Escala y desplaza las coordenadas absolutas de un trazado cuyos comandos (M, L, C y Z) llevan pares x, y. */
function movePath(d: string, scale: number, dx: number, dy: number): string {
  let count = 0;
  return d.replace(/\d+(\.\d+)?/g, (number) => String(Math.round((Number(number) * scale + (count++ % 2 === 0 ? dx : dy)) * 100) / 100));
}

/** Ícono de una variante como trazos de `color`, dentro del cuadrado de lado `size` con esquina en (x, y). */
export function flowIconPrimitives(variant: FlowVariant, color: string, x: number, y: number, size: number): Primitive[] {
  const scale = size / GRID;
  const stroke = { stroke: color, strokeWidth: Math.round(1.8 * scale * 100) / 100, lineCap: 'round' as const, lineJoin: 'round' as const };
  return ICONS[variant].map((part): Primitive => {
    if ('path' in part) return { type: 'path', d: movePath(part.path, scale, x, y), fill: 'none', ...stroke };
    if ('ellipse' in part) {
      const [cx, cy, rx, ry] = part.ellipse;
      return { type: 'ellipse', cx: x + cx * scale, cy: y + cy * scale, rx: rx * scale, ry: ry * scale, fill: 'none', ...stroke };
    }
    const [rx0, ry0, width, height, radius] = part.rect;
    return { type: 'rect', x: x + rx0 * scale, y: y + ry0 * scale, width: width * scale, height: height * scale, rx: radius * scale, fill: 'none', ...stroke };
  });
}
