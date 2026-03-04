import { describe, it, expect, vi, beforeEach } from 'vitest';
import { runPipeline } from '../pipelineRunner';
import type { StepEvent } from '../../store/runTypes';
import * as executors from '../stepExecutors';

vi.mock('../stepExecutors', () => ({
  executeIngest: vi.fn().mockResolvedValue({
    request: { url: 'http://localhost:8004/ingest/ai_workout', method: 'POST', headers: {}, body: 'bench press' },
    response: { status: 200, body: { title: 'Test Workout', blocks: [{ label: 'Block 1', exercises: [{ name: 'bench press' }] }] } },
    schemaValidation: { passed: true },
    apiOutput: { title: 'Test Workout', blocks: [{ label: 'Block 1', exercises: [{ name: 'bench press' }] }] },
  }),
  executeMap: vi.fn().mockResolvedValue({
    request: { url: 'http://localhost:8001/validate', method: 'POST', headers: {}, body: {} },
    response: { status: 200, body: { success: true, matches: [{ original_name: 'bench press', matched_name: 'Bench Press', confidence: 0.99, garmin_id: '123' }], unmapped: [] } },
    schemaValidation: { passed: true },
    apiOutput: { success: true, matches: [], unmapped: [] },
  }),
  executeHealthCheck: vi.fn().mockResolvedValue({
    request: { url: 'http://localhost:8004/health', method: 'GET', headers: {}, body: undefined },
    response: { status: 200, body: { status: 'ok' } },
    apiOutput: { status: 'ok' },
  }),
  extractExerciseNames: vi.fn().mockReturnValue(['bench press']),
}));

async function collectEvents(gen: AsyncGenerator<StepEvent>): Promise<StepEvent[]> {
  const events: StepEvent[] = [];
  for await (const event of gen) {
    events.push(event);
  }
  return events;
}

describe('runPipeline', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(executors.executeIngest).mockResolvedValue({
      request: { url: 'http://localhost:8004/ingest/ai_workout', method: 'POST', headers: {}, body: 'bench press' },
      response: { status: 200, body: { title: 'Test', blocks: [{ label: 'B', exercises: [{ name: 'bench press' }] }] } },
      schemaValidation: { passed: true },
      apiOutput: { title: 'Test', blocks: [{ label: 'B', exercises: [{ name: 'bench press' }] }] },
    });
    vi.mocked(executors.executeMap).mockResolvedValue({
      request: { url: 'http://localhost:8001/validate', method: 'POST', headers: {}, body: {} },
      response: { status: 200, body: { success: true, matches: [], unmapped: [] } },
      schemaValidation: { passed: true },
      apiOutput: { success: true, matches: [], unmapped: [] },
    });
    vi.mocked(executors.executeHealthCheck).mockResolvedValue({
      request: { url: 'http://localhost:8004/health', method: 'GET', headers: {}, body: undefined },
      response: { status: 200, body: { status: 'ok' } },
      apiOutput: { status: 'ok' },
    });
    vi.mocked(executors.extractExerciseNames).mockReturnValue(['bench press']);
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
    vi.mocked(executors.executeIngest).mockResolvedValueOnce({
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
    expect(events.at(-1)!.type).toBe('run:completed');
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
});
