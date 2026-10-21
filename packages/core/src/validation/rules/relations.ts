import {
  ALLOWED_RELATIONS_BY_DIAGRAM,
  isGroupKind,
  MULTIPLICITY_RELATION_KINDS,
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
};

export function checkRelations({ diagram, elementsById }: RuleContext): ValidationError[] {
  const errors: ValidationError[] = [];
  const allowedKinds = ALLOWED_RELATIONS_BY_DIAGRAM[diagram.type];

  diagram.relations.forEach((rel, i) => {
    const base = `/relations/${i}`;
    const notAllowed = (message: string, hint: string) =>
      errors.push(validationError('RELATION_NOT_ALLOWED', `${base}/kind`, message, hint));

    if (!allowedKinds.includes(rel.kind)) {
      notAllowed(
        `La relación "${rel.id}" de tipo "${rel.kind}" no está permitida en "${diagram.type}".`,
        `En "${diagram.type}" usa: ${allowedKinds.join(', ')}.`,
      );
    } else {
      const source = elementsById.get(rel.source);
      const target = elementsById.get(rel.target);
      if (source && target) {
        const group = [source, target].find((e) => isGroupKind(e.kind));
        if (group) {
          notAllowed(
            `La relación "${rel.id}" conecta el grupo "${group.id}" (${group.kind}).`,
            'Las relaciones unen elementos, no grupos: conecta un elemento contenido en el grupo.',
          );
        } else {
          const rule = ENDPOINT_RULES[rel.kind];
          if (rule && !rule.pairs.some(([s, t]) => s === source.kind && t === target.kind)) {
            notAllowed(
              `"${rel.id}": ${source.id} (${source.kind}) → ${target.id} (${target.kind}) no es válido.`,
              `Regla: ${rule.text}.`,
            );
          }
        }
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
