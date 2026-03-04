import { describe, it, expect } from 'vitest';
import { PipelineError } from '../../../api/pipelines';

describe('PipelineError', () => {
  it('is an instance of Error', () => {
    const err = new PipelineError('UnmappedExercises', {
      unmapped: ['bench press'],
      message: '1 exercise(s) could not be mapped: bench press',
    });
    expect(err).toBeInstanceOf(Error);
  });

  it('has the correct code and detail', () => {
    const err = new PipelineError('IngestorFailed', {
      message: 'Ingestor returned 500',
      status: 500,
    });
    expect(err.code).toBe('IngestorFailed');
    expect(err.detail.status).toBe(500);
  });

  it('message comes from detail.message', () => {
    const err = new PipelineError('UnmappedExercises', {
      message: 'bench press could not be mapped',
      unmapped: ['bench press'],
    });
    expect(err.message).toBe('bench press could not be mapped');
  });

  it('name is PipelineError', () => {
    const err = new PipelineError('ExportFailed', { message: 'export failed' });
    expect(err.name).toBe('PipelineError');
  });
});
