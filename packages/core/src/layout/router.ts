import { type Point } from '../model/common.js';
import { type Side } from '../model/enums.js';
import { type Rect, r2 } from './types.js';

export interface RouteRequest {
  id: string;
  source: string;
  target: string;
  sourceSide?: Side;
  targetSide?: Side;
  waypoints?: Point[];
}

const MARGIN = 10;
const STUB = 16;
const BEND_COST = 40;
const WINDOW = 240;

const NORMAL: Record<Side, Point> = { top: { x: 0, y: -1 }, bottom: { x: 0, y: 1 }, left: { x: -1, y: 0 }, right: { x: 1, y: 0 } };

function center(r: Rect): Point {
  return { x: r.x + r.width / 2, y: r.y + r.height / 2 };
}

function chooseSides(s: Rect, t: Rect): [Side, Side] {
  if (t.y >= s.y + s.height) return ['bottom', 'top'];
  if (t.y + t.height <= s.y) return ['top', 'bottom'];
  if (t.x >= s.x + s.width) return ['right', 'left'];
  if (t.x + t.width <= s.x) return ['left', 'right'];
  return ['right', 'right'];
}

function portAt(r: Rect, side: Side, fraction: number): Point {
  switch (side) {
    case 'top':
      return { x: r.x + r.width * fraction, y: r.y };
    case 'bottom':
      return { x: r.x + r.width * fraction, y: r.y + r.height };
    case 'left':
      return { x: r.x, y: r.y + r.height * fraction };
    case 'right':
      return { x: r.x + r.width, y: r.y + r.height * fraction };
  }
}

/** Punto del borde del óvalo inscrito en `r` que queda en línea con el puerto `at` de su caja. */
function ovalPoint(r: Rect, side: Side, at: Point): Point {
  const vertical = side === 'top' || side === 'bottom';
  const offset = vertical ? (at.x - (r.x + r.width / 2)) / (r.width / 2) : (at.y - (r.y + r.height / 2)) / (r.height / 2);
  const inset = (vertical ? r.height / 2 : r.width / 2) * (1 - Math.sqrt(Math.max(0, 1 - offset * offset)));
  switch (side) {
    case 'top':
      return { x: at.x, y: r.y + inset };
    case 'bottom':
      return { x: at.x, y: r.y + r.height - inset };
    case 'left':
      return { x: r.x + inset, y: at.y };
    case 'right':
      return { x: r.x + r.width - inset, y: at.y };
  }
}

interface Obstacle extends Rect {
  id: string;
  /** Rectángulo real del nodo, sin margen. */
  core: Rect;
}

/** Índice espacial de cubos para consultar obstáculos por punto. */
class Buckets {
  private readonly cells = new Map<string, Obstacle[]>();
  constructor(private readonly obstacles: Obstacle[], private readonly size = 160) {
    for (const o of obstacles) {
      for (let cx = Math.floor(o.x / size); cx <= Math.floor((o.x + o.width) / size); cx++) {
        for (let cy = Math.floor(o.y / size); cy <= Math.floor((o.y + o.height) / size); cy++) {
          const key = `${cx}:${cy}`;
          const list = this.cells.get(key) ?? [];
          list.push(o);
          this.cells.set(key, list);
        }
      }
    }
  }
  blocked(x: number, y: number, exempt: Set<string>): boolean {
    const list = this.cells.get(`${Math.floor(x / this.size)}:${Math.floor(y / this.size)}`);
    if (!list) return false;
    // A un obstáculo eximido (un extremo cae en su margen) se le permite cruzar el margen,
    // pero nunca el nodo en sí.
    return list.some((o) => inside({ x, y }, exempt.has(o.id) ? o.core : o));
  }
  near(window: Rect): Obstacle[] {
    return this.obstacles.filter(
      (o) => o.x < window.x + window.width && o.x + o.width > window.x && o.y < window.y + window.height && o.y + o.height > window.y,
    );
  }
}

/** Montículo binario mínimo por coste. */
class Heap<T> {
  private readonly items: { cost: number; value: T }[] = [];
  get size(): number {
    return this.items.length;
  }
  push(cost: number, value: T): void {
    const items = this.items;
    items.push({ cost, value });
    let i = items.length - 1;
    while (i > 0) {
      const p = (i - 1) >> 1;
      if (items[p]!.cost <= cost) break;
      [items[i], items[p]] = [items[p]!, items[i]!];
      i = p;
    }
  }
  pop(): T {
    const items = this.items;
    const top = items[0]!;
    const last = items.pop()!;
    if (items.length > 0) {
      items[0] = last;
      let i = 0;
      for (;;) {
        const l = i * 2 + 1;
        const r = l + 1;
        let m = i;
        if (l < items.length && items[l]!.cost < items[m]!.cost) m = l;
        if (r < items.length && items[r]!.cost < items[m]!.cost) m = r;
        if (m === i) break;
        [items[i], items[m]] = [items[m]!, items[i]!];
        i = m;
      }
    }
    return top.value;
  }
}

