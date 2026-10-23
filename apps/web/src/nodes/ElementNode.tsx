import { CSS_FONT_FAMILIES, measureElement, type Primitive } from '@chartsia/core/shapes';
import { Handle, NodeResizer, type NodeProps, Position } from '@xyflow/react';
import { type CSSProperties, memo, useCallback, useEffect, useMemo, useState } from 'react';
import { memberKinds, slotValue } from '../canvas/slot-edits';
import { suggestTypes, typeContext } from '../canvas/type-suggestions';
import { CleanShape } from '../render/CleanShape';
import { shapePrimitives } from '../render/shape-cache';
import { useDiagramEditActions } from './edit-context';
import { diagramStore } from '../state/diagram-store';
import { InlineEditableText, type Suggestions } from './InlineEditableText';
import { MemberControls } from './MemberControls';
import { TextBlockEditor } from './TextBlockEditor';
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
  const { editText, addMember, removeMember, resize, readOnly } = useDiagramEditActions();
  const [editing, setEditing] = useState<TextPrimitive>();
  // Bloque de texto en edición multilínea (su markdown completo).
  const [writing, setWriting] = useState(false);
  // Slot del miembro recién agregado: cuando llega al diagrama se abre en edición.
  const [newSlot, setNewSlot] = useState<string>();
  const showMemberControls = selected && !readOnly && memberKinds(element).length > 0;

  // Un bloque recién creado con la herramienta Texto se abre en edición al llegar al lienzo.
  useEffect(() => {
    if (element.kind !== 'text' || diagramStore.getState().pendingTextEdit !== id) return;
    diagramStore.getState().setPendingTextEdit(undefined);
    if (!readOnly) setWriting(true);
  }, [element.kind, id, readOnly]);

  useEffect(() => {
    if (!newSlot) return;
    const line = shapePrimitives(element, size).find((p): p is TextPrimitive => p.type === 'text' && p.slot === newSlot);
    if (!line) return;
    setNewSlot(undefined);
    setEditing(line);
  }, [element, newSlot, size.width, size.height]);

  const onTextDoubleClick = useCallback(
    (p: TextPrimitive) => {
      if (readOnly || !p.slot) return;
      if (element.kind === 'text') setWriting(true);
      else setEditing(p);
    },
    [element.kind, readOnly],
  );

  return (
    <div className={`chartsia-node${selected ? ' is-selected' : ''}`} style={{ width: size.width, height: size.height }} data-element-id={id}>
      <CleanShape element={element} size={size} onTextDoubleClick={onTextDoubleClick} />
      {selected && !readOnly && element.kind !== 'drawing' && element.kind !== 'text' ? (
        <NodeResizer minWidth={minimum.width} minHeight={minimum.height} color="var(--accent)" onResizeEnd={(_, box) => resize(id, box)} />
      ) : null}
      {showMemberControls ? (
        <MemberControls
          element={element}
          texts={shapePrimitives(element, size).filter((p): p is TextPrimitive => p.type === 'text')}
          onAdd={(kind) => void addMember(id, kind).then(setNewSlot)}
          onRemove={(slot) => removeMember(id, slot)}
        />
      ) : null}
      <Handle type="target"position={Position.Top} isConnectable={!readOnly} className="chartsia-handle" />
      <Handle type="source" position={Position.Bottom} isConnectable={!readOnly} className="chartsia-handle" />
      {writing && element.kind === 'text' ? (
        <TextBlockEditor
          value={element.name}
          width={size.width}
          height={size.height}
          onCommit={(value) => {
            setWriting(false);
            editText(id, 'name', value);
          }}
          onCancel={() => setWriting(false)}
        />
      ) : null}
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
