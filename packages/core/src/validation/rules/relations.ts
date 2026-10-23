import {
  CONNECTOR_KIND,
  type ElementKind,
  isGroupKind,
  MULTIPLICITY_RELATION_KINDS,
  RELATION_ENDPOINT_KINDS,
  type RelationKind,
} from '../../model/enums.js';
import { type Relation } from '../../model/relation.js';
import { type RuleContext } from '../context.js';
import { validationError, type ValidationError } from '../errors.js';

const ENDPOINT_RULES: Partial<Record<Relation['kind'], { pairs: [string, string][]; text: string }>> = {
  inheritance: {
    pairs: [
      ['class', 'class'],
      ['interface', 'interface'],
    ],
    text: 'inheritance solo une class→class o interface→interface',
  },
  realization: { pairs: [['class', 'interface']], text: 'realization solo une class→interface' },
  'er-rel': {
    pairs: [
      ['entity', 'entity'],
      ['entity', 'table'],
      ['table', 'entity'],
      ['table', 'table'],
    ],
    text: 'er-rel solo une entities o tables; los atributos y listas se unen con er-attr',
  },
  'er-attr': {
    pairs: [
      ['entity', 'attribute'],
      ['attribute', 'attribute'],
      ['attribute', 'value-list'],
    ],
    text: 'er-attr va del dueño al elemento que cuelga de él: entity→attribute, attribute→attribute (compuesto) o attribute→value-list',
  },
  'nosql-rel': {
    pairs: [['collection', 'collection']],
    text: 'nosql-rel solo une colecciones',
  },
};

/** Si una relación del tipo dado puede unir un elemento de kind `source` con uno de kind `target`. */
export function canRelate(kind: RelationKind, source: ElementKind, target: ElementKind): boolean {
  if (kind === CONNECTOR_KIND) return true;
  const family = RELATION_ENDPOINT_KINDS[kind];
  if (family && !(family.includes(source) && family.includes(target))) return false;
  const rule = ENDPOINT_RULES[kind];
  return !rule || rule.pairs.some(([s, t]) => s === source && t === target);
}

/** Qué une cada tipo de relación, para explicar el error de extremos. */
function endpointHint(kind: RelationKind): string {
  const rule = ENDPOINT_RULES[kind];
  if (rule) return `Regla: ${rule.text}.`;
  const family = RELATION_ENDPOINT_KINDS[kind] ?? [];
  return `${kind} solo une elementos de: ${family.join(', ')}. Para unir familias distintas usa connector.`;
}

export function checkRelations({ diagram, elementsById }: RuleContext): ValidationError[] {
  const errors: ValidationError[] = [];

  diagram.relations.forEach((rel, i) => {
    const base = `/relations/${i}`;
    const notAllowed = (message: string, hint: string) =>
      errors.push(validationError('RELATION_NOT_ALLOWED', `${base}/kind`, message, hint));

    const source = elementsById.get(rel.source);
    const target = elementsById.get(rel.target);
    if (source && target) {
      const group = [source, target].find((e) => isGroupKind(e.kind));
      if (group) {
        notAllowed(
          `La relación "${rel.id}" conecta el grupo "${group.id}" (${group.kind}).`,
          'Las relaciones unen elementos, no grupos: conecta un elemento contenido en el grupo.',
        );
      } else if (!canRelate(rel.kind, source.kind, target.kind)) {
        notAllowed(
          `"${rel.id}": ${source.id} (${source.kind}) → ${target.id} (${target.kind}) no es válido para ${rel.kind}.`,
          endpointHint(rel.kind),
        );
      }
    }

    const field = (name: keyof Relation, why: string) => {
      if (rel[name] !== undefined) {
        errors.push(
          validationError(
            'FIELD_NOT_ALLOWED',
            `${base}/${name}`,
            `La relación "${rel.id}" (${rel.kind}) no admite "${name}".`,
            `Elimina "${name}": ${why}.`,
          ),
        );
      }
    };
    if (!(MULTIPLICITY_RELATION_KINDS as readonly string[]).includes(rel.kind)) {
      const why = 'las multiplicidades solo aplican a association, aggregation y composition';
      field('sourceMultiplicity', why);
      field('targetMultiplicity', why);
    }
    if (rel.kind !== 'connector') {
      const why = 'las puntas y el trazo discontinuo solo aplican a relaciones connector';
      field('arrowheads', why);
      field('dashed', why);
    }
    if (rel.kind !== 'er-rel' && rel.kind !== 'connector') {
      const why = 'la participación total solo aplica a er-rel y connector';
      field('sourceTotal', why);
      field('targetTotal', why);
    }
    if (rel.kind !== 'association') field('navigable', 'navigable solo aplica a association');
    if (rel.kind !== 'c4-rel') field('technology', 'technology solo aplica a relaciones c4-rel');
    if (rel.kind === 'er-rel') {
      for (const name of ['sourceCardinality', 'targetCardinality'] as const) {
        if (rel[name] === undefined) {
          errors.push(
            validationError(
              'FIELD_REQUIRED',
              `${base}/${name}`,
              `La relación "${rel.id}" (er-rel) necesita "${name}".`,
              `Agrega "${name}": one, zero-one, one-many o zero-many.`,
            ),
          );
        }
      }
    } else {
      const why = 'la cardinalidad y identifying solo aplican a relaciones er-rel';
      field('sourceCardinality', why);
      field('targetCardinality', why);
      field('identifying', why);
    }
  });
  return errors;
}
