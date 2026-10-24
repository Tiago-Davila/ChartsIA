import { useEffect, useRef } from 'react';

// Adaptado de Squares de React Bits: una cuadrícula que se desliza en diagonal y rellena la celda bajo el puntero.

const SIZE = 44;
const SPEED = 0.25;

/** Lee un color del tema para dibujar en el lienzo, que no entiende variables CSS. */
function tokenColor(el: HTMLElement, name: string): string {
  return getComputedStyle(el).getPropertyValue(name).trim() || '#888';
}

/** Fondo animado en blanco y negro: cuadrícula diagonal; quieto si se pide menos movimiento. */
export function SquaresBackground() {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext('2d');
    if (!canvas || !ctx) return;
    const quieto = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false;
    let offset = 0;
    let raf = 0;
    let hover: { x: number; y: number } | null = null;

    const resize = () => {
      const ratio = window.devicePixelRatio || 1;
      canvas.width = canvas.offsetWidth * ratio;
      canvas.height = canvas.offsetHeight * ratio;
      ctx.setTransform(ratio, 0, 0, ratio, 0, 0);
    };

    // Dibuja la cuadrícula desplazada y la celda resaltada; la viñeta la pone el CSS.
    const draw = () => {
      const w = canvas.offsetWidth;
      const h = canvas.offsetHeight;
      ctx.clearRect(0, 0, w, h);
      ctx.lineWidth = 1;
      ctx.strokeStyle = tokenColor(canvas, '--border');
      const start = -(offset % SIZE);
      for (let x = start; x < w + SIZE; x += SIZE) {
        for (let y = start; y < h + SIZE; y += SIZE) {
          if (hover && hover.x >= x && hover.x < x + SIZE && hover.y >= y && hover.y < y + SIZE) {
            ctx.fillStyle = tokenColor(canvas, '--surface-muted');
            ctx.fillRect(x, y, SIZE, SIZE);
          }
          ctx.strokeRect(x + 0.5, y + 0.5, SIZE, SIZE);
        }
      }
    };

    const tick = () => {
      offset = (offset + SPEED) % SIZE;
      draw();
      raf = requestAnimationFrame(tick);
    };

    const onMove = (e: PointerEvent) => {
      const rect = canvas.getBoundingClientRect();
      hover = { x: e.clientX - rect.left, y: e.clientY - rect.top };
      if (quieto) draw();
    };
    const onLeave = () => {
      hover = null;
      if (quieto) draw();
    };

    resize();
    window.addEventListener('resize', resize);
    window.addEventListener('pointermove', onMove);
    document.addEventListener('pointerleave', onLeave);
    if (quieto) draw();
    else raf = requestAnimationFrame(tick);
    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener('resize', resize);
      window.removeEventListener('pointermove', onMove);
      document.removeEventListener('pointerleave', onLeave);
    };
  }, []);

  return <canvas ref={canvasRef} className="squares-background" aria-hidden="true" />;
}
