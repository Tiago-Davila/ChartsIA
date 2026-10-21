import { type Point } from '../model/common.js';
import { type Diagram, type Element } from '../model/diagram.js';
import { type Cardinality, isGroupKind } from '../model/enums.js';
import { type Relation } from '../model/relation.js';
import { hashSeed } from '../render/hash.js';
import { edgeLabelLines } from '../render/edges.js';
import { c4Colors, C4_PALETTE } from '../shapes/c4/palette.js';
import { boxGeometry } from '../shapes/uml/compartments.js';
import { classBox } from '../shapes/uml/class.js';
import { enumBox } from '../shapes/uml/enum.js';
import { interfaceBox } from '../shapes/uml/interface.js';
import { WEAK_GAP } from '../shapes/er/entity.js';
import { CIRCLE_RADIUS, crowFoot, isCardinality, markerFrame, relationStyle, type MarkerKind } from '../shapes/uml/markers.js';
import { orderKeys } from './fractional-index.js';

type Json = Record<string, unknown>;
type Box = { x: number; y: number; width: number; height: number };

const ARROWHEADS: Record<Exclude<MarkerKind, Cardinality>, string> = {
  'triangle-hollow': 'triangle_outline',
  'diamond-filled': 'diamond',
  'diamond-hollow': 'diamond_outline',
  'arrow-open': 'arrow',
  'arrow-filled': 'triangle',
};
/** Excalifont: el archivo conserva el aspecto a mano alzada propio de Excalidraw. */
const FONT_FAMILY = 5;
const r = (n: number) => Math.round(n * 100) / 100;

class Builder {
  readonly elements: Json[] = [];
  private readonly updated: number;
  constructor(private readonly diagram: Diagram) {
    this.updated = Date.parse(diagram.updatedAt) || 0;
  }

  private base(id: string, type: string, box: Box, extra: Json): Json {
    return {
      id, type, x: r(box.x), y: r(box.y), width: r(box.width), height: r(box.height), angle: 0,
      strokeColor: '#1e1e1e', backgroundColor: 'transparent', fillStyle: 'solid', strokeWidth: 1,
      strokeStyle: 'solid', roughness: 1, opacity: 100, groupIds: [],
      frameId: null, roundness: null, seed: hashSeed(id), version: 1, versionNonce: hashSeed(`${id}#v`),
      isDeleted: false, boundElements: null, updated: this.updated, link: null, locked: false, ...extra,
    };
  }

  shape(id: string, type: 'rectangle' | 'ellipse', box: Box, extra: Json = {}): Json {
    const el = this.base(id, type, box, extra);
    this.elements.push(el);
    return el;
  }

  line(id: string, from: Point, to: Point, extra: Json = {}): void {
    this.elements.push(this.base(id, 'line', { x: from.x, y: from.y, width: Math.abs(to.x - from.x), height: Math.abs(to.y - from.y) }, {
      points: [[0, 0], [r(to.x - from.x), r(to.y - from.y)]], lastCommittedPoint: null, startBinding: null, endBinding: null,
      startArrowhead: null, endArrowhead: null, ...extra,
    }));
  }

  text(id: string, text: string, box: Box, extra: Json = {}): Json {
    const fontSize = (extra.fontSize as number | undefined) ?? 14;
    const el = this.base(id, 'text', box, {
      text, originalText: text, fontSize, fontFamily: FONT_FAMILY, textAlign: 'left', verticalAlign: 'top',
      containerId: null, autoResize: true, lineHeight: 1.25, strokeColor: '#1e1e1e', ...extra,
    });
    this.elements.push(el);
    return el;
  }

  /** Texto ligado a un contenedor: el contenedor declara el vínculo en `boundElements`. */
  boundText(container: Json, text: string, extra: Json = {}): void {
    const id = `${container.id as string}-label`;
    const lines = text.split('\n').length;
    const fontSize = (extra.fontSize as number | undefined) ?? 14;
    const height = lines * fontSize * 1.25;
    this.text(id, text, { x: (container.x as number) + 8, y: (container.y as number) + 8, width: (container.width as number) - 16, height }, {
      textAlign: 'center', verticalAlign: 'middle', containerId: container.id, ...extra,
    });
    container.boundElements = [...((container.boundElements as Json[] | null) ?? []), { type: 'text', id }];
  }
}

