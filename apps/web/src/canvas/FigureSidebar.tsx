import { FIGURE_DRAG_TYPE, PALETTE_ITEMS } from './figure-palette';

/** Barra derecha con todas las figuras, para arrastrarlas al lienzo de cualquier tipo de diagrama. */
export function FigureSidebar() {
  return (
    <aside className="figure-sidebar" aria-label="Figuras">
      <h2 className="figure-sidebar__title">Figuras</h2>
      <div className="figure-sidebar__list">
        {PALETTE_ITEMS.map((item) => (
          <div
            key={item.key}
            className="figure-sidebar__item"
            draggable
            data-figure={item.key}
            onDragStart={(event) => {
              event.dataTransfer.setData(FIGURE_DRAG_TYPE, item.key);
              event.dataTransfer.effectAllowed = 'copy';
            }}
          >
            {item.label}
          </div>
        ))}
      </div>
    </aside>
  );
}
