import { useEffect, useRef } from 'react';

export interface ContextMenuItem {
  label: string;
  onSelect(): void;
}

export interface ContextMenuProps {
  x: number;
  y: number;
  items: ContextMenuItem[];
  onClose(): void;
}

/** Menú contextual del lienzo: se cierra con Escape, con un clic afuera o al elegir una acción. */
export function ContextMenu({ x, y, items, onClose }: ContextMenuProps) {
  const menu = useRef<HTMLUListElement>(null);

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    const onPointerDown = (e: PointerEvent) => {
      if (!menu.current?.contains(e.target as Node)) onClose();
    };
    window.addEventListener('keydown', onKeyDown);
    window.addEventListener('pointerdown', onPointerDown, true);
    return () => {
      window.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('pointerdown', onPointerDown, true);
    };
  }, [onClose]);

  return (
    <ul ref={menu} role="menu" className="canvas-menu" style={{ left: x, top: y }}>
      {items.map((item) => (
        <li key={item.label} role="none">
          <button
            type="button"
            role="menuitem"
            onClick={() => {
              onClose();
              item.onSelect();
            }}
          >
            {item.label}
          </button>
        </li>
      ))}
    </ul>
  );
}
