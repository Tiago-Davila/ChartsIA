import { type DiagramStyle, type Element } from '@chartsia/core/model';
import { type Node } from '@xyflow/react';

export type ElementNodeData = { element: Element; style: DiagramStyle };
export type ElementFlowNode = Node<ElementNodeData>;
