import { z } from 'zod';

export const PROJECT_ID_PATTERN = /^pr_[a-z2-7]{12}$/;

export const ProjectSchema = z.strictObject({
  id: z.string().regex(PROJECT_ID_PATTERN),
  name: z.string().trim().min(1).max(100),
  createdAt: z.string(),
});

export type Project = z.infer<typeof ProjectSchema>;
