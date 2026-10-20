import { type Attribute, type Element, type ElementChanges, type Method } from '@chartsia/core/model';

const VISIBILITY = /^\s*([+\-#~])?\s*/;

/** "- isbn: String = x" → atributo. Conserva `static` del original. */
export function parseAttribute(text: string, previous?: Attribute): Attribute | undefined {
  const vis = VISIBILITY.exec(text)![1] as Attribute['visibility'] | undefined;
  const rest = text.replace(VISIBILITY, '');
  const match = /^([^:=]+?)\s*(?::\s*([^=]+?))?\s*(?:=\s*(.+))?$/.exec(rest);
  if (!match?.[1]) return undefined;
  return {
    name: match[1].trim(),
    visibility: vis ?? previous?.visibility ?? '+',
    ...(match[2] ? { type: match[2].trim() } : {}),
    ...(match[3] ? { defaultValue: match[3].trim() } : {}),
    ...(previous?.static ? { static: true } : {}),
  };
}

/** "+ pagar(monto: Decimal, x): void" → operación. Conserva `static`/`abstract`. */
export function parseMethod(text: string, previous?: Method): Method | undefined {
  const vis = VISIBILITY.exec(text)![1] as Method['visibility'] | undefined;
  const rest = text.replace(VISIBILITY, '');
  const match = /^([^(]+?)\s*\(([^)]*)\)\s*(?::\s*(.+))?$/.exec(rest);
  if (!match?.[1]) return undefined;
  const parameters = match[2]!
    .split(',')
    .map((p) => p.trim())
    .filter(Boolean)
    .map((p) => {
      const [name, type] = p.split(':').map((s) => s.trim());
      return type ? { name: name!, type } : { name: name! };
    });
  return {
    name: match[1].trim(),
    parameters,
    visibility: vis ?? previous?.visibility ?? '+',
    ...(match[3] ? { returnType: match[3].trim() } : {}),
    ...(previous?.static ? { static: true } : {}),
    ...(previous?.abstract ? { abstract: true } : {}),
  };
}

/** Valor editable de un slot (la descripción completa, no solo la línea visible). */
export function slotValue(element: Element, slot: string, shown: string): string {
  if (slot === 'description' && 'description' in element && element.description) return element.description;
  if (slot === 'stereotype') return shown.replace(/^«|»$/g, '');
  if (slot === 'type' && 'technology' in element) return element.technology ?? '';
  return shown;
}

/**
 * Traduce la edición en línea de un slot a los `changes` de `update_element`, o `undefined`
 * si el texto no es válido para ese slot.
 */
export function changesForSlot(element: Element, slot: string, value: string): ElementChanges | undefined {
  const [kind, indexText] = slot.split(':');
  const index = Number(indexText);
  switch (kind) {
    case 'name':
      return { name: value };
    case 'description':
      return { description: value };
    case 'stereotype':
      return { stereotype: value.replace(/^«|»$/g, '') };
    case 'type':
      return 'technology' in element || element.kind === 'container' || element.kind === 'component' ? { technology: value } : undefined;
    case 'attribute': {
      if (!('attributes' in element) || !element.attributes) return undefined;
      const parsed = parseAttribute(value, element.attributes[index]);
      if (!parsed) return undefined;
      return { attributes: element.attributes.map((a, i) => (i === index ? parsed : a)) };
    }
    case 'operation': {
      if (!('operations' in element)) return undefined;
      const parsed = parseMethod(value, element.operations[index]);
      if (!parsed) return undefined;
      return { operations: element.operations.map((m, i) => (i === index ? parsed : m)) };
    }
    case 'literal':
      if (element.kind !== 'enum') return undefined;
      return { literals: element.literals.map((l, i) => (i === index ? value : l)) };
    default:
      return undefined;
  }
}
