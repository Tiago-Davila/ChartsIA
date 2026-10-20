import { type z } from 'zod';
import { type ToolSuccess } from '../tool-result.js';

export interface ToolAnnotations {
  title: string;
  readOnlyHint: boolean;
  destructiveHint: boolean;
  idempotentHint: boolean;
  openWorldHint: boolean;
}

export interface ToolDefinition<I extends z.ZodType = z.ZodType> {
  name: string;
  description: string;
  input: I;
  output: z.ZodType;
  annotations: ToolAnnotations;
  run(args: z.infer<I>): Promise<ToolSuccess>;
}

export function defineTool<I extends z.ZodType>(tool: ToolDefinition<I>): ToolDefinition {
  return tool as unknown as ToolDefinition;
}
