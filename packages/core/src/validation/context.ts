import { type DiagramContent, type Element } from '../model/diagram.js';
import { type Relation } from '../model/relation.js';
import { type ValidationError } from './errors.js';

export interface RuleOptions {
  maxElements?: number;
}

/** Índices precalculados que comparten las reglas. */
export interface RuleContext {
  diagram: DiagramContent;
  elementsById: Map<string, Element>;
  elementIndex: Map<string, number>;
  relationIds: Set<string>;
  options: RuleOptions;
}

export type Rule = (ctx: RuleContext) => ValidationError[];

export function buildContext(diagram: DiagramContent, options: RuleOptions = {}): RuleContext {
  const elementsById = new Map<string, Element>();
  const elementIndex = new Map<string, number>();
  diagram.elements.forEach((el, i) => {
    if (!elementsById.has(el.id)) {
      elementsById.set(el.id, el);
      elementIndex.set(el.id, i);
    }
  });
  const relationIds = new Set(diagram.relations.map((r: Relation) => r.id));
  return { diagram, elementsById, elementIndex, relationIds, options };
}
