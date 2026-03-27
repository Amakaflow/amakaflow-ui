import { describe, it, expect } from 'vitest';
import { validateAgainstSchema } from '../schemaValidator';
import { WorkoutStructureSchema } from '../../../../api/schemas/ingestor';
import { ValidationResponseSchema } from '../../../../api/schemas/mapper';

describe('validateAgainstSchema', () => {
  it('returns passed:true for valid ingestor response', () => {
    const data = { title: 'Test', blocks: [] };
    const result = validateAgainstSchema(data, WorkoutStructureSchema);
    expect(result.passed).toBe(true);
    expect(result.errors).toBeUndefined();
  });

  it('returns passed:false with field errors for invalid data', () => {
    const data = { title: 123, blocks: 'not-an-array' };
    const result = validateAgainstSchema(data, WorkoutStructureSchema);
    expect(result.passed).toBe(false);
    expect(result.errors).toBeDefined();
    expect(result.errors!.length).toBeGreaterThan(0);
    expect(result.errors![0]).toHaveProperty('path');
    expect(result.errors![0]).toHaveProperty('message');
  });

  it('returns passed:true for valid mapper ValidationResponse', () => {
    const data = { success: true, matches: [], unmapped: [] };
    const result = validateAgainstSchema(data, ValidationResponseSchema);
    expect(result.passed).toBe(true);
  });

  it('returns passed:false with path for missing required field', () => {
    const data = { success: true };
    const result = validateAgainstSchema(data, ValidationResponseSchema);
    expect(result.passed).toBe(false);
    expect(result.errors!.some(e => e.path.includes('matches'))).toBe(true);
  });

  it('handles undefined input gracefully', () => {
    const result = validateAgainstSchema(undefined, WorkoutStructureSchema);
    expect(result.passed).toBe(false);
    expect(result.errors).toBeDefined();
  });
});
