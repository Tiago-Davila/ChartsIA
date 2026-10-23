import {
  Background,
  BackgroundVariant,
  ConnectionMode,
  Controls,
  type Edge,
  MiniMap,
  type Node,
  type OnConnect,
  type OnNodeDrag,
  ReactFlow,
  SelectionMode,
  Panel,
  useEdgesState,
  useNodesInitialized,
  useNodesState,
  useReactFlow,
  useViewport,
} from '@xyflow/react';
import { type MouseEvent as ReactMouseEvent, type PointerEvent as ReactPointerEvent, useCallback, useEffect, useRef, useState } from 'react';
import { DRAWING_DEFAULT_COLOR, DRAWING_WIDTH_PX, HIGHLIGHTER_DEFAULT_COLOR, HIGHLIGHTER_OPACITY, HIGHLIGHTER_WIDTH_PX, type Point, type StackOrderTarget, type StyleLineWidth } from '@chartsia/core/model';
import { edgeTypes } from '../edges';
import { nodeTypes } from '../nodes';
import { useDiagramEditActions } from '../nodes/edit-context';
import { type ElementNodeData } from '../nodes/types';
import { ContextMenu, type ContextMenuItem } from './ContextMenu';
import { drawingTargets, SelectionPanel, styleTargets } from './SelectionPanel';
import { WidthPicker } from './WidthPicker';
import { sampleStroke } from './drawing';
import { type FrameBox } from './figure-palette';
import { hasClipboard } from './clipboard';
import { copiedStyle, copyStyleOf, fieldUpdates, PALETTE, pasteUpdates } from './style-edits';

export interface DiagramCanvasProps {
  diagramId: string;
  nodes: Node[];
  edges: Edge[];
  readOnly?: boolean;
  onNodeDragStop?: OnNodeDrag;
  onDelete?: (params: { nodes: Node[]; edges: Edge[] }) => void;
  onDuplicate?: () => void;
  onCopy?: () => void;
  onCut?: () => void;
  onPaste?: () => void;
  onReorder?: (to: StackOrderTarget) => void;
  onToggleLock?: (ids: string[], locked: boolean) => void;
  onConnect?: OnConnect;
  onDraw?: (points: Point[], screenPoints: Point[], color: string, width: number, highlighter: boolean) => void;
  onAddText?: (screenPosition: { x: number; y: number }) => void;
  onAddFrame?: (box: FrameBox) => void;
}

export const FIT_VIEW_OPTIONS = { padding: 0.15, maxZoom: 1.25 };
const PRO_OPTIONS = { hideAttribution: true };
const MINIMAP_STYLE = { width: 180, height: 120 };
const MAX_CAPTURE_POINTS = 2048;
/** Relleno inicial del balde: el rojo de la paleta del panel de estilo. */
const BUCKET_DEFAULT_COLOR = PALETTE[3].value;

/** Herramienta activa de la barra. `select` es la de por defecto y apaga a las demás. */
type CanvasTool = 'select' | 'hand' | 'pen' | 'highlighter' | 'bucket' | 'text' | 'frame';
/** Herramientas con color propio elegido en la barra. */
type ColoredTool = 'pen' | 'highlighter' | 'bucket';
/** Arrastre de la herramienta Marco: esquinas inicial y actual, en píxeles del lienzo. */
interface FrameDrag {
  start: Point;
  end: Point;
}
/** Un arrastre más corto que esto, en píxeles de pantalla, no crea marco. */
const MIN_FRAME_PX = 10;

/** Punto del puntero en píxeles relativos al lienzo. */
function canvasPoint(event: ReactPointerEvent<HTMLDivElement>): Point {
  const rect = event.currentTarget.getBoundingClientRect();
  return { x: event.clientX - rect.left, y: event.clientY - rect.top };
}

/** Rectángulo entre dos esquinas, con la esquina superior izquierda y tamaños positivos. */
function boxBetween(a: Point, b: Point) {
  return { x: Math.min(a.x, b.x), y: Math.min(a.y, b.y), width: Math.abs(a.x - b.x), height: Math.abs(a.y - b.y) };
}

