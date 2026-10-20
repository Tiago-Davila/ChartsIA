import { measureElement, type Primitive } from '@chartsia/core/shapes';
import { Handle, type NodeProps, Position } from '@xyflow/react';
import { type CSSProperties, memo, useCallback, useState } from 'react';
import { ShapeRenderer } from '../render/ShapeRenderer';
import { useDiagramEditActions } from './edit-context';
import { InlineEditableText } from './InlineEditableText';
import { type ElementFlowNode } from './types';

type TextPrimitive = Extract<Primitive, { type: 'text' }>;

function editorStyle(p: TextPrimitive, width: number): CSSProperties {
  const height = Math.round(p.size * 1.5);
  const top = p.y - p.size * 1.05;
  if (p.anchor === 'middle') return { left: 8, top, width: width - 16, height, fontSize: p.size, textAlign: 'center' };
  return { left: p.x - 3, top, width: Math.max(80, width - p.x - 6), height, fontSize: p.size };
}

/**
 * Nodo genérico de un elemento: dibuja la forma del registro del núcleo y permite editar en
 * línea los textos con `slot`. Las aristas usan sus propias rutas, así que los handles solo
 * existen para que React Flow las conecte (invisibles, no conectables).
 */
function ElementNodeImpl({ id, data, width, height, selected }: NodeProps<ElementFlowNode>) {
  const { element, style } = data;
  const fallback = width && height ? undefined : measureElement(element);
  const size = { width: width ?? fallback!.width, height: height ?? fallback!.height };
  const { editText, readOnly } = useDiagramEditActions();
  const [editing, setEditing] = useState<TextPrimitive>();

  const onTextDoubleClick = useCallback(
    (p: TextPrimitive) => {
      if (!readOnly && p.slot) setEditing(p);
    },
    [readOnly],
  );

  return (
    <div className={`chartsia-node${selected ? ' is-selected' : ''}`} style={{ width: size.width, height: size.height }} data-element-id={id}>
      <ShapeRenderer element={element} size={size} style={style} onTextDoubleClick={onTextDoubleClick} />
      <Handle type="target" position={Position.Top} isConnectable={false} className="chartsia-handle" />
      <Handle type="source" position={Position.Bottom} isConnectable={false} className="chartsia-handle" />
      {editing ? (
        <InlineEditableText
          value={editing.text}
          style={editorStyle(editing, size.width)}
          onCommit={(value) => {
            setEditing(undefined);
            editText(id, editing.slot!, value);
          }}
          onCancel={() => setEditing(undefined)}
        />
      ) : null}
    </div>
  );
}

export const ElementNode = memo(ElementNodeImpl);
