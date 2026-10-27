const NAMED_ENTITIES: Record<string, string> = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ' };

/** Decodifica las entidades HTML más comunes y las referencias numéricas dentro de una etiqueta. */
function decodeHtml(value: string): string {
  return value.replace(/&(#x[0-9a-fA-F]{1,6}|#[0-9]{1,7}|[a-z]{2,6});/g, (match, body: string) => {
    if (body[0] !== '#') return NAMED_ENTITIES[body] ?? match;
    const code = body[1] === 'x' ? parseInt(body.slice(2), 16) : parseInt(body.slice(1), 10);
    return code > 0x10ffff || (code >= 0xd800 && code <= 0xdfff) || code === 0 ? match : String.fromCodePoint(code);
  });
}

/** Texto plano de una etiqueta: con `html=1` quita las etiquetas y convierte los cortes de línea; si no, la deja tal cual. */
export function plainText(value: string, html: boolean): string {
  if (!html) return value;
  return decodeHtml(value.replace(/<br\s*\/?>/gi, '\n').replace(/<\/(div|p|li|h[1-6]|tr)>/gi, '\n').replace(/<[^>]*>/g, '')).replace(/\n+$/, '');
}

const TAG = /<(\/?)([a-zA-Z][a-zA-Z0-9]*)([^>]*)>/g;
const CAPTION = /color:\s*#52606d/i;

/** Traduce el HTML de una etiqueta draw.io al markdown liviano de los bloques de texto. */
export function htmlToMarkdown(html: string): string {
  const blocks: string[] = [];
  let para: string[] = [];
  let line = '';
  let caption: string | undefined;
  let captionOpen = false;
  let heading = 0;
  let list: { ordered: boolean; items: string[] } | undefined;
  let pre: string | undefined;
  let last = 0;

  const endLine = () => {
    const text = line.trim();
    line = '';
    if (!text) return;
    if (captionOpen) caption = text;
    else para.push(text);
  };
  const endPara = () => {
    endLine();
    if (caption !== undefined) para.unshift(caption);
    caption = undefined;
    if (para.length) blocks.push(para.join('\n'));
    para = [];
  };
  const text = (value: string) => {
    if (pre !== undefined) pre += decodeHtml(value);
    else line += decodeHtml(value).replace(/\s+/g, ' ');
  };

  for (const match of html.matchAll(TAG)) {
    text(html.slice(last, match.index));
    last = match.index + match[0].length;
    const closing = match[1] === '/';
    const tag = match[2]!.toLowerCase();
    if (pre !== undefined) {
      if (closing && tag === 'pre') {
        blocks.push('```' + (caption ?? '') + '\n' + pre.replace(/\n$/, '') + '\n```');
        caption = undefined;
        pre = undefined;
      }
      continue;
    }
    if (/^h[1-6]$/.test(tag)) {
      if (closing) {
        blocks.push('#'.repeat(Math.min(heading, 3)) + ' ' + line.trim());
        line = '';
        heading = 0;
      } else {
        endPara();
        heading = Number(tag[1]);
      }
    } else if (tag === 'ul' || tag === 'ol') {
      if (closing) {
        if (list) blocks.push(list.items.map((item, i) => (list!.ordered ? i + 1 + '. ' : '- ') + item).join('\n'));
        list = undefined;
      } else {
        endPara();
        list = { ordered: tag === 'ol', items: [] };
      }
    } else if (tag === 'li' && closing) {
      list?.items.push(line.trim());
      line = '';
    } else if (tag === 'pre' && !closing) {
      if (para.length || line.trim()) {
        const kept = caption;
        caption = undefined;
        endPara();
        caption = kept;
      }
      pre = '';
    } else if (tag === 'div' || tag === 'p') {
      if (closing) {
        endLine();
        captionOpen = false;
      } else {
        endLine();
        captionOpen = CAPTION.test(match[3]!);
      }
    } else if (tag === 'br') {
      endLine();
    } else if (tag === 'b' || tag === 'strong') {
      line += '**';
    } else if (tag === 'i' || tag === 'em') {
      line += '*';
    }
  }
  text(html.slice(last));
  endPara();
  return blocks.join('\n\n');
}
