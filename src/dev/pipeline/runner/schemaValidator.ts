import { z } from 'zod';
import type { SchemaValidationResult } from '../store/runTypes';

export function validateAgainstSchema(
  data: unknown,
  schema: z.ZodTypeAny
): SchemaValidationResult {
  const result = schema.safeParse(data);
  if (result.success) {
    return { passed: true };
  }
  return {
    passed: false,
    errors: result.error.issues.map(issue => ({
      path: issue.path.join('.') || '(root)',
      message: issue.message,
    })),
  };
}
