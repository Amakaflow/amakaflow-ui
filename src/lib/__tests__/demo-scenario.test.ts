import { describe, it, expect, beforeEach } from 'vitest';
import { getImportScenario, setImportScenario, IMPORT_SCENARIO_LABELS } from '../demo-scenario';

describe('demo-scenario', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('defaults to ppl-program', () => {
    expect(getImportScenario()).toBe('ppl-program');
  });

  it('setImportScenario changes current scenario', () => {
    setImportScenario('messy-csv');
    expect(getImportScenario()).toBe('messy-csv');
  });

  it('persists to localStorage', () => {
    setImportScenario('large-program');
    expect(localStorage.getItem('amakaflow-demo-import-scenario')).toBe('large-program');
  });

  it('IMPORT_SCENARIO_LABELS has all scenarios', () => {
    expect(Object.keys(IMPORT_SCENARIO_LABELS)).toHaveLength(4);
    expect(IMPORT_SCENARIO_LABELS['ppl-program']).toContain('PPL');
    expect(IMPORT_SCENARIO_LABELS['messy-csv']).toContain('CSV');
  });
});