function nodeColor(node: Node): string {
  const kind = node.type ?? '';
  if (kind === 'person') return '#08427b';
  if (kind === 'software-system') return '#1168bd';
  if (kind === 'container') return '#438dd5';
  if (kind === 'component') return '#85bbf0';
  if (kind === 'package' || kind === 'boundary' || kind === 'frame') return 'transparent';
  return '#f6e7a6';
}

/** Copia el estado `selected` de los elementos que siguen existiendo. */
function keepSelection<T extends Node | Edge>(prev: T[], next: T[]): T[] {
  const selected = new Set(prev.filter((item) => item.selected).map((item) => item.id));
  return selected.size === 0 ? next : next.map((item) => (selected.has(item.id) ? { ...item, selected: true } : item));
}

/**
 * Lienzo infinito (React Flow): pan, zoom, minimapa y controles. El estado local permite
 * arrastrar con fluidez; cada actualización del hub lo reemplaza (el hub es la fuente de verdad).
 */
export function DiagramCanvas({ diagramId, nodes: incomingNodes, edges: incomingEdges, readOnly = false, onNodeDragStop, onDelete, onDuplicate, onCopy, onCut, onPaste, onReorder, onToggleLock, onConnect, onDraw, onAddText, onAddFrame }: DiagramCanvasProps) {
  const [nodes, setNodes, onNodesChange] = useNodesState(incomingNodes);
  const [edges, setEdges, onEdgesChange] = useEdgesState(incomingEdges);
  const { fitView, screenToFlowPosition, deleteElements } = useReactFlow();
  // Posición de pantalla del menú contextual abierto; `pane` si se abrió sobre el lienzo vacío.
  const [menu, setMenu] = useState<Point & { pane?: boolean }>();
  const closeMenu = useCallback(() => setMenu(undefined), []);
  // Elemento o flecha sobre el que se abrió el menú, para "Copiar estilo".
  const menuTarget = useRef<{ id: string; relation: boolean }>(undefined);
  const { zoom } = useViewport();
  const initialized = useNodesInitialized();
  const canvas = useRef<HTMLDivElement>(null);
  const activePointer = useRef<number | undefined>(undefined);
  const strokePoints = useRef<Point[]>([]);
  const screenPoints = useRef<Point[]>([]);
  const [tool, setTool] = useState<CanvasTool>('select');
  const [colors, setColors] = useState<Record<ColoredTool, string>>({ pen: DRAWING_DEFAULT_COLOR, highlighter: HIGHLIGHTER_DEFAULT_COLOR, bucket: BUCKET_DEFAULT_COLOR });
  const [widths, setWidths] = useState<Record<'pen' | 'highlighter', StyleLineWidth>>({ pen: 'medium', highlighter: 'medium' });
  const highlighter = tool === 'highlighter';
  const drawingMode = tool === 'pen' || highlighter;
  const bucketMode = tool === 'bucket';
  const textMode = tool === 'text';
  const frameMode = tool === 'frame';
  // Con la mano, arrastrar desplaza el lienzo aunque sea sobre una figura.
  const handMode = tool === 'hand';
  const drawingColor = highlighter ? colors.highlighter : colors.pen;
  const drawingWidth = highlighter ? HIGHLIGHTER_WIDTH_PX[widths.highlighter] : DRAWING_WIDTH_PX[widths.pen];
  const bucketColor = colors.bucket;
  const { updateStyles } = useDiagramEditActions();
  const [preview, setPreview] = useState<Point[]>([]);
  const frameDrag = useRef<FrameDrag | undefined>(undefined);
  const [framePreview, setFramePreview] = useState<FrameDrag>();
  const framePreviewBox = framePreview && boxBetween(framePreview.start, framePreview.end);
  const fittedFor = useRef<string | null>(null);
  const [editingEdge, setEditingEdge] = useState<string>();
  // Cierra el formulario de textos cuando la flecha deja de estar seleccionada.
  const onSelectionChange = useCallback(({ edges: selected }: { edges: Edge[] }) => {
    setEditingEdge((id) => (selected.some((e) => e.id === id) ? id : undefined));
  }, []);

  // Cada actualización del hub reemplaza nodos y aristas, pero conserva lo seleccionado.
  useEffect(() => setNodes((prev) => keepSelection(prev, incomingNodes)), [incomingNodes, setNodes]);
  useEffect(() => setEdges((prev) => keepSelection(prev, incomingEdges)), [incomingEdges, setEdges]);
  // Descarta el arrastre de la herramienta Marco en curso.
  const clearFrame = useCallback(() => {
    frameDrag.current = undefined;
    setFramePreview(undefined);
  }, []);
  useEffect(() => {
    const pointerId = activePointer.current;
    activePointer.current = undefined;
    if (pointerId !== undefined && canvas.current?.hasPointerCapture(pointerId)) canvas.current.releasePointerCapture(pointerId);
    strokePoints.current = [];
    screenPoints.current = [];
    setPreview([]);
    clearFrame();
    setTool('select');
  }, [diagramId, clearFrame]);
  // Al abrir otro diagrama se encuadra completo, cuando React Flow ya midió sus nodos.
  useEffect(() => {
    if (!initialized || fittedFor.current === diagramId) return;
    fittedFor.current = diagramId;
    void fitView(FIT_VIEW_OPTIONS);
  }, [initialized, diagramId, fitView]);

  // Convierte una muestra de pantalla al lienzo y la conserva para la vista previa.
  const addSample = useCallback((event: ReactPointerEvent<HTMLDivElement>, force = false) => {
    const screen = canvasPoint(event);
    const previous = screenPoints.current.at(-1);
    if (previous) {
      const distance = Math.hypot(screen.x - previous.x, screen.y - previous.y);
      if (distance === 0 || (!force && distance < 2)) return;
    }
    strokePoints.current.push(screenToFlowPosition({ x: event.clientX, y: event.clientY }));
    screenPoints.current.push(screen);
    if (screenPoints.current.length >= MAX_CAPTURE_POINTS) {
      const reduced = sampleStroke(strokePoints.current, screenPoints.current, MAX_CAPTURE_POINTS / 2);
      strokePoints.current = reduced.points;
      screenPoints.current = reduced.screenPoints;
    }
    setPreview([...screenPoints.current]);
  }, [screenToFlowPosition]);

  // Con el balde activo, un clic sobre una figura le aplica el color de relleno elegido.
  const paintNode = useCallback((_: unknown, node: Node) => {
    const { element } = node.data as ElementNodeData;
    if (!bucketMode || readOnly || element.kind === 'drawing') return;
    updateStyles(fieldUpdates([{ id: element.id, relation: false, style: element.style }], 'fillColor', bucketColor));
  }, [bucketColor, bucketMode, readOnly, updateStyles]);

  const startDrawing = useCallback((event: ReactPointerEvent<HTMLDivElement>) => {
    if (readOnly || event.button !== 0 || !(event.target instanceof Element) || event.target.closest('.react-flow__panel')) return;
    // Con la herramienta Texto, el clic crea el bloque en ese punto y la herramienta vuelve a la selección.
    if (textMode) {
      event.preventDefault();
      event.stopPropagation();
      onAddText?.({ x: event.clientX, y: event.clientY });
      setTool('select');
      return;
    }
    // Con la herramienta Marco, el arrastre dibuja el rectángulo del marco.
    if (frameMode) {
      event.preventDefault();
      event.stopPropagation();
      activePointer.current = event.pointerId;
      event.currentTarget.setPointerCapture(event.pointerId);
      const start = canvasPoint(event);
      frameDrag.current = { start, end: start };
      setFramePreview(frameDrag.current);
      return;
    }
    if (!drawingMode) return;
    event.preventDefault();
    event.stopPropagation();
    activePointer.current = event.pointerId;
    event.currentTarget.setPointerCapture(event.pointerId);
    strokePoints.current = [];
    screenPoints.current = [];
    addSample(event, true);
  }, [addSample, drawingMode, frameMode, onAddText, readOnly, textMode]);

  const moveDrawing = useCallback((event: ReactPointerEvent<HTMLDivElement>) => {
    if (activePointer.current !== event.pointerId) return;
    event.preventDefault();
    event.stopPropagation();
    if (frameDrag.current) {
      frameDrag.current = { ...frameDrag.current, end: canvasPoint(event) };
      setFramePreview(frameDrag.current);
      return;
    }
    addSample(event);
  }, [addSample]);

  const finishDrawing = useCallback((event: ReactPointerEvent<HTMLDivElement>) => {
    if (activePointer.current !== event.pointerId) return;
    event.preventDefault();
    event.stopPropagation();
    if (frameDrag.current) {
      const box = boxBetween(frameDrag.current.start, canvasPoint(event));
      clearFrame();
      activePointer.current = undefined;
      if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId);
      setTool('select');
      // Un arrastre muy chico no crea nada.
      if (Math.max(box.width, box.height) < MIN_FRAME_PX) return;
      const rect = event.currentTarget.getBoundingClientRect();
      const topLeft = screenToFlowPosition({ x: rect.left + box.x, y: rect.top + box.y });
      const bottomRight = screenToFlowPosition({ x: rect.left + box.x + box.width, y: rect.top + box.y + box.height });
      onAddFrame?.({ x: topLeft.x, y: topLeft.y, width: bottomRight.x - topLeft.x, height: bottomRight.y - topLeft.y });
      return;
    }
    addSample(event, true);
    const points = strokePoints.current;
    const screen = screenPoints.current;
    activePointer.current = undefined;
    strokePoints.current = [];
    screenPoints.current = [];
    setPreview([]);
    if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId);
    onDraw?.(points, screen, drawingColor, drawingWidth, highlighter);
  }, [addSample, clearFrame, drawingColor, drawingWidth, highlighter, onAddFrame, onDraw, screenToFlowPosition]);

  const cancelDrawing = useCallback((event: ReactPointerEvent<HTMLDivElement>) => {
    if (activePointer.current !== event.pointerId) return;
    activePointer.current = undefined;
    strokePoints.current = [];
    screenPoints.current = [];
    setPreview([]);
    clearFrame();
    if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId);
  }, [clearFrame]);

  const loseDrawing = useCallback((event: ReactPointerEvent<HTMLDivElement>) => {
    if (activePointer.current !== event.pointerId) return;
    activePointer.current = undefined;
    strokePoints.current = [];
    screenPoints.current = [];
    setPreview([]);
    clearFrame();
  }, [clearFrame]);

  // Deja seleccionado solo el nodo o la flecha indicados.
  const selectOnly = useCallback((nodeId?: string, edgeId?: string) => {
    setNodes((prev) => prev.map((n) => ({ ...n, selected: n.id === nodeId })));
    setEdges((prev) => prev.map((e) => ({ ...e, selected: e.id === edgeId })));
  }, [setNodes, setEdges]);

  // Clic derecho sobre algo no seleccionado lo selecciona solo; dentro de la selección, el menú actúa sobre todas.
  const onNodeContextMenu = useCallback((event: ReactMouseEvent, node: Node) => {
    if (readOnly) return;
    event.preventDefault();
    if (!node.selected) selectOnly(node.id);
    menuTarget.current = { id: node.id, relation: false };
    setMenu({ x: event.clientX, y: event.clientY });
  }, [readOnly, selectOnly]);

  const onEdgeContextMenu = useCallback((event: ReactMouseEvent, edge: Edge) => {
    if (readOnly) return;
    event.preventDefault();
    if (!edge.selected) selectOnly(undefined, edge.id);
    menuTarget.current = { id: edge.id, relation: true };
    setMenu({ x: event.clientX, y: event.clientY });
  }, [readOnly, selectOnly]);

  const onSelectionContextMenu = useCallback((event: ReactMouseEvent) => {
    if (readOnly) return;
    event.preventDefault();
    menuTarget.current = undefined;
    setMenu({ x: event.clientX, y: event.clientY });
  }, [readOnly]);

  // Clic derecho sobre el lienzo vacío: solo ofrece Pegar, y si no hay nada copiado queda el menú del navegador.
  const onPaneContextMenu = useCallback((event: ReactMouseEvent | MouseEvent) => {
    if (readOnly || !hasClipboard()) return;
    event.preventDefault();
    setMenu({ x: event.clientX, y: event.clientY, pane: true });
  }, [readOnly]);

  // Borra lo seleccionado igual que la tecla Supr.
  const deleteSelection = () => void deleteElements({ nodes: nodes.filter((n) => n.selected), edges: edges.filter((e) => e.selected) });

  // Botón de la barra: al pulsar la herramienta activa vuelve a la selección.
  const toolButton = (value: CanvasTool, label: string) => (
    <button type="button" className={`button${tool === value ? ' button--primary' : ''}`} aria-pressed={tool === value} onClick={() => setTool((active) => (active === value ? 'select' : value))}>
      {label}
    </button>
  );

  const selectedIds = nodes.filter((n) => n.selected).map((n) => n.id);
  const allLocked = nodes.filter((n) => n.selected).every((n) => (n.data as ElementNodeData).element.locked === true);

  // El orden de dibujo solo aplica a figuras, así que las acciones aparecen con nodos seleccionados.
  const reorderItems: ContextMenuItem[] = nodes.some((n) => n.selected)
    ? [
        { label: 'Traer al frente', onSelect: () => onReorder?.('front') },
        { label: 'Enviar al fondo', onSelect: () => onReorder?.('back') },
        { label: 'Traer adelante un nivel', onSelect: () => onReorder?.('forward') },
        { label: 'Enviar atrás un nivel', onSelect: () => onReorder?.('backward') },
      ]
    : [];

  // Estilo del elemento o flecha del clic derecho, o del primero seleccionado, para pegarlo luego.
  const copyStyle = () => {
    const targets = styleTargets(nodes.filter((n) => n.selected), edges.filter((e) => e.selected));
    const clicked = menuTarget.current;
    const source = targets.find((t) => t.id === clicked?.id && t.relation === clicked?.relation) ?? targets[0];
    if (source) copyStyleOf(source);
  };

  // Aplica el estilo copiado a toda la selección en un solo lote.
  const pasteStyle = () => {
    const style = copiedStyle();
    if (style) updateStyles(pasteUpdates(styleTargets(nodes.filter((n) => n.selected), edges.filter((e) => e.selected)), drawingTargets(nodes.filter((n) => n.selected)), style));
  };

  const pasteItem = { label: 'Pegar', onSelect: () => onPaste?.() };
  const menuItems: ContextMenuItem[] = menu?.pane ? [pasteItem] : [
    { label: 'Copiar', onSelect: () => onCopy?.() },
    { label: 'Cortar', onSelect: () => onCut?.() },
    // Pegar solo aparece con algo copiado.
    ...(hasClipboard() ? [pasteItem] : []),
    { label: 'Duplicar', onSelect: () => onDuplicate?.() },
    ...reorderItems,
    ...(selectedIds.length > 0 && onToggleLock ? [{ label: allLocked ? 'Desbloquear' : 'Bloquear', onSelect: () => onToggleLock(selectedIds, !allLocked) }] : []),
    { label: 'Copiar estilo', onSelect: copyStyle },
    ...(copiedStyle() ? [{ label: 'Pegar estilo', onSelect: pasteStyle }] : []),
    { label: 'Borrar', onSelect: deleteSelection },
  ];

  return (
    <>
      <div
        ref={canvas}
        className={`diagram-canvas${drawingMode || frameMode ? ' is-drawing' : ''}${bucketMode ? ' is-painting' : ''}${textMode ? ' is-placing' : ''}${handMode ? ' is-hand' : ''}`}
        onPointerDownCapture={startDrawing}
        onPointerMoveCapture={moveDrawing}
        onPointerUpCapture={finishDrawing}
        onPointerCancelCapture={cancelDrawing}
        onLostPointerCapture={loseDrawing}
      >
        <ReactFlow
          nodes={nodes}
          edges={edges}
          nodeTypes={nodeTypes}
          edgeTypes={edgeTypes}
          onNodesChange={onNodesChange}
          onEdgesChange={onEdgesChange}
          onNodeDragStop={onNodeDragStop}
          onDelete={onDelete}
          onNodeContextMenu={onNodeContextMenu}
          onEdgeContextMenu={onEdgeContextMenu}
          onSelectionContextMenu={onSelectionContextMenu}
          onPaneContextMenu={onPaneContextMenu}
          nodesDraggable={!readOnly && !drawingMode && !bucketMode && !handMode && !frameMode}
          onNodeClick={paintNode}
          onConnect={onConnect}
          onEdgeDoubleClick={(_, edge) => !readOnly && setEditingEdge(edge.id)}
          onSelectionChange={onSelectionChange}
          nodesConnectable={!readOnly && !drawingMode && !bucketMode && !handMode && !frameMode}
          connectionMode={ConnectionMode.Loose}
          elementsSelectable={!bucketMode && !handMode}
          selectionOnDrag={!drawingMode && !bucketMode && !handMode && !frameMode}
          selectionMode={SelectionMode.Partial}
          panOnScroll
          panOnDrag={handMode}
          panActivationKeyCode="Space"
          deleteKeyCode={readOnly ? null : ['Delete', 'Backspace']}
          minZoom={0.05}
          maxZoom={4}
          proOptions={PRO_OPTIONS}
        >
          <Background variant={BackgroundVariant.Dots} gap={20} size={1} color="#d5d9e0" />
          <MiniMap pannable zoomable nodeColor={nodeColor} nodeStrokeColor="#9aa5b1" style={MINIMAP_STYLE} />
          <Controls showInteractive={false} />
          {readOnly ? null : <SelectionPanel nodes={nodes} edges={edges} editingEdge={editingEdge} onEditEdge={setEditingEdge} />}
          {readOnly ? null : (
            <Panel position="top-left" className="drawing-tool nodrag nopan">
              {toolButton('select', 'Selección')}
              {toolButton('hand', 'Mano')}
              {toolButton('pen', 'Lápiz')}
              {toolButton('highlighter', 'Marcador')}
              {drawingMode ? (
                <input type="color" aria-label={highlighter ? 'Color del marcador' : 'Color del lápiz'} value={drawingColor} onChange={(event) => setColors((current) => ({ ...current, [tool]: event.target.value }))} />
              ) : null}
              {drawingMode ? (
                <WidthPicker label={highlighter ? 'Grosor del marcador' : 'Grosor del lápiz'} value={widths[tool]} onPick={(width) => setWidths((current) => ({ ...current, [tool]: width }))} />
              ) : null}
              {toolButton('bucket', 'Balde')}
              {bucketMode ? <input type="color" aria-label="Color del balde" value={bucketColor} onChange={(event) => setColors((current) => ({ ...current, bucket: event.target.value }))} /> : null}
              {toolButton('text', 'Texto')}
              {toolButton('frame', 'Marco')}
            </Panel>
          )}
        </ReactFlow>
        {preview.length > 1 ? (
          <svg className="diagram-canvas__preview" aria-hidden="true">
            <polyline points={preview.map((p) => `${p.x},${p.y}`).join(' ')} fill="none" stroke={drawingColor} strokeOpacity={highlighter ? HIGHLIGHTER_OPACITY : undefined} strokeWidth={drawingWidth * zoom} strokeLinecap="round" strokeLinejoin="round" />

          </svg>
        ) : null}
        {framePreviewBox ? <div className="diagram-canvas__frame" style={{ left: framePreviewBox.x, top: framePreviewBox.y, width: framePreviewBox.width, height: framePreviewBox.height }} /> : null}
      </div>
      {/* Fuera del lienzo: sus manejadores de puntero no deben capturar los clics del menú. */}
      {menu ? <ContextMenu x={menu.x} y={menu.y} items={menuItems} onClose={closeMenu} /> : null}
    </>
  );
}
