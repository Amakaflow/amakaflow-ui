import { isParallelGroup, type FlowDefinition, type FlowStep } from '../runTypes';

test('isParallelGroup identifies parallel group', () => {
  const group = { type: 'parallel' as const, steps: ['export-garmin', 'export-apple'] };
  expect(isParallelGroup(group)).toBe(true);
});

test('isParallelGroup rejects plain string', () => {
  expect(isParallelGroup('ingest')).toBe(false);
});

test('FlowDefinition accepts mixed step array', () => {
  const flow: FlowDefinition = {
    id: 'test-flow',
    label: 'Test',
    steps: ['ingest', 'map', { type: 'parallel', steps: ['export-garmin', 'export-apple'] }],
  };
  expect(flow.steps).toHaveLength(3);
});
