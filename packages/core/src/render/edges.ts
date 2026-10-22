import { type Point } from '../model/common.js';
import { type Relation } from '../model/relation.js';
import { type Style } from '../model/style.js';
import { MARKER_LENGTH, markerPrimitives, relationStyle } from '../shapes/uml/markers.js';
import { textFont } from '../shapes/style.js';
import { lineHeight, measureText } from '../shapes/text-metrics.js';
import { FONT, type Primitive } from '../shapes/types.js';

const r = (n: number) => Math.round(n * 100) / 100;

function pathOf(points: Point[]): string {
  return points.map((p, i) => `${i === 0 ? 'M' : 'L'} ${r(p.x)} ${r(p.y)}`).join(' ');
}

/** Acorta el extremo `end` de la polilínea en `by` px (para que la línea no cruce el marcador). */
function trim(points: Point[], end: 'start' | 'end', by: number): Point[] {
  const pts = end === 'start' ? [...points] : [...points].reverse();
  const [a, b] = [pts[0]!, pts[1]!];
  const len = Math.hypot(b.x - a.x, b.y - a.y);
  if (len > by) pts[0] = { x: a.x + ((b.x - a.x) / len) * by, y: a.y + ((b.y - a.y) / len) * by };
  return end === 'start' ? pts : pts.reverse();
}

/** Punto medio del tramo más largo: donde se coloca la etiqueta. */
export function labelAnchor(points: Point[]): Point {
  let best = 0;
  let bestLen = -1;
  for (let i = 0; i + 1 < points.length; i++) {
    const len = Math.abs(points[i + 1]!.x - points[i]!.x) + Math.abs(points[i + 1]!.y - points[i]!.y);
    if (len > bestLen) {
      bestLen = len;
      best = i;
    }
  }
  const a = points[best]!;
  const b = points[best + 1] ?? a;
  return { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
}

export function edgeLabelLines(rel: Relation): string[] {
  const lines: string[] = [];
  if (rel.label) lines.push(rel.label);
  if (rel.kind === 'c4-rel' && rel.technology) lines.push(`[${rel.technology}]`);
  return lines;
}

function labelPrimitives(lines: string[], at: Point, color: string, slot: string, style?: Style): Primitive[] {
  if (lines.length === 0) return [];
  const font = textFont(style, FONT.small);
  const lh = lineHeight(font.size);
  const width = Math.max(...lines.map((l) => measureText(l, font))) + 8;
  const height = lh * lines.length + 4;
  const top = at.y - height / 2;
  return [
    { type: 'rect', x: r(at.x - width / 2), y: r(top), width: r(width), height: r(height), rx: 3, fill: '#ffffff', stroke: 'none' },
    ...lines.map((text, i): Primitive => ({
      type: 'text', x: r(at.x), y: r(top + 2 + lh * (i + 0.75)), text, ...font, color, anchor: 'middle', ...(i === 0 ? { slot } : {}),
    })),
  ];
}

function multiplicity(text: string | undefined, port: Point, next: Point, color: string, slot: string, style?: Style): Primitive[] {
  if (!text) return [];
  const horizontal = port.y === next.y;
  const dx = horizontal ? Math.sign(next.x - port.x) * 10 : 6;
  const dy = horizontal ? -6 : Math.sign(next.y - port.y) * 14;
  return [{ type: 'text', x: r(port.x + dx), y: r(port.y + dy), text, ...textFont(style, FONT.small), color, anchor: horizontal && dx < 0 ? 'end' : 'start', slot }];
}

/** Primitivas absolutas de una relación: línea, marcadores, etiqueta y multiplicidades. */
export function edgePrimitives(rel: Relation): Primitive[] {
  const route = rel.route ?? [];
  if (route.length < 2) return [];
  const style = relationStyle(rel);
  let line = route;
  if (style.start) line = trim(line, 'start', MARKER_LENGTH[style.start]);
  if (style.end) line = trim(line, 'end', MARKER_LENGTH[style.end]);
  const out: Primitive[] = [
    { type: 'path', d: pathOf(line), fill: 'none', stroke: style.color, strokeWidth: style.width, ...(style.dash ? { dash: style.dash } : {}) },
  ];
  if (style.start) out.push(...markerPrimitives(style.start, route[0]!, route[1]!, style.color, style.fill, style.width));
  if (style.end) out.push(...markerPrimitives(style.end, route[route.length - 1]!, route[route.length - 2]!, style.color, style.fill, style.width));
  const text = rel.style?.fontColor ?? '#333333';
  out.push(...labelPrimitives(edgeLabelLines(rel), labelAnchor(route), text, 'label', rel.style));
  out.push(...multiplicity(rel.sourceMultiplicity, route[0]!, route[1]!, text, 'sourceMultiplicity', rel.style));
  out.push(...multiplicity(rel.targetMultiplicity, route[route.length - 1]!, route[route.length - 2]!, text, 'targetMultiplicity', rel.style));
  return out;
}
