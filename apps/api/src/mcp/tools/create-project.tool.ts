import { z } from 'zod';
import { ProjectSchema } from '@chartsia/core/model';
import { type DiagramCommandService } from '../../diagrams/diagram-command.service.js';
import { defineTool } from './tool-definition.js';

export const createProjectTool = (commands: DiagramCommandService) =>
  defineTool({
    name: 'create_project',
    annotations: { title: 'Crear proyecto', readOnlyHint: false, destructiveHint: false, idempotentHint: false, openWorldHint: false },
    description: [
      'Crea un proyecto vacío para agrupar diagramas en la barra lateral de la app y devuelve su id.',
      'Úsalo solo si la persona pide organizar diagramas en un proyecto; después usa move_diagram o projectId en create_diagram.',
      'Ejemplo de entrada: {"name":"Tienda en línea"}',
    ].join('\n'),
    input: z.strictObject({ name: ProjectSchema.shape.name }),
    output: z.strictObject({ projectId: z.string(), name: z.string() }),
    run: async ({ name }) => {
      const project = await commands.createProject(name);
      return { summary: `Proyecto "${project.name}" creado con id ${project.id}.`, structured: { projectId: project.id, name: project.name } };
    },
  });
