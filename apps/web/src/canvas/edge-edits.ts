import { canRelate } from '@chartsia/core/validation';
import { type Diagram, type Element, isGroupKind, MULTIPLICITY_RELATION_KINDS, type Point, RELATION_KINDS, type Relation, type RelationChanges, type RelationKind } from '@chartsia/core/model';

/** Ids ya usados por elementos y relaciones (comparten espacio). */
function usedIds(diagram: Pick<Diagram, 'elements' | 'relations'>): Set<string> {
  return new Set([...diagram.elements.map((e) => e.id), ...diagram.relations.map((r) => r.id)]);
}

/** Id libre a partir de una base: `base`, `base2`, `base3`… */
export function freeId(diagram: Pick<Diagram, 'elements' | 'relations'>, base: string): string {
  const used = usedIds(diagram);
  if (!used.has(base)) return base;
  for (let n = 2; ; n++) if (!used.has(`${base}${n}`)) return `${base}${n}`;
}

/** Id libre para una relación nueva: `r1`, `r2`… */
export function relationId(diagram: Pick<Diagram, 'elements' | 'relations'>): string {
  const used = usedIds(diagram);
  for (let n = diagram.relations.length + 1; ; n++) if (!used.has(`r${n}`)) return `r${n}`;
}

/** Relaciones que se prueban al conectar, de la más específica a la menos; en er-attr se prueba también con los extremos invertidos. */
function connectionCandidates(id: string, source: string, target: string): Relation[] {
  return [
    { id, kind: 'association', source, target },
    { id, kind: 'nosql-rel', source, target },
    { id, kind: 'er-rel', source, target, sourceCardinality: 'one', targetCardinality: 'zero-many' },
    { id, kind: 'er-attr', source, target },
    { id, kind: 'er-attr', source: target, target: source },
    { id, kind: 'c4-rel', source, target },
  ];
}

/** Si un tipo de flecha admite el par de elementos (ninguno grupo), según sus familias y las reglas del núcleo. */
function admits(elements: Element[], kind: RelationKind, source: string, target: string): boolean {
  const from = elements.find((e) => e.id === source);
  const to = elements.find((e) => e.id === target);
  return !!from && !!to && !isGroupKind(from.kind) && !isGroupKind(to.kind) && canRelate(kind, from.kind, to.kind);
}

/** Relación nueva al conectar arrastrando: la primera semántica que admite el par o, si ninguna, un conector. */
export function connectionRelation(diagram: Pick<Diagram, 'elements' | 'relations'>, source: string, target: string): Relation {
  const id = relationId(diagram);
  const candidates = connectionCandidates(id, source, target);
  return candidates.find((rel) => admits(diagram.elements, rel.kind, rel.source, rel.target)) ?? { id, kind: 'connector', source, target };
}

/** Tipos de flecha que admiten los extremos de la relación, incluido el actual para que el selector lo muestre. */
export function relationKinds(elements: Element[], relation: Relation): RelationKind[] {
  return RELATION_KINDS.filter((kind) => kind === relation.kind || admits(elements, kind, relation.source, relation.target));
}

/** Tipos de flecha que admiten cada campo opcional; los demás tipos no lo aceptan. */
const KINDS_BY_FIELD = {
  sourceMultiplicity: MULTIPLICITY_RELATION_KINDS,
  targetMultiplicity: MULTIPLICITY_RELATION_KINDS,
  navigable: ['association'],
  technology: ['c4-rel'],
  sourceCardinality: ['er-rel'],
  targetCardinality: ['er-rel'],
  identifying: ['er-rel'],
  sourceTotal: ['er-rel', 'connector'],
  targetTotal: ['er-rel', 'connector'],
  arrowheads: ['connector'],
  dashed: ['connector'],
} as const satisfies Partial<Record<keyof Relation, readonly RelationKind[]>>;

/** Cambios para pasar a otro tipo de flecha, quitando los campos que el tipo nuevo no admite y agregando los obligatorios. */
export function kindChanges(rel: Relation, kind: RelationKind): RelationChanges {
  const removed = Object.entries(KINDS_BY_FIELD)
    .filter(([field, kinds]) => rel[field as keyof typeof KINDS_BY_FIELD] !== undefined && !(kinds as readonly string[]).includes(kind))
    .map(([field]) => [field, null]);
  return {
    kind,
    ...Object.fromEntries(removed),
    ...(kind === 'er-rel' && !rel.sourceCardinality ? { sourceCardinality: 'one' as const } : {}),
    ...(kind === 'er-rel' && !rel.targetCardinality ? { targetCardinality: 'zero-many' as const } : {}),
  };
}

/** Cambios que invierten la flecha: intercambia extremos, multiplicidades, lados y quiebres. */
export function reverseChanges(rel: Relation): RelationChanges {
  return {
    source: rel.target,
    target: rel.source,
    sourceMultiplicity: rel.targetMultiplicity ?? null,
    targetMultiplicity: rel.sourceMultiplicity ?? null,
    ...(rel.kind === 'er-rel' ? { sourceCardinality: rel.targetCardinality ?? null, targetCardinality: rel.sourceCardinality ?? null } : {}),
    ...(rel.sourceTotal !== undefined || rel.targetTotal !== undefined ? { sourceTotal: rel.targetTotal ?? null, targetTotal: rel.sourceTotal ?? null } : {}),
    sourceSide: rel.targetSide ?? null,
    targetSide: rel.sourceSide ?? null,
    ...(rel.waypoints ? { waypoints: [...rel.waypoints].reverse() } : {}),
  };
}

/** Distancia recorrida sobre la ruta hasta la proyección de `p` en su tramo más cercano. */
function arcPosition(route: Point[], p: Point): number {
  let best = { distance: Infinity, arc: 0 };
  let walked = 0;
  for (let i = 1; i < route.length; i++) {
    const a = route[i - 1]!;
    const b = route[i]!;
    const length = Math.hypot(b.x - a.x, b.y - a.y);
    const t = length === 0 ? 0 : Math.max(0, Math.min(1, ((p.x - a.x) * (b.x - a.x) + (p.y - a.y) * (b.y - a.y)) / length ** 2));
    const distance = Math.hypot(a.x + t * (b.x - a.x) - p.x, a.y + t * (b.y - a.y) - p.y);
    if (distance < best.distance) best = { distance, arc: walked + t * length };
    walked += length;
  }
  return best.arc;
}

/** Quiebres tras arrastrar el punto medio del tramo `segment` hasta `point`, en orden sobre la ruta. */
export function insertWaypoint(route: Point[], waypoints: Point[], segment: number, point: Point): Point[] {
  const a = route[segment]!;
  const b = route[segment + 1]!;
  const arc = arcPosition(route, { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 });
  const ordered = waypoints.map((w) => ({ w, arc: arcPosition(route, w) }));
  ordered.push({ w: point, arc });
  return ordered.sort((x, y) => x.arc - y.arc).map((o) => o.w);
}

/** Puntos medios de cada tramo de la ruta (tiradores para crear quiebres). */
export function segmentMidpoints(route: Point[]): Point[] {
  return route.slice(1).map((b, i) => ({ x: (route[i]!.x + b.x) / 2, y: (route[i]!.y + b.y) / 2 }));
}
