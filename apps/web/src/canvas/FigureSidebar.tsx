import { FIGURE_DRAG_TYPE, paletteSections } from './figure-palette';

const secciones = paletteSections();

/** Barra derecha con las figuras agrupadas por tipo: se arrastran al lienzo o, con doble clic, se agregan al centro. */
export function FigureSidebar({ onAdd }: { onAdd(key: string): void }) {
  return (
    <aside className="figure-sidebar" aria-label="Figuras">
      <h2 className="figure-sidebar__title">Figuras</h2>
      <div className="figure-sidebar__list">
        {secciones.map((seccion) => (
          <details key={seccion.id} className="figure-sidebar__section" open>
            <summary className="figure-sidebar__section-title">{seccion.title}</summary>
            <div className="figure-sidebar__items">
              {seccion.items.map((item) => (
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
          </details>
        ))}
      </div>
    </aside>
  );
}
