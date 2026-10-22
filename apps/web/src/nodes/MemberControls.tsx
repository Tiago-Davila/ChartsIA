import { type Element } from '@chartsia/core/model';
import { type Primitive } from '@chartsia/core/shapes';
import { MEMBER_LABELS, type MemberKind, changesForRemoveMember, memberKinds } from '../canvas/slot-edits';

type TextPrimitive = Extract<Primitive, { type: 'text' }>;

export interface MemberControlsProps {
  element: Element;
  /** Textos de la forma: de ahí salen la posición de cada miembro y su `slot`. */
  texts: TextPrimitive[];
  onAdd(kind: MemberKind): void;
  onRemove(slot: string): void;
}

/**
 * Botones "+" (agregar atributo, método o literal) bajo el nodo y "×" (quitar) junto a cada
 * miembro. Son HTML fuera del SVG de la forma: no aparecen en el SVG exportado.
 */
export function MemberControls({ element, texts, onAdd, onRemove }: MemberControlsProps) {
  const members = texts.filter((t) => t.slot && changesForRemoveMember(element, t.slot));
  return (
    <>
      <div className="member-add nodrag nopan">
        {memberKinds(element).map((kind) => (
          <button key={kind} type="button" className="member-add__button" aria-label={`Agregar ${MEMBER_LABELS[kind]}`} onClick={() => onAdd(kind)}>
            + {MEMBER_LABELS[kind]}
          </button>
        ))}
      </div>
      {members.map((t) => (
        <button
          key={t.slot}
          type="button"
          className="member-remove nodrag nopan"
          style={{ top: t.y - t.size * 0.35 - 8 }}
          aria-label={`Quitar ${t.text}`}
          onClick={() => onRemove(t.slot!)}
        >
          ×
        </button>
      ))}
    </>
  );
}
