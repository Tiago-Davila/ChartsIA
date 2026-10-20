import { type Diagram, type Element, isGroupKind, type Operation, type RelationChanges } from '@chartsia/core/model';
import { type Connection, type Edge, type Node, type OnNodeDrag, useReactFlow } from '@xyflow/react';
import { useCallback, useMemo } from 'react';
import { type DiagramEditActions } from '../nodes/edit-context';
import { ApiError, type ApiClient } from '../state/api-client';
import { diagramStore } from '../state/diagram-store';
import { type AlignMode, alignBoxes } from './align';
import { defaultRelationKind, freeId, relationId } from './edge-edits';
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
  const { getInternalNode, getNodes } = useReactFlow();

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

  /** Al soltar el tirador de tamaño: fija la posición (si cambió) y el tamaño elegido. */
  const resize = useCallback(
    (id: string, box: { x: number; y: number; width: number; height: number }) => {
      const node = getInternalNode(id);
      const parent = node?.parentId ? getInternalNode(node.parentId)?.internals.positionAbsolute : undefined;
      const x = Math.round(box.x + (parent?.x ?? 0));
      const y = Math.round(box.y + (parent?.y ?? 0));
      const layout = diagramStore.getState().diagram?.elements.find((e) => e.id === id)?.layout;
      const ops: Operation[] = [];
      if (!layout || Math.round(layout.x) !== x || Math.round(layout.y) !== y) ops.push({ op: 'move_element', id, x, y });
      ops.push({ op: 'resize_element', id, width: Math.round(box.width), height: Math.round(box.height) });
      void send(ops);
    },
    [getInternalNode, send],
  );

  const updateRelation = useCallback((id: string, changes: RelationChanges) => void send([{ op: 'update_relation', id, changes }]), [send]);

  /** Conectar arrastrando de un elemento a otro: crea una relación con el tipo por defecto. */
  const onConnect = useCallback(
    ({ source, target }: Connection) => {
      const diagram = diagramStore.getState().diagram;
      if (!diagram || !source || !target) return;
      void send([{ op: 'add_relation', relation: { id: relationId(diagram), kind: defaultRelationKind(diagram.type), source, target } }]);
    },
    [send],
  );

  // Cajas absolutas de los nodos seleccionados.
  const selectedBoxes = useCallback(
    () =>
      getNodes()
        .filter((n) => n.selected)
        .map((n) => {
          const abs = getInternalNode(n.id)?.internals.positionAbsolute ?? n.position;
          return { id: n.id, x: abs.x, y: abs.y, width: n.measured?.width ?? n.width ?? 0, height: n.measured?.height ?? n.height ?? 0 };
        }),
    [getInternalNode, getNodes],
  );

  /** Ctrl+D: copia los elementos seleccionados (no los grupos) desplazados 30 px. */
  const duplicate = useCallback(() => {
    const diagram = diagramStore.getState().diagram;
    if (!diagram) return;
    const draft = { elements: [...diagram.elements], relations: diagram.relations };
    const ops: Operation[] = [];
    for (const box of selectedBoxes()) {
      const el = diagram.elements.find((e) => e.id === box.id);
      if (!el || isGroupKind(el.kind)) continue;
      const { layout: _layout, ...rest } = el;
      const copy = { ...rest, id: freeId(draft, `${el.id}_copia`), layout: { x: Math.round(box.x + 30), y: Math.round(box.y + 30) } } as Element;
      draft.elements.push(copy);
      ops.push({ op: 'add_element', element: copy });
    }
    void send(ops);
  }, [selectedBoxes, send]);

  /** Alinea o distribuye los elementos seleccionados. */
  const align = useCallback(
    (mode: AlignMode) => void send(alignBoxes(selectedBoxes(), mode).map((m) => ({ op: 'move_element', ...m }))),
    [selectedBoxes, send],
  );

  const leaveGroup = useCallback((id: string) => void send([{ op: 'update_element', id, changes: { parentId: null } }]), [send]);
  const ungroup = useCallback((id: string) => void send([{ op: 'remove_element', id, cascade: 'reparent' }]), [send]);

  const editActions = useMemo<DiagramEditActions>(
    () => ({ editText, resize, updateRelation, leaveGroup, ungroup, readOnly: false }),
    [editText, resize, updateRelation, leaveGroup, ungroup],
  );

  return { onNodeDragStop, onDelete, onConnect, editText, editActions, history, duplicate, align };
}
