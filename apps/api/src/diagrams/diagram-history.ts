import { type Diagram } from '@chartsia/core/model';

/** Contenido de un diagrama que se restaura al deshacer o rehacer. */
export type Snapshot = Pick<Diagram, 'title' | 'elements' | 'relations'>;

export type HistoryDirection = 'undo' | 'redo';

const MAX_STEPS = 50;

/** Pilas de deshacer y rehacer por diagrama, en memoria (se pierden al reiniciar el hub). */
export class DiagramHistory {
  private readonly stacks = new Map<string, Record<HistoryDirection, Snapshot[]>>();

  /** Guarda el estado previo a un cambio nuevo y descarta lo que se podía rehacer. */
  record(diagram: Diagram): void {
    const stacks = this.stacksOf(diagram.id);
    stacks.undo.push(snapshot(diagram));
    if (stacks.undo.length > MAX_STEPS) stacks.undo.shift();
    stacks.redo = [];
  }

  /** Saca el estado a restaurar y apila el actual en la dirección contraria. */
  step(current: Diagram, direction: HistoryDirection): Snapshot | undefined {
    const stacks = this.stacksOf(current.id);
    const target = stacks[direction].pop();
    if (target) stacks[direction === 'undo' ? 'redo' : 'undo'].push(snapshot(current));
    return target;
  }

  private stacksOf(diagramId: string): Record<HistoryDirection, Snapshot[]> {
    let stacks = this.stacks.get(diagramId);
    if (!stacks) {
      stacks = { undo: [], redo: [] };
      this.stacks.set(diagramId, stacks);
    }
    return stacks;
  }
}

function snapshot(diagram: Diagram): Snapshot {
  return { title: diagram.title, elements: diagram.elements, relations: diagram.relations };
}
