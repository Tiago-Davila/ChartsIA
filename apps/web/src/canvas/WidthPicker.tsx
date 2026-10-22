import { LINE_WIDTHS, type StyleLineWidth } from '@chartsia/core/model';
import { WIDTH_LABELS } from './style-edits';

/** Grosor de la muestra dibujada en cada botón. */
const SAMPLE_PX: Record<StyleLineWidth, number> = { thin: 1, medium: 2.5, thick: 5 };

/** Tres botones de grosor (fino, medio, grueso); marca el grosor actual si es común. */
export function WidthPicker({ label, value, onPick }: { label: string; value?: StyleLineWidth; onPick(width: StyleLineWidth): void }) {
  return (
    <div className="style-panel__row" role="group" aria-label={label}>
      <span className="style-panel__label">{label}</span>
      <div className="width-picker">
        {LINE_WIDTHS.map((width) => (
          <button key={width} type="button" className="button width-picker__option" aria-label={`${label}: ${WIDTH_LABELS[width]}`} title={WIDTH_LABELS[width]} aria-pressed={value === width} onClick={() => onPick(width)}>
            <svg width="28" height="12" viewBox="0 0 28 12" aria-hidden="true">
              <line x1="2" y1="6" x2="26" y2="6" stroke="currentColor" strokeWidth={SAMPLE_PX[width]} strokeLinecap="round" />
            </svg>
          </button>
        ))}
      </div>
    </div>
  );
}
