import { type Element } from '../model/diagram.js';
import { type Run, parseMarkdown } from '../shapes/text/markdown.js';
import { highlight } from '../shapes/text/highlight.js';
import { CODE_FILL, CODE_STROKE, TOKEN_COLORS } from '../shapes/general/text-block.js';
import { FONT } from '../shapes/types.js';
import { type DrawioCell } from './drawio.js';
import { drawioBox, drawioFont } from './drawio-style.js';
import { escapeXml } from './xml-escape.js';

/** Tramo como HTML de draw.io: la negrita y la cursiva se traducen a sus etiquetas. */
function runHtml(run: Run): string {
  let html = escapeXml(run.text);
  if (run.italic) html = `<i>${html}</i>`;
  if (run.bold) html = `<b>${html}</b>`;
  return html;
}

/** Bloque de código: su lenguaje y su texto resaltado en un `<pre>` con el mismo recuadro gris. */
function codeHtml(language: string, code: string): string {
  const lines = highlight(code, language).map((tokens) =>
    tokens
      .map((token) => {
        const text = escapeXml(token.text);
        const color = TOKEN_COLORS[token.kind];
        const styled = color ? `<span style="color:${color};">${text}</span>` : text;
        return token.kind === 'comment' ? `<i>${styled}</i>` : styled;
      })
      .join(''),
  );
  const caption = language ? `<div style="font-size:${FONT.small}px;color:#52606d;">${escapeXml(language)}</div>` : '';
  return `${caption}<pre style="background-color:${CODE_FILL};border:1px solid ${CODE_STROKE};border-radius:4px;padding:10px;font-family:Courier New;">${lines.join('\n')}</pre>`;
}

/** Markdown liviano como HTML de una etiqueta draw.io; las listas y los títulos usan sus etiquetas nativas. */
export function textBlockHtml(markdown: string): string {
  return parseMarkdown(markdown)
    .map((block) => {
      if (block.type === 'heading') return `<h${block.level}>${block.runs.map(runHtml).join('')}</h${block.level}>`;
      if (block.type === 'paragraph') return block.lines.map((runs) => `<div>${runs.map(runHtml).join('')}</div>`).join('');
      if (block.type === 'list') {
        const tag = block.ordered ? 'ol' : 'ul';
        return `<${tag}>${block.items.map((runs) => `<li>${runs.map(runHtml).join('')}</li>`).join('')}</${tag}>`;
      }
      return codeHtml(block.language, block.code);
    })
    .join('');
}

/** Bloque de texto como una celda draw.io con etiqueta HTML; su tamaño es el del núcleo. */
export function textBlockCells(el: Element, parent: string, geo: { x: number; y: number; width: number; height: number }): DrawioCell[] | undefined {
  if (el.kind !== 'text') return undefined;
  const base = 'text;html=1;whiteSpace=wrap;align=left;verticalAlign=top;strokeColor=none;fillColor=none;';
  return [{ id: el.id, parent, value: textBlockHtml(el.name), vertex: true, geometry: geo, style: drawioFont(drawioBox(base, el.style), el.style, FONT.name) }];
}
