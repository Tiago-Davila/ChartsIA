import { type FlowVariant } from '../model/enums.js';
import { primitivesToSvg } from '../render/svg-clean.js';
import { flowIconPrimitives } from '../shapes/flow/icons.js';

const SIZE = 24;

/** Ícono de una variante como imagen SVG en un data URL base64, para los formatos que no dibujan trazados (draw.io y Excalidraw). */
export function flowIconDataUrl(variant: FlowVariant, color: string): string {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${SIZE}" height="${SIZE}" viewBox="0 0 ${SIZE} ${SIZE}">${primitivesToSvg(flowIconPrimitives(variant, color, 0, 0, SIZE))}</svg>`;
  return `data:image/svg+xml;base64,${btoa(svg)}`;
}
