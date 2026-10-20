import { type RelationChanges } from '@chartsia/core/model';
import { createContext, useContext } from 'react';

export interface DiagramEditActions {
  /** Edición en línea de un texto con `slot` (p. ej. `name`, `attribute:0`). */
  editText(elementId: string, slot: string, value: string): void;
  /** Tamaño elegido a mano (posición relativa al padre, como la da React Flow). */
  resize(elementId: string, box: { x: number; y: number; width: number; height: number }): void;
  updateRelation(relationId: string, changes: RelationChanges): void;
  /** Saca un elemento de su grupo, o deshace un grupo dejando a sus hijos en su lugar. */
  leaveGroup(elementId: string): void;
  ungroup(groupId: string): void;
  readOnly: boolean;
}

const noop: DiagramEditActions = { editText: () => {}, resize: () => {}, updateRelation: () => {}, leaveGroup: () => {}, ungroup: () => {}, readOnly: true };

export const DiagramEditContext = createContext<DiagramEditActions>(noop);

export function useDiagramEditActions(): DiagramEditActions {
  return useContext(DiagramEditContext);
}
