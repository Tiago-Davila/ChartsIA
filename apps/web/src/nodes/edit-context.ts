import { type RelationChanges } from '@chartsia/core/model';
import { createContext, useContext } from 'react';

export interface DiagramEditActions {
  /** Edición en línea de un texto con `slot` (p. ej. `name`, `attribute:0`). */
  editText(elementId: string, slot: string, value: string): void;
  /** Tamaño elegido a mano (posición relativa al padre, como la da React Flow). */
  resize(elementId: string, box: { x: number; y: number; width: number; height: number }): void;
  updateRelation(relationId: string, changes: RelationChanges): void;
  readOnly: boolean;
}

const noop: DiagramEditActions = { editText: () => {}, resize: () => {}, updateRelation: () => {}, readOnly: true };

export const DiagramEditContext = createContext<DiagramEditActions>(noop);

export function useDiagramEditActions(): DiagramEditActions {
  return useContext(DiagramEditContext);
}
