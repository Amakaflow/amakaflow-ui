import { describe, it, expect, beforeAll, afterAll, afterEach } from 'vitest';
import { setupServer } from 'msw/node';
import { http, HttpResponse } from 'msw';
import { runIngestionPipeline } from '../../../api/pipelines/ingestion';
import { PipelineError } from '../../../api/pipelines';
import { API_URLS } from '../../../lib/config';

const INGESTOR_RESPONSE = {
  title: 'Push Day',
  blocks: [
    {
      label: 'Main Block',
      structure: 'regular',
      exercises: [
        { name: 'bench press', sets: 3, reps: 10 },
        { name: 'overhead press', sets: 3, reps: 8 },
      ],
    },
  ],
};

const MAPPER_RESPONSE_OK = {
  success: true,
  matches: [
    { original_name: 'bench press', matched_name: 'Bench Press', confidence: 0.97, garmin_id: 'bench_press' },
    { original_name: 'overhead press', matched_name: 'Overhead Press', confidence: 0.94, garmin_id: 'overhead_press' },
  ],
  unmapped: [],
};

const MAPPER_RESPONSE_UNMAPPED = {
  success: false,
  matches: [],
  unmapped: ['bench press', 'overhead press'],
};

const server = setupServer();
beforeAll(() => server.listen({ onUnhandledRequest: 'error' }));
afterEach(() => server.resetHandlers());
afterAll(() => server.close());

function useIngestor(body = INGESTOR_RESPONSE) {
  server.use(http.post(`${API_URLS.INGESTOR}/ingest/ai_workout`, () => HttpResponse.json(body)));
}
function useMapper(body = MAPPER_RESPONSE_OK) {
  server.use(http.post(`${API_URLS.MAPPER}/validate`, () => HttpResponse.json(body)));
}

const TEST_SOURCES = [{ type: 'url', content: 'https://instagram.com/p/abc123' }];

describe('runIngestionPipeline', () => {
  it('returns workout and validation with correct structure on success', async () => {
    useIngestor();
    useMapper();
    const { workout, validation } = await runIngestionPipeline(TEST_SOURCES);
    expect(workout.title).toBe('Push Day');
    expect(workout.blocks).toHaveLength(1);
    expect(workout.blocks[0].label).toBe('Main Block');
    expect(workout.blocks[0].exercises).toHaveLength(2);
    expect(workout.blocks[0].exercises[0].name).toBe('bench press');
    expect(validation.unmapped).toHaveLength(0);
  });

  it('throws PipelineError when exercises are unmapped', async () => {
    useIngestor();
    useMapper(MAPPER_RESPONSE_UNMAPPED);
    await expect(runIngestionPipeline(TEST_SOURCES)).rejects.toThrow(PipelineError);
  });

  it('PipelineError has UnmappedExercises code and lists the exercises', async () => {
    useIngestor();
    useMapper(MAPPER_RESPONSE_UNMAPPED);
    const err = await runIngestionPipeline(TEST_SOURCES).catch((e) => e);
    expect(err.code).toBe('UnmappedExercises');
    expect(err.detail.unmapped).toEqual(['bench press', 'overhead press']);
  });

  it('throws PipelineError when ingestor returns 500', async () => {
    server.use(http.post(`${API_URLS.INGESTOR}/ingest/ai_workout`, () => HttpResponse.json({ detail: 'server error' }, { status: 500 })));
    await expect(runIngestionPipeline(TEST_SOURCES)).rejects.toThrow(PipelineError);
  });

  it('throws PipelineError with MapperFailed code when mapper returns 500', async () => {
    useIngestor();
    server.use(http.post(`${API_URLS.MAPPER}/validate`, () =>
      HttpResponse.json({ detail: 'mapper server error' }, { status: 500 })
    ));
    const err = await runIngestionPipeline(TEST_SOURCES).catch((e) => e);
    expect(err).toBeInstanceOf(PipelineError);
    expect(err.code).toBe('MapperFailed');
  });

  it('throws PipelineError when no sources are provided', async () => {
    const err = await runIngestionPipeline([]).catch((e) => e);
    expect(err).toBeInstanceOf(PipelineError);
    expect(err.code).toBe('IngestorFailed');
    expect(err.message).toContain('source');
  });
});
