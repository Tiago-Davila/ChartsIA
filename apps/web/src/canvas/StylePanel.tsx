import { FONT_FAMILIES, FONT_SIZE_MAX, FONT_SIZE_MIN, type Style } from '@chartsia/core/model';
import { Panel } from '@xyflow/react';
import { useEffect, useRef, useState } from 'react';
import { useDiagramEditActions } from '../nodes/edit-context';
import { commonValue, fieldUpdates, PALETTE, parseFontSize, resetUpdates, type StyleTarget } from './style-edits';

const FONT_LABELS: Record<(typeof FONT_FAMILIES)[number], string> = {
  'sans-serif': 'Sans serif',
  serif: 'Serif',
  monospace: 'Monoespaciada',
  handwritten: 'Manuscrita',
};

/** Color que muestra el selector libre cuando el objetivo aún no tiene uno. */
const PICKER_FALLBACK = '#808080';

/** Selector libre de color: confirma al cerrar el selector, no en cada paso del arrastre. */
function FreeColor({ label, value, onPick }: { label: string; value?: string; onPick(color: string): void }) {
  const [draft, setDraft] = useState(value ?? PICKER_FALLBACK);
  const ref = useRef<HTMLInputElement>(null);
  const onPickRef = useRef(onPick);
  onPickRef.current = onPick;
  useEffect(() => setDraft(value ?? PICKER_FALLBACK), [value]);
  // React llama a onChange en cada paso del arrastre; el evento nativo "change" llega al confirmar.
  useEffect(() => {
    const input = ref.current;
    const confirm = () => onPickRef.current(input!.value);
    input?.addEventListener('change', confirm);
    return () => input?.removeEventListener('change', confirm);
  }, []);
  return <input ref={ref} type="color" aria-label={`${label} libre`} title={`${label} libre`} value={draft} onChange={(e) => setDraft(e.target.value)} />;
}

/** Fila de un color: paleta fija más selector libre. */
function ColorField({ label, value, onPick }: { label: string; value?: string; onPick(color: string): void }) {
  return (
    <div className="style-panel__row" role="group" aria-label={label}>
      <span className="style-panel__label">{label}</span>
      <div className="style-panel__swatches">
        {PALETTE.map((color) => (
          <button
            key={color.value}
            type="button"
            className="style-panel__swatch"
            style={{ background: color.value }}
            aria-label={`${label}: ${color.name}`}
            title={color.name}
            aria-pressed={value?.toLowerCase() === color.value}
            onClick={() => onPick(color.value)}
          />
        ))}
        <FreeColor label={label} value={value} onPick={onPick} />
      </div>
    </div>
  );
}

/** Tamaño de fuente: se confirma con Enter o al salir del campo. */
function FontSizeField({ value, onPick }: { value?: number; onPick(size: number | undefined): void }) {
  const [draft, setDraft] = useState(value === undefined ? '' : String(value));
  useEffect(() => setDraft(value === undefined ? '' : String(value)), [value]);
  const commit = () => {
    const size = parseFontSize(draft);
    setDraft(size === undefined ? '' : String(size));
    if (size !== value) onPick(size);
  };
  return (
    <label className="style-panel__row">
      <span className="style-panel__label">Tamaño de fuente</span>
      <input
        type="number"
        min={FONT_SIZE_MIN}
        max={FONT_SIZE_MAX}
        step={1}
        placeholder="Auto"
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onBlur={commit}
        onKeyDown={(e) => {
          e.stopPropagation();
          if (e.key === 'Enter') commit();
        }}
      />
    </label>
  );
}

/** Panel de estilo del elemento o la flecha seleccionada; con varios, aplica el cambio a todos en un lote. */
export function StylePanel({ targets }: { targets: StyleTarget[] }) {
  const { updateStyles } = useDiagramEditActions();
  if (targets.length === 0) return null;
  const set = <K extends keyof Style>(field: K, value: Style[K] | undefined) => updateStyles(fieldUpdates(targets, field, value));
  const onlyRelations = targets.every((t) => t.relation);
  return (
    <Panel position="top-right" className="style-panel nodrag nopan" role="region" aria-label="Estilo">
      <ColorField label={onlyRelations ? 'Color de línea' : 'Color de borde'} value={commonValue(targets, 'borderColor')} onPick={(c) => set('borderColor', c)} />
      <ColorField label="Relleno" value={commonValue(targets, 'fillColor')} onPick={(c) => set('fillColor', c)} />
      <ColorField label="Color de fuente" value={commonValue(targets, 'fontColor')} onPick={(c) => set('fontColor', c)} />
      <label className="style-panel__row">
        <span className="style-panel__label">Familia de fuente</span>
        <select value={commonValue(targets, 'fontFamily') ?? ''} onChange={(e) => set('fontFamily', (e.target.value || undefined) as Style['fontFamily'])}>
          <option value="">Predeterminada</option>
          {FONT_FAMILIES.map((family) => (
            <option key={family} value={family}>
              {FONT_LABELS[family]}
            </option>
          ))}
        </select>
      </label>
      <FontSizeField value={commonValue(targets, 'fontSize')} onPick={(size) => set('fontSize', size)} />
      <button type="button" className="button" disabled={!targets.some((t) => t.style)} onClick={() => updateStyles(resetUpdates(targets))}>
        Restablecer estilo
      </button>
    </Panel>
  );
}
