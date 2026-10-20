import { ALLOWED_RELATIONS_BY_DIAGRAM, type Diagram, MULTIPLICITY_RELATION_KINDS, type Point, type Relation, type RelationChanges, type RelationKind } from '@chartsia/core/model';

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

/** Tipo de relación por defecto al conectar dos elementos arrastrando. */
export function defaultRelationKind(type: Diagram['type']): RelationKind {
  return type === 'class' ? 'association' : 'c4-rel';
}

/** Tipos de flecha válidos en el diagrama. */
export function relationKinds(type: Diagram['type']): readonly RelationKind[] {
  return ALLOWED_RELATIONS_BY_DIAGRAM[type];
}

/** Cambios para pasar a otro tipo de flecha, quitando los campos que el tipo nuevo no admite. */
export function kindChanges(rel: Relation, kind: RelationKind): RelationChanges {
  const multiplicities = (MULTIPLICITY_RELATION_KINDS as readonly string[]).includes(kind);
  return {
    kind,
    ...(!multiplicities && (rel.sourceMultiplicity || rel.targetMultiplicity) ? { sourceMultiplicity: null, targetMultiplicity: null } : {}),
    ...(kind !== 'association' && rel.navigable ? { navigable: null } : {}),
  };
}

/** Cambios que invierten la flecha: intercambia extremos, multiplicidades, lados y quiebres. */
export function reverseChanges(rel: Relation): RelationChanges {
  return {
    source: rel.target,
    target: rel.source,
    sourceMultiplicity: rel.targetMultiplicity ?? null,
    targetMultiplicity: rel.sourceMultiplicity ?? null,
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
