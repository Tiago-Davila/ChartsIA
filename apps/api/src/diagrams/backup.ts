import { z } from 'zod';
import { DiagramSchema, ProjectSchema } from '@chartsia/core/model';

export const BACKUP_FORMAT = 'chartsia-backup';

/** Archivo de respaldo: todos los proyectos y diagramas, cada diagrama con su proyecto. */
export const BackupSchema = z
  .strictObject({
    format: z.literal(BACKUP_FORMAT),
    version: z.literal(1),
    exportedAt: z.string(),
    projects: z.array(ProjectSchema),
    diagrams: z.array(z.strictObject({ projectId: z.string().optional(), diagram: DiagramSchema })),
  })
  .superRefine(({ projects, diagrams }, ctx) => {
    const projectIds = new Set<string>();
    projects.forEach((p, i) => {
      if (projectIds.has(p.id)) ctx.addIssue({ code: 'custom', path: ['projects', i, 'id'], message: `El proyecto "${p.id}" está repetido en el archivo.` });
      projectIds.add(p.id);
    });
    const diagramIds = new Set<string>();
    diagrams.forEach(({ diagram, projectId }, i) => {
      if (diagramIds.has(diagram.id)) ctx.addIssue({ code: 'custom', path: ['diagrams', i, 'diagram', 'id'], message: `El diagrama "${diagram.id}" está repetido en el archivo.` });
      diagramIds.add(diagram.id);
      if (projectId !== undefined && !projectIds.has(projectId)) {
        ctx.addIssue({ code: 'custom', path: ['diagrams', i, 'projectId'], message: `El proyecto "${projectId}" no está en el archivo.` });
      }
    });
  });
export type Backup = z.infer<typeof BackupSchema>;

/** Qué hacer con un diagrama del archivo cuyo id ya existe: reemplazar el actual o dejarlo como está. */
export const ConflictPolicySchema = z.enum(['replace', 'skip']);
export type ConflictPolicy = z.infer<typeof ConflictPolicySchema>;

export interface BackupImportResult {
  /** Diagramas nuevos. */
  imported: number;
  /** Diagramas existentes que se reemplazaron. */
  replaced: number;
  /** Diagramas con id repetido que se dejaron como estaban. */
  skipped: number;
  projectsCreated: number;
}
