import { type LayoutBox, overlapsWithGap, type Rect } from './types.js';

/** Separación mínima entre cajas que el algoritmo mueve. */
export const NODE_GAP = 24;
const NEAREST_CANDIDATES = 12;

function priority(a: LayoutBox, b: LayoutBox): number {
  return Number(a.isNew ?? false) - Number(b.isNew ?? false) || (a.id < b.id ? -1 : a.id > b.id ? 1 : 0);
}

function distance2(a: Rect, b: Rect): number {
  const dx = a.x + a.width / 2 - (b.x + b.width / 2);
  const dy = a.y + a.height / 2 - (b.y + b.height / 2);
  return dx * dx + dy * dy;
}

function isFree(box: Rect, settled: Rect[], gap: number): boolean {
  return settled.every((s) => !overlapsWithGap(box, s, gap));
}

/** Busca la posición libre más cercana a la deseada, probando bordes de las cajas vecinas. */
function nearestFree(box: LayoutBox, settled: LayoutBox[]): { x: number; y: number } {
  const near = [...settled].sort((a, b) => distance2(a, box) - distance2(b, box) || priority(a, b)).slice(0, NEAREST_CANDIDATES);
  const xs = new Set([box.x]);
  const ys = new Set([box.y]);
  for (const s of near) {
    xs.add(s.x + s.width + NODE_GAP);
    xs.add(s.x - box.width - NODE_GAP);
    xs.add(s.x);
    ys.add(s.y + s.height + NODE_GAP);
    ys.add(s.y - box.height - NODE_GAP);
    ys.add(s.y);
  }
  const candidates: { x: number; y: number; d: number }[] = [];
  for (const x of xs) for (const y of ys) candidates.push({ x, y, d: (x - box.x) ** 2 + (y - box.y) ** 2 });
  candidates.sort((a, b) => a.d - b.d || a.y - b.y || a.x - b.x);
  for (const c of candidates) {
    if (isFree({ ...box, x: c.x, y: c.y }, settled, NODE_GAP)) return { x: c.x, y: c.y };
  }
  // Sin hueco cerca: debajo de todo, alineado a la izquierda de la posición deseada.
  const bottom = Math.max(...settled.map((s) => s.y + s.height));
  return { x: box.x, y: bottom + NODE_GAP };
}

/**
 * Elimina solapes entre cajas hermanas (FR-019, R7). Las fijadas nunca se mueven; las demás
 * conservan su posición salvo que solapen, y en ese caso se desplazan lo mínimo. Las nuevas
 * ceden ante las existentes. Determinista: el orden lo fija el id, no el de entrada.
 */
export function removeOverlaps(input: LayoutBox[]): { boxes: LayoutBox[]; warnings: string[] } {
  const warnings: string[] = [];
  const pinned = input.filter((b) => b.pinned).sort(priority);
  const movable = input.filter((b) => !b.pinned).sort(priority);

  for (let i = 0; i < pinned.length; i++) {
    for (let j = i + 1; j < pinned.length; j++) {
      if (overlapsWithGap(pinned[i]!, pinned[j]!, 0)) {
        warnings.push(`Los elementos fijados "${pinned[i]!.id}" y "${pinned[j]!.id}" se solapan; muévelos con move_element.`);
      }
    }
  }

  const settled: LayoutBox[] = [...pinned];
  const deferred: LayoutBox[] = [];
  for (const box of movable) {
    // Los existentes solo ceden si realmente se solapan; a los nuevos se les exige hueco.
    const gap = box.isNew ? NODE_GAP / 2 : 0;
    if (isFree(box, settled, gap)) settled.push(box);
    else deferred.push(box);
  }
  const moved = new Map<string, LayoutBox>();
  for (const box of deferred) {
    const pos = nearestFree(box, settled);
    const placed = { ...box, ...pos };
    settled.push(placed);
    moved.set(box.id, placed);
  }
  return { boxes: input.map((b) => moved.get(b.id) ?? b), warnings };
}
