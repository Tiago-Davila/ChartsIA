import { type DiagramType } from '@chartsia/core/model';
import { FIGURE_DRAG_TYPE, paletteFor } from './figure-palette';

/** Barra derecha con las figuras del tipo de diagrama: se arrastran al lienzo o, con doble clic, se agregan al centro. */
export function FigureSidebar({ type, onAdd }: { type: DiagramType; onAdd(key: string): void }) {
  return (
    <aside className="figure-sidebar" aria-label="Figuras">
      <h2 className="figure-sidebar__title">Figuras</h2>
      <div className="figure-sidebar__list">
        {paletteFor(type).map((item) => (
          <div
            key={item.key}
            className="figure-sidebar__item"
            draggable
            data-figure={item.key}
            onDragStart={(event) => {
              event.dataTransfer.setData(FIGURE_DRAG_TYPE, item.key);
              event.dataTransfer.effectAllowed = 'copy';
            }}
            onDoubleClick={() => onAdd(item.key)}
          >
            {item.label}
          </div>
        ))}
      </div>
    </aside>
  );
}
