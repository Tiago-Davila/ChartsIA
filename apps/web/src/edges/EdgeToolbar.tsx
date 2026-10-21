import { ARROWHEADS, type Arrowheads, CARDINALITIES, type Cardinality, MULTIPLICITY_RELATION_KINDS, type Point, type Relation, type RelationKind, SIDES, type Side } from '@chartsia/core/model';
import { EdgeLabelRenderer, useReactFlow } from '@xyflow/react';
import { useState } from 'react';
import { insertWaypoint, kindChanges, relationKinds, reverseChanges, segmentMidpoints } from '../canvas/edge-edits';
import { useDiagramEditActions } from '../nodes/edit-context';
import { useDiagramStore } from '../state/diagram-store';

const KIND_LABELS: Record<RelationKind, string> = {
  association: 'Asociación',
  aggregation: 'Agregación',
  composition: 'Composición',
  inheritance: 'Herencia',
  realization: 'Implementación',
  dependency: 'Dependencia',
  'c4-rel': 'Relación',
  'er-rel': 'Relación ER',
  'er-attr': 'Atributo ER',
  connector: 'Conector libre',
};

const CARDINALITY_LABELS: Record<Cardinality, string> = {
  one: 'Uno',
  'zero-one': 'Cero o uno',
  'one-many': 'Uno o muchos',
  'zero-many': 'Cero o muchos',
};

/** Selector de cardinalidad (pata de gallo) de un extremo de una relación ER. */
function CardinalitySelect({ label, value, onChange }: { label: string; value?: Cardinality; onChange(value: Cardinality): void }) {
  return (
    <select aria-label={label} title={label} value={value ?? 'one'} onChange={(e) => onChange(e.target.value as Cardinality)}>
      {CARDINALITIES.map((c) => (
        <option key={c} value={c}>
          {label}: {CARDINALITY_LABELS[c]}
        </option>
      ))}
    </select>
  );
}

const ARROWHEAD_LABELS: Record<Arrowheads, string> = { none: 'Sin punta', end: 'Punta en destino', both: 'Punta en ambos' };

const SIDE_LABELS: Record<Side, string> = { top: 'Arriba', right: 'Derecha', bottom: 'Abajo', left: 'Izquierda' };

/** Selector de lado de una punta de la flecha ("auto" lo elige el hub). */
function SideSelect({ label, value, onChange }: { label: string; value?: Side; onChange(side: Side | null): void }) {
  return (
    <select aria-label={label} title={label} value={value ?? ''} onChange={(e) => onChange((e.target.value || null) as Side | null)}>
      <option value="">{label}: auto</option>
      {SIDES.map((s) => (
        <option key={s} value={s}>
          {label}: {SIDE_LABELS[s]}
        </option>
      ))}
    </select>
  );
}

/** Formulario de etiqueta y multiplicidades; Enter guarda y Escape cancela. */
function EdgeTextForm({ relation, onDone }: { relation: Relation; onDone(): void }) {
  const { updateRelation } = useDiagramEditActions();
  const [label, setLabel] = useState(relation.label ?? '');
  const [source, setSource] = useState(relation.sourceMultiplicity ?? '');
  const [target, setTarget] = useState(relation.targetMultiplicity ?? '');
  const multiplicities = (MULTIPLICITY_RELATION_KINDS as readonly string[]).includes(relation.kind);
  const save = () => {
    updateRelation(relation.id, {
      label: label.trim() || null,
      ...(multiplicities ? { sourceMultiplicity: source.trim() || null, targetMultiplicity: target.trim() || null } : {}),
    });
    onDone();
  };
  return (
    <form
      className="edge-form"
      onSubmit={(e) => {
        e.preventDefault();
        save();
      }}
      onKeyDown={(e) => {
        e.stopPropagation();
        if (e.key === 'Escape') onDone();
      }}
    >
      <input aria-label="Etiqueta" placeholder="Etiqueta" value={label} autoFocus onChange={(e) => setLabel(e.target.value)} />
      {multiplicities ? (
        <>
          <input aria-label="Multiplicidad origen" placeholder="Origen (1, 0..1, *)" value={source} onChange={(e) => setSource(e.target.value)} />
          <input aria-label="Multiplicidad destino" placeholder="Destino (1, 0..1, *)" value={target} onChange={(e) => setTarget(e.target.value)} />
        </>
      ) : null}
      <button type="submit" className="button button--primary">
        Guardar
      </button>
    </form>
  );
}

