import { escapeXml } from '../export/xml-escape.js';
import { CSS_FONT_FAMILIES } from '../shapes/style.js';
import { type Paint, type Primitive } from '../shapes/types.js';

const n = (v: number) => String(Math.round(v * 100) / 100);

function paint(p: Paint): string {
  let out = ` fill="${escapeXml(p.fill ?? 'none')}" stroke="${escapeXml(p.stroke ?? 'none')}"`;
  if (p.strokeWidth !== undefined) out += ` stroke-width="${n(p.strokeWidth)}"`;
  if (p.dash) out += ` stroke-dasharray="${p.dash.map(n).join(' ')}"`;
  if (p.strokeOpacity !== undefined) out += ` stroke-opacity="${n(p.strokeOpacity)}"`;
  if (p.lineCap) out += ` stroke-linecap="${p.lineCap}"`;
  if (p.lineJoin) out += ` stroke-linejoin="${p.lineJoin}"`;
  return out;
}

/** Serializa primitivas a elementos SVG. Todo texto pasa por `escapeXml`. */
export function primitivesToSvg(primitives: Primitive[]): string {
  return primitives
    .map((p) => {
      switch (p.type) {
        case 'rect':
          return `<rect x="${n(p.x)}" y="${n(p.y)}" width="${n(p.width)}" height="${n(p.height)}"${p.rx ? ` rx="${n(p.rx)}"` : ''}${paint(p)}/>`;
        case 'ellipse':
          return `<ellipse cx="${n(p.cx)}" cy="${n(p.cy)}" rx="${n(p.rx)}" ry="${n(p.ry)}"${paint(p)}/>`;
        case 'line':
          return `<line x1="${n(p.x1)}" y1="${n(p.y1)}" x2="${n(p.x2)}" y2="${n(p.y2)}"${paint(p)}/>`;
        case 'image':
          return `<image href="${escapeXml(p.href)}" x="${n(p.x)}" y="${n(p.y)}" width="${n(p.width)}" height="${n(p.height)}" preserveAspectRatio="xMidYMid meet"/>`;
        case 'path':
          return `<path d="${escapeXml(p.d)}"${paint(p)}/>`;
        case 'text': {
          let attrs = ` x="${n(p.x)}" y="${n(p.y)}" font-size="${n(p.size)}" fill="${escapeXml(p.color)}"`;
          if (p.fontFamily) attrs += ` font-family="${escapeXml(CSS_FONT_FAMILIES[p.fontFamily])}"`;
          if (p.anchor !== 'start') attrs += ` text-anchor="${p.anchor}"`;
          if (p.bold) attrs += ' font-weight="bold"';
          if (p.italic) attrs += ' font-style="italic"';
          if (p.underline) attrs += ' text-decoration="underline"';
          return `<text${attrs}>${escapeXml(p.text)}</text>`;
        }
      }
    })
    .join('');
}
