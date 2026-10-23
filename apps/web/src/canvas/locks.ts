import { type Diagram, type Element, type Operation } from '@chartsia/core/model';

/** Ids que no se mueven, redimensionan ni borran: los bloqueados y los grupos que contienen alguno. */
export function frozenIds(diagram: Diagram): Set<string> {
  const byId = new Map(diagram.elements.map((e) => [e.id, e]));
  const frozen = new Set<string>();
  for (const el of diagram.elements) {
    if (!el.locked) continue;
    let current: Element | undefined = el;
    for (let depth = 0; current && depth < 64; depth++) {
      frozen.add(current.id);
      current = current.parentId ? byId.get(current.parentId) : undefined;
    }
  }
  return frozen;
}

/** Quita de un lote lo que tocaría un elemento bloqueado; desbloquear (`locked` solo) sí pasa. */
export function unlockedOperations(diagram: Diagram, operations: Operation[]): Operation[] {
  const frozen = frozenIds(diagram);
  const locked = new Set(diagram.elements.filter((e) => e.locked).map((e) => e.id));
  return operations.filter((op) => {
    switch (op.op) {
      case 'move_element':
      case 'resize_element':
      case 'remove_element':
        return !frozen.has(op.id);
      case 'update_element':
        return !locked.has(op.id) || Object.keys(op.changes).every((key) => key === 'locked');
      default:
        return true;
    }
  });
}