const sortedUnique = (values: number[]) => [...new Set(values.map(r2))].sort((a, b) => a - b);

/** A* sobre la rejilla de visibilidad ortogonal, penalizando los giros. */
function searchPath(start: Point, goal: Point, obstacles: Obstacle[], buckets: Buckets, exempt: Set<string>): Point[] | undefined {
  const minX = Math.min(start.x, goal.x, ...obstacles.map((o) => o.x)) - 40;
  const maxX = Math.max(start.x, goal.x, ...obstacles.map((o) => o.x + o.width)) + 40;
  const minY = Math.min(start.y, goal.y, ...obstacles.map((o) => o.y)) - 40;
  const maxY = Math.max(start.y, goal.y, ...obstacles.map((o) => o.y + o.height)) + 40;
  const xs = sortedUnique([minX, maxX, start.x, goal.x, ...obstacles.flatMap((o) => [o.x, o.x + o.width])]);
  const ys = sortedUnique([minY, maxY, start.y, goal.y, ...obstacles.flatMap((o) => [o.y, o.y + o.height])]);
  const xi = new Map(xs.map((x, i) => [x, i]));
  const yi = new Map(ys.map((y, i) => [y, i]));
  const sx = xi.get(r2(start.x))!;
  const sy = yi.get(r2(start.y))!;
  const gx = xi.get(r2(goal.x))!;
  const gy = yi.get(r2(goal.y))!;
  const W = xs.length;
  const key = (ix: number, iy: number, dir: number) => (iy * W + ix) * 5 + dir;
  const best = new Map<number, number>();
  const prev = new Map<number, number>();
  const heap = new Heap<[number, number, number, number]>();
  const h = (ix: number, iy: number) => Math.abs(xs[ix]! - goal.x) + Math.abs(ys[iy]! - goal.y);
  const startKey = key(sx, sy, 4);
  best.set(startKey, 0);
  heap.push(h(sx, sy), [sx, sy, 4, 0]);
  const DIRS = [[1, 0], [-1, 0], [0, 1], [0, -1]] as const;

  while (heap.size > 0) {
    const [ix, iy, dir, cost] = heap.pop();
    const k = key(ix, iy, dir);
    if (cost > (best.get(k) ?? Infinity)) continue;
    if (ix === gx && iy === gy) {
      const points: Point[] = [];
      let cur: number | undefined = k;
      while (cur !== undefined) {
        const cell = Math.floor(cur / 5);
        points.push({ x: xs[cell % W]!, y: ys[Math.floor(cell / W)]! });
        cur = prev.get(cur);
      }
      return points.reverse();
    }
    for (let d = 0; d < 4; d++) {
      const nx = ix + DIRS[d]![0];
      const ny = iy + DIRS[d]![1];
      if (nx < 0 || ny < 0 || nx >= W || ny >= ys.length) continue;
      const mx = (xs[ix]! + xs[nx]!) / 2;
      const my = (ys[iy]! + ys[ny]!) / 2;
      if (buckets.blocked(mx, my, exempt)) continue;
      const step = Math.abs(xs[nx]! - xs[ix]!) + Math.abs(ys[ny]! - ys[iy]!);
      const nextCost = cost + step + (dir !== 4 && dir !== d ? BEND_COST : 0);
      const nk = key(nx, ny, d);
      if (nextCost < (best.get(nk) ?? Infinity)) {
        best.set(nk, nextCost);
        prev.set(nk, k);
        heap.push(nextCost + h(nx, ny), [nx, ny, d, nextCost]);
      }
    }
  }
  return undefined;
}

const between = (a: number, m: number, b: number) => Math.min(a, b) <= m && m <= Math.max(a, b);

/** Quita puntos repetidos y puntos intermedios de un tramo recto (sin perder los retrocesos hacia un quiebre). */
function simplify(points: Point[]): Point[] {
  const out: Point[] = [];
  for (const p of points) {
    const last = out[out.length - 1];
    if (last && last.x === p.x && last.y === p.y) continue;
    const before = out[out.length - 2];
    if (
      before &&
      last &&
      ((before.x === last.x && last.x === p.x && between(before.y, last.y, p.y)) || (before.y === last.y && last.y === p.y && between(before.x, last.x, p.x)))
    )
      out.pop();
    out.push(p);
  }
  return out;
}

function selfLoop(r: Rect): Point[] {
  const x = r.x + r.width;
  const top = r.y + r.height * 0.3;
  const bottom = r.y + r.height * 0.7;
  return [{ x, y: top }, { x: x + 30, y: top }, { x: x + 30, y: bottom }, { x, y: bottom }];
}

