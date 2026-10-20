import { type Element } from '@chartsia/core/model';
import { type Node } from '@xyflow/react';

export type ElementNodeData = { element: Element };
export type ElementFlowNode = Node<ElementNodeData>;
