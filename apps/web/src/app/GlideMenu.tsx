import { useEffect, useLayoutEffect, useRef, useState, type KeyboardEvent, type ReactNode } from 'react';

// Adaptado de GlideSelect de React Bits: el menú brota desde la esquina del botón y el resaltado se desliza entre opciones.

export interface GlideMenuItem<T extends string> {
  value: T;
  label: string;
  icon?: ReactNode;
}

export interface GlideMenuProps<T extends string> {
  label: ReactNode;
  /** Nombre accesible del botón y del menú. */
  ariaLabel: string;
  items: GlideMenuItem<T>[];
  className?: string;
  onSelect(value: T): void;
}

const ROW = 32;
const GAP = 1;

/** Botón que despliega un menú de acciones con un resaltado que se desliza. */
export function GlideMenu<T extends string>({ label, ariaLabel, items, className = '', onSelect }: GlideMenuProps<T>) {
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState<number | null>(null);
  const rootRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const pillRef = useRef<HTMLSpanElement>(null);
  const itemRefs = useRef<(HTMLButtonElement | null)[]>([]);

  const close = (focusTrigger: boolean) => {
    setOpen(false);
    setActive(null);
    if (focusTrigger) triggerRef.current?.focus({ preventScroll: true });
  };

  // Al abrir, fuerza el estado cerrado un frame para que la escala y la opacidad se animen.
  useLayoutEffect(() => {
    const menu = menuRef.current;
    if (!open || !menu) return;
    menu.dataset.state = 'closed';
    void menu.offsetHeight;
    menu.dataset.state = 'open';
  }, [open]);

  // El resaltado salta a la primera fila y después se desliza entre filas.
  useLayoutEffect(() => {
    const pill = pillRef.current;
    if (!pill || !open) return;
    if (active === null) {
      pill.style.opacity = '0';
      return;
    }
    const jump = pill.style.opacity !== '1';
    pill.style.transitionDuration = jump ? '0ms, 150ms' : '';
    pill.style.transform = `translateY(${active * (ROW + GAP)}px)`;
    pill.style.opacity = '1';
  }, [active, open]);

  // Un clic fuera del menú lo cierra.
  useEffect(() => {
    if (!open) return undefined;
    const onDown = (e: PointerEvent) => {
      if (!rootRef.current?.contains(e.target as Node)) close(false);
    };
    document.addEventListener('pointerdown', onDown, true);
    return () => document.removeEventListener('pointerdown', onDown, true);
  }, [open]);

  const focusItem = (i: number) => {
    setActive(i);
    itemRefs.current[i]?.focus({ preventScroll: true });
  };

  const onTriggerKey = (e: KeyboardEvent<HTMLButtonElement>) => {
    if (e.key !== 'ArrowDown' && e.key !== 'ArrowUp') return;
    e.preventDefault();
    setOpen(true);
    requestAnimationFrame(() => focusItem(e.key === 'ArrowUp' ? items.length - 1 : 0));
  };

  const onMenuKey = (e: KeyboardEvent<HTMLDivElement>) => {
    const n = items.length;
    const cur = active ?? 0;
    if (e.key === 'ArrowDown') focusItem((cur + 1) % n);
    else if (e.key === 'ArrowUp') focusItem((cur - 1 + n) % n);
    else if (e.key === 'Home') focusItem(0);
    else if (e.key === 'End') focusItem(n - 1);
    else if (e.key === 'Escape') {
      // Escape solo cierra el menú, no la ventana que lo contenga.
      e.stopPropagation();
      close(true);
    } else if (e.key === 'Tab') close(false);
    else return;
    if (e.key !== 'Tab') e.preventDefault();
  };

  const pick = (value: T) => {
    close(false);
    onSelect(value);
  };

  return (
    <div ref={rootRef} className={`glide-menu${className ? ` ${className}` : ''}`}>
      <button
        ref={triggerRef}
        type="button"
        className="glide-menu__trigger"
        aria-label={ariaLabel}
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={() => (open ? close(false) : setOpen(true))}
        onKeyDown={onTriggerKey}
      >
        {label}
      </button>
      {open ? (
        <div ref={menuRef} role="menu" aria-label={ariaLabel} className="glide-menu__menu" data-state="open" onKeyDown={onMenuKey} onPointerLeave={() => setActive(null)}>
          <span ref={pillRef} className="glide-menu__pill" aria-hidden="true" />
          {items.map((item, i) => (
            <button
              key={item.value}
              ref={(el) => {
                itemRefs.current[i] = el;
              }}
              type="button"
              role="menuitem"
              className="glide-menu__item"
              onPointerEnter={() => setActive(i)}
              onFocus={() => setActive(i)}
              onClick={() => pick(item.value)}
            >
              {item.icon ? <span className="glide-menu__icon">{item.icon}</span> : null}
              {item.label}
            </button>
          ))}
        </div>
      ) : null}
    </div>
  );
}
