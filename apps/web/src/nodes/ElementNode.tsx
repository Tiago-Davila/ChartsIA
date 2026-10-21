import { CSS_FONT_FAMILIES, measureElement, type Primitive } from '@chartsia/core/shapes';
import { Handle, NodeResizer, type NodeProps, Position } from '@xyflow/react';
import { type CSSProperties, memo, useCallback, useMemo, useState } from 'react';
import { slotValue } from '../canvas/slot-edits';
import { suggestTypes, typeContext } from '../canvas/type-suggestions';
import { CleanShape } from '../render/CleanShape';
import { useDiagramEditActions } from './edit-context';
import { diagramStore } from '../state/diagram-store';
import { InlineEditableText, type Suggestions } from './InlineEditableText';
import { type ElementFlowNode } from './types';

type TextPrimitive = Extract<Primitive, { type: 'text' }>;

function editorStyle(p: TextPrimitive, width: number): CSSProperties {
  const height = Math.round(p.size * 1.5);
  const top = p.y - p.size * 1.05;
  const fontFamily = p.fontFamily ? CSS_FONT_FAMILIES[p.fontFamily] : undefined;
  if (p.anchor === 'middle') return { left: 8, top, width: width - 16, height, fontSize: p.size, fontFamily, textAlign: 'center' };
  return { left: p.x - 3, top, width: Math.max(80, width - p.x - 6), height, fontSize: p.size, fontFamily };
}

/** Autocompletado de tipos para los slots de atributos y operaciones. */
function typeSuggester(slot: string): ((text: string, caret: number) => Suggestions | undefined) | undefined {
  const field = slot.startsWith('attribute:') ? 'attribute' : slot.startsWith('operation:') ? 'operation' : undefined;
  if (!field) return undefined;
  return (text, caret) => {
    const context = typeContext(text, caret, field);
    return context && { context, items: suggestTypes(context, diagramStore.getState().diagram) };
  };
}

/**
 * Nodo genérico de un elemento: dibuja la forma del registro del núcleo y permite editar en
 * línea los textos con `slot`. Las aristas usan sus propias rutas, así que los handles solo
 * existen para que React Flow las conecte (invisibles, no conectables).
 */
function ElementNodeImpl({ id, data, width, height, selected }: NodeProps<ElementFlowNode>) {
  const { element } = data;
  const minimum = useMemo(() => measureElement(element), [element]);
  const size = { width: width ?? minimum.width, height: height ?? minimum.height };
  const { editText, resize, readOnly } = useDiagramEditActions();
  const [editing, setEditing] = useState<TextPrimitive>();

  const onTextDoubleClick = useCallback(
    (p: TextPrimitive) => {
      if (!readOnly && p.slot) setEditing(p);
    },
    [readOnly],
  );

  return (
    <div className={`chartsia-node${selected ? ' is-selected' : ''}`} style={{ width: size.width, height: size.height }} data-element-id={id}>
      <CleanShape element={element} size={size} onTextDoubleClick={onTextDoubleClick} />
      {selected && !readOnly ? (
        <NodeResizer minWidth={minimum.width} minHeight={minimum.height} color="var(--accent)" onResizeEnd={(_, box) => resize(id, box)} />
      ) : null}
      <Handle type="target" position={Position.Top} isConnectable={!readOnly} className="chartsia-handle" />
      <Handle type="source" position={Position.Bottom} isConnectable={!readOnly} className="chartsia-handle" />
      {editing ? (
        <InlineEditableText
          value={slotValue(element, editing.slot!, editing.text)}
          style={editorStyle(editing, size.width)}
          onCommit={(value) => {
            setEditing(undefined);
            editText(id, editing.slot!, value);
          }}
          onCancel={() => setEditing(undefined)}
          suggest={typeSuggester(editing.slot!)}
        />
      ) : null}
    </div>
  );
}

export const ElementNode = memo(ElementNodeImpl);
