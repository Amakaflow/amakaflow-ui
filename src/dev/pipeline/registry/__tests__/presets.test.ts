import { PRESETS, getPreset } from '../presets';
import { isParallelGroup } from '../../store/runTypes';
import { getStep } from '../stepRegistry';

test('garmin-full preset has 3 steps: ingest, map, export-garmin', () => {
  const p = getPreset('garmin-full');
  expect(p!.steps).toEqual(['ingest-youtube', 'map-exercises', 'export-garmin']);
});

test('everything preset has parallel group with 3 export steps', () => {
  const p = getPreset('everything');
  const parallel = p!.steps.find(isParallelGroup);
  expect(parallel).toBeDefined();
  const group = parallel as { type: 'parallel'; steps: string[] };
  expect(group.steps).toContain('export-garmin');
  expect(group.steps).toContain('export-apple');
  expect(group.steps).toContain('sync-strava');
});

test('apple-full preset skips map step', () => {
  const p = getPreset('apple-full');
  expect(p!.steps).not.toContain('map-exercises');
});

test('getPreset returns undefined for unknown id', () => {
  expect(getPreset('does-not-exist')).toBeUndefined();
});

test('all preset step IDs exist in step registry', () => {
  // Check that every string step ID in every preset exists in the registry
  for (const preset of PRESETS) {
    for (const step of preset.steps) {
      if (isParallelGroup(step)) {
        for (const id of step.steps) {
          expect(getStep(id), `Parallel step "${id}" in preset "${preset.id}" not in registry`).toBeDefined();
        }
      } else {
        expect(getStep(step), `Step "${step}" in preset "${preset.id}" not in registry`).toBeDefined();
      }
    }
  }
});
