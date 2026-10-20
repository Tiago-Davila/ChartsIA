import roughModule from 'roughjs';
import { type RoughGenerator } from 'roughjs/bin/generator.js';
import { type Primitive } from '../shapes/types.js';

// roughjs es CommonJS en Node y ESM en el navegador: se normaliza el export por defecto.
// Tipado estructural: TypeScript ve el export por defecto distinto según la resolución (NodeNext/Bundler).
type Rough = { generator(): RoughGenerator };
const rough = ((roughModule as unknown as { default?: Rough }).default ?? roughModule) as unknown as Rough;
const generator = rough.generator();

function roundedRectPath(x: number, y: number, w: number, h: number, rx: number): string {
  const r = Math.min(rx, w / 2, h / 2);
  return [
    `M ${x + r} ${y}`, `L ${x + w - r} ${y}`, `Q ${x + w} ${y} ${x + w} ${y + r}`,
    `L ${x + w} ${y + h - r}`, `Q ${x + w} ${y + h} ${x + w - r} ${y + h}`,
    `L ${x + r} ${y + h}`, `Q ${x} ${y + h} ${x} ${y + h - r}`,
    `L ${x} ${y + r}`, `Q ${x} ${y} ${x + r} ${y}`, 'Z',
  ].join(' ');
}

const r = (n: number) => Math.round(n * 100) / 100;
const compact = (d: string) => d.replace(/-?\d+\.\d+/g, (n) => String(r(Number(n))));

/**
 * Convierte primitivas limpias en trazos a mano alzada con roughjs (estilo Excalidraw). La
 * semilla se deriva del id del elemento: el mismo diagrama produce siempre el mismo boceto.
 * El texto no se toca; lo dibuja la fuente Excalifont.
 */
export function sketchPrimitives(primitives: Primitive[], seed: number): Primitive[] {
  const out: Primitive[] = [];
  primitives.forEach((p, i) => {
    if (p.type === 'text') {
      out.push(p);
      return;
    }
    const hasFill = 'fill' in p && p.fill !== undefined && p.fill !== 'none';
    const options = {
      seed: seed + i,
      roughness: 1,
      bowing: 1,
      stroke: p.stroke && p.stroke !== 'none' ? p.stroke : 'none',
      strokeWidth: p.strokeWidth ?? 1,
      ...(hasFill ? { fill: p.fill, fillStyle: 'solid' } : {}),
      ...(p.dash ? { strokeLineDash: p.dash } : {}),
      preserveVertices: true,
    };
    const drawable =
      p.type === 'rect'
        ? p.rx
          ? generator.path(roundedRectPath(p.x, p.y, p.width, p.height, p.rx), options)
          : generator.rectangle(p.x, p.y, p.width, p.height, options)
        : p.type === 'ellipse'
          ? generator.ellipse(p.cx, p.cy, p.rx * 2, p.ry * 2, options)
          : p.type === 'line'
            ? generator.line(p.x1, p.y1, p.x2, p.y2, options)
            : generator.path(p.d, options);
    for (const path of generator.toPaths(drawable)) {
      const isFill = path.fill !== undefined && path.fill !== 'none' && (path.stroke === 'none' || path.strokeWidth === 0);
      out.push({
        type: 'path',
        d: compact(path.d),
        fill: path.fill && path.fill !== 'none' ? path.fill : 'none',
        stroke: isFill ? 'none' : path.stroke,
        strokeWidth: path.strokeWidth,
        ...(p.dash && !isFill ? { dash: p.dash } : {}),
      });
    }
  });
  return out;
}
