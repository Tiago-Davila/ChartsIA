import { type Layout } from '../model/common.js';
import { type Diagram, type Element } from '../model/diagram.js';
import { isGroupKind } from '../model/enums.js';
import { groupPadding } from '../shapes/registry.js';
import { type Size } from '../shapes/types.js';
import { removeOverlaps } from './overlap-removal.js';
import { type LayoutBox, r2, type Rect } from './types.js';

export interface ArrangeInput {
  diagram: Diagram;
  /** Posición tentativa absoluta de cada elemento. */
  positions: Map<string, Rect>;
  /** Tamaño mínimo (natural) de cada elemento. */
  sizes: Map<string, Size>;
  pinned: Set<string>;
  /** Bloqueados: se tratan como fijados, pero no se guardan como `pinned`. */
  locked?: Set<string>;
  isNew?: Set<string>;
}

/**
 * Resuelve solapes nivel a nivel (hermanos con el mismo padre), de abajo arriba, y ajusta
 * cada grupo para que contenga a sus hijos. Mover un grupo desplaza a sus descendientes.
 */
export function arrange({ diagram, positions, sizes, pinned, locked, isNew }: ArrangeInput): { layouts: Map<string, Layout>; warnings: string[] } {
  const rects = new Map([...positions].map(([id, r]) => [id, { ...r }]));
  const children = new Map<string | undefined, Element[]>();
  const ids = new Set(diagram.elements.map((e) => e.id));
  for (const el of diagram.elements) {
    const parent = el.parentId && ids.has(el.parentId) ? el.parentId : undefined;
    const list = children.get(parent) ?? [];
    list.push(el);
    children.set(parent, list);
  }
  const warnings: string[] = [];

  const translate = (id: string, dx: number, dy: number) => {
    for (const child of children.get(id) ?? []) {
      const r = rects.get(child.id)!;
      r.x += dx;
      r.y += dy;
      translate(child.id, dx, dy);
    }
  };

  const fitGroup = (group: Element) => {
    const kids = children.get(group.id) ?? [];
    const rect = rects.get(group.id)!;
    const min = sizes.get(group.id)!;
    if (kids.length === 0) {
      rect.width = Math.max(rect.width, min.width);
      rect.height = Math.max(rect.height, min.height);
      return;
    }
    const pad = groupPadding(group);
    const k = kids.map((c) => rects.get(c.id)!);
    const left = Math.min(...k.map((r) => r.x));
    const top = Math.min(...k.map((r) => r.y));
    const right = Math.max(...k.map((r) => r.x + r.width));
    const bottom = Math.max(...k.map((r) => r.y + r.height));
    if (pinned.has(group.id)) {
      // El grupo fijado no se mueve: si algún hijo invade su cabecera, se desplazan los hijos.
      const dx = Math.max(0, rect.x + pad.left - left);
      const dy = Math.max(0, rect.y + pad.top - top);
      if (dx || dy) for (const c of kids) {
        const r = rects.get(c.id)!;
        r.x += dx;
        r.y += dy;
        translate(c.id, dx, dy);
      }
      rect.width = Math.max(min.width, right + dx + pad.right - rect.x);
      rect.height = Math.max(min.height, bottom + dy + pad.bottom - rect.y);
      return;
    }
    rect.x = left - pad.left;
    rect.y = top - pad.top;
    rect.width = Math.max(min.width, right - left + pad.left + pad.right);
    rect.height = Math.max(min.height, bottom - top + pad.top + pad.bottom);
  };

  const level = (parent: string | undefined) => {
    const kids = [...(children.get(parent) ?? [])].sort((a, b) => (a.id < b.id ? -1 : 1));
    for (const kid of kids) {
      if (isGroupKind(kid.kind)) {
        level(kid.id);
        fitGroup(kid);
      }
    }
    // Los trazos son anotaciones superpuestas: nunca desplazan figuras ni grupos vecinos.
    const boxes: LayoutBox[] = kids
      .filter((k) => k.kind !== 'drawing')
      .map((k) => ({ id: k.id, ...rects.get(k.id)!, pinned: pinned.has(k.id), isNew: isNew?.has(k.id) ?? false }));
    const result = removeOverlaps(boxes);
    warnings.push(...result.warnings);
    for (const box of result.boxes) {
      const r = rects.get(box.id)!;
      const dx = box.x - r.x;
      const dy = box.y - r.y;
      if (dx || dy) {
        r.x = box.x;
        r.y = box.y;
        translate(box.id, dx, dy);
      }
    }
  };
  level(undefined);

  const layouts = new Map<string, Layout>();
  for (const [id, r] of rects) {
    layouts.set(id, { x: r2(r.x), y: r2(r.y), width: r2(r.width), height: r2(r.height), pinned: pinned.has(id) && !locked?.has(id) });
  }
  return { layouts, warnings };
}
