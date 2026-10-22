import { type RelationChanges } from '@chartsia/core/model';
import { createContext, useContext } from 'react';
import { type StyleUpdate } from '../canvas/style-edits';

export interface DiagramEditActions {
  /** Edición en línea de un texto con `slot` (p. ej. `name`, `attribute:0`). */
  editText(elementId: string, slot: string, value: string): void;
  /** Tamaño elegido a mano (posición relativa al padre, como la da React Flow). */
  resize(elementId: string, box: { x: number; y: number; width: number; height: number }): void;
  updateRelation(relationId: string, changes: RelationChanges): void;
  /** Cambia el estilo de varios elementos y flechas en un solo lote (un solo paso de Ctrl+Z). */
  updateStyles(updates: StyleUpdate[]): void;
  /** Saca un elemento de su grupo, o deshace un grupo dejando a sus hijos en su lugar. */
  leaveGroup(elementId: string): void;
  ungroup(groupId: string): void;
  /** Envuelve los elementos seleccionados en un marco sin alterar sus posiciones absolutas. */
  groupInFrame(elementIds: string[]): void;
  readOnly: boolean;
}

const noop: DiagramEditActions = { editText: () => {}, resize: () => {}, updateRelation: () => {}, updateStyles: () => {}, leaveGroup: () => {}, ungroup: () => {}, groupInFrame: () => {}, readOnly: true };

export const DiagramEditContext = createContext<DiagramEditActions>(noop);

export function useDiagramEditActions(): DiagramEditActions {
  return useContext(DiagramEditContext);
}
