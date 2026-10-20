import { type Layout } from '../model/common.js';

export interface Rect {
  x: number;
  y: number;
  width: number;
  height: number;
}

/** Caja que participa en la eliminación de solapes. */
export interface LayoutBox extends Rect {
  id: string;
  pinned: boolean;
  /** Elemento recién añadido: se mueve antes que los existentes. */
  isNew?: boolean;
}

export type PositionMap = Map<string, Layout>;

export const r2 = (n: number): number => Math.round(n * 100) / 100;

export function overlapsWithGap(a: Rect, b: Rect, gap: number): boolean {
  return (
    a.x < b.x + b.width + gap &&
    b.x < a.x + a.width + gap &&
    a.y < b.y + b.height + gap &&
    b.y < a.y + a.height + gap
  );
}
