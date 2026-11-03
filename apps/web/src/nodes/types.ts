import { type Element, type UmlDetail } from '@chartsia/core/model';
import { type Node } from '@xyflow/react';

/** `uml` es el detalle UML del diagrama; sin él se muestra todo. */
export type ElementNodeData = { element: Element; uml?: UmlDetail };
export type ElementFlowNode = Node<ElementNodeData>;
