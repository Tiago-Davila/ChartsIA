import { type NodeProps } from '@xyflow/react';
import { memo } from 'react';
import { ElementNode } from './ElementNode';
import { type ElementFlowNode } from './types';

/**
 * Grupo (`package` o `boundary`): nodo padre de un sub-flow de React Flow. Sus hijos se
 * colocan con posiciones relativas a él y se mueven con él.
 */
export const GroupNode = memo(function GroupNode(props: NodeProps<ElementFlowNode>) {
  return <ElementNode {...props} />;
});
