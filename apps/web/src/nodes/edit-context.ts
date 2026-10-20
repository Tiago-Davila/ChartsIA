import { createContext, useContext } from 'react';

export interface DiagramEditActions {
  /** Edición en línea de un texto con `slot` (p. ej. `name`, `attribute:0`). */
  editText(elementId: string, slot: string, value: string): void;
  readOnly: boolean;
}

const noop: DiagramEditActions = { editText: () => {}, readOnly: true };

export const DiagramEditContext = createContext<DiagramEditActions>(noop);

export function useDiagramEditActions(): DiagramEditActions {
  return useContext(DiagramEditContext);
}
