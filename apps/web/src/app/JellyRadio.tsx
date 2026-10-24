import { useEffect, useLayoutEffect, useRef } from 'react';

// Adaptado de JellyRadio de React Bits: la opción elegida se hincha y empuja a sus vecinas hacia afuera.

export interface JellyRadioItem<T extends string> {
  value: T;
  label: string;
}

export interface JellyRadioProps<T extends string> {
  items: JellyRadioItem<T>[];
  value: T;
  ariaLabel: string;
  onSelect(value: T): void;
}

/** Valor animado por un resorte amortiguado, con su objetivo y el momento en que arranca. */
interface Spring {
  value: number;
  velocity: number;
  target: number;
  stiffness: number;
  damping: number;
  mass: number;
  startAt: number;
}

/** Desplazamiento y escala de cada opción. */
interface ChipSprings {
  x: Spring;
  sx: Spring;
  sy: Spring;
}

const SWELL = 0.14;
const BARGE = 4;
const SHRINK = 0.04;
const BOUNCE = 0.25;
const STAGGER_MS = 22;
const STIFFNESS = 580;
const STEP_S = 1 / 240;

/** Crea un resorte quieto en el valor dado. */
function spring(value: number): Spring {
  return { value, velocity: 0, target: value, stiffness: STIFFNESS, damping: 1, mass: 1, startAt: 0 };
}

/** Apunta el resorte a un objetivo con la rigidez, masa y rebote dados. */
function aim(s: Spring, target: number, stiffness: number, mass: number, bounce: number, startAt: number) {
  s.target = target;
  s.stiffness = stiffness;
  s.mass = mass;
  s.damping = 2 * Math.sqrt(stiffness * mass) * (1 - bounce);
  s.startAt = startAt;
}

/** Avanza el resorte dt segundos; devuelve true si sigue en movimiento. */
function step(s: Spring, dt: number, now: number): boolean {
  if (now < s.startAt) return true;
  const force = -s.stiffness * (s.value - s.target) - s.damping * s.velocity;
  s.velocity += (force / s.mass) * dt;
  s.value += s.velocity * dt;
  if (Math.abs(s.velocity) < 0.001 && Math.abs(s.value - s.target) < 0.0005) {
    s.value = s.target;
    s.velocity = 0;
    return false;
  }
  return true;
}

/** Grupo de opciones excluyentes con efecto gelatina; cada opción es un botón con aria-pressed. */
export function JellyRadio<T extends string>({ items, value, ariaLabel, onSelect }: JellyRadioProps<T>) {
  const groupRef = useRef<HTMLDivElement>(null);
  const chipRefs = useRef<(HTMLButtonElement | null)[]>([]);
  const springs = useRef<ChipSprings[]>([]);
  const frame = useRef(0);
  const shown = useRef(-1);
  const at = Math.max(0, items.findIndex((it) => it.value === value));

  // Escribe en cada opción el transform que marcan sus resortes.
  const paint = () => {
    springs.current.forEach((s, i) => {
      const chip = chipRefs.current[i];
      if (chip) chip.style.transform = `translateX(${s.x.value}px) scale(${s.sx.value}, ${s.sy.value})`;
    });
  };

  // Mueve los resortes con pasos fijos hasta que todos quedan quietos.
  const run = () => {
    cancelAnimationFrame(frame.current);
    let last = performance.now();
    const tick = () => {
      // Usa performance.now() y no la marca del frame, que puede ser anterior a `last` y dejaría el bucle sin pasos.
      const now = performance.now();
      let moving = last >= now;
      for (; last < now; last += STEP_S * 1000) {
        for (const s of springs.current) moving = [step(s.x, STEP_S, last), step(s.sx, STEP_S, last), step(s.sy, STEP_S, last)].some(Boolean) || moving;
      }
      paint();
      frame.current = moving ? requestAnimationFrame(tick) : 0;
    };
    frame.current = requestAnimationFrame(tick);
  };

  // Lleva las opciones a la forma de la elegida, al instante o con resortes escalonados.
  const apply = (sel: number, instant: boolean) => {
    shown.current = sel;
    const widths = chipRefs.current.map((el) => el?.offsetWidth ?? 0);
    const push = ((widths[sel] ?? 0) * SWELL) / 2 + BARGE;
    const reduce = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false;
    const now = performance.now();
    springs.current = items.map((_, i) => springs.current[i] ?? { x: spring(0), sx: spring(1), sy: spring(1) });
    springs.current.forEach((s, i) => {
      const far = Math.abs(i - sel);
      const x = Math.sign(i - sel) * push;
      const scale = i === sel ? 1 + SWELL : 1 - SHRINK;
      if (instant || reduce) {
        Object.assign(s.x, spring(x));
        Object.assign(s.sx, spring(scale));
        Object.assign(s.sy, spring(scale));
        return;
      }
      const k = STIFFNESS * (1 - 0.12 * Math.min(far, 3));
      const inFlight = s.x.velocity !== 0 || s.sx.velocity !== 0;
      const start = inFlight ? now : now + far * STAGGER_MS;
      aim(s.x, x, k, 0.9, BOUNCE, start);
      aim(s.sx, scale, k * 1.24, 0.8, Math.min(0.85, BOUNCE + 0.3), start);
      aim(s.sy, scale, k * 0.86, 0.95, BOUNCE, start + 50);
    });
    if (instant || reduce) paint();
    else run();
  };

  // Ajusta el relleno del grupo para que la opción hinchada no se salga y reacomoda al cambiar de tamaño.
  useLayoutEffect(() => {
    const group = groupRef.current;
    if (!group) return undefined;
    const settle = () => {
      const maxW = Math.max(0, ...chipRefs.current.map((el) => el?.offsetWidth ?? 0));
      const chipH = chipRefs.current[0]?.offsetHeight ?? 0;
      group.style.setProperty('--jr-pad-x', `${Math.ceil((maxW * SWELL * 1.3) / 2 + BARGE) + 2}px`);
      group.style.setProperty('--jr-pad-y', `${Math.ceil((chipH * SWELL) / 2) + 2}px`);
      apply(shown.current < 0 ? at : shown.current, true);
    };
    settle();
    const observer = new ResizeObserver(settle);
    observer.observe(group);
    return () => observer.disconnect();
  }, [items.length]);

  // Cuando la elección cambia desde afuera (atajo o vuelta a Selección) anima hacia la nueva.
  useEffect(() => {
    if (shown.current !== at) apply(at, false);
  }, [at]);

  useEffect(() => () => cancelAnimationFrame(frame.current), []);

  return (
    <div ref={groupRef} role="group" aria-label={ariaLabel} className="jelly-radio">
      {items.map((it, i) => (
        <button
          key={it.value}
          ref={(el) => {
            chipRefs.current[i] = el;
          }}
          type="button"
          className="jelly-radio__chip"
          aria-pressed={i === at}
          data-on={i === at ? 'true' : 'false'}
          onClick={() => onSelect(it.value)}
        >
          <span className="jelly-radio__skin">{it.label}</span>
        </button>
      ))}
    </div>
  );
}