function addUml(b: Builder, el: Element, box: Box): void {
  const compartments = el.kind === 'class' ? classBox(el) : el.kind === 'interface' ? interfaceBox(el) : el.kind === 'enum' ? enumBox(el) : undefined;
  if (!compartments) return;
  const group = [`${el.id}-group`];
  const rect = b.shape(el.id, 'rectangle', box, { backgroundColor: '#fffef5', groupIds: group });
  const g = boxGeometry(compartments);
  b.boundText(rect, compartments.header.map((l) => l.text).join('\n'), { verticalAlign: 'top', fontSize: 14, groupIds: group });
  g.sections.forEach((section, s) => {
    b.line(`${el.id}-sep-${s}`, { x: box.x, y: box.y + section.top }, { x: box.x + box.width, y: box.y + section.top }, { groupIds: group });
    section.lines.forEach((line, i) => {
      b.text(`${el.id}-${line.line.slot ?? `${s}-${i}`}`, line.line.text, { x: box.x + 10, y: box.y + line.y, width: box.width - 20, height: line.height }, { fontSize: 13, groupIds: group });
    });
  });
}

function addC4(b: Builder, el: Element, box: Box): void {
  if (el.kind === 'boundary') {
    b.shape(el.id, 'rectangle', box, { strokeStyle: 'dashed', strokeColor: C4_PALETTE.boundary.stroke, roundness: { type: 3 } });
    const type = { enterprise: '[Enterprise]', system: '[Software System]', container: '[Container]' }[el.boundaryType];
    b.text(`${el.id}-title`, `${el.name}\n${type}`, { x: box.x + 12, y: box.y + 10, width: box.width - 24, height: 40 }, { fontSize: 14, strokeColor: C4_PALETTE.boundary.text });
    return;
  }
  if (el.kind !== 'person' && el.kind !== 'software-system' && el.kind !== 'container' && el.kind !== 'component') return;
  const external = 'external' in el ? el.external : undefined;
  const c = c4Colors(el.kind, external);
  const paint = { backgroundColor: c.fill, strokeColor: c.stroke, roundness: { type: 3 } };
  const type =
    el.kind === 'person' ? (external ? 'Person - External' : 'Person')
      : el.kind === 'software-system' ? (external ? 'Software System - External' : 'Software System')
        : `${el.kind === 'container' ? 'Container' : 'Component'}${'technology' in el && el.technology ? `: ${el.technology}` : ''}`;
  const label = [el.name, `[${type}]`, ...(el.description ? ['', el.description] : [])].join('\n');
  const group = [`${el.id}-group`];
  if (el.kind === 'person') {
    const head = 56;
    b.shape(`${el.id}-head`, 'ellipse', { x: box.x + box.width / 2 - head / 2, y: box.y, width: head, height: head }, { ...paint, groupIds: group });
    const body = b.shape(el.id, 'rectangle', { x: box.x, y: box.y + head - 14, width: box.width, height: box.height - head + 14 }, { ...paint, groupIds: group });
    b.boundText(body, label, { strokeColor: c.text, groupIds: group });
    return;
  }
  const rect = b.shape(el.id, 'rectangle', box, paint);
  b.boundText(rect, label, { strokeColor: c.text });
  if (el.kind === 'container' && el.variant === 'database') {
    b.shape(`${el.id}-cap`, 'ellipse', { x: box.x, y: box.y - 9, width: box.width, height: 18 }, { ...paint });
  }
}

function addEr(b: Builder, el: Element, box: Box): void {
  if (el.kind !== 'entity') return;
  const rect = b.shape(el.id, 'rectangle', box, { backgroundColor: '#fffef5' });
  b.boundText(rect, el.name, { fontSize: 14 });
  if (el.weak) {
    const inner = { x: box.x + WEAK_GAP, y: box.y + WEAK_GAP, width: box.width - WEAK_GAP * 2, height: box.height - WEAK_GAP * 2 };
    b.shape(`${el.id}-inner`, 'rectangle', inner, {});
  }
}

