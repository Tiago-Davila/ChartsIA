import { type Diagram, type DiagramType } from '@chartsia/core/model';
import { type ValidationError } from '@chartsia/core/validation';
import { createStore, useStore } from 'zustand';
import { type ConnectionState } from '../app/ConnectionStatus';
import { type DiagramListResponse, type DiagramSummary } from './api-client';
import { type DiagramUpdatedEvent } from './live-client';

export interface DiagramState {
  diagrams: DiagramSummary[];
  activeDiagramId: string | null;
  openDiagramId: string | null;
  diagram?: Diagram;
  connection: ConnectionState;
  needsToken: boolean;
  errors: ValidationError[];
  /** Origen del último cambio aplicado (anima solo los del agente). */
  lastOrigin?: 'agent' | 'app';
  /** Elementos que tocó el último `diagram.updated` del diagrama abierto (vacío si no se sabe). */
  lastChangedIds: string[];
  /** Se incrementa para descartar cambios optimistas del lienzo (p. ej. tras un 422). */
  viewVersion: number;

  setList(list: DiagramListResponse): void;
  open(diagramId: string | null): void;
  receiveDiagram(diagram: Diagram): void;
  applyUpdate(event: DiagramUpdatedEvent): void;
  reconcile(remote: Diagram): void;
  diagramCreated(event: { diagramId: string; title: string; type: DiagramType }): void;
  setActive(diagramId: string): void;
  setConnection(state: ConnectionState): void;
  setNeedsToken(value: boolean): void;
  showErrors(errors: ValidationError[]): void;
  dismissErrors(): void;
  refreshView(): void;
}

/** Ids de los elementos nuevos o distintos entre dos versiones del diagrama. */
export function changedElementIds(before: Diagram, after: Diagram): string[] {
  const old = new Map(before.elements.map((e) => [e.id, JSON.stringify(e)]));
  return after.elements.filter((e) => old.get(e.id) !== JSON.stringify(e)).map((e) => e.id);
}

function summarize(d: Diagram): DiagramSummary {
  return { diagramId: d.id, type: d.type, title: d.title, revision: d.revision, updatedAt: d.updatedAt };
}

function upsert(list: DiagramSummary[], summary: DiagramSummary): DiagramSummary[] {
  const rest = list.filter((s) => s.diagramId !== summary.diagramId);
  return [summary, ...rest].sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
}

export function createDiagramStore() {
  return createStore<DiagramState>()((set, get) => ({
    diagrams: [],
    activeDiagramId: null,
    openDiagramId: null,
    diagram: undefined,
    connection: 'reconnecting',
    needsToken: false,
    errors: [],
    lastOrigin: undefined,
    lastChangedIds: [],
    viewVersion: 0,

    setList: (list) => set({ diagrams: list.diagrams, activeDiagramId: list.activeDiagramId }),
    open: (diagramId) =>
      set((s) => (s.openDiagramId === diagramId ? s : { openDiagramId: diagramId, diagram: undefined, errors: [], lastOrigin: undefined, lastChangedIds: [] })),
    receiveDiagram: (diagram) => {
      if (diagram.id !== get().openDiagramId) return;
      set((s) => ({ diagram, diagrams: upsert(s.diagrams, summarize(diagram)) }));
    },
    applyUpdate: ({ diagramId, revision, origin, diagram }) =>
      set((s) => {
        const diagrams = upsert(s.diagrams, summarize(diagram));
        if (diagramId !== s.openDiagramId) return { diagrams };
        if (s.diagram && revision <= s.diagram.revision) return { diagrams };
        return { diagrams, diagram, lastOrigin: origin, lastChangedIds: s.diagram ? changedElementIds(s.diagram, diagram) : [] };
      }),
    reconcile: (remote) =>
      set((s) => {
        if (remote.id !== s.openDiagramId) return s;
        if (s.diagram && remote.revision <= s.diagram.revision) return s;
        return { diagram: remote, diagrams: upsert(s.diagrams, summarize(remote)) };
      }),
    diagramCreated: ({ diagramId, title, type }) =>
      set((s) =>
        s.diagrams.some((d) => d.diagramId === diagramId)
          ? s
          : { diagrams: upsert(s.diagrams, { diagramId, title, type, revision: 1, updatedAt: new Date().toISOString() }) },
      ),
    setActive: (diagramId) => set({ activeDiagramId: diagramId }),
    setConnection: (connection) => set({ connection }),
    setNeedsToken: (needsToken) => set({ needsToken }),
    showErrors: (errors) => set((s) => ({ errors, viewVersion: s.viewVersion + 1 })),
    dismissErrors: () => set({ errors: [] }),
    refreshView: () => set((s) => ({ viewVersion: s.viewVersion + 1 })),
  }));
}

export type DiagramStore = ReturnType<typeof createDiagramStore>;

/** Store única de la app. */
export const diagramStore = createDiagramStore();

export function useDiagramStore<T>(selector: (state: DiagramState) => T): T {
  return useStore(diagramStore, selector);
}
