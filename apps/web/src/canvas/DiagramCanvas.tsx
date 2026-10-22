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
import { type PointerEvent as ReactPointerEvent, useCallback, useEffect, useRef, useState } from 'react';
import { DRAWING_DEFAULT_COLOR, DRAWING_DEFAULT_WIDTH, type Point } from '@chartsia/core/model';
import { edgeTypes } from '../edges';
import { nodeTypes } from '../nodes';
import { SelectionPanel } from './SelectionPanel';
import { sampleStroke } from './drawing';

export interface DiagramCanvasProps {
  diagramId: string;
  nodes: Node[];
  edges: Edge[];
  readOnly?: boolean;
  onNodeDragStop?: OnNodeDrag;
  onDelete?: (params: { nodes: Node[]; edges: Edge[] }) => void;
  onConnect?: OnConnect;
  onDraw?: (points: Point[], screenPoints: Point[], color: string) => void;
}

export const FIT_VIEW_OPTIONS = { padding: 0.15, maxZoom: 1.25 };
const PRO_OPTIONS = { hideAttribution: true };
const MINIMAP_STYLE = { width: 180, height: 120 };
const MAX_CAPTURE_POINTS = 2048;

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
export function DiagramCanvas({ diagramId, nodes: incomingNodes, edges: incomingEdges, readOnly = false, onNodeDragStop, onDelete, onConnect, onDraw }: DiagramCanvasProps) {
  const [nodes, setNodes, onNodesChange] = useNodesState(incomingNodes);
  const [edges, setEdges, onEdgesChange] = useEdgesState(incomingEdges);
  const { fitView, screenToFlowPosition } = useReactFlow();
  const { zoom } = useViewport();
  const initialized = useNodesInitialized();
  const canvas = useRef<HTMLDivElement>(null);
  const activePointer = useRef<number | undefined>(undefined);
  const strokePoints = useRef<Point[]>([]);
  const screenPoints = useRef<Point[]>([]);
  const [drawingMode, setDrawingMode] = useState(false);
  const [drawingColor, setDrawingColor] = useState(DRAWING_DEFAULT_COLOR);
  const [preview, setPreview] = useState<Point[]>([]);
  const fittedFor = useRef<string | null>(null);
  const [editingEdge, setEditingEdge] = useState<string>();
  // Cierra el formulario de textos cuando la flecha deja de estar seleccionada.
  const onSelectionChange = useCallback(({ edges: selected }: { edges: Edge[] }) => {
    setEditingEdge((id) => (selected.some((e) => e.id === id) ? id : undefined));
  }, []);

  // Cada actualización del hub reemplaza nodos y aristas, pero conserva lo seleccionado.
  useEffect(() => setNodes((prev) => keepSelection(prev, incomingNodes)), [incomingNodes, setNodes]);
  useEffect(() => setEdges((prev) => keepSelection(prev, incomingEdges)), [incomingEdges, setEdges]);
  useEffect(() => {
    const pointerId = activePointer.current;
    activePointer.current = undefined;
    if (pointerId !== undefined && canvas.current?.hasPointerCapture(pointerId)) canvas.current.releasePointerCapture(pointerId);
    strokePoints.current = [];
    screenPoints.current = [];
    setPreview([]);
    setDrawingMode(false);
  }, [diagramId]);
  // Al abrir otro diagrama se encuadra completo, cuando React Flow ya midió sus nodos.
  useEffect(() => {
    if (!initialized || fittedFor.current === diagramId) return;
    fittedFor.current = diagramId;
    void fitView(FIT_VIEW_OPTIONS);
  }, [initialized, diagramId, fitView]);

  // Convierte una muestra de pantalla al lienzo y la conserva para la vista previa.
  const addSample = useCallback((event: ReactPointerEvent<HTMLDivElement>, force = false) => {
    const rect = event.currentTarget.getBoundingClientRect();
    const screen = { x: event.clientX - rect.left, y: event.clientY - rect.top };
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

  const startDrawing = useCallback((event: ReactPointerEvent<HTMLDivElement>) => {
    if (!drawingMode || readOnly || event.button !== 0 || !(event.target instanceof Element) || event.target.closest('.react-flow__panel')) return;
    event.preventDefault();
    event.stopPropagation();
    activePointer.current = event.pointerId;
    event.currentTarget.setPointerCapture(event.pointerId);
    strokePoints.current = [];
    screenPoints.current = [];
    addSample(event, true);
  }, [addSample, drawingMode, readOnly]);

  const moveDrawing = useCallback((event: ReactPointerEvent<HTMLDivElement>) => {
    if (activePointer.current !== event.pointerId) return;
    event.preventDefault();
    event.stopPropagation();
    addSample(event);
  }, [addSample]);

  const finishDrawing = useCallback((event: ReactPointerEvent<HTMLDivElement>) => {
    if (activePointer.current !== event.pointerId) return;
    event.preventDefault();
    event.stopPropagation();
    addSample(event, true);
    const points = strokePoints.current;
    const screen = screenPoints.current;
    activePointer.current = undefined;
    strokePoints.current = [];
    screenPoints.current = [];
    setPreview([]);
    if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId);
    onDraw?.(points, screen, drawingColor);
  }, [addSample, drawingColor, onDraw]);

  const cancelDrawing = useCallback((event: ReactPointerEvent<HTMLDivElement>) => {
    if (activePointer.current !== event.pointerId) return;
    activePointer.current = undefined;
    strokePoints.current = [];
    screenPoints.current = [];
    setPreview([]);
    if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId);
  }, []);

  const loseDrawing = useCallback((event: ReactPointerEvent<HTMLDivElement>) => {
    if (activePointer.current !== event.pointerId) return;
    activePointer.current = undefined;
    strokePoints.current = [];
    screenPoints.current = [];
    setPreview([]);
  }, []);

  return (
    <div
      ref={canvas}
      className={`diagram-canvas${drawingMode ? ' is-drawing' : ''}`}
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
        nodesDraggable={!readOnly && !drawingMode}
        onConnect={onConnect}
        onEdgeDoubleClick={(_, edge) => !readOnly && setEditingEdge(edge.id)}
        onSelectionChange={onSelectionChange}
        nodesConnectable={!readOnly && !drawingMode}
        connectionMode={ConnectionMode.Loose}
        elementsSelectable
        selectionOnDrag={!drawingMode}
        selectionMode={SelectionMode.Partial}
        panOnScroll
        panOnDrag={false}
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
            <button type="button" className={`button${drawingMode ? ' button--primary' : ''}`} aria-pressed={drawingMode} onClick={() => setDrawingMode((active) => !active)}>
              Lápiz
            </button>
            {drawingMode ? <input type="color" aria-label="Color del lápiz" value={drawingColor} onChange={(event) => setDrawingColor(event.target.value)} /> : null}
          </Panel>
        )}
      </ReactFlow>
      {preview.length > 1 ? (
        <svg className="diagram-canvas__preview" aria-hidden="true">
          <polyline points={preview.map((p) => `${p.x},${p.y}`).join(' ')} fill="none" stroke={drawingColor} strokeWidth={DRAWING_DEFAULT_WIDTH * zoom} strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      ) : null}
    </div>
  );
}
