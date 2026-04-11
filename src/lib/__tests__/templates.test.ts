import { describe, it, expect } from 'vitest';
import {
  templateCategoryLabels,
  workoutTemplates,
  getTemplatesByCategory,
  getWorkoutHistory,
} from '../templates';

describe('templateCategoryLabels', () => {
  it('has labels for all expected categories', () => {
    expect(templateCategoryLabels).toHaveProperty('strength');
    expect(templateCategoryLabels).toHaveProperty('cardio');
    expect(typeof templateCategoryLabels.strength).toBe('string');
  });
});

describe('workoutTemplates', () => {
  it('is a non-empty array', () => {
    expect(Array.isArray(workoutTemplates)).toBe(true);
    expect(workoutTemplates.length).toBeGreaterThan(0);
  });

  it('each template has required fields', () => {
    for (const template of workoutTemplates) {
      expect(template).toHaveProperty('title');
      expect(template).toHaveProperty('source');
      expect(template).toHaveProperty('blocks');
      expect(typeof template.title).toBe('string');
      expect(Array.isArray(template.blocks)).toBe(true);
    }
  });

  it('each template has a category', () => {
    for (const template of workoutTemplates) {
      expect(template).toHaveProperty('category');
      expect(typeof template.category).toBe('string');
    }
  });
});

describe('getTemplatesByCategory', () => {
  it('returns a Map', () => {
    const result = getTemplatesByCategory();
    expect(result).toBeInstanceOf(Map);
  });

  it('groups templates correctly', () => {
    const result = getTemplatesByCategory();
    let totalTemplates = 0;
    for (const [, templates] of result) {
      totalTemplates += templates.length;
    }
    expect(totalTemplates).toBe(workoutTemplates.length);
  });
});

describe('getWorkoutHistory', () => {
  it('returns an array', () => {
    const result = getWorkoutHistory();
    expect(Array.isArray(result)).toBe(true);
  });
});
