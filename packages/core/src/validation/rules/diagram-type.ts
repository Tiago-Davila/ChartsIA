import { type DiagramType, UML_RELATION_KINDS, CONNECTOR_KIND, FLOW_RELATION_KIND, NOSQL_RELATION_KIND, type RelationKind } from '../../model/enums.js';
import { type DiagramContent } from '../../model/diagram.js';
import { buildContext } from '../context.js';
import { validationError, type ValidationError } from '../errors.js';
import { canRelate } from './relations.js';

/** Relaciones propias de cada tipo de diagrama; el conector libre se trata aparte. */
export const RELATIONS_BY_TYPE: Record<DiagramType, readonly RelationKind[]> = {
  class: UML_RELATION_KINDS,
  'c4-context': ['c4-rel'],
  'c4-container': ['c4-rel'],
  'c4-component': ['c4-rel'],
  er: ['er-rel', 'er-attr'],
  nosql: [NOSQL_RELATION_KIND],
  flow: [FLOW_RELATION_KIND],
};

/**
 * Revisa que las relaciones del diagrama correspondan a su tipo. Si se pasa `previous`, solo
 * mira las relaciones nuevas o cambiadas, para no bloquear diagramas que ya existían.
 */
export function checkRelationsByType(diagram: DiagramContent, previous?: DiagramContent): ValidationError[] {
  const allowed = RELATIONS_BY_TYPE[diagram.type];
  const { elementsById } = buildContext(diagram);
  const before = new Map((previous?.relations ?? []).map((r) => [r.id, r]));
  const errors: ValidationError[] = [];

  diagram.relations.forEach((rel, i) => {
    const old = before.get(rel.id);
    if (old && old.kind === rel.kind && old.source === rel.source && old.target === rel.target) return;
    const path = `/relations/${i}/kind`;
    const list = allowed.join(', ');

    if (rel.kind !== CONNECTOR_KIND) {
      if (!allowed.includes(rel.kind)) {
        errors.push(
          validationError(
            'RELATION_NOT_ALLOWED',
            path,
            `"${rel.id}": la relación ${rel.kind} no corresponde a un diagrama ${diagram.type}.`,
            `En un diagrama ${diagram.type} usa solo: ${list}. Elige la relación según el tipo de diagrama que pidió la persona.`,
          ),
        );
      }
      return;
    }

    // El conector libre no sirve para unir lo que ya tiene relación propia; las figuras sí pueden unirse con él.
    const source = elementsById.get(rel.source);
    const target = elementsById.get(rel.target);
    if (!source || !target || source.kind === 'figure' || target.kind === 'figure') return;
    const own = allowed.find((kind) => canRelate(kind, source.kind, target.kind));
    if (own) {
      errors.push(
        validationError(
          'RELATION_NOT_ALLOWED',
          path,
          `"${rel.id}": ${source.id} (${source.kind}) → ${target.id} (${target.kind}) no se une con connector en un diagrama ${diagram.type}.`,
          `Usa ${own} (relaciones del tipo ${diagram.type}: ${list}). connector es solo para figuras y uniones libres.`,
        ),
      );
    }
  });
  return errors;
}
