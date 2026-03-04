import { describe, it, expect, vi, beforeEach } from 'vitest';
import { runPipeline } from '../pipelineRunner';
import type { StepEvent } from '../../store/runTypes';
import * as executors from '../stepExecutors';

vi.mock('../stepExecutors', () => ({
  executeIngest: vi.fn(),
  executeMap: vi.fn(),
  executeHealthCheck: vi.fn(),
  extractExerciseNames: vi.fn(),
}));

async function collectEvents(gen: AsyncGenerator<StepEvent>): Promise<StepEvent[]> {
  const events: StepEvent[] = [];
  for await (const event of gen) {
    events.push(event);
  }
  return events;
}

const mockExecuteIngest = vi.mocked(executors.executeIngest);
const mockExecuteMap = vi.mocked(executors.executeMap);
const mockExecuteHealthCheck = vi.mocked(executors.executeHealthCheck);
const mockExtractExerciseNames = vi.mocked(executors.extractExerciseNames);

describe('runPipeline', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockExecuteIngest.mockResolvedValue({
      request: { url: 'http://localhost:8004/ingest/ai_workout', method: 'POST', headers: {}, body: 'bench press' },
      response: { status: 200, body: { title: 'Test', blocks: [{ label: 'B', exercises: [{ name: 'bench press' }] }] } },
      schemaValidation: { passed: true },
      apiOutput: { title: 'Test', blocks: [{ label: 'B', exercises: [{ name: 'bench press' }] }] },
    });
    mockExecuteMap.mockResolvedValue({
      request: { url: 'http://localhost:8001/validate', method: 'POST', headers: {}, body: {} },
      response: { status: 200, body: { success: true, matches: [], unmapped: [] } },
      schemaValidation: { passed: true },
      apiOutput: { success: true, matches: [], unmapped: [] },
    });
    mockExecuteHealthCheck.mockResolvedValue({
      request: { url: 'http://localhost:8004/health', method: 'GET', headers: {}, body: undefined },
      response: { status: 200, body: { status: 'ok' } },
      apiOutput: { status: 'ok' },
    });
    mockExtractExerciseNames.mockReturnValue(['bench press']);
  });

  it('yields run:started and run:completed for ingest-only flow', async () => {
    const events = await collectEvents(
      runPipeline({ flowId: 'ingest-only', inputs: { workoutText: 'bench press 3x10' }, mode: 'auto' })
    );
    expect(events[0].type).toBe('run:started');
    expect(events.at(-1)!.type).toBe('run:completed');
  });

  it('yields step:started and step:completed for ingest-only', async () => {
    const events = await collectEvents(
      runPipeline({ flowId: 'ingest-only', inputs: { workoutText: 'bench press' }, mode: 'auto' })
    );
    const started = events.filter(e => e.type === 'step:started');
    const completed = events.filter(e => e.type === 'step:completed');
    expect(started.length).toBe(1);
    expect(completed.length).toBe(1);
  });

  it('yields step:failed when executor returns an error', async () => {
    mockExecuteIngest.mockResolvedValueOnce({
      request: { url: 'x', method: 'POST', headers: {}, body: '' },
      response: undefined,
      apiOutput: undefined,
      error: 'Network error',
    });
    const events = await collectEvents(
      runPipeline({ flowId: 'ingest-only', inputs: { workoutText: 'bench press' }, mode: 'auto' })
    );
    const failed = events.find(e => e.type === 'step:failed');
    expect(failed).toBeDefined();
    expect((failed as Extract<StepEvent, { type: 'step:failed' }>).error).toBeDefined();
    const completed = events.at(-1)! as Extract<StepEvent, { type: 'run:completed' }>;
    expect(completed.type).toBe('run:completed');
    expect(completed.status).toBe('failed');
  });

  it('full-pipeline flow yields ingestor and mapper steps', async () => {
    const events = await collectEvents(
      runPipeline({ flowId: 'full-pipeline', inputs: { workoutText: 'bench press', exportTarget: 'garmin' }, mode: 'auto' })
    );
    const services = events
      .filter(e => e.type === 'step:started')
      .map(e => (e as Extract<StepEvent, { type: 'step:started' }>).service);
    expect(services).toContain('ingestor');
    expect(services).toContain('mapper');
    expect(events.at(-1)!.type).toBe('run:completed');
  });

  it('step-through mode yields step:paused and resumes', async () => {
    const onStepPaused = vi.fn().mockResolvedValue({ title: 'Test', blocks: [] });
    const events = await collectEvents(runPipeline({
      flowId: 'ingest-only',
      inputs: { workoutText: 'bench press 3x10' },
      mode: 'step-through',
      onStepPaused,
    }));
    const paused = events.find(e => e.type === 'step:paused');
    expect(paused).toBeDefined();
    expect(onStepPaused).toHaveBeenCalledOnce();
  });

  it('step-through mode yields step:edited when output changes', async () => {
    const original = { title: 'Original', blocks: [] };
    const edited = { title: 'Edited', blocks: [] };
    mockExecuteIngest.mockResolvedValue({
      request: { url: 'http://localhost:8004/ingest/ai_workout', method: 'POST', headers: {}, body: 'bench press 3x10' },
      response: { status: 200, body: original },
      schemaValidation: { passed: true },
      apiOutput: original,
    });
    const onStepPaused = vi.fn().mockResolvedValue(edited);
    const events = await collectEvents(runPipeline({
      flowId: 'ingest-only',
      inputs: { workoutText: 'bench press 3x10' },
      mode: 'step-through',
      onStepPaused,
    }));
    const editedEvent = events.find(e => e.type === 'step:edited');
    expect(editedEvent).toBeDefined();
  });

  it('health-check flow yields step:started for all 6 services', async () => {
    const events = await collectEvents(runPipeline({
      flowId: 'health-check',
      inputs: {},
      mode: 'auto',
    }));
    const stepStarts = events.filter(e => e.type === 'step:started');
    expect(stepStarts).toHaveLength(6);
  });

  it('full-pipeline stops at ingest failure and skips map', async () => {
    mockExecuteIngest.mockResolvedValue({ error: 'ingest failed', request: undefined, response: undefined, apiOutput: undefined });
    const events = await collectEvents(runPipeline({
      flowId: 'full-pipeline',
      inputs: { workoutText: 'bench press 3x10' },
      mode: 'auto',
    }));
    const failed = events.find(e => e.type === 'step:failed');
    const mapStarted = events.find(e => e.type === 'step:started' && (e as Extract<StepEvent, { type: 'step:started' }>).service === 'mapper');
    expect(failed).toBeDefined();
    expect(mapStarted).toBeUndefined();
    const completed = events.at(-1);
    expect(completed?.type).toBe('run:completed');
  });
});
