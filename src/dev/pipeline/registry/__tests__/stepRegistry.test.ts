import { STEP_REGISTRY, getStep, getStepsByGroup } from '../stepRegistry';

test('registry contains ingest-youtube step', () => {
  const step = getStep('ingest-youtube');
  expect(step).toBeDefined();
  expect(step!.mcpTool).toBe('ingest_youtube');
  expect(step!.service).toBe('ingestor');
});

test('registry contains map-exercises step', () => {
  const step = getStep('map-exercises');
  expect(step!.mcpTool).toBe('map_exercises');
  expect(step!.canParallelize).toBe(false);
});

test('registry marks export steps as parallelizable', () => {
  expect(getStep('export-garmin')!.canParallelize).toBe(true);
  expect(getStep('export-apple')!.canParallelize).toBe(true);
  expect(getStep('sync-strava')!.canParallelize).toBe(true);
});

test('getStep returns undefined for unknown id', () => {
  expect(getStep('does-not-exist')).toBeUndefined();
});

test('all registry steps have required fields', () => {
  for (const step of Object.values(STEP_REGISTRY)) {
    expect(step.id).toBeTruthy();
    expect(step.label).toBeTruthy();
    expect(step.service).toBeTruthy();
    expect(step.mcpTool).toBeTruthy();
    expect(step.group).toBeTruthy();
  }
});

test('getStepsByGroup returns only steps of that group', () => {
  const ingestion = getStepsByGroup('ingestion');
  expect(ingestion.length).toBeGreaterThan(0);
  ingestion.forEach(s => expect(s.group).toBe('ingestion'));
});
