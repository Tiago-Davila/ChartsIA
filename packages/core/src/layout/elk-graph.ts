import elkModule, { type ElkExtendedEdge, type ElkNode } from 'elkjs/lib/elk.bundled.js';
import { type Diagram } from '../model/diagram.js';
import { isGroupKind } from '../model/enums.js';
import { groupPadding } from '../shapes/registry.js';
import { type Size } from '../shapes/types.js';
import { type Rect } from './types.js';

const byId = <T extends { id: string }>(a: T, b: T) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0);

/** Espaciado: también se aplica a cada grupo, porque ELK no lo hereda de la raíz. */
const SPACING: Record<string, string> = {
  'elk.spacing.nodeNode': '60',
  'elk.layered.spacing.nodeNodeBetweenLayers': '80',
  'elk.spacing.edgeNode': '30',
};

const BASE_OPTIONS: Record<string, string> = {
  'elk.algorithm': 'layered',
  'elk.direction': 'DOWN',
  'elk.hierarchyHandling': 'INCLUDE_CHILDREN',
  'elk.edgeRouting': 'ORTHOGONAL',
  'elk.randomSeed': '1',
  ...SPACING,
  'elk.layered.considerModelOrder.strategy': 'NODES_AND_EDGES',
  'elk.layered.nodePlacement.strategy': 'BRANDES_KOEPF',
  'elk.padding': '[top=30,left=30,bottom=30,right=30]',
};

const INTERACTIVE_OPTIONS: Record<string, string> = {
  'elk.layered.layering.strategy': 'INTERACTIVE',
  'elk.layered.crossingMinimization.semiInteractive': 'true',
  'elk.layered.cycleBreaking.strategy': 'INTERACTIVE',
};

/** En herencia y realización el padre va arriba: se invierte el sentido para ELK. */
function upward(kind: string): boolean {
  return kind === 'inheritance' || kind === 'realization';
}

export interface ElkInput {
  diagram: Diagram;
  sizes: Map<string, Size>;
  /** Posiciones absolutas previas para el modo interactivo (layout incremental). */
  seeds?: Map<string, Rect>;
}

/**
 * Convierte el modelo en un grafo ELK con orden estable por id, grupos como nodos
 * compuestos y semilla fija, para que la misma entrada produzca el mismo resultado.
 */
export function buildElkGraph({ diagram, sizes, seeds }: ElkInput): ElkNode {
  const elements = [...diagram.elements].sort(byId);
  const ids = new Set(elements.map((e) => e.id));
  const nodes = new Map<string, ElkNode>();
  for (const el of elements) {
    const size = sizes.get(el.id)!;
    const node: ElkNode = { id: el.id, width: size.width, height: size.height };
    if (isGroupKind(el.kind)) {
      const p = groupPadding(el);
      node.layoutOptions = {
        ...SPACING,
        'elk.padding': `[top=${p.top},left=${p.left},bottom=${p.bottom},right=${p.right}]`,
        'elk.nodeSize.constraints': 'MINIMUM_SIZE',
        'elk.nodeSize.minimum': `(${size.width},${size.height})`,
      };
      node.children = [];
    }
    nodes.set(el.id, node);
  }
  const root: ElkNode = { id: '__root__', layoutOptions: { ...BASE_OPTIONS, ...(seeds ? INTERACTIVE_OPTIONS : {}) }, children: [] };
  for (const el of elements) {
    const parent = el.parentId && ids.has(el.parentId) ? nodes.get(el.parentId)! : root;
    const node = nodes.get(el.id)!;
    const seed = seeds?.get(el.id);
    const parentSeed = el.parentId ? seeds?.get(el.parentId) : undefined;
    if (seed) {
      node.x = seed.x - (parentSeed?.x ?? 0);
      node.y = seed.y - (parentSeed?.y ?? 0);
    }
    (parent.children ??= []).push(node);
  }
  const edges: ElkExtendedEdge[] = [...diagram.relations]
    .sort(byId)
    .filter((r) => ids.has(r.source) && ids.has(r.target) && r.source !== r.target)
    .map((r) => (upward(r.kind) ? { id: r.id, sources: [r.target], targets: [r.source] } : { id: r.id, sources: [r.source], targets: [r.target] }));
  root.edges = edges;
  return root;
}

// elkjs es CommonJS: según el cargador, el constructor llega directo o en `.default`.
type ElkConstructor = (typeof elkModule)['default'];
const ELK = ((elkModule as unknown as { default?: ElkConstructor }).default ?? elkModule) as ElkConstructor;

let engine: InstanceType<ElkConstructor> | undefined;

export async function runElk(graph: ElkNode): Promise<Map<string, Rect>> {
  engine ??= new ELK();
  const result = await engine.layout(graph);
  const out = new Map<string, Rect>();
  const walk = (node: ElkNode, ox: number, oy: number) => {
    for (const child of node.children ?? []) {
      const x = ox + (child.x ?? 0);
      const y = oy + (child.y ?? 0);
      out.set(child.id, { x, y, width: child.width ?? 0, height: child.height ?? 0 });
      walk(child, x, y);
    }
  };
  walk(result, 0, 0);
  return out;
}
