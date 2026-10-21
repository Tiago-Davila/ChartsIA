import { Injectable } from '@nestjs/common';
import { type Diagram, type DiagramType, type Project } from '@chartsia/core/model';

export type Origin = 'agent' | 'app';

export type DiagramEvent =
  | { name: 'diagram.created'; payload: { diagramId: string; title: string; type: DiagramType } }
  | { name: 'diagram.updated'; payload: { diagramId: string; revision: number; origin: Origin; diagram: Diagram } }
  | { name: 'projects.changed'; payload: { projects: Project[] } }
  | { name: 'active.changed'; payload: { diagramId: string } };

export type DiagramEventListener = (event: DiagramEvent) => void;

/** Bus de eventos de dominio en proceso; lo consumen el gateway en vivo y los tests. */
@Injectable()
export class DiagramEvents {
  private readonly listeners = new Set<DiagramEventListener>();

  subscribe(listener: DiagramEventListener): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  emit(event: DiagramEvent): void {
    for (const listener of this.listeners) {
      try {
        listener(event);
      } catch {
        // Un suscriptor que falla no debe impedir la escritura ni a los demás suscriptores.
      }
    }
  }
}
