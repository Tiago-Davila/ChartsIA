import { type DiagramContent } from '@chartsia/core/model';
import { legendEntries } from '@chartsia/core/shapes';
import { useMemo } from 'react';

/** Leyenda C4 flotante (FR-015), solo con los tipos presentes en el diagrama. */
export function C4Legend({ diagram }: { diagram: DiagramContent }) {
  const entries = useMemo(() => legendEntries(diagram), [diagram]);
  if (entries.length === 0) return null;
  return (
    <aside className="c4-legend" aria-label="Leyenda C4">
      <h2>Leyenda</h2>
      <ul>
        {entries.map((e) => (
          <li key={e.key}>
            <span
              className={`c4-legend__swatch${e.key === 'relationship' ? ' is-line' : ''}`}
              style={{ background: e.fill === 'none' ? 'transparent' : e.fill, borderColor: e.stroke, borderStyle: e.dashed ? 'dashed' : 'solid' }}
              aria-hidden
            />
            {e.label}
          </li>
        ))}
      </ul>
    </aside>
  );
}
