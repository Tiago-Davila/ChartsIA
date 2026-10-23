import { CLASS_ELEMENT_KINDS, isGroupKind } from '../../model/enums.js';
import { type RuleContext } from '../context.js';
import { validationError, type ValidationError } from '../errors.js';

export function checkParents({ diagram, elementsById }: RuleContext): ValidationError[] {
  const errors: ValidationError[] = [];
  diagram.elements.forEach((el, i) => {
    const path = `/elements/${i}/parentId`;
    const invalid = (message: string, hint: string) =>
      errors.push(validationError('INVALID_PARENT', path, message, hint));

    if (el.kind === 'component') {
      let container = el.parentId ? elementsById.get(el.parentId) : undefined;
      const parentExists = Boolean(container);
      const visited = new Set<string>();
      while (container?.kind === 'frame' && !visited.has(container.id) && visited.size < elementsById.size) {
        visited.add(container.id);
        container = container.parentId ? elementsById.get(container.parentId) : undefined;
      }
      // La regla general de ciclos reporta esta cadena; no diagnosticarla también como
      // boundary inválido ni volver a recorrerla indefinidamente.
      if (container?.kind === 'frame' && visited.has(container.id)) {
        // PARENT_CYCLE se agrega luego en checkParentCycles.
      } else if ((!el.parentId || parentExists) && (!container || container.kind !== 'boundary' || container.boundaryType !== 'container')) {
        invalid(
          `El componente "${el.id}" debe estar dentro de un boundary de tipo "container".`,
          'Crea un elemento {"kind":"boundary","boundaryType":"container"} y pon su id en parentId, directamente o mediante un frame.',
        );
      }
    }

    if (el.parentId === undefined) return;
    const parent = elementsById.get(el.parentId);
    if (!parent || parent.id === el.id) return; // UNKNOWN_REFERENCE / PARENT_CYCLE lo reportan
    if (!isGroupKind(parent.kind)) {
      invalid(
        `"${el.id}" tiene como padre a "${parent.id}", que es un ${parent.kind} y no un grupo.`,
        'parentId solo puede apuntar a un package, boundary o frame.',
      );
    } else if (parent.kind === 'package' && el.kind !== 'figure' && el.kind !== 'drawing' && el.kind !== 'image' && el.kind !== 'text' && el.kind !== 'frame' && !(CLASS_ELEMENT_KINDS as readonly string[]).includes(el.kind)) {
      invalid(
        `Un package solo contiene elementos de clases, figuras, trazos, imágenes o marcos; "${el.id}" es ${el.kind}.`,
        'Mueve el elemento fuera del package o usa un boundary en diagramas C4.',
      );
    }
  });
  return errors;
}

export function checkParentCycles({ diagram, elementsById, elementIndex }: RuleContext): ValidationError[] {
  const errors: ValidationError[] = [];
  const reported = new Set<string>();
  for (const el of diagram.elements) {
    const chain: string[] = [];
    let current: string | undefined = el.id;
    while (current !== undefined && !chain.includes(current)) {
      chain.push(current);
      current = elementsById.get(current)?.parentId;
    }
    if (current === undefined) continue;
    const cycle = chain.slice(chain.indexOf(current));
    const key = [...cycle].sort().join('|');
    if (reported.has(key)) continue;
    reported.add(key);
    errors.push(
      validationError(
        'PARENT_CYCLE',
        `/elements/${elementIndex.get(current)}/parentId`,
        `Ciclo de anidamiento: ${[...cycle, current].join(' → ')}.`,
        'Un grupo no puede contenerse a sí mismo ni a sus ancestros; elimina uno de los parentId.',
      ),
    );
  }
  return errors;
}

export function checkInheritanceCycles({ diagram }: RuleContext): ValidationError[] {
  const parents = new Map<string, { target: string; index: number }[]>();
  diagram.relations.forEach((rel, index) => {
    if (rel.kind !== 'inheritance') return;
    const list = parents.get(rel.source) ?? [];
    list.push({ target: rel.target, index });
    parents.set(rel.source, list);
  });

  const errors: ValidationError[] = [];
  const state = new Map<string, 'visiting' | 'done'>();
  const stack: string[] = [];

  const visit = (node: string): void => {
    state.set(node, 'visiting');
    stack.push(node);
    for (const { target, index } of parents.get(node) ?? []) {
      const s = state.get(target);
      if (s === 'visiting') {
        const cycle = [...stack.slice(stack.indexOf(target)), target];
        errors.push(
          validationError(
            'INHERITANCE_CYCLE',
            `/relations/${index}`,
            `Ciclo de herencia: ${cycle.join(' → ')}.`,
            'La herencia debe formar una jerarquía sin ciclos; elimina o invierte una de estas relaciones.',
          ),
        );
      } else if (s === undefined) visit(target);
    }
    stack.pop();
    state.set(node, 'done');
  };
  for (const node of [...parents.keys()].sort()) if (!state.has(node)) visit(node);
  return errors;
}
