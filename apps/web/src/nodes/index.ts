import { type ElementKind } from '@chartsia/core/model';
import { type NodeTypes } from '@xyflow/react';
import { C4ComponentNode } from './c4/C4ComponentNode';
import { C4ContainerNode } from './c4/C4ContainerNode';
import { C4PersonNode } from './c4/C4PersonNode';
import { C4SystemNode } from './c4/C4SystemNode';
import { ErAttributeNode } from './er/ErAttributeNode';
import { ErEntityNode } from './er/ErEntityNode';
import { ErTableNode } from './er/ErTableNode';
import { ElementNode } from './ElementNode';
import { ErValueListNode } from './er/ErValueListNode';
import { GroupNode } from './GroupNode';
import { UmlClassNode } from './uml/UmlClassNode';
import { UmlEnumNode } from './uml/UmlEnumNode';
import { UmlInterfaceNode } from './uml/UmlInterfaceNode';

/** Tipo de nodo de React Flow por `kind`: la clave es el propio `kind` del modelo. */
export const nodeTypes = {
  class: UmlClassNode,
  interface: UmlInterfaceNode,
  enum: UmlEnumNode,
  package: GroupNode,
  person: C4PersonNode,
  'software-system': C4SystemNode,
  container: C4ContainerNode,
  component: C4ComponentNode,
  boundary: GroupNode,
  entity: ErEntityNode,
  table: ErTableNode,
  figure: ElementNode,
  drawing: ElementNode,
  image: ElementNode,
  frame: GroupNode,
  attribute: ErAttributeNode,
  'value-list': ErValueListNode,
} satisfies Record<ElementKind, NodeTypes[string]> as NodeTypes;

export type { ElementFlowNode, ElementNodeData } from './types';
