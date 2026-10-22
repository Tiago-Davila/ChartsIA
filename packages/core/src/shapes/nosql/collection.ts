import { type ElementOfKind } from '../../model/diagram.js';
import { type NoSqlField, NOSQL_FIELD_SCALAR_TYPES } from '../../model/nosql-elements.js';
import { paintOf, textFont } from '../style.js';
import { lineHeight, measureText } from '../text-metrics.js';
import { COLORS, FONT, type Primitive, type ShapeDefinition, type Size } from '../types.js';

type CollectionElement = ElementOfKind<'collection'>;
type FieldNode = { field: NoSqlField; children: FieldNode[] };

const PAD = 12;
const HEADER_PAD = 10;
const FIELD_GAP = 4;

function headerHeight(style: CollectionElement['style']): number {
  return lineHeight(textFont(style, FONT.name).size) + HEADER_PAD * 2;
}

function rowHeight(style: CollectionElement['style']): number {
  return lineHeight(textFont(style, FONT.member).size) + 10;
}

const SCALAR_TYPES: Record<(typeof NOSQL_FIELD_SCALAR_TYPES)[number], string> = {
  string: 'string',
  number: 'number',
  boolean: 'boolean',
  date: 'date',
  timestamp: 'timestamp',
  objectId: 'ObjectId',
  reference: 'reference',
  geopoint: 'GeoPoint',
  null: 'null',
};

function pathKey(path: string[]): string {
  return JSON.stringify(path);
}

function fieldName(field: NoSqlField): string {
  return field.path[field.path.length - 1]!;
}

function fieldType(field: NoSqlField): string {
  if (field.type === 'array') return `array<${field.itemsType === 'object' ? 'object' : SCALAR_TYPES[field.itemsType]}>`;
  return field.type === 'object' ? 'object' : SCALAR_TYPES[field.type];
}

function isContainer(field: NoSqlField): boolean {
  return field.type === 'object' || (field.type === 'array' && field.itemsType === 'object');
}

function tree(fields: NoSqlField[]): FieldNode[] {
  const nodes = fields.map((field) => ({ field, children: [] as FieldNode[] }));
  const byPath = new Map(nodes.map((node) => [pathKey(node.field.path), node]));
  const roots: FieldNode[] = [];
  for (const node of nodes) {
    const parent = node.field.path.length > 1 ? byPath.get(pathKey(node.field.path.slice(0, -1))) : undefined;
    if (parent) parent.children.push(node);
    else roots.push(node);
  }
  return roots;
}

function fieldLabel(node: FieldNode): string {
  return `${fieldName(node.field)}: ${fieldType(node.field)}`;
}

function measureField(node: FieldNode, style: CollectionElement['style']): Size {
  const font = textFont(style, FONT.member);
  const labelWidth = measureText(fieldLabel(node), { ...font, bold: isContainer(node.field) }) + PAD * 2;
  if (!isContainer(node.field)) return { width: labelWidth, height: rowHeight(style) };
  const content = measureFields(node.children, style);
  return {
    width: Math.max(labelWidth, content.width + PAD * 2),
    height: rowHeight(style) + PAD + content.height + PAD,
  };
}

function measureFields(nodes: FieldNode[], style: CollectionElement['style']): Size {
  if (nodes.length === 0) return { width: 0, height: 0 };
  const boxes = nodes.map((node) => measureField(node, style));
  return {
    width: Math.max(...boxes.map((box) => box.width)),
    height: boxes.reduce((sum, box) => sum + box.height, 0) + FIELD_GAP * (boxes.length - 1),
  };
}

/** Colección documental con subdocumentos y arrays de objetos representados por cajas anidadas. */
export const collectionShape: ShapeDefinition<CollectionElement> = {
  measure: (element) => {
    const font = textFont(element.style, FONT.name);
    const header = headerHeight(element.style);
    const fields = measureFields(tree(element.fields), element.style);
    return {
      width: Math.max(180, measureText(element.name, { ...font, bold: true }) + PAD * 2, fields.width + PAD * 2),
      height: header + PAD + fields.height + PAD,
    };
  },
  primitives: (element, { width, height }) => {
    const colors = paintOf(element.style, { fill: '#f8fafc', stroke: COLORS.stroke, text: COLORS.text });
    const headerFont = textFont(element.style, FONT.name);
    const fieldFont = textFont(element.style, FONT.member);
    const header = headerHeight(element.style);
    const row = rowHeight(element.style);
    const fields = tree(element.fields);
    const out: Primitive[] = [
      { type: 'rect', x: 0, y: 0, width, height, rx: 6, fill: colors.fill, stroke: colors.stroke, strokeWidth: 1.5 },
      { type: 'rect', x: 0, y: 0, width, height: header, rx: 6, fill: element.style?.fillColor ?? '#dbeafe', stroke: 'none' },
      { type: 'text', x: PAD, y: header / 2 + headerFont.size / 3, text: element.name, ...headerFont, bold: true, color: colors.text, anchor: 'start', slot: 'name' },
    ];
    const drawFields = (nodes: FieldNode[], x: number, y: number, availableWidth: number): number => {
      let cursor = y;
      for (const node of nodes) {
        const box = measureField(node, element.style);
        const boxWidth = Math.max(box.width, availableWidth);
        if (isContainer(node.field)) {
          out.push({ type: 'rect', x, y: cursor, width: boxWidth, height: box.height, rx: 4, fill: '#ffffff', stroke: colors.stroke, strokeWidth: 1 });
          out.push({
            type: 'text', x: x + PAD, y: cursor + row / 2 + fieldFont.size / 3,
            text: fieldLabel(node), ...fieldFont, bold: true, color: colors.text, anchor: 'start',
          });
          drawFields(node.children, x + PAD, cursor + row + PAD, Math.max(0, boxWidth - PAD * 2));
        } else {
          out.push({
            type: 'text', x: x + PAD, y: cursor + row / 2 + fieldFont.size / 3,
            text: fieldLabel(node), ...fieldFont, color: colors.text, anchor: 'start',
          });
        }
        cursor += box.height + FIELD_GAP;
      }
      return cursor;
    };
    drawFields(fields, PAD, header + PAD, Math.max(0, width - PAD * 2));
    return out;
  },
};
