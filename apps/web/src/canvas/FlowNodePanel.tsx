import { type ElementOfKind, FLOW_VARIANTS } from '@chartsia/core/model';
import { useEffect, useState } from 'react';
import { FLOW_VARIANT_LABELS } from '../app/labels';
import { useDiagramEditActions } from '../nodes/edit-context';

/** Variante y subtítulo del nodo de flujo seleccionado; el subtítulo se guarda al salir del campo o con Enter. */
export function FlowNodePanel({ element }: { element: ElementOfKind<'flow-node'> }) {
  const { editText } = useDiagramEditActions();
  const [subtitle, setSubtitle] = useState(element.subtitle ?? '');
  useEffect(() => setSubtitle(element.subtitle ?? ''), [element.id, element.subtitle]);
  const save = () => {
    if (subtitle.trim() !== (element.subtitle ?? '')) editText(element.id, 'subtitle', subtitle);
  };
  return (
    <>
      <select aria-label="Variante" title="Variante" value={element.variant} onChange={(e) => editText(element.id, 'variant', e.target.value)}>
        {FLOW_VARIANTS.map((variant) => (
          <option key={variant} value={variant}>
            {FLOW_VARIANT_LABELS[variant]}
          </option>
        ))}
      </select>
      <input
        aria-label="Subtítulo"
        placeholder="Subtítulo: ruta, firma, endpoint…"
        value={subtitle}
        maxLength={200}
        onChange={(e) => setSubtitle(e.target.value)}
        onBlur={save}
        onKeyDown={(e) => {
          e.stopPropagation();
          if (e.key === 'Enter') save();
        }}
      />
    </>
  );
}
