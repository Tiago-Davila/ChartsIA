import { type Diagram, type Element, isGroupKind, type Operation } from '@chartsia/core/model';
import { type Edge, type Node, type OnNodeDrag, useReactFlow } from '@xyflow/react';
import { useCallback, useMemo } from 'react';
import { type DiagramEditActions } from '../nodes/edit-context';
import { ApiError, type ApiClient } from '../state/api-client';
import { diagramStore } from '../state/diagram-store';
import { changesForSlot } from './slot-edits';

function depth(id: string, byId: Map<string, Element>): number {
  let d = 0;
  let el = byId.get(id);
  while (el?.parentId && d < 64) {
    d++;
    el = byId.get(el.parentId);
  }
  return d;
}

/**
 * Ediciones manuales de la app (US4). Todas viajan como operaciones por
 * `POST /api/diagrams/:id/operations`, la misma ruta de escritura que usan los agentes; el
 * resultado llega por el canal en vivo. Si el hub las rechaza se muestran sus errores y el
 * lienzo vuelve al último estado confirmado.
 */
export function useDiagramEdits(api: ApiClient) {
  const { getInternalNode } = useReactFlow();

  // Ejecuta una escritura en el hub y muestra sus errores si la rechaza.
  const write = useCallback(
    async (task: (diagram: Diagram) => Promise<unknown>) => {
      const { diagram, connection } = diagramStore.getState();
      if (!diagram) return;
      try {
        await task(diagram);
        // Sin canal en vivo, se lee el resultado directamente.
        if (connection !== 'connected') diagramStore.getState().reconcile(await api.getDiagram(diagram.id));
      } catch (error) {
        const store = diagramStore.getState();
        if (error instanceof ApiError && error.unauthorized) store.setNeedsToken(true);
        else if (error instanceof ApiError && error.errors.length > 0) store.showErrors(error.errors);
        else store.showErrors([{ code: 'SCHEMA_VIOLATION', path: '', message: 'No se pudo contactar con el hub.', hint: 'Comprueba que el hub está en marcha y vuelve a intentarlo.' }]);
      }
    },
    [api],
  );

  const send = useCallback(
    async (operations: Operation[]) => {
      if (operations.length === 0) return;
      await write((diagram) => api.applyOperations(diagram.id, { baseRevision: diagram.revision, operations }));
    },
    [api, write],
  );

  /** Ctrl+Z / Ctrl+Y: deshace o rehace el último cambio del diagrama en el hub. */
  const history = useCallback((direction: 'undo' | 'redo') => void write((diagram) => api.history(diagram.id, direction)), [api, write]);

  /** Al soltar un nodo: `move_element` con su posición absoluta (queda fijado). */
  const onNodeDragStop = useCallback<OnNodeDrag>(
    (_event, _node, dragged) => {
      const diagram = diagramStore.getState().diagram;
      if (!diagram) return;
      const byId = new Map(diagram.elements.map((e) => [e.id, e]));
      const ops: Operation[] = dragged
        .map((n) => {
          const abs = getInternalNode(n.id)?.internals.positionAbsolute ?? n.position;
          const layout = byId.get(n.id)?.layout;
          const x = Math.round(abs.x);
          const y = Math.round(abs.y);
          return layout && Math.round(layout.x) === x && Math.round(layout.y) === y ? undefined : { id: n.id, x, y };
        })
        .filter((m): m is { id: string; x: number; y: number } => m !== undefined)
        // Primero los padres: mover un grupo desplaza a sus hijos en el hub.
        .sort((a, b) => depth(a.id, byId) - depth(b.id, byId))
        .map((m) => ({ op: 'move_element', ...m }));
      void send(ops);
    },
    [getInternalNode, send],
  );

  /** Tecla Supr: elimina elementos (y sus relaciones) y relaciones seleccionadas. */
  const onDelete = useCallback(
    ({ nodes, edges }: { nodes: Node[]; edges: Edge[] }) => {
      const diagram = diagramStore.getState().diagram;
      if (!diagram) return;
      const byId = new Map(diagram.elements.map((e) => [e.id, e]));
      const removed = new Set(nodes.map((n) => n.id));
      const hasRemovedAncestor = (id: string) => {
        let el = byId.get(id);
        while (el?.parentId) {
          if (removed.has(el.parentId)) return true;
          el = byId.get(el.parentId);
        }
        return false;
      };
      const ops: Operation[] = [];
      for (const id of [...removed].sort((a, b) => depth(a, byId) - depth(b, byId))) {
        if (hasRemovedAncestor(id)) continue;
        const el = byId.get(id);
        if (!el) continue;
        // React Flow borra también los hijos de un grupo: en el hub, con cascade "children".
        ops.push(isGroupKind(el.kind) ? { op: 'remove_element', id, cascade: 'children' } : { op: 'remove_element', id });
      }
      for (const edge of edges) {
        if (!removed.has(edge.source) && !removed.has(edge.target)) ops.push({ op: 'remove_relation', id: edge.id });
      }
      void send(ops);
    },
    [send],
  );

  const editText = useCallback(
    (elementId: string, slot: string, value: string) => {
      const element = diagramStore.getState().diagram?.elements.find((e) => e.id === elementId);
      if (!element) return;
      const changes = changesForSlot(element, slot, value);
      if (!changes) {
        diagramStore.getState().showErrors([
          { code: 'SCHEMA_VIOLATION', path: `/${slot}`, message: `"${value}" no es un valor válido.`, hint: 'Usa el formato "+ nombre: Tipo" para atributos y "+ nombre(p: Tipo): Retorno" para operaciones.' },
        ]);
        return;
      }
      void send([{ op: 'update_element', id: elementId, changes }]);
    },
    [send],
  );

  const editActions = useMemo<DiagramEditActions>(() => ({ editText, readOnly: false }), [editText]);

  return { onNodeDragStop, onDelete, editText, editActions, history };
}
