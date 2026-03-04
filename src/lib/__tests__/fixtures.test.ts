/**
 * Schema drift detection tests.
 *
 * Each service fixture is parsed against its Zod schema. If the real API
 * changes its response shape and someone updates a fixture to match without
 * also updating the schema (or vice versa), this test will fail in CI.
 *
 * Run with: npx vitest run src/lib/__tests__/fixtures.test.ts
 */

import { describe, it, expect } from 'vitest';
import { WorkoutStructureSchema } from '../../api/schemas/ingestor';
import { ValidationResponseSchema } from '../../api/schemas/mapper';
import ingestorFixture from '../../api/fixtures/services/ingestor.json';
import mapperFixture from '../../api/fixtures/services/mapper.json';

describe('service fixtures conform to Zod schemas', () => {
  it('ingestor fixture matches WorkoutStructureSchema', () => {
    expect(() => WorkoutStructureSchema.parse(ingestorFixture)).not.toThrow();
  });

  it('mapper fixture matches ValidationResponseSchema', () => {
    expect(() => ValidationResponseSchema.parse(mapperFixture)).not.toThrow();
  });

  it('ingestor fixture has expected title and blocks', () => {
    const parsed = WorkoutStructureSchema.parse(ingestorFixture);
    expect(parsed.title).toBe('Push Day');
    expect(parsed.blocks).toHaveLength(1);
    expect(parsed.blocks[0].exercises).toHaveLength(2);
  });

  it('mapper fixture has all required fields', () => {
    const parsed = ValidationResponseSchema.parse(mapperFixture);
    expect(parsed.success).toBe(true);
    expect(parsed.matches).toHaveLength(1);
    expect(parsed.unmapped).toHaveLength(0);
    expect(parsed.matches[0].confidence).toBeLessThanOrEqual(1);
  });

  it('Zod schemas reject obviously wrong data', () => {
    expect(() => WorkoutStructureSchema.parse({ notATitle: true })).toThrow();
    expect(() => ValidationResponseSchema.parse({ success: 'yes' })).toThrow();
  });

  it('Zod schemas reject constraint violations (confidence out of bounds)', () => {
    expect(() =>
      ValidationResponseSchema.parse({
        success: true,
        matches: [{ original_name: 'x', matched_name: 'X', confidence: 1.5, garmin_id: null }],
        unmapped: [],
      })
    ).toThrow();
  });
});