/** Marca pata de gallo como líneas y un círculo, porque Excalidraw no tiene cero-o-uno nativo. */
function addCardinality(b: Builder, rel: Relation, kind: Cardinality, tag: string, tip: Point, from: Point, color: string): void {
  const { lines, circle } = crowFoot(kind, markerFrame(tip, from));
  lines.forEach((l, i) => b.line(`${rel.id}-${tag}-${i}`, l[0], l[1], { strokeColor: color, strokeWidth: 1.5 }));
  if (circle) {
    const box = { x: circle.x - CIRCLE_RADIUS, y: circle.y - CIRCLE_RADIUS, width: CIRCLE_RADIUS * 2, height: CIRCLE_RADIUS * 2 };
    b.shape(`${rel.id}-${tag}-o`, 'ellipse', box, { strokeColor: color, backgroundColor: '#ffffff', strokeWidth: 1.5 });
  }
}

function addArrow(b: Builder, rel: Relation, byId: Map<string, Json>): void {
  const route = rel.route ?? [];
  if (route.length < 2) return;
  const style = relationStyle(rel);
  const origin = route[0]!;
  const xs = route.map((p) => p.x);
  const ys = route.map((p) => p.y);
  const binding = (elementId: string) => ({ elementId, focus: 0, gap: 1 });
  const arrow = b.shape(rel.id, 'rectangle', { x: origin.x, y: origin.y, width: Math.max(...xs) - Math.min(...xs), height: Math.max(...ys) - Math.min(...ys) }, {
    type: 'arrow',
    strokeColor: style.color,
    strokeStyle: style.dash ? 'dashed' : 'solid',
    points: route.map((p) => [r(p.x - origin.x), r(p.y - origin.y)]),
    lastCommittedPoint: null,
    startBinding: byId.has(rel.source) ? binding(rel.source) : null,
    endBinding: byId.has(rel.target) ? binding(rel.target) : null,
    startArrowhead: style.start && !isCardinality(style.start) ? ARROWHEADS[style.start] : null,
    endArrowhead: style.end && !isCardinality(style.end) ? ARROWHEADS[style.end] : null,
    elbowed: false,
  });
  for (const id of [rel.source, rel.target]) {
    const target = byId.get(id);
    if (target) target.boundElements = [...((target.boundElements as Json[] | null) ?? []), { type: 'arrow', id: rel.id }];
  }
  if (style.start && isCardinality(style.start)) addCardinality(b, rel, style.start, 'src', route[0]!, route[1]!, style.color);
  if (style.end && isCardinality(style.end)) addCardinality(b, rel, style.end, 'dst', route[route.length - 1]!, route[route.length - 2]!, style.color);
  const lines = edgeLabelLines(rel);
  if (lines.length > 0) b.boundText(arrow, lines.join('\n'), { fontSize: 12 });
}

/**
 * Exporta a Excalidraw (`.excalidraw`). Formas con texto ligado (`containerId` /
 * `boundElements`), flechas con `startBinding`/`endBinding` y puntos de la ruta calculada.
 * Semillas e índices se derivan de los ids, así el archivo es determinista.
 */
export function exportExcalidraw(diagram: Diagram): string {
  const b = new Builder(diagram);
  const groupsFirst = [...diagram.elements].sort((a, c) => Number(!isGroupKind(a.kind)) - Number(!isGroupKind(c.kind)) || (a.id < c.id ? -1 : 1));
  for (const el of groupsFirst) {
    const l = el.layout;
    if (!l || l.width === undefined || l.height === undefined) continue;
    const box = { x: l.x, y: l.y, width: l.width, height: l.height };
    if (diagram.type === 'class') {
      if (el.kind === 'package') {
        b.shape(el.id, 'rectangle', box, {});
        b.text(`${el.id}-title`, el.name, { x: box.x + 10, y: box.y + 6, width: box.width - 20, height: 20 }, { fontSize: 14 });
      } else addUml(b, el, box);
    } else if (diagram.type === 'er') addEr(b, el, box);
    else addC4(b, el, box);
  }
  const byId = new Map(b.elements.filter((e) => diagram.elements.some((d) => d.id === e.id)).map((e) => [e.id as string, e]));
  for (const rel of [...diagram.relations].sort((a, c) => (a.id < c.id ? -1 : 1))) addArrow(b, rel, byId);

  const keys = orderKeys(b.elements.length);
  const elements = b.elements.map((e, i) => ({ ...e, index: keys[i] }));
  return JSON.stringify(
    { type: 'excalidraw', version: 2, source: 'https://github.com/chartsia/chartsia', elements, appState: { gridSize: 20, viewBackgroundColor: '#ffffff' }, files: {} },
    null,
    2,
  ) + '\n';
}
