import { afterEach, describe, expect, it, vi } from 'vitest';
import { canvasPreferences, DEFAULT_CANVAS_PREFERENCES, reducedMotion, setCanvasPreferences } from '../../src/app/canvas-preferences';

describe('preferencias del lienzo', () => {
  afterEach(() => {
    setCanvasPreferences(DEFAULT_CANVAS_PREFERENCES);
    localStorage.clear();
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
    vi.resetModules();
  });

  it('por defecto dejan el lienzo como estaba', () => {
    expect(DEFAULT_CANVAS_PREFERENCES).toEqual({
      grid: true,
      gridSize: 20,
      snapToGrid: false,
      minimap: true,
      zoomControls: true,
      onOpen: 'fit',
      animations: 'system',
      onAgentChange: 'open',
    });
  });

  it('un cambio se aplica al instante y se guarda en el navegador', () => {
    setCanvasPreferences({ minimap: false, gridSize: 40 });
    expect(canvasPreferences()).toMatchObject({ minimap: false, gridSize: 40, grid: true });
    expect(JSON.parse(localStorage.getItem('chartsia.canvas')!)).toMatchObject({ minimap: false, gridSize: 40 });
  });

  it('en otra visita recupera lo guardado', async () => {
    localStorage.setItem('chartsia.canvas', JSON.stringify({ grid: false, onOpen: 'actual', animations: 'reduced' }));
    vi.resetModules();
    const { canvasPreferences: otraVisita } = await import('../../src/app/canvas-preferences');
    expect(otraVisita()).toMatchObject({ grid: false, onOpen: 'actual', animations: 'reduced', minimap: true });
  });

  it('descarta lo guardado que no es válido', async () => {
    localStorage.setItem('chartsia.canvas', JSON.stringify({ grid: 'si', gridSize: 15, onOpen: 'otro', minimap: false }));
    vi.resetModules();
    const { canvasPreferences: otraVisita } = await import('../../src/app/canvas-preferences');
    expect(otraVisita()).toMatchObject({ grid: true, gridSize: 20, onOpen: 'fit', minimap: false });
  });

  it('con datos dañados usa los valores por defecto', async () => {
    localStorage.setItem('chartsia.canvas', '{no es json');
    vi.resetModules();
    const { canvasPreferences: otraVisita } = await import('../../src/app/canvas-preferences');
    expect(otraVisita()).toEqual(DEFAULT_CANVAS_PREFERENCES);
  });

  it('sin almacenamiento los cambios valen para la sesión', () => {
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('sin cupo');
    });
    setCanvasPreferences({ grid: false });
    expect(canvasPreferences().grid).toBe(false);
  });

  it('las animaciones "según el sistema" siguen prefers-reduced-motion; las otras opciones lo ignoran', () => {
    vi.stubGlobal('matchMedia', () => ({ matches: true }));
    expect(reducedMotion('system')).toBe(true);
    expect(reducedMotion('normal')).toBe(false);
    expect(reducedMotion('reduced')).toBe(true);
    vi.stubGlobal('matchMedia', () => ({ matches: false }));
    expect(reducedMotion('system')).toBe(false);
    expect(reducedMotion('reduced')).toBe(true);
  });
});
