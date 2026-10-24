import { useEffect, useRef, type ReactNode } from 'react';

// Adaptado de AnimatedList de React Bits: las filas entran con un resorte escalonado y un resaltado se desliza hasta la fila bajo el puntero.

export interface AnimatedListProps {
  ariaLabel: string;
  className?: string;
  /** Filas `<li data-row>`; la abierta lleva `data-current` y el resaltado vuelve a ella al salir el puntero. */
  children: ReactNode;
}

const OMEGA = 30;
const ZETA = 0.78;
const STEP_S = 1 / 240;

/** Lista con entrada escalonada y un resaltado con resorte que sigue al puntero. */
export function AnimatedList({ ariaLabel, className = '', children }: AnimatedListProps) {
  const listRef = useRef<HTMLUListElement>(null);
  const indicatorRef = useRef<HTMLLIElement>(null);
  const motion = useRef({ y: 0, h: 0, vy: 0, vh: 0, ty: 0, th: 0, ready: false, raf: 0 });

  const write = () => {
    const el = indicatorRef.current;
    const m = motion.current;
    if (el) el.style.transform = `translateY(${m.y.toFixed(2)}px)`;
    if (el) el.style.height = `${m.h.toFixed(2)}px`;
  };

  // Integra el resorte con pasos fijos hasta que llega a la fila objetivo.
  const run = () => {
    const m = motion.current;
    cancelAnimationFrame(m.raf);
    let last = performance.now();
    const tick = () => {
      const now = performance.now();
      const dt = Math.min(0.05, (now - last) / 1000);
      last = now;
      const steps = Math.max(1, Math.ceil(dt / STEP_S));
      const h = dt / steps;
      for (let i = 0; i < steps; i++) {
        m.vy += (OMEGA * OMEGA * (m.ty - m.y) - 2 * ZETA * OMEGA * m.vy) * h;
        m.vh += (OMEGA * OMEGA * (m.th - m.h) - 2 * ZETA * OMEGA * m.vh) * h;
        m.y += m.vy * h;
        m.h += m.vh * h;
      }
      const moving = Math.abs(m.ty - m.y) > 0.05 || Math.abs(m.th - m.h) > 0.05 || Math.abs(m.vy) + Math.abs(m.vh) > 0.5;
      if (!moving) {
        m.y = m.ty;
        m.h = m.th;
        m.vy = m.vh = 0;
      }
      write();
      m.raf = moving ? requestAnimationFrame(tick) : 0;
    };
    m.raf = requestAnimationFrame(tick);
  };

  // Lleva el resaltado a la fila dada, o lo oculta si no hay ninguna.
  const glideTo = (row: HTMLElement | null) => {
    const el = indicatorRef.current;
    const m = motion.current;
    if (!el) return;
    if (!row) {
      el.style.opacity = '0';
      m.ready = false;
      return;
    }
    m.ty = row.offsetTop;
    m.th = row.offsetHeight;
    const reduce = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false;
    if (!m.ready || reduce) {
      m.y = m.ty;
      m.h = m.th;
      m.vy = m.vh = 0;
      m.ready = true;
      write();
    } else run();
    el.style.opacity = '1';
  };

  const current = () => listRef.current?.querySelector<HTMLElement>(':scope > [data-row][data-current]') ?? null;

  // Si cambian las filas, el resaltado se reubica sobre la abierta.
  useEffect(() => {
    glideTo(current());
  });

  useEffect(() => {
    const m = motion.current;
    return () => cancelAnimationFrame(m.raf);
  }, []);

  return (
    <ul
      ref={listRef}
      className={`animated-list${className ? ` ${className}` : ''}`}
      aria-label={ariaLabel}
      onPointerOver={(e) => glideTo((e.target as Element).closest<HTMLElement>('[data-row]'))}
      onPointerLeave={() => glideTo(current())}
    >
      <li ref={indicatorRef} className="animated-list__indicator" role="presentation" aria-hidden="true" />
      {children}
    </ul>
  );
}
