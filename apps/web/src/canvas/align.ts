export interface Box {
  id: string;
  x: number;
  y: number;
  width: number;
  height: number;
}

export type AlignMode = 'left' | 'center' | 'right' | 'top' | 'middle' | 'bottom' | 'distribute-x' | 'distribute-y';

/** Nuevas posiciones absolutas tras alinear o distribuir; omite las cajas que no se mueven. */
export function alignBoxes(boxes: Box[], mode: AlignMode): { id: string; x: number; y: number }[] {
  if (boxes.length < 2) return [];
  const left = Math.min(...boxes.map((b) => b.x));
  const right = Math.max(...boxes.map((b) => b.x + b.width));
  const top = Math.min(...boxes.map((b) => b.y));
  const bottom = Math.max(...boxes.map((b) => b.y + b.height));
  const place = (b: Box): { x: number; y: number } => {
    switch (mode) {
      case 'left':
        return { x: left, y: b.y };
      case 'center':
        return { x: (left + right) / 2 - b.width / 2, y: b.y };
      case 'right':
        return { x: right - b.width, y: b.y };
      case 'top':
        return { x: b.x, y: top };
      case 'middle':
        return { x: b.x, y: (top + bottom) / 2 - b.height / 2 };
      case 'bottom':
        return { x: b.x, y: bottom - b.height };
      default:
        return b;
    }
  };
  const moved = mode.startsWith('distribute') ? distribute(boxes, mode === 'distribute-x' ? 'x' : 'y') : boxes.map((b) => ({ id: b.id, ...place(b) }));
  return moved
    .map((m) => ({ id: m.id, x: Math.round(m.x), y: Math.round(m.y) }))
    .filter((m) => {
      const b = boxes.find((box) => box.id === m.id)!;
      return m.x !== Math.round(b.x) || m.y !== Math.round(b.y);
    });
}

/** Reparte las cajas con el mismo espacio entre ellas sobre un eje, sin mover las de los extremos. */
function distribute(boxes: Box[], axis: 'x' | 'y'): { id: string; x: number; y: number }[] {
  const size = axis === 'x' ? 'width' : 'height';
  const sorted = [...boxes].sort((a, b) => a[axis] - b[axis]);
  const first = sorted[0]!;
  const last = sorted[sorted.length - 1]!;
  const used = sorted.reduce((sum, b) => sum + b[size], 0);
  const gap = (last[axis] + last[size] - first[axis] - used) / (sorted.length - 1);
  let cursor = first[axis];
  return sorted.map((b) => {
    const at = cursor;
    cursor += b[size] + gap;
    return { id: b.id, x: axis === 'x' ? at : b.x, y: axis === 'y' ? at : b.y };
  });
}