/** Tirador arrastrable: al soltarlo informa la posición en coordenadas del diagrama. */
function DragHandle({ at, label, onDrop }: { at: Point; label: string; onDrop(point: Point): void }) {
  const { screenToFlowPosition } = useReactFlow();
  const [drag, setDrag] = useState<Point>();
  const p = drag ?? at;
  return (
    <div
      className="edge-handle nodrag nopan"
      role="button"
      aria-label={label}
      title={label}
      style={{ transform: `translate(-50%, -50%) translate(${p.x}px, ${p.y}px)` }}
      onPointerDown={(e) => {
        e.stopPropagation();
        e.currentTarget.setPointerCapture(e.pointerId);
        setDrag(at);
      }}
      onPointerMove={(e) => {
        if (drag) setDrag(screenToFlowPosition({ x: e.clientX, y: e.clientY }));
      }}
      onPointerUp={() => {
        if (drag && (drag.x !== at.x || drag.y !== at.y)) onDrop({ x: Math.round(drag.x), y: Math.round(drag.y) });
        setDrag(undefined);
      }}
    />
  );
}

/** Tiradores sobre la flecha seleccionada: crear quiebres arrastrando un tramo o mover los existentes. */
export function EdgeHandles({ relation }: { relation: Relation }) {
  const { updateRelation } = useDiagramEditActions();
  const route = relation.route ?? [];
  if (route.length < 2) return null;
  const waypoints = relation.waypoints ?? [];
  return (
    <EdgeLabelRenderer>
      {segmentMidpoints(route).map((mid, i) => (
        <DragHandle key={`m${i}`} at={mid} label="Arrastrar para quebrar la flecha" onDrop={(point) => updateRelation(relation.id, { waypoints: insertWaypoint(route, waypoints, i, point) })} />
      ))}
      {waypoints.map((w, i) => (
        <DragHandle key={`w${i}`} at={w} label="Mover quiebre" onDrop={(point) => updateRelation(relation.id, { waypoints: waypoints.map((p, j) => (j === i ? point : p)) })} />
      ))}
    </EdgeLabelRenderer>
  );
}

/** Barra de la flecha seleccionada: tipo, invertir, lados, textos y quitar quiebres. */
export function EdgePanel({ relation, editingText, onEditText }: { relation: Relation; editingText: boolean; onEditText(open: boolean): void }) {
  const { updateRelation } = useDiagramEditActions();
  const type = useDiagramStore((s) => s.diagram?.type);
  if (!type) return null;
  const update = (changes: Parameters<typeof updateRelation>[1]) => updateRelation(relation.id, changes);

  if (editingText) return <EdgeTextForm relation={relation} onDone={() => onEditText(false)} />;
  return (
    <>
      <select aria-label="Tipo de flecha" value={relation.kind} onChange={(e) => update(kindChanges(relation, e.target.value as RelationKind))}>
        {relationKinds(type).map((k) => (
          <option key={k} value={k}>
            {KIND_LABELS[k]}
          </option>
        ))}
      </select>
      <button type="button" className="button" onClick={() => update(reverseChanges(relation))}>
        Invertir
      </button>
      {relation.kind === 'er-rel' ? (
        <>
          <CardinalitySelect label="Cardinalidad origen" value={relation.sourceCardinality} onChange={(value) => update({ sourceCardinality: value })} />
          <CardinalitySelect label="Cardinalidad destino" value={relation.targetCardinality} onChange={(value) => update({ targetCardinality: value })} />
          <label>
            <input type="checkbox" checked={relation.identifying ?? false} onChange={(e) => update({ identifying: e.target.checked })} /> Identificante
          </label>
        </>
      ) : null}
      {relation.kind === 'connector' ? (
        <>
          <select aria-label="Puntas" title="Puntas" value={relation.arrowheads ?? 'end'} onChange={(e) => update({ arrowheads: e.target.value as Arrowheads })}>
            {ARROWHEADS.map((a) => (
              <option key={a} value={a}>
                {ARROWHEAD_LABELS[a]}
              </option>
            ))}
          </select>
          <label>
            <input type="checkbox" checked={relation.dashed ?? false} onChange={(e) => update({ dashed: e.target.checked })} /> Discontinua
          </label>
        </>
      ) : null}
      <SideSelect label="Salida" value={relation.sourceSide} onChange={(side) => update({ sourceSide: side })} />
      <SideSelect label="Llegada" value={relation.targetSide} onChange={(side) => update({ targetSide: side })} />
      <button type="button" className="button" onClick={() => onEditText(true)}>
        Textos
      </button>
      {relation.waypoints?.length ? (
        <button type="button" className="button" onClick={() => update({ waypoints: null })}>
          Quitar quiebres
        </button>
      ) : null}
    </>
  );
}
