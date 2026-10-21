import { describe, expect, it } from 'vitest';
import { ImageDataUrlSchema, MAX_IMAGE_DATA_URL_LENGTH, isSanitizedImageDataUrl, sanitizeImageDataUrl, totalImageRasterPixels } from '../../../src/model/index.js';
import { pngDataUrl, svgDataUrl } from '../../support/images.js';

describe('datos de imagen', () => {
  it('acepta PNG estructuralmente válido y limita firma/MIME falsificados', () => {
    const png = pngDataUrl();
    expect(sanitizeImageDataUrl(png)).toBe(png);
    expect(() => sanitizeImageDataUrl(png.replace('image/png', 'image/jpeg'))).toThrow(/JPG completo/);
    expect(() => sanitizeImageDataUrl('data:image/png;base64,iVBORw0KGgo=')).toThrow(/PNG completo/);
    expect(() => sanitizeImageDataUrl(png.slice(0, -4) + 'AAAA')).toThrow(/PNG completo/);
    expect(ImageDataUrlSchema.safeParse(png).success).toBe(true);
  });

  it('rechaza base64 no canónico y corta URLs enormes antes de decodificarlas', () => {
    const png = pngDataUrl();
    expect(() => sanitizeImageDataUrl(`${png}=`)).toThrow(/base64/);
    expect(isSanitizedImageDataUrl(`${png}=`)).toBe(false);
    expect(() => sanitizeImageDataUrl(`data:image/png;base64,${'A'.repeat(MAX_IMAGE_DATA_URL_LENGTH)}`)).toThrow(/5 MiB/);
  });

  it('canonicaliza SVG pasivo y mantiene idempotente la frontera del modelo', () => {
    const raw = '<?xml version="1.0" encoding="UTF-8"?><svg height="20" width="20" xmlns="http://www.w3.org/2000/svg"><rect y="2" x="1" width="5" height="8" fill="red"/></svg>';
    const canonical = sanitizeImageDataUrl(svgDataUrl(raw));
    expect(canonical).not.toBe(svgDataUrl(raw));
    expect(sanitizeImageDataUrl(canonical)).toBe(canonical);
    expect(ImageDataUrlSchema.safeParse(canonical).success).toBe(true);
    expect(ImageDataUrlSchema.safeParse(svgDataUrl(raw)).success).toBe(false);
  });

  it.each([
    '<svg xmlns="http://www.w3.org/2000/svg"><script>alert(1)</script></svg>',
    '<svg xmlns="http://www.w3.org/2000/svg" onload="alert(1)"/>',
    '<svg xmlns="http://www.w3.org/2000/svg"><foreignObject/></svg>',
    '<svg xmlns="http://www.w3.org/2000/svg"><a href="https://evil.invalid"><text>x</text></a></svg>',
    '<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink"><g xlink:href="https://evil.invalid"/></svg>',
    '<svg xmlns="http://www.w3.org/2000/svg"><rect style="fill:url(https://evil.invalid/x)"/></svg>',
    '<svg xmlns="http://www.w3.org/2000/svg"><rect fill="url(https://evil.invalid/x)"/></svg>',
    '<!DOCTYPE svg [<!ENTITY x SYSTEM "file:///etc/passwd">]><svg xmlns="http://www.w3.org/2000/svg">&x;</svg>',
    '<svg xmlns="http://www.w3.org/2000/svg"><image href="data:image/svg+xml;base64,PHN2Zz4="/></svg>',
    '<svg xmlns="http://www.w3.org/2000/svg"><path d="M1e999999 0"/></svg>',
    '<svg xmlns="http://www.w3.org/2000/svg"><path transform="translate(1e999999)"/></svg>',
    '<svg xmlns="http://www.w3.org/2000/svg"><text>\u0000</text></svg>',
  ])('rechaza SVG activo o fuera del subconjunto: %s', (svg) => {
    expect(() => sanitizeImageDataUrl(svgDataUrl(svg))).toThrow();
  });

  it('rechaza SVG demasiado profundo y APNG', () => {
    const nested = `<svg xmlns="http://www.w3.org/2000/svg">${'<g>'.repeat(64)}<rect/>${'</g>'.repeat(64)}</svg>`;
    expect(() => sanitizeImageDataUrl(svgDataUrl(nested))).toThrow();
    expect(() => sanitizeImageDataUrl(pngDataUrl({ animated: true }))).toThrow(/PNG completo/);
  });

  it('cuenta píxeles desde dimensiones JPEG/PNG sin cargar recursos remotos', () => {
    const onePng = pngDataUrl({ width: 10_000, height: 4_000 });
    const smallPng = pngDataUrl({ width: 1, height: 1 });
    expect(totalImageRasterPixels([{ kind: 'image', src: onePng }, { kind: 'image', src: smallPng }])).toBe(40_000_001);
  });
});