/**
 * Enruta las relaciones como polilíneas ortogonales que no atraviesan nodos (FR-018). Los
 * puertos se reparten a lo largo de cada lado según la posición del otro extremo. Los
 * extremos en `ovalIds` (óvalos) terminan sobre el borde del óvalo y no en el de su caja.
 */
export function routeEdges(requests: RouteRequest[], rects: Map<string, Rect>, obstacleIds: string[], ovalIds: Set<string> = new Set()): Map<string, Point[]> {
  const sorted = [...requests].sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));
  const sides = new Map<string, [Side, Side]>();
  const slots = new Map<string, { edge: string; end: 0 | 1; along: number }[]>();
  for (const req of sorted) {
    const s = rects.get(req.source);
    const t = rects.get(req.target);
    if (!s || !t || req.source === req.target) continue;
    const auto = chooseSides(s, t);
    const pair: [Side, Side] = [req.sourceSide ?? auto[0], req.targetSide ?? auto[1]];
    sides.set(req.id, pair);
    const other = [center(t), center(s)];
    pair.forEach((side, end) => {
      const node = end === 0 ? req.source : req.target;
      const key = `${node}:${side}`;
      const along = side === 'top' || side === 'bottom' ? other[end]!.x : other[end]!.y;
      const list = slots.get(key) ?? [];
      list.push({ edge: req.id, end: end as 0 | 1, along });
      slots.set(key, list);
    });
  }
  const fractions = new Map<string, number>();
  for (const list of slots.values()) {
    list.sort((a, b) => a.along - b.along || (a.edge < b.edge ? -1 : 1) || a.end - b.end);
    list.forEach((slot, i) => fractions.set(`${slot.edge}:${slot.end}`, (i + 1) / (list.length + 1)));
  }

  const obstacles: Obstacle[] = obstacleIds
    .map((id) => ({ id, rect: rects.get(id) }))
    .filter((o): o is { id: string; rect: Rect } => o.rect !== undefined)
    .map(({ id, rect }) => ({ id, core: rect, x: rect.x - MARGIN, y: rect.y - MARGIN, width: rect.width + MARGIN * 2, height: rect.height + MARGIN * 2 }));
  const buckets = new Buckets(obstacles);

  const routes = new Map<string, Point[]>();
  for (const req of sorted) {
    const s = rects.get(req.source);
    const t = rects.get(req.target);
    if (!s || !t) continue;
    if (req.source === req.target) {
      routes.set(req.id, selfLoop(s).map((p) => ({ x: r2(p.x), y: r2(p.y) })));
      continue;
    }
    const [sSide, tSide] = sides.get(req.id)!;
    const from = portAt(s, sSide, fractions.get(`${req.id}:0`)!);
    const to = portAt(t, tSide, fractions.get(`${req.id}:1`)!);
    const fromOut = { x: from.x + NORMAL[sSide].x * STUB, y: from.y + NORMAL[sSide].y * STUB };
    const toOut = { x: to.x + NORMAL[tSide].x * STUB, y: to.y + NORMAL[tSide].y * STUB };
    const stops = [fromOut, ...(req.waypoints ?? []), toOut];
    const exempt = new Set(obstacles.filter((o) => stops.some((p) => inside(p, o))).map((o) => o.id));

    const segment = (a: Point, b: Point): Point[] => {
      const box = {
        x: Math.min(a.x, b.x) - WINDOW,
        y: Math.min(a.y, b.y) - WINDOW,
        width: Math.abs(a.x - b.x) + WINDOW * 2,
        height: Math.abs(a.y - b.y) + WINDOW * 2,
      };
      return searchPath(a, b, buckets.near(box), buckets, exempt) ?? searchPath(a, b, obstacles, buckets, exempt) ?? [a, { x: b.x, y: a.y }, b];
    };
    const path = stops.slice(1).flatMap((stop, i) => segment(stops[i]!, stop));
    // La rejilla trabaja con coordenadas redondeadas: se redondean también los puntos del óvalo.
    const round = (p: Point): Point => ({ x: r2(p.x), y: r2(p.y) });
    const start = ovalIds.has(req.source) ? [round(ovalPoint(s, sSide, from)), round(from)] : [from];
    const end = ovalIds.has(req.target) ? [round(to), round(ovalPoint(t, tSide, to))] : [to];
    routes.set(req.id, simplify([...start, ...path, ...end]).map((p) => ({ x: r2(p.x), y: r2(p.y) })));
  }
  return routes;
}

function inside(p: Point, o: Rect): boolean {
  return p.x > o.x && p.x < o.x + o.width && p.y > o.y && p.y < o.y + o.height;
}
