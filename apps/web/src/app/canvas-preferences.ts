import { useSyncExternalStore } from 'react';

export type GridSize = 10 | 20 | 40;
export type OnOpen = 'fit' | 'actual';
export type Animations = 'system' | 'normal' | 'reduced';
export type OnAgentChange = 'open' | 'notice';

export interface CanvasPreferences {
  grid: boolean;
  gridSize: GridSize;
  snapToGrid: boolean;
  minimap: boolean;
  zoomControls: boolean;
  onOpen: OnOpen;
  animations: Animations;
  onAgentChange: OnAgentChange;
}

/** Valores por defecto: dejan el lienzo como era antes de tener preferencias. */
export const DEFAULT_CANVAS_PREFERENCES: CanvasPreferences = {
  grid: true,
  gridSize: 20,
  snapToGrid: false,
  minimap: true,
  zoomControls: true,
  onOpen: 'fit',
  animations: 'system',
  onAgentChange: 'open',
};

/** Valores permitidos de las preferencias que no son un sí o un no. */
const OPTIONS: Partial<Record<keyof CanvasPreferences, unknown[]>> = {
  gridSize: [10, 20, 40],
  onOpen: ['fit', 'actual'],
  animations: ['system', 'normal', 'reduced'],
  onAgentChange: ['open', 'notice'],
};

const STORAGE_KEY = 'chartsia.canvas';
const listeners = new Set<() => void>();

/** Lee lo guardado y se queda solo con los campos válidos; el resto usa su valor por defecto. */
function readPreferences(): CanvasPreferences {
  const result = { ...DEFAULT_CANVAS_PREFERENCES };
  try {
    const saved: Record<string, unknown> = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? '{}') ?? {};
    for (const key of Object.keys(result) as (keyof CanvasPreferences)[]) {
      const options = OPTIONS[key];
      if (options ? options.includes(saved[key]) : typeof saved[key] === 'boolean') Object.assign(result, { [key]: saved[key] });
    }
  } catch {
    // Sin acceso al almacenamiento o con datos dañados: quedan los valores por defecto.
  }
  return result;
}

let current = readPreferences();

/** Preferencias actuales del lienzo. */
export function canvasPreferences(): CanvasPreferences {
  return current;
}

/** Cambia preferencias, las recuerda en el navegador y avisa a quien las usa. */
export function setCanvasPreferences(changes: Partial<CanvasPreferences>): void {
  current = { ...current, ...changes };
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(current));
  } catch {
    // Si no se puede guardar, las preferencias valen solo para esta sesión.
  }
  listeners.forEach((listener) => listener());
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

/** Preferencias del lienzo; el componente se actualiza al instante cuando cambian. */
export function useCanvasPreferences(): CanvasPreferences {
  return useSyncExternalStore(subscribe, canvasPreferences);
}

/** Dice si hay que reducir las animaciones: lo elegido o, con "Según el sistema", lo que pide el sistema. */
export function reducedMotion(animations: Animations): boolean {
  if (animations !== 'system') return animations === 'reduced';
  return window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false;
}
