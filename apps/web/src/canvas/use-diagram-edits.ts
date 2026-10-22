import { DRAWING_MAX_COORDINATE, DRAWING_MAX_POINTS, type Diagram, type Element, isGroupKind, type Operation, type Point, type RelationChanges } from '@chartsia/core/model';
import { type Connection, type Edge, type Node, type OnNodeDrag, useReactFlow } from '@xyflow/react';
import { useCallback, useMemo } from 'react';
import { type DiagramEditActions } from '../nodes/edit-context';
import { ApiError, type ApiClient } from '../state/api-client';
import { diagramStore } from '../state/diagram-store';
import { type AlignMode, alignBoxes } from './align';
import { connectionRelation, freeId } from './edge-edits';
import { newPaletteElements, paletteFor } from './figure-palette';
import { readImageFile } from './image-import';
import { changesForSlot } from './slot-edits';
import { type StyleUpdate } from './style-edits';
import { simplifyStroke } from './drawing';
import { framePadding } from '@chartsia/core/shapes';

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
  const { getInternalNode, getNodes, screenToFlowPosition } = useReactFlow();

  // Ejecuta una escritura en el hub y muestra sus errores si la rechaza.
  const write = useCallback(
    async (task: (diagram: Diagram) => Promise<unknown>) => {
      const { diagram, connection } = diagramStore.getState();
      if (!diagram) return false;
      try {
        await task(diagram);
        // Sin canal en vivo, se lee el resultado directamente.
        if (connection !== 'connected') diagramStore.getState().reconcile(await api.getDiagram(diagram.id));
        return true;
      } catch (error) {
        const store = diagramStore.getState();
        if (error instanceof ApiError && error.unauthorized) store.setNeedsToken(true);
        else if (error instanceof ApiError && error.errors.length > 0) store.showErrors(error.errors);
        else store.showErrors([{ code: 'SCHEMA_VIOLATION', path: '', message: 'No se pudo contactar con el hub.', hint: 'Comprueba que el hub está en marcha y vuelve a intentarlo.' }]);
        return false;
      }
    },
    [api],
  );

  const send = useCallback(
    async (operations: Operation[]) => {
      if (operations.length === 0) return true;
      return write((diagram) => api.applyOperations(diagram.id, { baseRevision: diagram.revision, operations }));
    },
    [api, write],
  );

  /** Inserta imágenes locales saneadas en la posición de pantalla indicada. */
  const insertImages = useCallback(
    (files: File[], screenPosition: { x: number; y: number }) => {
      void (async () => {
        const initial = diagramStore.getState().diagram;
        if (!initial) return;
        const draft = { elements: [...initial.elements], relations: initial.relations };
        const point = screenToFlowPosition(screenPosition);
        for (const [index, file] of files.entries()) {
          let image: { name: string; src: string };
          try {
            image = await readImageFile(file);
          } catch (error) {
            diagramStore.getState().showErrors([{ code: 'SCHEMA_VIOLATION', path: '/elements', message: (error as Error).message, hint: 'Usa un PNG, JPG o SVG válido de hasta 5 MiB. Los SVG solo pueden contener formas y texto; se rechazan scripts, enlaces y estilos activos.' }]);
            return;
          }
          if (diagramStore.getState().diagram?.id !== initial.id) return;
          const element = {
            id: freeId(draft, 'Imagen'),
            kind: 'image' as const,
            name: image.name,
            src: image.src,
            layout: { x: Math.round(point.x + index * 24), y: Math.round(point.y + index * 24), width: 320, height: 220 },
          };
          if (!(await send([{ op: 'add_element', element }]))) return;
          draft.elements.push(element);
        }
      })();
    },
    [screenToFlowPosition, send],
  );

  /** Crea la figura de la barra lateral soltada en la posición de pantalla indicada. */
  const addFigure = useCallback(
    (key: string, screenPosition: { x: number; y: number }) => {
      const diagram = diagramStore.getState().diagram;
      const item = diagram && paletteFor(diagram.type).find((candidate) => candidate.key === key);
      if (!diagram || !item) return;
      const elements = newPaletteElements(diagram, item, screenToFlowPosition(screenPosition));
      void send(elements.map((element): Operation => ({ op: 'add_element', element })));
    },
    [screenToFlowPosition, send],
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

  /** Crea un trazo de lápiz o de marcador desde puntos absolutos del lienzo. */
  const addDrawing = useCallback((points: Point[], screenPoints: Point[], strokeColor: string, strokeWidth: number, highlighter = false) => {
    const diagram = diagramStore.getState().diagram;
    if (!diagram) return;
    const simplified = simplifyStroke(points, screenPoints);
    if (simplified.length < 2 || !simplified.some((p) => p.x !== simplified[0]!.x || p.y !== simplified[0]!.y)) return;

    const padding = strokeWidth / 2;
    const minX = Math.min(...simplified.map((p) => p.x));
    const minY = Math.min(...simplified.map((p) => p.y));
    const maxX = Math.max(...simplified.map((p) => p.x));
    const maxY = Math.max(...simplified.map((p) => p.y));
    if (maxX - minX + strokeWidth > DRAWING_MAX_COORDINATE || maxY - minY + strokeWidth > DRAWING_MAX_COORDINATE) {
      diagramStore.getState().showErrors([
        { code: 'LIMIT_EXCEEDED', path: '/points', message: 'El trazo supera el límite de 5000 unidades.', hint: 'Acércate al lienzo y dibuja un trazo más corto.' },
      ]);
      return;
    }

    const x = Math.round((minX - padding) * 100) / 100;
    const y = Math.round((minY - padding) * 100) / 100;
    const local = simplified.map((p) => ({ x: Math.round((p.x - x) * 100) / 100, y: Math.round((p.y - y) * 100) / 100 }));
    if (local.some((p) => p.x > DRAWING_MAX_COORDINATE || p.y > DRAWING_MAX_COORDINATE) || local.length > DRAWING_MAX_POINTS) {
      diagramStore.getState().showErrors([
        { code: 'LIMIT_EXCEEDED', path: '/points', message: 'El trazo excede los límites de puntos o tamaño.', hint: 'Dibuja un trazo más corto.' },
      ]);
      return;
    }
    const draft = { elements: diagram.elements, relations: diagram.relations };
    const name = highlighter ? 'Marcador' : 'Trazo';
    const element: Element = {
      id: freeId(draft, name),
      kind: 'drawing',
      name,
      points: local,
      strokeColor,
      strokeWidth,
      ...(highlighter ? { highlighter: true as const } : {}),
      layout: { x, y },
    };
    void send([{ op: 'add_element', element }]);
  }, [send]);

  /** Panel de estilo: un `update_element` o `update_relation` por objetivo, todos en un lote. */
  const updateStyles = useCallback(
    (updates: StyleUpdate[]) =>
      void send(
        updates.map((u): Operation => {
          if ('strokeWidth' in u) return { op: 'update_element', id: u.id, changes: { strokeWidth: u.strokeWidth } };
          return u.relation ? { op: 'update_relation', id: u.id, changes: { style: u.style } } : { op: 'update_element', id: u.id, changes: { style: u.style } };
        }),
      ),
    [send],
  );

  /** Conectar arrastrando de un elemento a otro: crea una relación con el tipo por defecto. */
  const onConnect = useCallback(
    ({ source, target }: Connection) => {
      const diagram = diagramStore.getState().diagram;
      if (!diagram || !source || !target) return;
      void send([{ op: 'add_relation', relation: connectionRelation(diagram, source, target) }]);
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

  const rename = useCallback((title: string) => void send([{ op: 'set_title', title }]), [send]);
  const leaveGroup = useCallback((id: string) => void send([{ op: 'update_element', id, changes: { parentId: null } }]), [send]);
  const ungroup = useCallback((id: string) => void send([{ op: 'remove_element', id, cascade: 'reparent' }]), [send]);

  /** Agrupa los nodos seleccionados en un marco sin cambiar sus coordenadas absolutas. */
  const groupInFrame = useCallback((elementIds: string[]) => {
    const diagram = diagramStore.getState().diagram;
    if (!diagram) return;
    const byId = new Map(diagram.elements.map((element) => [element.id, element]));
    const selected = new Set(elementIds.filter((id) => byId.has(id)));
    const hasSelectedAncestor = (id: string) => {
      const visited = new Set<string>();
      let parentId = byId.get(id)?.parentId;
      while (parentId && !visited.has(parentId)) {
        if (selected.has(parentId)) return true;
        visited.add(parentId);
        parentId = byId.get(parentId)?.parentId;
      }
      return false;
    };
    // Si se selecciona un grupo junto con descendientes, solo el grupo se reparenta.
    const roots = [...selected].filter((id) => !hasSelectedAncestor(id));
    if (selected.size < 2 || roots.length === 0) return;

    const ancestors = (id: string) => {
      const result: string[] = [];
      const visited = new Set<string>();
      let parentId = byId.get(id)?.parentId;
      while (parentId && !visited.has(parentId)) {
        visited.add(parentId);
        result.push(parentId);
        parentId = byId.get(parentId)?.parentId;
      }
      return result;
    };
    const parentId = ancestors(roots[0]!).find((id) => roots.slice(1).every((root) => ancestors(root).includes(id)));

    const boxes = roots.map((id) => {
      const element = byId.get(id)!;
      const node = getInternalNode(id);
      const position = node?.internals.positionAbsolute ?? { x: element.layout?.x ?? 0, y: element.layout?.y ?? 0 };
      const width = node?.measured?.width ?? node?.width ?? element.layout?.width ?? 120;
      const height = node?.measured?.height ?? node?.height ?? element.layout?.height ?? 60;
      return { x: position.x, y: position.y, width, height };
    });
    const left = Math.min(...boxes.map((box) => box.x));
    const top = Math.min(...boxes.map((box) => box.y));
    const right = Math.max(...boxes.map((box) => box.x + box.width));
    const bottom = Math.max(...boxes.map((box) => box.y + box.height));
    const id = freeId(diagram, 'Marco');
    const padding = framePadding();
    const frame: Element = {
      id,
      kind: 'frame',
      name: 'Marco',
      ...(parentId ? { parentId } : {}),
      layout: {
        x: Math.round(left - padding.left),
        y: Math.round(top - padding.top),
        width: Math.round(right - left + padding.left + padding.right),
        height: Math.round(bottom - top + padding.top + padding.bottom),
      },
    };
    void send([
      { op: 'add_element', element: frame },
      ...roots.map((root): Operation => ({ op: 'update_element', id: root, changes: { parentId: id } })),
    ]);
  }, [getInternalNode, send]);

  const editActions = useMemo<DiagramEditActions>(
    () => ({ editText, resize, updateRelation, updateStyles, leaveGroup, ungroup, groupInFrame, readOnly: false }),
    [editText, resize, updateRelation, updateStyles, leaveGroup, ungroup, groupInFrame],
  );

  return { onNodeDragStop, onDelete, onConnect, onDraw: addDrawing, editText, editActions, history, duplicate, align, rename, insertImages, addFigure };
}
