import { useEffect, useId, useLayoutEffect, useRef, useState, type CSSProperties, type KeyboardEvent, type PointerEvent, type ReactNode } from 'react';

// Adaptado de HoldButton de React Bits: el relleno sube como líquido mientras se mantiene pulsado y vuelve si se suelta.

export interface HoldButtonProps {
  children: ReactNode;
  /** Milisegundos que hay que mantenerlo pulsado para confirmar. */
  holdTime?: number;
  /** Texto para lectores de pantalla que explica cómo confirmar. */
  hint: string;
  className?: string;
  onHold(): void;
}

type Phase = 'idle' | 'holding' | 'done';

const RELEASE_MS = 200;
const HIT_PAD = 10;
const LINEAR = (t: number) => t;
const EASE_OUT = (t: number) => 1 - Math.pow(1 - t, 3);

/** Botón que confirma solo si se mantiene pulsado con el puntero, Enter o Espacio. */
export function HoldButton({ children, holdTime = 1500, hint, className = '', onHold }: HoldButtonProps) {
  const [phase, setPhase] = useState<Phase>('idle');
  const phaseRef = useRef<Phase>('idle');
  const buttonRef = useRef<HTMLButtonElement>(null);
  const pointer = useRef<{ id: number | null; rect: DOMRect | null }>({ id: null, rect: null });
  const fill = useRef({ raf: 0, p: 0 });
  const hintId = useId();

  const go = (next: Phase) => {
    phaseRef.current = next;
    setPhase(next);
  };

  // Lleva el relleno hasta `to` en `duration` ms y confirma al llenarse.
  const drive = (to: number, duration: number, ease: (t: number) => number) => {
    const m = fill.current;
    cancelAnimationFrame(m.raf);
    const from = m.p;
    const start = performance.now();
    const tick = (now: number) => {
      const t = duration > 0 ? Math.min(1, (now - start) / duration) : 1;
      m.p = from + (to - from) * ease(t);
      buttonRef.current?.style.setProperty('--hb-p', m.p.toFixed(4));
      if (t < 1) {
        m.raf = requestAnimationFrame(tick);
        return;
      }
      m.raf = 0;
      if (to === 1 && phaseRef.current === 'holding') {
        go('done');
        onHold();
      }
    };
    m.raf = requestAnimationFrame(tick);
  };

  const begin = () => {
    if (phaseRef.current !== 'idle') return false;
    pointer.current.rect = buttonRef.current?.getBoundingClientRect() ?? null;
    go('holding');
    drive(1, holdTime, LINEAR);
    return true;
  };

  const release = () => {
    if (phaseRef.current !== 'holding') return;
    go('idle');
    drive(0, RELEASE_MS, EASE_OUT);
  };
  const releaseRef = useRef(release);
  releaseRef.current = release;

  const onPointerDown = (e: PointerEvent<HTMLButtonElement>) => {
    if (e.button !== 0 || !e.isPrimary || pointer.current.id !== null || !begin()) return;
    pointer.current.id = e.pointerId;
    e.currentTarget.setPointerCapture?.(e.pointerId);
  };

  const endPointer = (e: PointerEvent<HTMLButtonElement>) => {
    if (e.pointerId !== pointer.current.id) return;
    pointer.current.id = null;
    if (e.currentTarget.hasPointerCapture?.(e.pointerId)) e.currentTarget.releasePointerCapture(e.pointerId);
    release();
  };

  // Si el puntero se aleja del botón mientras se mantiene, se cancela.
  const onPointerMove = (e: PointerEvent<HTMLButtonElement>) => {
    const r = pointer.current.rect;
    if (e.pointerId !== pointer.current.id || !r) return;
    if (e.clientX < r.left - HIT_PAD || e.clientX > r.right + HIT_PAD || e.clientY < r.top - HIT_PAD || e.clientY > r.bottom + HIT_PAD) endPointer(e);
  };

  const onKeyDown = (e: KeyboardEvent<HTMLButtonElement>) => {
    if (e.key === 'Escape' && phaseRef.current === 'holding') {
      // Escape cancela la pulsación sin cerrar el diálogo.
      e.stopPropagation();
      release();
      return;
    }
    if (e.key === ' ' || e.key === 'Enter') {
      e.preventDefault();
      if (!e.repeat) begin();
    }
  };

  const onKeyUp = (e: KeyboardEvent<HTMLButtonElement>) => {
    if (e.key === ' ' || e.key === 'Enter') {
      e.preventDefault();
      release();
    }
  };

  // Mide el botón para que la ola del borde recorra su ancho y alto.
  useLayoutEffect(() => {
    const button = buttonRef.current;
    if (!button) return undefined;
    const measure = () => {
      button.style.setProperty('--hb-w', `${button.offsetWidth}px`);
      button.style.setProperty('--hb-h', `${button.offsetHeight}px`);
    };
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(button);
    return () => observer.disconnect();
  }, []);

  // Cambiar de ventana o de pestaña a mitad de la pulsación la cancela.
  useEffect(() => {
    if (phase !== 'holding') return undefined;
    const cancel = () => releaseRef.current();
    const onVisibility = () => document.hidden && cancel();
    window.addEventListener('blur', cancel);
    document.addEventListener('visibilitychange', onVisibility);
    return () => {
      window.removeEventListener('blur', cancel);
      document.removeEventListener('visibilitychange', onVisibility);
    };
  }, [phase]);

  useEffect(() => {
    const m = fill.current;
    return () => cancelAnimationFrame(m.raf);
  }, []);

  const label = <span className="hold-button__text">{children}</span>;
  return (
    <>
      <button
        ref={buttonRef}
        type="button"
        className={`hold-button${className ? ` ${className}` : ''}`}
        data-phase={phase}
        aria-describedby={hintId}
        style={{ '--hb-hold': `${holdTime}ms`, '--hb-cycles': holdTime / 1100 } as CSSProperties}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={endPointer}
        onPointerCancel={endPointer}
        onLostPointerCapture={endPointer}
        onPointerLeave={(e) => e.pointerType !== 'touch' && endPointer(e)}
        onKeyDown={onKeyDown}
        onKeyUp={onKeyUp}
        onContextMenu={(e) => e.preventDefault()}
      >
        <span className="hold-button__pulse" aria-hidden="true" />
        <span className="hold-button__label">{label}</span>
        <span className="hold-button__clip" aria-hidden="true">
          <span className="hold-button__fill">
            <span className="hold-button__label">{label}</span>
          </span>
          <span className="hold-button__crest">
            <span className="hold-button__label">{label}</span>
          </span>
        </span>
      </button>
      <span id={hintId} className="hold-button__sr">
        {hint}
      </span>
    </>
  );
}
