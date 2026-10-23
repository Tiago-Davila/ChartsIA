import { type Diagram, type Element, type Operation, type Relation } from '@chartsia/core/model';
import { freeId } from './edge-edits';

/** Desplazamiento en píxeles de cada pegado en el mismo diagrama. */
export const PASTE_STEP = 30;

/** Elementos y relaciones copiados, el diagrama de origen y cuántas veces se pegaron en él. */
export interface Clipboard {
  diagramId: string;
  elements: Element[];
  relations: Relation[];
  pastes: number;
}

// Portapapeles en memoria: sobrevive a cambiar de diagrama y no usa el del sistema.
let clipboard: Clipboard | undefined;

/** Indica si hay algo copiado para pegar. */
export function hasClipboard(): boolean {
  return clipboard !== undefined;
}

/** Devuelve el portapapeles actual, si hay uno. */
export function getClipboard(): Clipboard | undefined {
  return clipboard;
}

/** Sube por los grupos del elemento y dice si alguno está en `ids`. */
function hasAncestorIn(id: string, byId: Map<string, Element>, ids: Set<string>): boolean {
  const visited = new Set<string>();
  let parentId = byId.get(id)?.parentId;
  while (parentId && !visited.has(parentId)) {
    if (ids.has(parentId)) return true;
    visited.add(parentId);
    parentId = byId.get(parentId)?.parentId;
  }
  return false;
}

/** Copia los elementos seleccionados, lo que contienen y las relaciones entre ellos. Devuelve false si no hay nada que copiar. */
export function copyElements(diagram: Diagram, selectedIds: string[]): boolean {
  const byId = new Map(diagram.elements.map((e) => [e.id, e]));
  const selected = new Set(selectedIds.filter((id) => byId.has(id)));
  const copied = new Set(
    diagram.elements.filter((e) => selected.has(e.id) || hasAncestorIn(e.id, byId, selected)).map((e) => e.id),
  );
  if (copied.size === 0) return false;
  clipboard = {
    diagramId: diagram.id,
    elements: diagram.elements.filter((e) => copied.has(e.id)),
    relations: diagram.relations.filter((r) => copied.has(r.source) && copied.has(r.target)),
    pastes: 0,
  };
  return true;
}

/** Arma el lote para pegar el portapapeles en el diagrama: ids nuevos, flechas reasignadas y todo corrido `offset` píxeles. */
export function pasteOperations(clip: Clipboard, diagram: Diagram, offset: number): Operation[] {
  const sameDiagram = clip.diagramId === diagram.id;
  const elementIds = new Map(clip.elements.map((e) => [e.id, freeId(diagram, `${e.id}_copia`)]));
  const relationIds = new Map(clip.relations.map((r) => [r.id, freeId(diagram, `${r.id}_copia`)]));

  const elements = clip.elements.map((el): Element => {
    const { parentId, layout, ...rest } = el;
    // Un hijo sin su grupo pegado conserva el padre solo si el grupo sigue en este diagrama.
    const newParent = parentId && (elementIds.get(parentId) ?? (sameDiagram ? parentId : undefined));
    const base = layout ?? { x: 0, y: 0 };
    return {
      ...rest,
      id: elementIds.get(el.id)!,
      ...(newParent ? { parentId: newParent } : {}),
      layout: { ...base, x: Math.round(base.x + offset), y: Math.round(base.y + offset) },
    } as Element;
  });

  const relations = clip.relations.map((rel): Relation => {
    const { waypoints: _waypoints, ...rest } = rel;
    return { ...rest, id: relationIds.get(rel.id)!, source: elementIds.get(rel.source)!, target: elementIds.get(rel.target)! } as Relation;
  });

  return [
    ...elements.map((element): Operation => ({ op: 'add_element', element })),
    ...relations.map((relation): Operation => ({ op: 'add_relation', relation })),
  ];
}
