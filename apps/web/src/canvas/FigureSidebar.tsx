import { type DiagramType } from '@chartsia/core/model';
import { FigureIcon } from './FigureIcon';
import { FIGURE_DRAG_TYPE, paletteSections } from './figure-palette';

/** Barra derecha con las figuras agrupadas por tipo, la del diagrama abierto primero: cada una es un ícono con su nombre al pasar el mouse, que se arrastra al lienzo o, con doble clic, se agrega al centro. */
export function FigureSidebar({ diagramType, onAdd }: { diagramType?: DiagramType; onAdd(key: string): void }) {
  return (
    <aside className="figure-sidebar" aria-label="Figuras">
      <h2 className="figure-sidebar__title">Figuras</h2>
      <div className="figure-sidebar__list">
        {paletteSections(diagramType).map((seccion) => (
          <details key={seccion.id} className="figure-sidebar__section" open>
            <summary className="figure-sidebar__section-title">{seccion.title}</summary>
            <div className="figure-sidebar__items">
              {seccion.items.map((item) => (
                <div
                  key={item.key}
                  className="figure-sidebar__item"
                  draggable
                  data-figure={item.key}
                  title={item.label}
                  onDragStart={(event) => {
                    event.dataTransfer.setData(FIGURE_DRAG_TYPE, item.key);
                    event.dataTransfer.effectAllowed = 'copy';
                  }}
                  onDoubleClick={() => onAdd(item.key)}
                >
                  <FigureIcon item={item} />
                  <span className="sr-only">{item.label}</span>
                </div>
              ))}
            </div>
          </details>
        ))}
      </div>
    </aside>
  );
}
