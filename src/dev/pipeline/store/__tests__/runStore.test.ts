import 'fake-indexeddb/auto';
import { saveRun, getRun, getAllRuns, deleteRun, applyEventToRun } from '../runStore';
import type { PipelineRun, StepEvent } from '../runTypes';

function makeRun(id: string, startedAt = Date.now()): PipelineRun {
  return {
    id,
    flowId: 'ingest-only',
    label: 'Test run',
    mode: 'auto',
    status: 'success',
    startedAt,
    inputs: {},
    steps: [],
  };
}

describe('runStore', () => {
  it('saves and retrieves a run', async () => {
    const run = makeRun('run-1');
    await saveRun(run);
    const retrieved = await getRun('run-1');
    expect(retrieved).toEqual(run);
  });

  it('getAllRuns returns newest first', async () => {
    await saveRun(makeRun('run-2', 1000));
    await saveRun(makeRun('run-3', 2000));
    const runs = await getAllRuns();
    // run-3 is newest, run-2 is older
    const ids = runs.map(r => r.id);
    expect(ids.indexOf('run-3')).toBeLessThan(ids.indexOf('run-2'));
  });

  it('deleteRun removes a run', async () => {
    await saveRun(makeRun('run-delete'));
    await deleteRun('run-delete');
    const retrieved = await getRun('run-delete');
    expect(retrieved).toBeUndefined();
  });

  describe('applyEventToRun', () => {
    const base = makeRun('run-apply');

    it('step:started adds a step', () => {
      const event: StepEvent = {
        type: 'step:started',
        runId: 'run-apply',
        stepId: 'step-1',
        service: 'ingestor',
        label: 'Ingest',
      };
      const updated = applyEventToRun(base, event);
      expect(updated.steps).toHaveLength(1);
      expect(updated.steps[0].id).toBe('step-1');
      expect(updated.steps[0].status).toBe('running');
    });

    it('step:edited sets effectiveOutput and edited flag', () => {
      const withStep: PipelineRun = {
        ...base,
        steps: [{
          id: 'step-1',
          service: 'ingestor',
          label: 'Ingest',
          status: 'success',
          edited: false,
        }],
      };
      const event: StepEvent = {
        type: 'step:edited',
        runId: 'run-apply',
        stepId: 'step-1',
        effectiveOutput: { title: 'Edited' },
      };
      const updated = applyEventToRun(withStep, event);
      expect(updated.steps[0].edited).toBe(true);
      expect(updated.steps[0].effectiveOutput).toEqual({ title: 'Edited' });
    });

    it('run:completed sets status and completedAt', () => {
      const event: StepEvent = {
        type: 'run:completed',
        runId: 'run-apply',
        status: 'success',
      };
      const updated = applyEventToRun(base, event);
      expect(updated.status).toBe('success');
      expect(updated.completedAt).toBeDefined();
    });
  });
});
